// First-launch onboarding — four screens that follow the splash, built from the
// app's own material: each feature is introduced by a glass orb (the same shader
// the Companies field and splash use), over the ambient canvas.
//
// Sequence on a first cold launch: static launch screen → splash → these → login.
// One AppStorage flag; returning users never see it again.
import SwiftUI

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

/// One screen: a big glass orb holding the feature's glyph, then the words.
///
/// When the page becomes active its orb rises and settles and the words fade up
/// after it — the same bottom-to-centre motion as the splash cluster, one orb at a
/// time — so paging through onboarding feels like the intro continuing rather than
/// four static cards.
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

            FeatureOrb(symbol: symbol, tint: tint, diameter: 168)
                .offset(y: on ? 0 : 60)
                .scaleEffect(on ? 1 : 0.82)
                .opacity(on ? 1 : 0)
                .animation(reduceMotion ? nil : .spring(response: 0.7, dampingFraction: 0.7), value: on)
                .padding(.bottom, 40)

            Text(title)
                .font(Font2.title(28))
                .tracking(-0.4)
                .foregroundStyle(Palette.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 14)
                .opacity(on ? 1 : 0)
                .offset(y: on ? 0 : 12)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.45).delay(0.18), value: on)

            Text(message)
                .font(.system(size: 15))
                .foregroundStyle(Palette.ink500)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 36)
                .opacity(on ? 1 : 0)
                .offset(y: on ? 0 : 12)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.45).delay(0.28), value: on)

            Spacer()
            Spacer()
        }
        .padding(.horizontal, 20)
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
