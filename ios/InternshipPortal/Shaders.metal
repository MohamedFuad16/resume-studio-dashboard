// Metal shaders backing the app's motion. Each is reachable from SwiftUI through
// ShaderLibrary (see ShaderEffects.swift).
//
// SwiftUI shader ABI:
//   [[stitchable]] half4 name(float2 position, half4 currentColor, <args...>)
// for .colorEffect;  float2 for .distortionEffect;  and layer sampling for
// .layerEffect. Argument order must match the Swift call site exactly.
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

// ── radarSweep ───────────────────────────────────────────────────────────
// Behind the Radar tab's stat row: concentric rings plus a rotating sweep, like
// the instrument the tab is named after.
//
// This is a SHAPE STYLE shader (`Rectangle().fill(...)`), not a colorEffect —
// it generates pixels rather than filtering them, so it takes no `currentColor`
// and returns its own premultiplied color. A colorEffect over `Color.clear` is
// the obvious-looking alternative and does not work: SwiftUI never rasterizes a
// fully transparent layer, so the shader is simply not run.
[[stitchable]] half4 radarSweep(float2 position, float2 size, float time) {
    float2 center = float2(size.x * 0.5, size.y * 0.5);
    float2 d = position - center;
    // Normalise by the LONG edge: the strip is far wider than it is tall, so
    // dividing by height would collapse the rings into a small halo in the middle.
    float r = length(d) / max(size.x * 0.5, 1.0);
    float angle = atan2(d.y, d.x);

    // Rings, thinning with radius.
    float rings = smoothstep(0.05, 0.0, abs(fract(r * 2.4) - 0.5) - 0.44);

    // Sweep: a soft wedge trailing the leading edge.
    float sweepAngle = fmod(time * 0.9, 6.2831853);
    float delta = fmod(angle - sweepAngle + 6.2831853 * 2.0, 6.2831853);
    float wedge = smoothstep(2.2, 0.0, delta) * 0.5;

    float falloff = smoothstep(1.15, 0.1, r);
    half3 teal = half3(0.051, 0.580, 0.533);
    half alpha = half((rings * 0.5 + wedge * 0.28) * falloff);

    // Premultiplied: rgb carries alpha, as SwiftUI's raster layers expect.
    return half4(teal * alpha, alpha);
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

// ── pressWarp ────────────────────────────────────────────────────────────
// Distortion applied while a card is held: a gentle inward pull toward the touch
// point. Reads as the surface being soft rather than the view being scaled.
[[stitchable]] float2 pressWarp(float2 position, float2 size,
                                float2 touch, float amount) {
    float2 d = position - touch;
    float dist = length(d) / max(length(size) * 0.5, 1.0);
    float pull = amount * 6.0 * smoothstep(1.0, 0.0, dist);
    return position - normalize(d + 1e-4) * pull;
}
