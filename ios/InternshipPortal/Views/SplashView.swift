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

    /// One orb per flagship company from the live catalog — the splash shows the
    /// THING the app is about (applying to these companies), not abstract feature
    /// glyphs whose pastel fills never matched each other. Logos load through the
    /// same LogoLoader the bubbles use (cached after first launch); until a logo
    /// arrives the company's monogram holds the chip, so the cluster is never blank.
    private struct Orb: Identifiable {
        let id: Int
        let company: String
        let domain: String
        let tint: Color6
        let x: CGFloat      // × width
        let y: CGFloat      // × width (the cluster lives in a square-ish band)
        let r: CGFloat      // × width

        var bubble: CompanyBubble {
            CompanyBubble(
                id: domain, name: company,
                logoCandidates: logoCandidateURLs(logoUrl: nil, domain: domain),
                roleCount: 1, bestScore: 0, status: nil, tier: .flagship, tint: tint
            )
        }
    }

    private static let orbs: [Orb] = [
        Orb(id: 0, company: "Rakuten", domain: "rakuten.com", tint: .indigo, x: 0.50, y: 0.34, r: 0.155),
        Orb(id: 1, company: "NVIDIA", domain: "nvidia.com", tint: .teal, x: 0.28, y: 0.22, r: 0.105),
        Orb(id: 2, company: "Mercari", domain: "mercari.com", tint: .blue, x: 0.72, y: 0.23, r: 0.095),
        Orb(id: 3, company: "Cloudflare", domain: "cloudflare.com", tint: .orange, x: 0.15, y: 0.40, r: 0.070),
        Orb(id: 4, company: "HENNGE", domain: "hennge.com", tint: .purple, x: 0.70, y: 0.45, r: 0.080),
        Orb(id: 5, company: "1Password", domain: "1password.com", tint: .indigo, x: 0.87, y: 0.35, r: 0.055),
        Orb(id: 6, company: "Sakana AI", domain: "sakana.ai", tint: .orange, x: 0.35, y: 0.50, r: 0.050),
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
                            .font(.system(size: 30, weight: .semibold, design: .serif))
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

    /// The cluster: the same floating GlassOrbs the Companies view draws — large
    /// behind, small in front, each with its own shadow and out-of-step bob — so
    /// the splash and the market view are visibly the same material.
    private func bubbleCluster(width: CGFloat, height: CGFloat) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: reduceMotion)) { timeline in
            let t = ShaderClock.seconds(timeline.date)

            ZStack(alignment: .topLeading) {
                ForEach(Self.orbs.sorted { $0.r > $1.r }) { orb in
                    let d = orb.r * width * 2
                    let bob = reduceMotion ? 0 : sin(t * 0.5 + Double(orb.id) * 0.9) * 2.5

                    GlassOrb(bubble: orb.bubble, diameter: d)
                        .shadow(color: .black.opacity(0.16), radius: d * 0.11, y: d * 0.08)
                        .offset(y: bob)
                        .position(x: orb.x * width, y: orb.y * width)
                }
            }
            .frame(width: width, height: height)
        }
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Splash") {
    SplashView(onFinished: {})
}
#endif
