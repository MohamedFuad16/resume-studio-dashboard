// Metal shaders backing the app's motion. Each is reachable from SwiftUI through
// ShaderLibrary (see ShaderEffects.swift).
//
// SwiftUI shader ABI:
//   [[stitchable]] half4 name(float2 position, half4 currentColor, <args...>)
// for .colorEffect;  float2 for .distortionEffect;  and a SwiftUI::Layer parameter
// for .layerEffect. Argument order must match the Swift call site exactly.
#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>

using namespace metal;

// ── Helpers ──────────────────────────────────────────────────────────────

// Cheap hash → [0,1). Good enough for grain; no texture fetch needed.
static inline float hash21(float2 p) {
    p = fract(p * float2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

// Value noise with smooth (hermite) interpolation.
static inline float valueNoise(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + float2(1.0, 0.0));
    float c = hash21(i + float2(0.0, 1.0));
    float d = hash21(i + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Two octaves is plenty at this scale and keeps the fragment cost trivial.
static inline float fbm(float2 p) {
    return valueNoise(p) * 0.6 + valueNoise(p * 2.03) * 0.3;
}

// ── auroraCanvas ─────────────────────────────────────────────────────────
// The app's background: slow, low-amplitude teal/blue drifts over the canvas
// color so the ground breathes instead of sitting flat, plus a whisper of grain
// (flat #F4F7F6 across a 6.3" OLED bands visibly; ±1.5/255 of noise breaks it).
//
// Grain is folded in here rather than chained as a second `.colorEffect`: SwiftUI
// runs only the outermost effect in a chain, so the first one silently does
// nothing. One pass, one shader, no ambiguity.
[[stitchable]] half4 auroraCanvas(float2 position, half4 currentColor,
                                  float2 size, float time, float grain) {
    float2 uv = position / max(size.x, 1.0);

    // Two counter-drifting noise fields; the offsets are prime-ish so they never
    // visibly resynchronise.
    float n1 = fbm(uv * 1.7 + float2(time * 0.021, time * -0.017));
    float n2 = fbm(uv * 2.3 + float2(time * -0.013, time * 0.019) + 4.7);

    half3 base = currentColor.rgb;
    half3 teal = half3(0.051, 0.580, 0.533);   // teal-600
    half3 blue = half3(0.231, 0.510, 0.965);   // blue-500

    // Vertical falloff: strongest at the top, gone by mid-screen, so content sits
    // on clean ground.
    float fade = smoothstep(0.85, 0.0, position.y / max(size.y, 1.0));

    // Amplitudes are tuned by eye against the panel, not guessed: below ~0.06 the
    // drift lands under 2/255 and is invisible; above ~0.15 it starts reading as a
    // gradient hero, which this design is not.
    half3 c = base;
    c = mix(c, teal, half(n1 * 0.105 * fade));
    c = mix(c, blue, half(n2 * 0.070 * fade));

    float g = hash21(position + fract(time) * 91.7) - 0.5;
    c += half3(g * grain);

    return half4(c, currentColor.a);
}

// ── shimmer ──────────────────────────────────────────────────────────────
// Loading skeletons. A diagonal band travelling left→right; `progress` is driven
// from SwiftUI so timing lives with the animation, not the GPU clock.
[[stitchable]] half4 shimmer(float2 position, half4 currentColor,
                             float2 size, float progress) {
    float travel = (position.x + position.y * 0.35) / max(size.x * 1.35, 1.0);
    float band = smoothstep(0.22, 0.0, abs(travel - progress));
    return half4(currentColor.rgb + half3(band * 0.55) * currentColor.a,
                 currentColor.a);
}

// ── bubbleField ──────────────────────────────────────────────────────────
// The Companies view, built the way Wabi's splash is: not N separate circle views
// but ONE signed-distance field over the whole canvas, warped by a loupe.
//
// Why it has to be a field rather than per-view shaders: separate views cannot know
// about each other, so they can only ever overlap. Evaluating every bubble into one
// SDF and combining them with a polynomial smooth-minimum makes neighbours grow a
// meniscus and merge like real bubbles — that surface tension is the whole effect,
// and it is unreachable any other way.
//
// Cost is bounded by the canvas, not the company count: the field is one screen,
// and the loop is a handful of cheap flops per bubble per pixel.

/// Polynomial smooth minimum (iq). `k` is the blend radius in points: where two
/// bubbles come within k of each other, the surface bridges instead of creasing.
static inline float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / max(k, 1e-4), 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

/// Signed distance to the merged field, AND the local sphere radius.
///
/// The radius has to travel with the distance. Reconstructing a dome needs to know
/// how big the sphere under this pixel is: with a fixed shoulder instead, every
/// bubble becomes a flat disc with a constant-width refracting ring around it —
/// which is exactly what reads as "a weird border on the edges".
///
/// Returns (distance, radius). `bubbles` is packed (x, y, radius) triples.
static inline float2 fieldSDF(float2 p, device const float *bubbles, int count,
                              float blend, float time) {
    float d = 1e9;
    float rr = 30.0;
    for (int i = 0; i + 2 < count; i += 3) {
        // Each bubble drifts on its own phase, so the field breathes and the
        // bridges between neighbours stretch and thin as they move.
        float phase = float(i) * 0.37;
        float2 c = float2(bubbles[i], bubbles[i + 1]);
        c.x += sin(time * 0.31 + phase) * 2.5;
        c.y += cos(time * 0.27 + phase * 1.3) * 3.0;
        float r = bubbles[i + 2];
        float di = length(p - c) - r;

        // Smooth union, with the radius blended by the same weight so the dome
        // stays continuous across a merge.
        float h = clamp(0.5 + 0.5 * (di - d) / max(blend, 1e-4), 0.0, 1.0);
        d = mix(di, d, h) - blend * h * (1.0 - h);
        rr = mix(r, rr, h);
    }
    return float2(d, rr);
}

// Shared bubble shading, matched to the Wabi reference by eye and by the physics
// it photographs (lensball + soap film):
//   • contents get MILD centre magnification — the picture is laminated inside the
//     sphere and stays legible, not crushed into the rim by hard Snell bending;
//   • the rim is BRIGHT, in two lobes (key light + the caustic opposite it) —
//     light wraps a bubble's silhouette; darkness there reads as a border;
//   • a whisper of thin-film iridescence rides the rim;
//   • one broad sheen (curved + glossy) and one tight hotspot (hard surface);
//   • a breath of white haze, because glass sits between you and the contents.
static inline half4 shadeBubble(half4 color, float3 normal, float height,
                                float2 outward, float mask) {
    // Haze.
    color.rgb = mix(color.rgb, half3(1.0), half(0.06) * color.a);

    // One key light, up and to the left — same light as the app's card shadows.
    float3 lightDir = normalize(float3(-0.42, -0.74, 0.53));
    float ndl = saturate(dot(normal, lightDir));
    color.rgb += half3(pow(ndl, 5.0) * 0.20 + pow(ndl, 64.0) * 0.85) * color.a;

    // Bright rim, two lobes: lit side, and the refocused caustic opposite.
    float rim = pow(1.0 - height, 5.0);
    float lobes = 0.40 + 0.60 * pow(ndl, 2.0)
                + 0.70 * pow(saturate(dot(normal, -lightDir)), 2.0);

    // Thin-film colour walking around the circumference, rim-only and subtle.
    float angle = atan2(outward.y, outward.x);
    float phase = angle * 0.3183 + height * 0.6;   // two hue cycles per revolution
    half3 film = half3(0.5) + half3(0.5) * half3(
        half(cos(6.28318 * (phase + 0.00))),
        half(cos(6.28318 * (phase + 0.33))),
        half(cos(6.28318 * (phase + 0.67))));
    half3 rimColor = mix(half3(1.0), film, half(0.30));

    half glow = half(rim * lobes);
    color.rgb += rimColor * glow * 0.85h;
    // The rim glows even where the contents thin out (meniscus bridges), which is
    // what makes merged bubbles read as one skin of glass.
    color.a = saturate(color.a + glow * 0.4h);

    return color * half(mask);
}

[[stitchable]] half4 bubbleField(float2 position, SwiftUI::Layer layer, float2 size,
                                 device const float *bubbles, int count,
                                 float time, float blend, float mag, float chroma) {
    float2 field = fieldSDF(position, bubbles, count, blend, time);
    float d = field.x;
    float radius = max(field.y, 1.0);

    // Antialias the silhouette over ~1pt of the distance field — free, because the
    // SDF already measures exactly that.
    float mask = smoothstep(0.6, -0.6, d);
    if (mask <= 0.001) return half4(0.0);

    // Surface normal from the field's gradient. Central differences: 4 extra field
    // evaluations, which is the honest price of not faking the lighting.
    const float e = 1.25;
    float dx = fieldSDF(position + float2(e, 0), bubbles, count, blend, time).x
             - fieldSDF(position - float2(e, 0), bubbles, count, blend, time).x;
    float dy = fieldSDF(position + float2(0, e), bubbles, count, blend, time).x
             - fieldSDF(position - float2(0, e), bubbles, count, blend, time).x;
    float2 grad = normalize(float2(dx, dy) + 1e-5);   // unit radial direction

    // Lift the field into a TRUE hemisphere rather than a fixed shoulder. For a
    // sphere of radius R, a point at distance (R + d) from the centre sits at
    // height sqrt(-d(2R + d)) — exact, and it scales with each bubble, so a big
    // bubble is a big dome instead of a disc with a ring.
    float height = sqrt(max(-d * (2.0 * radius + d), 0.0)) / radius;   // 1 centre → 0 rim

    // Radial component: 0 at the centre, 1 at the rim. Together with `height` this
    // is the real sphere normal.
    float lateral = saturate((radius + d) / radius);
    float3 normal = normalize(float3(grad * lateral, max(height, 1e-3)));

    // The bubble's loupe: mild magnification, not hard Snell bending. Sampling is
    // pulled toward the local centre, strongest at the rim, so the contents bulge
    // gently like a picture laminated inside a lens ball — and stay legible.
    float2 offset = -grad * radius * mag * (1.0 - height);

    // Chromatic fringe, rim-only, tiny.
    float edge = pow(1.0 - height, 3.0);
    float2 spread = grad * radius * chroma * edge;
    half r = layer.sample(position + offset + spread).r;
    half4 g = layer.sample(position + offset);
    half b = layer.sample(position + offset - spread).b;
    half4 color = half4(r, g.g, b, g.a);

    return shadeBubble(color, normal, height, grad, mask);
}

// ── glassOrb ─────────────────────────────────────────────────────────────
// A refractive glass marble: the Companies view's bubbles. The layer beneath is
// the bubble's contents (tint + company logo); this bends it as if seen through a
// solid glass sphere, then adds the things that actually sell glass — chromatic
// fringing at the rim, a Fresnel edge, and a specular hotspot.
//
// This is a LAYER effect: it samples the composited layer at offset positions, so
// `maxSampleOffset` on the Swift side must cover the largest offset produced here
// or the refraction clips at the edges.
//
// Refraction is real rather than the usual parabolic fudge: reconstruct the sphere
// normal from the pixel's position on the disc, then bend the view ray through it
// with Snell's law (Metal's refract()). It costs nothing extra and behaves
// correctly at the rim, where a fudge flattens out and reads like a fisheye photo.
[[stitchable]] half4 glassOrb(float2 position, SwiftUI::Layer layer,
                              float2 size, float mag, float chroma) {
    float2 center = size * 0.5;
    float radius = min(size.x, size.y) * 0.5;
    float2 toCenter = position - center;
    float dist = length(toCenter);
    float nd = dist / max(radius, 1.0);          // 0 at centre, 1 at the rim

    // Outside the sphere: fully transparent, so bubbles stay round against
    // whatever is behind them.
    if (nd > 1.0) return half4(0.0);

    // Height of the sphere surface at this pixel (unit sphere, orthographic view).
    float z = sqrt(max(1.0 - nd * nd, 0.0));
    float3 normal = normalize(float3(toCenter / max(radius, 1.0), z));
    float2 outward = toCenter / max(dist, 1e-4);

    // Same bubble loupe as bubbleField: gentle centre magnification.
    float2 offset = -outward * dist * mag * (1.0 - z);

    float edge = pow(1.0 - z, 3.0);
    float2 spread = outward * radius * chroma * edge;
    half r = layer.sample(position + offset + spread).r;
    half4 g = layer.sample(position + offset);
    half b = layer.sample(position + offset - spread).b;
    half4 color = half4(r, g.g, b, g.a);

    // Antialias the silhouette across roughly one pixel.
    float aa = 1.5 / max(radius, 1.0);
    float mask = smoothstep(1.0, 1.0 - aa, nd);

    return shadeBubble(color, normal, z, outward, mask);
}
