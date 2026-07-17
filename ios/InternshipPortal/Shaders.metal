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

// ── glassOrb ─────────────────────────────────────────────────────────────
// One floating glass bubble, matched to the Wabi hero and to real lensball
// photography. What actually sells those spheres, in order of importance:
//   1. a broad CRESCENT of light hugging the upper rim (the studio softbox),
//   2. a fainter counter-crescent along the lower rim (light refocused through
//      the ball),
//   3. one small hard specular dot,
//   4. an inner shade at the bottom that gives the ball weight,
//   5. contents gently magnified at the centre and compressed at the edge.
// Deliberately absent: any uniform rim ring. A ring traced around the silhouette
// is what kept reading as "a border" — real bubbles brighten in crescents, not
// in circles. The float comes from a drop shadow OUTSIDE the shader (SwiftUI),
// which also keeps every bubble its own body.
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

    // 5) The loupe: gentle centre magnification, strongest toward the edge, so the
    // contents bulge like a picture laminated inside the ball and stay legible.
    float2 offset = -outward * dist * mag * (1.0 - z);

    float edge = pow(1.0 - z, 3.0);
    float2 spread = outward * radius * chroma * edge;
    half r = layer.sample(position + offset + spread).r;
    half4 g = layer.sample(position + offset);
    half b = layer.sample(position + offset - spread).b;
    half4 color = half4(r, g.g, b, g.a);

    // A band hugging the inside of the silhouette — every crescent lives in it.
    float rimBand = smoothstep(0.55, 0.10, z) * smoothstep(-0.02, 0.10, z);

    // 1) Key crescent, upper rim. The light matches the app's card shadows.
    float3 keyDir = normalize(float3(-0.30, -0.90, 0.28));
    float keyFace = saturate(dot(normal, keyDir));
    color.rgb += half3(rimBand * pow(keyFace, 2.5) * 0.85) * color.a;

    // 2) Counter-crescent, lower rim — fainter, slightly warm like bounced light.
    float3 counterDir = normalize(float3(0.20, 0.95, 0.20));
    float counterFace = saturate(dot(normal, counterDir));
    color.rgb += half3(0.38, 0.36, 0.34) * half(rimBand * pow(counterFace, 3.0)) * color.a;

    // 3) The hotspot: small, hard, off the key direction.
    float3 hotDir = normalize(float3(-0.42, -0.72, 0.55));
    color.rgb += half3(pow(saturate(dot(normal, hotDir)), 110.0) * 0.9) * color.a;

    // 4) Weight: shade the lower interior, just inside the counter-crescent.
    float belly = smoothstep(0.75, 0.25, z) * saturate(normal.y);
    color.rgb -= half3(belly * 0.12) * color.a;

    // A breath of haze so the glass reads as BETWEEN you and the contents.
    color.rgb = mix(color.rgb, half3(1.0), half(0.04) * color.a);

    // Antialias the silhouette across roughly one pixel.
    float aa = 1.5 / max(radius, 1.0);
    return color * half(smoothstep(1.0, 1.0 - aa, nd));
}
