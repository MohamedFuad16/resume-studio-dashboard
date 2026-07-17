// SwiftUI bindings for Shaders.metal.
//
// Every effect here is applied to an already-correct view — if a shader failed to
// compile the app would still render its layout, just flat. That is deliberate:
// motion is polish, never the thing that carries meaning.
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

/// A card that responds to touch. The feedback is the reference's own
/// `active:scale-[0.98]` and nothing more — a distortion shader was tried here and
/// removed: warping the thing you are touching fights the tap rather than
/// confirming it.
struct PressableCard<Content: View>: View {
    var action: () -> Void
    @ViewBuilder var content: () -> Content

    @State private var isPressed = false

    var body: some View {
        content()
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(.spring(response: 0.28, dampingFraction: 0.7), value: isPressed)
            .contentShape(.rect)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in if !isPressed { isPressed = true } }
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
