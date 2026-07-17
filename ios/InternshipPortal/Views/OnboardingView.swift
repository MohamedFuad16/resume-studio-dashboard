// First-launch onboarding — four screens that follow the splash, built from the
// app's own material: each feature is introduced by a glass orb (the same shader
// the Companies field and splash use), over the ambient canvas.
//
// Sequence on a first cold launch: static launch screen → splash → these → login.
// One AppStorage flag; returning users never see it again.
import AudioToolbox
import SwiftUI
import UIKit

/// A soft tactile + audible "stick" for a bubble arriving into the cluster. Haptic
/// carries the feel on device; the system "pop" carries the sound. Respects Reduce
/// Motion by simply not being called from the animation path.
@MainActor
enum SoftFeedback {
    private static let generator = UIImpactFeedbackGenerator(style: .soft)
    static func prepare() { generator.prepare() }
    static func stick() {
        generator.impactOccurred(intensity: 0.75)
        generator.prepare()
        AudioServicesPlaySystemSound(1520)   // a soft, bubble-like "pop"
    }
}

struct OnboardingView: View {
    /// Called when the user finishes or skips; the parent fades this out.
    var onFinished: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var page = 0

    private struct Page: Identifiable {
        let id: Int
        let symbol: String
        let tint: Color6
        let title: String
        let message: String
    }

    private static let pages: [Page] = [
        Page(
            id: 0, symbol: "circle.hexagongrid.fill", tint: .teal,
            title: "Every application,\none calm place",
            message: "Internship Portal keeps your whole search — roles, applications, interviews — in one quiet, glassy home."
        ),
        Page(
            id: 1, symbol: "location.north.circle", tint: .indigo,
            title: "Find your match",
            message: "Radar ranks verified Tokyo and Japan internships against your résumé, so the best-fit roles surface first."
        ),
        Page(
            id: 2, symbol: "envelope.open", tint: .purple,
            title: "Track without typing",
            message: "Gmail sync reads replies for you — applications move from applied to interview on their own, rejections file themselves."
        ),
        Page(
            id: 3, symbol: "calendar.badge.clock", tint: .orange,
            title: "Never miss a deadline",
            message: "Deadlines and interview dates land on the calendar the moment a role is tracked."
        ),
    ]

    private var isLast: Bool { page == Self.pages.count - 1 }

    var body: some View {
        ZStack {
            AmbientCanvas {
                VStack(spacing: 0) {
                    HStack {
                        Spacer()
                        Button("Skip") { onFinished() }
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Palette.ink500)
                            .buttonStyle(.plain)
                            .opacity(isLast ? 0 : 1)
                            .accessibilityHidden(isLast)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 8)

                    TabView(selection: $page) {
                        ForEach(Self.pages) { item in
                            OnboardingPage(
                                symbol: item.symbol, tint: item.tint,
                                title: item.title, message: item.message,
                                isActive: item.id == page
                            )
                            .tag(item.id)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.85), value: page)

                    // Dots + one primary action. The dots are ours, not the system
                    // page control — it paints white-on-white over this canvas.
                    HStack(spacing: 7) {
                        ForEach(Self.pages) { item in
                            Capsule()
                                .fill(item.id == page ? Palette.ink : Palette.ink300)
                                .frame(width: item.id == page ? 22 : 7, height: 7)
                        }
                    }
                    .animation(.spring(response: 0.35, dampingFraction: 0.8), value: page)
                    .padding(.bottom, 22)
                    .accessibilityElement()
                    .accessibilityLabel("Page \(page + 1) of \(Self.pages.count)")

                    Button {
                        if isLast {
                            onFinished()
                        } else {
                            page += 1
                        }
                    } label: {
                        Text(isLast ? "Get started" : "Continue")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Palette.ink, in: .rect(cornerRadius: Radius.row, style: .continuous))
                            .floatShadow()
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 12)
                }
            }
        }
    }
}

/// One screen: a floating cluster of real, colourful company bubbles around the
/// feature's glyph, then the words.
///
/// The single pastel orb read as bland; the market the app is about is colourful,
/// so onboarding shows it — actual brand bubbles (Rakuten red, NVIDIA green,
/// Cloudflare orange, Mercari blue) drifting around the feature glyph. When the
/// page becomes active they rise and settle, staggered, and the words follow.
private struct OnboardingPage: View {
    var symbol: String
    var tint: Color6
    var title: String
    var message: String
    var isActive: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let on = isActive || reduceMotion

        return VStack(spacing: 0) {
            Spacer()

            OnboardingCluster(centerSymbol: symbol, centerTint: tint, isActive: on)
                .frame(height: 260)
                .padding(.bottom, 36)

            Text(title)
                .font(Font2.title(28))
                .tracking(-0.4)
                .foregroundStyle(Palette.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 14)
                .opacity(on ? 1 : 0)
                .offset(y: on ? 0 : 12)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.45).delay(0.3), value: on)

            Text(message)
                .font(.system(size: 15))
                .foregroundStyle(Palette.ink500)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 36)
                .opacity(on ? 1 : 0)
                .offset(y: on ? 0 : 12)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.45).delay(0.4), value: on)

            Spacer()
            Spacer()
        }
        .padding(.horizontal, 20)
    }
}

/// The feature glyph as the central glass orb, with real company bubbles floating
/// around it. Same material and motion as the splash and Companies clusters.
private struct OnboardingCluster: View {
    var centerSymbol: String
    var centerTint: Color6
    var isActive: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Sat: Identifiable {
        let id: Int
        let company: String
        let domain: String
        let tint: Color6
        let x: CGFloat  // × field width
        let y: CGFloat  // × field width
        let r: CGFloat  // × field width
    }

    // A deliberately colourful spread — red, green, orange, blue, ink.
    private static let sats: [Sat] = [
        Sat(id: 1, company: "Rakuten", domain: "rakuten.com", tint: .indigo, x: 0.19, y: 0.30, r: 0.115),
        Sat(id: 2, company: "NVIDIA", domain: "nvidia.com", tint: .teal, x: 0.83, y: 0.26, r: 0.10),
        Sat(id: 3, company: "Cloudflare", domain: "cloudflare.com", tint: .orange, x: 0.16, y: 0.72, r: 0.085),
        Sat(id: 4, company: "Mercari", domain: "mercari.com", tint: .blue, x: 0.84, y: 0.72, r: 0.095),
        Sat(id: 5, company: "1Password", domain: "1password.com", tint: .indigo, x: 0.5, y: 0.9, r: 0.07),
    ]

    /// Per-bubble stagger, so the cluster assembles rather than snapping in.
    private func delay(_ id: Int) -> Double { reduceMotion ? 0 : Double(id) * 0.14 }

    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let centerD = w * 0.34

            TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: reduceMotion || !isActive)) { timeline in
                let t = ShaderClock.seconds(timeline.date)

                ZStack(alignment: .topLeading) {
                    // The satellites fly in FROM THE SIDES: a bubble that belongs on
                    // the left of the cluster enters from off-screen left, one on the
                    // right from off-screen right, the centre-bottom one rises. They
                    // converge and settle around the glyph — "coming from the sides
                    // and sticking together."
                    ForEach(Self.sats) { sat in
                        let d = sat.r * w * 2
                        let bob = reduceMotion ? 0 : sin(t * 0.5 + Double(sat.id) * 0.9) * 3
                        let entry = entryOffset(for: sat, width: w)

                        GlassOrb(
                            bubble: CompanyBubble(
                                id: sat.domain, name: sat.company,
                                logoCandidates: logoCandidateURLs(logoUrl: nil, domain: sat.domain, name: sat.company),
                                roleCount: 1, bestScore: 0, status: nil, tier: .flagship, tint: sat.tint
                            ),
                            diameter: d
                        )
                        .shadow(color: .black.opacity(0.14), radius: d * 0.1, y: d * 0.07)
                        .offset(y: bob)
                        .offset(x: isActive ? 0 : entry.width, y: isActive ? 0 : entry.height)
                        .scaleEffect(isActive ? 1 : 0.7)
                        .opacity(isActive ? 1 : 0)
                        .animation(
                            reduceMotion ? nil
                                : .spring(response: 0.75, dampingFraction: 0.72).delay(delay(sat.id)),
                            value: isActive
                        )
                        .position(x: sat.x * w, y: sat.y * w)
                    }

                    FeatureOrb(symbol: centerSymbol, tint: centerTint, diameter: centerD)
                        .offset(y: reduceMotion ? 0 : sin(t * 0.5) * 2)
                        .scaleEffect(isActive ? 1 : 0.8)
                        .opacity(isActive ? 1 : 0)
                        .animation(reduceMotion ? nil : .spring(response: 0.75, dampingFraction: 0.75), value: isActive)
                        .position(x: 0.5 * w, y: 0.5 * w)
                }
                .frame(width: w, height: w)
            }
            .frame(width: w, height: proxy.size.height, alignment: .center)
        }
        // Sound + haptic timed to each bubble's arrival. Fires on first appearance
        // of an already-active page (page 0) and whenever a page becomes active.
        .onAppear { if isActive { playAssembly() } }
        .onChange(of: isActive) { _, on in if on { playAssembly() } }
    }

    /// Where a bubble starts before it flies in: off-screen on the side it lives on,
    /// or from below if it sits on the centre line.
    private func entryOffset(for sat: Sat, width w: CGFloat) -> CGSize {
        if abs(sat.x - 0.5) < 0.12 { return CGSize(width: 0, height: w * 0.9) } // centre → rise
        return CGSize(width: sat.x < 0.5 ? -w : w, height: 0)                    // side → slide in
    }

    /// One soft pop per bubble, timed to when its spring settles.
    private func playAssembly() {
        guard !reduceMotion else { return }
        SoftFeedback.prepare()
        for sat in Self.sats {
            let at = delay(sat.id) + 0.32
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(at))
                SoftFeedback.stick()
            }
        }
    }
}

/// A feature glyph inside the app's glass — same contents recipe as the splash
/// orbs, bent by the same glassOrb shader the Companies bubbles use.
private struct FeatureOrb: View {
    var symbol: String
    var tint: Color6
    var diameter: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [tint.bg, tint.fg.opacity(0.72)],
                        center: .init(x: 0.38, y: 0.28),
                        startRadius: diameter * 0.06,
                        endRadius: diameter * 0.85
                    )
                )
            Image(systemName: symbol)
                .font(.system(size: diameter * 0.32, weight: .medium))
                .foregroundStyle(.white.opacity(0.92))
        }
        .frame(width: diameter, height: diameter)
        .layerEffect(
            ShaderLibrary.glassOrb(
                .float2(CGSize(width: diameter, height: diameter)),
                .float(0.16),
                .float(0.035)
            ),
            maxSampleOffset: CGSize(width: diameter, height: diameter)
        )
        .accessibilityHidden(true)
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Onboarding") {
    OnboardingView(onFinished: {})
}
#endif
