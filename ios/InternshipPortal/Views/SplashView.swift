// The intro splash: a cluster of glass bubbles breathing above the wordmark,
// Wabi-style, drawn by the same bubbleField shader the Companies view uses — the
// splash is a promise about the app, so it is made of the app's own material.
//
// It plays over the auth gate for a beat and fades. Sequence on a cold launch:
// static launch screen (canvas colour, so no white flash) → this → login or Home.
import SwiftUI

struct SplashView: View {
    /// Called when the splash has had its moment; the parent fades it out.
    var onFinished: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    /// One orb per thing the app actually does. Positions are fractions of the
    /// screen width, clustered like the reference's opening — dense at the middle,
    /// strays at the edges.
    private struct Orb: Identifiable {
        let id: Int
        let symbol: String
        let tint: Color6
        let x: CGFloat      // × width
        let y: CGFloat      // × width (the cluster lives in a square-ish band)
        let r: CGFloat      // × width
    }

    private static let orbs: [Orb] = [
        Orb(id: 0, symbol: "location.north.circle", tint: .teal, x: 0.50, y: 0.34, r: 0.155),
        Orb(id: 1, symbol: "briefcase", tint: .purple, x: 0.28, y: 0.22, r: 0.105),
        Orb(id: 2, symbol: "calendar", tint: .blue, x: 0.72, y: 0.23, r: 0.095),
        Orb(id: 3, symbol: "doc.text", tint: .indigo, x: 0.15, y: 0.40, r: 0.070),
        Orb(id: 4, symbol: "sparkles", tint: .orange, x: 0.70, y: 0.45, r: 0.080),
        Orb(id: 5, symbol: "graduationcap", tint: .teal, x: 0.87, y: 0.35, r: 0.055),
        Orb(id: 6, symbol: "flame.fill", tint: .orange, x: 0.35, y: 0.50, r: 0.050),
    ]

    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let fieldHeight = w * 0.68

            ZStack {
                Palette.canvas.ignoresSafeArea()

                VStack(spacing: 0) {
                    Spacer(minLength: proxy.size.height * 0.12)

                    bubbleCluster(width: w, height: fieldHeight)
                        .frame(width: w, height: fieldHeight)
                        .scaleEffect(appeared ? 1 : 0.92)
                        .opacity(appeared ? 1 : 0)

                    VStack(spacing: 10) {
                        Text("Internship Portal")
                            .font(.system(size: 30, weight: .bold))
                            .tracking(-0.6)
                            .foregroundStyle(Palette.ink)
                        Text("Every application, one calm place.")
                            .font(.system(size: 15))
                            .foregroundStyle(Palette.ink500)
                    }
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 10)

                    Spacer()
                }
            }
        }
        .onAppear {
            withAnimation(reduceMotion ? .none : .spring(response: 0.7, dampingFraction: 0.8)) {
                appeared = true
            }
        }
        .task {
            #if DEBUG
            // `simctl launch … -holdSplash YES` keeps the splash up for screenshots.
            if UserDefaults.standard.bool(forKey: "holdSplash") { return }
            #endif
            try? await Task.sleep(for: .seconds(reduceMotion ? 0.6 : 1.8))
            onFinished()
        }
        .accessibilityElement()
        .accessibilityLabel("Internship Portal")
    }

    /// The orbs' contents, warped by the shared bubbleField shader — so they merge,
    /// breathe, and light exactly like the Companies view.
    private func bubbleCluster(width: CGFloat, height: CGFloat) -> some View {
        let packed: [Float] = Self.orbs.flatMap {
            [Float($0.x * width), Float($0.y * width), Float($0.r * width)]
        }

        return TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: reduceMotion)) { timeline in
            let t = ShaderClock.seconds(timeline.date)

            ZStack(alignment: .topLeading) {
                Color.clear

                ForEach(Self.orbs) { orb in
                    let d = orb.r * width * 2
                    ZStack {
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [orb.tint.bg, orb.tint.fg.opacity(0.72)],
                                    center: .init(x: 0.38, y: 0.28),
                                    startRadius: d * 0.06,
                                    endRadius: d * 0.85
                                )
                            )
                        Image(systemName: orb.symbol)
                            .font(.system(size: d * 0.34, weight: .medium))
                            .foregroundStyle(.white.opacity(0.92))
                    }
                    .frame(width: d, height: d)
                    .position(x: orb.x * width, y: orb.y * width)
                }
            }
            .frame(width: width, height: height)
            .layerEffect(
                ShaderLibrary.bubbleField(
                    .float2(CGSize(width: width, height: height)),
                    .floatArray(packed),
                    .float(t),
                    .float(10),     // blend — the cluster kisses, like the reference
                    .float(0.34),   // magnification
                    .float(0.05)    // chromatic fringe
                ),
                maxSampleOffset: CGSize(width: 44, height: 44)
            )
        }
    }
}

// MARK: - Previews

#Preview("Splash") {
    SplashView(onFinished: {})
}
