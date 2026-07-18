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
                logoCandidates: logoCandidateURLs(logoUrl: nil, domain: domain, name: company),
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

                    bubbleCluster(width: w, height: fieldHeight, riseFrom: proxy.size.height)
                        .frame(width: w, height: fieldHeight)

                    VStack(spacing: 10) {
                        Text("Internship Portal")
                            .font(.system(size: 33, weight: .semibold, design: .serif))
                            .tracking(-0.5)
                            .foregroundStyle(Palette.ink)
                        Text("Every application, one calm place.")
                            .font(.system(size: 15, weight: .regular))
                            .foregroundStyle(Palette.ink500)
                    }
                    // The words arrive after the cluster has gathered, so the eye
                    // follows the bubbles up first, then reads.
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 14)
                    .animation(reduceMotion ? nil : .easeOut(duration: 0.5).delay(0.75), value: appeared)

                    Spacer()
                }
            }
        }
        .task {
            // Resolve the logos BEFORE anything moves. Without this the glass balls
            // fly in empty and each mark pops in whenever its download lands, so the
            // intro reads as loose parts appearing one at a time instead of finished
            // bubbles gathering. Capped, so a slow network delays the intro briefly
            // rather than holding it.
            await LogoLoader.preload(Self.orbs.map(\.bubble.logoCandidates), timeout: 2.0)

            withAnimation(reduceMotion ? .none : .spring(response: 0.8, dampingFraction: 0.74)) {
                appeared = true
            }

            #if DEBUG
            // `simctl launch … -holdSplash YES` keeps the splash up for screenshots.
            if UserDefaults.standard.bool(forKey: "holdSplash") { return }
            #endif
            // Held long enough to watch the cluster gather and read the wordmark.
            // Shorter than before because the logo preload above now runs first,
            // so this sits on top of that rather than replacing it.
            try? await Task.sleep(for: .seconds(reduceMotion ? 1.0 : 2.2))
            onFinished()
        }
        .accessibilityElement()
        .accessibilityLabel("Internship Portal")
    }

    /// The cluster: the same floating GlassOrbs the Companies view draws — large
    /// behind, small in front — but here they FLOW UP from below the screen and
    /// gather into formation. Each orb rises from `riseFrom` (a full screen-height
    /// below its resting place) to its cluster position, staggered so the big
    /// central bubble lands first and the satellites drift up to attach around it.
    /// A continuous, out-of-step bob keeps the settled cluster alive.
    private func bubbleCluster(width: CGFloat, height: CGFloat, riseFrom: CGFloat) -> some View {
        // Back-to-front, and that same order drives the stagger: the largest
        // (Rakuten) leads, the small satellites follow.
        let ordered = Self.orbs.sorted { $0.r > $1.r }

        return TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: reduceMotion)) { timeline in
            let t = ShaderClock.seconds(timeline.date)

            ZStack(alignment: .topLeading) {
                ForEach(Array(ordered.enumerated()), id: \.element.id) { index, orb in
                    let d = orb.r * width * 2
                    let bob = reduceMotion ? 0 : sin(t * 0.5 + Double(orb.id) * 0.9) * 2.5
                    let delay = reduceMotion ? 0 : Double(index) * 0.08

                    GlassOrb(bubble: orb.bubble, diameter: d)
                        .shadow(color: .black.opacity(0.16), radius: d * 0.11, y: d * 0.08)
                        // Continuous life, applied first so it composes with the rise.
                        .offset(y: bob)
                        // The rise + a little scale-up as they settle. Separate from
                        // the bob offset so the one-time spring and the per-frame bob
                        // don't fight over the same value.
                        .offset(y: appeared ? 0 : riseFrom)
                        .scaleEffect(appeared ? 1 : 0.8, anchor: .center)
                        .opacity(appeared ? 1 : 0)
                        .animation(
                            reduceMotion ? nil
                                : .spring(response: 0.85, dampingFraction: 0.72).delay(delay),
                            value: appeared
                        )
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
