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

/// Signed distance to the merged field. `bubbles` is packed (x, y, radius) triples.
/// Negative inside, positive outside.
static inline float fieldSDF(float2 p, device const float *bubbles, int count,
                             float blend, float time) {
    float d = 1e9;
    for (int i = 0; i + 2 < count; i += 3) {
        // Each bubble drifts on its own phase, so the field breathes and the
        // bridges between neighbours stretch and thin as they move.
        float phase = float(i) * 0.37;
        float2 c = float2(bubbles[i], bubbles[i + 1]);
        c.x += sin(time * 0.31 + phase) * 2.5;
        c.y += cos(time * 0.27 + phase * 1.3) * 3.0;
        float r = bubbles[i + 2];
        d = smin(d, length(p - c) - r, blend);
    }
    return d;
}

[[stitchable]] half4 bubbleField(float2 position, SwiftUI::Layer layer, float2 size,
                                 device const float *bubbles, int count,
                                 float time, float blend, float ior, float chroma) {
    float d = fieldSDF(position, bubbles, count, blend, time);

    // Antialias the silhouette over ~1pt of the distance field — free, because the
    // SDF already measures exactly that.
    float mask = smoothstep(0.75, -0.75, d);
    if (mask <= 0.001) return half4(0.0);

    // Surface normal from the field's gradient. Central differences: 4 extra field
    // evaluations, which is the honest price of not faking the lighting.
    const float e = 1.25;
    float dx = fieldSDF(position + float2(e, 0), bubbles, count, blend, time)
             - fieldSDF(position - float2(e, 0), bubbles, count, blend, time);
    float dy = fieldSDF(position + float2(0, e), bubbles, count, blend, time)
             - fieldSDF(position - float2(0, e), bubbles, count, blend, time);
    float2 grad = float2(dx, dy) / (2.0 * e);

    // Lift the 2D field into a dome: `height` is 1 deep inside the blob and 0 at the
    // rim, which is what turns a flat mask into something that reads as a sphere.
    // The 26pt shoulder is the apparent "thickness" of the glass.
    float height = sqrt(saturate(-d / 26.0));
    float3 normal = normalize(float3(grad * (1.0 - height), height + 0.06));

    // The warping loupe: bend the view ray through the surface and read the layer
    // underneath from where the glass says it should come from.
    float3 bent = refract(float3(0.0, 0.0, -1.0), normal, 1.0 / max(ior, 1.0001));
    float2 offset = bent.xy * 34.0 * (1.0 - height);

    float edge = smoothstep(0.55, 0.0, height);        // rim-only effects
    float2 spread = offset * chroma * edge;
    half r = layer.sample(position + offset + spread).r;
    half4 g = layer.sample(position + offset);
    half b = layer.sample(position + offset - spread).b;
    half4 color = half4(r, g.g, b, g.a);

    // Bubbles are mostly transparent; the tint underneath supplies the colour, so
    // lift the interior toward white rather than painting it.
    color.rgb = mix(color.rgb, half3(1.0), half(edge * 0.28));
    color.a = max(color.a, half(edge * 0.55));

    // One light, up and to the left, matching the card shadows elsewhere.
    float3 lightDir = normalize(float3(-0.45, -0.75, 0.5));
    float spec = pow(saturate(dot(normal, lightDir)), 32.0);
    float rim = pow(saturate(1.0 - height), 6.0) * 0.5;
    color.rgb += half3(spec * 0.9 + rim * 0.35);
    color.a = max(color.a, half(saturate(spec + rim * 0.6)));

    // Shade the far side so the dome has volume.
    color.rgb -= half3(pow(saturate(dot(normal, -lightDir)), 3.0) * 0.08);

    return color * half(mask);
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
                              float2 size, float ior, float chroma) {
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

    // Bend the incoming view ray (straight into the screen) through the surface.
    float3 incident = float3(0.0, 0.0, -1.0);
    float3 bent = refract(incident, normal, 1.0 / max(ior, 1.0001));

    // Walk the refracted ray to the plane holding the contents. The (1 - z) factor
    // keeps the centre almost undistorted and the rim strongly bent, which is what
    // a real marble does.
    float2 offset = bent.xy * radius * (1.0 - z) * 0.85;

    // Chromatic aberration: wavelengths bend by different amounts, so sample each
    // channel at a slightly different offset. Only visible near the rim, which is
    // exactly where a real lens shows it.
    float edge = smoothstep(0.35, 1.0, nd);
    float2 spread = offset * chroma * edge;
    half r = layer.sample(position + offset + spread).r;
    half4 g = layer.sample(position + offset);
    half b = layer.sample(position + offset - spread).b;
    half4 color = half4(r, g.g, b, g.a);

    // Contents fade out at the very rim, where a real sphere shows mostly
    // reflection rather than transmission.
    float fresnel = pow(1.0 - z, 3.0);
    color.rgb = mix(color.rgb, half3(1.0), half(fresnel * 0.22));
    color.a = max(color.a, half(fresnel * 0.5));

    // Specular hotspot, up and to the left — one light, consistent with the card
    // shadows elsewhere in the app.
    float3 lightDir = normalize(float3(-0.45, -0.75, 0.55));
    float spec = pow(max(dot(normal, lightDir), 0.0), 28.0);
    color.rgb += half3(spec * 0.85);
    color.a = max(color.a, half(spec * 0.9));

    // A soft inner shadow opposite the light gives the sphere volume.
    float shade = pow(max(dot(normal, -lightDir), 0.0), 3.0);
    color.rgb -= half3(shade * 0.10);

    // Antialias the silhouette across roughly one pixel.
    float aa = 1.5 / max(radius, 1.0);
    color *= half(smoothstep(1.0, 1.0 - aa, nd));

    return color;
}
