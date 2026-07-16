// SwiftUI bindings for Shaders.metal.
//
// Every effect here is applied with `.compositingGroup()`-safe modifiers and is
// purely additive over an already-correct view — if the shader failed to compile,
// the app would still render its layout, just flat. That is deliberate: motion is
// polish, never the thing that carries meaning.
import SwiftUI

/// Seconds since the app started, for shader `time` arguments.
///
/// Never hand a shader `timeIntervalSinceReferenceDate` directly. Metal computes
/// in float32, and that value is ~8×10⁸ where the ulp is ~64 seconds — every
/// `fract()` and hash inside a noise function collapses to a constant, so the
/// effect renders perfectly flat and looks like it never ran. Starting from zero
/// keeps the clock small for any realistic session, with no wrap-around jump.
enum ShaderClock {
    private static let epoch = Date.timeIntervalSinceReferenceDate
    static func seconds(_ date: Date) -> Double {
        date.timeIntervalSinceReferenceDate - epoch
    }
}

/// One clock, shared by every ambient shader. A single TimelineView per screen
/// beats N independent ones, and pausing it when a sheet covers the screen keeps
/// the GPU idle.
///
/// The shaders stay on the BACKGROUND layer, never over `content`. A raster shader
/// (`colorEffect`/`layerEffect`) silently refuses to draw UIKit-backed views, and
/// ScrollView/TextField are exactly that — wrapping the content tree in one blanks
/// the screen. Grain belongs on the paper anyway, not on the text sitting on it.
struct AmbientCanvas<Content: View>: View {
    var active: Bool = true
    @ViewBuilder var content: () -> Content

    var body: some View {
        ZStack {
            // One colorEffect, not two: chained effects silently drop all but the
            // outermost, so aurora + grain live in a single shader pass.
            GeometryReader { proxy in
                TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !active)) { timeline in
                    let t = ShaderClock.seconds(timeline.date)

                    Palette.canvas
                        .colorEffect(
                            ShaderLibrary.auroraCanvas(
                                .float2(proxy.size),
                                .float(t),
                                .float(0.012)
                            )
                        )
                }
            }
            .ignoresSafeArea()

            content()
        }
    }
}

/// The Radar stat strip's backdrop. The shader is used as a ShapeStyle so it
/// generates its own pixels — see the note in Shaders.metal on why a colorEffect
/// over Color.clear draws nothing.
struct RadarSweepBackdrop: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { timeline in
            let t = ShaderClock.seconds(timeline.date)
            GeometryReader { proxy in
                Rectangle()
                    .fill(
                        ShaderLibrary.radarSweep(
                            .float2(proxy.size),
                            .float(t)
                        )
                    )
            }
        }
    }
}

/// Skeleton shimmer for the loading state.
struct ShimmerBox: View {
    var height: CGFloat
    var radius: CGFloat = Radius.row
    @State private var progress: Double = -0.3

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(Palette.card)
            .frame(height: height)
            .visualEffect { view, proxy in
                view.colorEffect(
                    ShaderLibrary.shimmer(
                        .float2(proxy.size),
                        .float(progress)
                    )
                )
            }
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    progress = 1.3
                }
            }
    }
}

/// Press feedback: a soft inward warp toward the finger, paired with the
/// reference's `active:scale-[0.98]`.
struct PressWarp: ViewModifier {
    var isPressed: Bool
    var touch: CGPoint

    func body(content: Content) -> some View {
        content
            .visualEffect { [isPressed, touch] view, proxy in
                view.distortionEffect(
                    ShaderLibrary.pressWarp(
                        .float2(proxy.size),
                        .float2(touch),
                        .float(isPressed ? 1.0 : 0.0)
                    ),
                    maxSampleOffset: CGSize(width: 8, height: 8)
                )
            }
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(.spring(response: 0.28, dampingFraction: 0.7), value: isPressed)
    }
}

/// A card that responds to touch with the warp shader. Wraps its content in a
/// button so it stays fully accessible.
struct PressableCard<Content: View>: View {
    var action: () -> Void
    @ViewBuilder var content: () -> Content

    @State private var isPressed = false
    @State private var touch: CGPoint = .zero

    var body: some View {
        content()
            .modifier(PressWarp(isPressed: isPressed, touch: touch))
            .contentShape(.rect)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        if !isPressed {
                            touch = value.startLocation
                            isPressed = true
                        }
                    }
                    .onEnded { value in
                        isPressed = false
                        // Only fire if the finger stayed on the card — matches the
                        // cancel behaviour of a real button.
                        let moved = hypot(value.translation.width, value.translation.height)
                        if moved < 12 { action() }
                    }
            )
            .accessibilityAddTraits(.isButton)
    }
}
