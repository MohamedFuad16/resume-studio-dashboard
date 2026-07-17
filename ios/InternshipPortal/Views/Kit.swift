// The component vocabulary, ported from the reference app's function components:
// ActionCard, MatchCard, ApplicationCard, StatCard, SettingsRow, NavItem.
// Anything used on more than one screen lives here.
import SwiftUI

// MARK: - Surfaces

/// The white paper every screen is built from — reference: rounded-[24px] bg-white
/// shadow-[0_2px_10px_rgb(0,0,0,0.02)].
struct Card<Content: View>: View {
    var radius: CGFloat = Radius.card
    var padding: CGFloat = 16
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .background(Palette.card, in: .rect(cornerRadius: radius, style: .continuous))
            .cardShadow()
    }
}

/// A pastel icon tile — reference: w-[36px] h-[36px] rounded-[12px] bg-{tint}-50.
struct IconTile: View {
    var symbol: String
    var tint: Color6
    var size: CGFloat = 36
    var glyph: CGFloat = 18

    var body: some View {
        RoundedRectangle(cornerRadius: Radius.tile, style: .continuous)
            .fill(tint.bg)
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: symbol)
                    .font(.system(size: glyph, weight: .medium))
                    .foregroundStyle(tint.fg)
            }
    }
}

/// Company mark. Uses the real logo when the catalog has one, and falls back to a
/// monogram — never an empty box (the web's DuckDuckGo favicons often 404).
struct CompanyMark: View {
    var company: String
    var candidates: [String] = []
    var size: CGFloat = 44

    private var monogram: String {
        let letter = company.trimmingCharacters(in: .whitespaces).first
        return letter.map { String($0).uppercased() } ?? "?"
    }

    var body: some View {
        RoundedRectangle(cornerRadius: Radius.logo, style: .continuous)
            .fill(Palette.tile)
            .frame(width: size, height: size)
            .overlay {
                LogoImage(candidates: candidates) {
                    Text(monogram)
                        .font(.system(size: size * 0.38, weight: .bold))
                        .foregroundStyle(Palette.ink600)
                }
                .padding(size * 0.22)
            }
            .overlay {
                RoundedRectangle(cornerRadius: Radius.logo, style: .continuous)
                    .strokeBorder(Palette.hairline, lineWidth: 1)
            }
    }
}

// MARK: - Cards

/// Home's 2×2 launcher — reference: ActionCard.
struct ActionCard: View {
    var symbol: String
    var tint: Color6
    var title: String
    var subtitle: String
    var action: () -> Void

    var body: some View {
        PressableCard(action: action) {
            Card(padding: 16) {
                VStack(alignment: .leading, spacing: 0) {
                    IconTile(symbol: symbol, tint: tint, size: 36, glyph: 18)
                    Spacer(minLength: 12)
                    Text(title)
                        .font(Font2.cardTitle)
                        .foregroundStyle(Palette.ink)
                    Text(subtitle)
                        .font(Font2.caption)
                        .foregroundStyle(Palette.ink500)
                        .lineLimit(1)
                        .padding(.top, 2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .aspectRatio(1, contentMode: .fit)
        }
        .accessibilityLabel("\(title). \(subtitle)")
    }
}

/// A ranked catalog row — reference: MatchCard.
struct MatchCard: View {
    var item: Internship
    var action: () -> Void

    var body: some View {
        PressableCard(action: action) {
            Card(radius: Radius.row, padding: 14) {
                HStack(spacing: 12) {
                    CompanyMark(company: item.displayCompany, candidates: item.logoCandidates)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.displayCompany)
                            .font(Font2.rowTitle)
                            .foregroundStyle(Palette.ink)
                            .lineLimit(1)
                        Text(item.displayRole)
                            .font(Font2.caption)
                            .foregroundStyle(Palette.ink500)
                            .lineLimit(1)
                        HStack(spacing: 4) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.system(size: 9))
                            Text(item.displayLocation).lineLimit(1)
                        }
                        .font(Font2.nano)
                        .foregroundStyle(Palette.ink400)
                        .padding(.top, 2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(item.matchText)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Palette.teal)
                            .monospacedDigit()
                        Text("MATCH")
                            .font(.system(size: 9, weight: .semibold))
                            .tracking(0.6)
                            .foregroundStyle(Palette.ink400)
                    }
                }
            }
        }
        .accessibilityLabel("\(item.displayCompany), \(item.displayRole), \(item.matchText) match")
    }
}

/// A tracked application — reference: ApplicationCard.
struct ApplicationCard: View {
    @Environment(CatalogStore.self) private var store
    var record: TrackerRecord
    var action: () -> Void

    var body: some View {
        PressableCard(action: action) {
            Card(radius: Radius.row, padding: 14) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top, spacing: 12) {
                        CompanyMark(company: record.displayCompany, candidates: store.logoCandidates(for: record), size: 40)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(record.displayCompany)
                                .font(Font2.rowTitle)
                                .foregroundStyle(Palette.ink)
                                .lineLimit(1)
                            Text(record.displayRole)
                                .font(Font2.caption)
                                .foregroundStyle(Palette.ink500)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        StatusChip(status: record.appStatus)
                    }

                    HStack(spacing: 5) {
                        Image(systemName: "clock").font(.system(size: 10))
                        Text(record.appliedAgo)
                        if record.fromGmail {
                            Text("·").foregroundStyle(Palette.ink300)
                            GmailMark(size: 11)
                            Text("Gmail")
                        }
                    }
                    .font(Font2.micro)
                    .foregroundStyle(Palette.ink400)
                }
            }
        }
        .accessibilityLabel("\(record.displayCompany), \(record.displayRole), \(record.appStatus.label)")
    }
}

/// Radar's horizontal stat strip — reference: StatCard.
struct StatCard: View {
    var symbol: String
    var tint: Color6
    var value: String
    var label: String

    var body: some View {
        Card(radius: Radius.row, padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Circle()
                    .fill(Palette.tile)
                    .frame(width: 32, height: 32)
                    .overlay {
                        Image(systemName: symbol)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(tint.fg)
                    }
                VStack(alignment: .leading, spacing: 4) {
                    Text(value)
                        .font(Font2.statValue)
                        .foregroundStyle(Palette.ink)
                        .monospacedDigit()
                    Text(label)
                        .font(Font2.micro)
                        .foregroundStyle(Palette.ink500)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(width: 108)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Small parts

/// Status always travels as dot + label — never colour alone.
struct StatusChip: View {
    var status: ApplicationStatus

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(status.tint.fg)
                .frame(width: 5, height: 5)
            Text(status.label)
        }
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(status.tint.fg)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(status.tint.bg, in: .rect(cornerRadius: 6, style: .continuous))
    }
}

/// Filter pill — reference: the Radar chip row. Active = slate-900 fill.
struct FilterChip: View {
    var label: String
    var count: Int?
    var isOn: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(label)
                if let count {
                    Text("\(count)")
                        .monospacedDigit()
                        .foregroundStyle(isOn ? .white.opacity(0.65) : Palette.ink400)
                }
            }
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(isOn ? .white : Palette.ink600)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background {
                if isOn {
                    Capsule().fill(Palette.ink)
                } else {
                    Capsule().fill(Palette.card).cardShadow()
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }
}

/// Screen heading — reference: h1 text-[24px] font-semibold tracking-tight + sub.
struct ScreenHeader<Trailing: View>: View {
    var title: String
    var subtitle: String?
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(Font2.title())
                    .tracking(-0.4)
                    .foregroundStyle(Palette.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(Font2.body)
                        .foregroundStyle(Palette.ink500)
                }
            }
            Spacer(minLength: 12)
            trailing()
        }
    }
}

extension ScreenHeader where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil) {
        self.init(title: title, subtitle: subtitle) { EmptyView() }
    }
}

/// Section title + optional trailing action — reference: "Tokyo opportunities / See all".
struct SectionHeader: View {
    var title: String
    var actionLabel: String?
    var action: (() -> Void)?

    var body: some View {
        HStack {
            Text(title)
                .font(Font2.sectionTitle)
                .foregroundStyle(Palette.ink)
            Spacer()
            if let actionLabel, let action {
                Button(actionLabel, action: action)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Palette.ink500)
                    .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 4)
    }
}

/// Settings list row — reference: SettingsRow.
struct SettingsRow<Trailing: View>: View {
    var symbol: String
    var tint: Color6
    var title: String
    var subtitle: String?
    var action: (() -> Void)?
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        let content = HStack(spacing: 12) {
            IconTile(symbol: symbol, tint: tint, size: 36, glyph: 15)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(Font2.cardTitle)
                    .foregroundStyle(Palette.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.ink400)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            trailing()
        }
        .padding(10)

        if let action {
            Button(action: action) { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }
}

extension SettingsRow where Trailing == Chevron {
    init(symbol: String, tint: Color6, title: String, subtitle: String? = nil, action: @escaping () -> Void) {
        self.init(symbol: symbol, tint: tint, title: title, subtitle: subtitle, action: action) { Chevron() }
    }
}

struct Chevron: View {
    var body: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Palette.ink300)
            .padding(.trailing, 6)
    }
}


/// The Gmail envelope, ported from the web's GmailMark.jsx (nominative use, to
/// label the integration and tag inbox-sourced records). Drawn as paths so it
/// stays crisp at badge sizes — an SF envelope glyph is not Gmail.
struct GmailMark: View {
    var size: CGFloat = 14

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 48

            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }

            // Right flap (green)
            var path = Path()
            path.move(to: pt(45, 16.2)); path.addLine(to: pt(40, 18.95))
            path.addLine(to: pt(35, 23.7)); path.addLine(to: pt(35, 40))
            path.addLine(to: pt(42, 40))
            path.addQuadCurve(to: pt(45, 37), control: pt(45, 40))
            path.closeSubpath()
            context.fill(path, with: .color(Color(hex: 0x4CAF50)))

            // Left flap (blue)
            path = Path()
            path.move(to: pt(3, 16.2)); path.addLine(to: pt(6.614, 17.91))
            path.addLine(to: pt(13, 23.7)); path.addLine(to: pt(13, 40))
            path.addLine(to: pt(6, 40))
            path.addQuadCurve(to: pt(3, 37), control: pt(3, 40))
            path.closeSubpath()
            context.fill(path, with: .color(Color(hex: 0x1E88E5)))

            // Envelope M (red)
            path = Path()
            path.move(to: pt(35, 11.2)); path.addLine(to: pt(24, 19.45))
            path.addLine(to: pt(13, 11.2)); path.addLine(to: pt(12, 17))
            path.addLine(to: pt(13, 23.7)); path.addLine(to: pt(24, 31.95))
            path.addLine(to: pt(35, 23.7)); path.addLine(to: pt(36, 17))
            path.closeSubpath()
            context.fill(path, with: .color(Color(hex: 0xE53935)))

            // Left fold (dark red)
            path = Path()
            path.move(to: pt(3, 12.3)); path.addLine(to: pt(3, 16.2))
            path.addLine(to: pt(13, 23.7)); path.addLine(to: pt(13, 11.2))
            path.addLine(to: pt(9.876, 8.86))
            path.addQuadCurve(to: pt(3, 12.3), control: pt(3.5, 8.5))
            path.closeSubpath()
            context.fill(path, with: .color(Color(hex: 0xC62828)))

            // Right fold (yellow)
            path = Path()
            path.move(to: pt(45, 12.3)); path.addLine(to: pt(45, 16.2))
            path.addLine(to: pt(35, 23.7)); path.addLine(to: pt(35, 11.2))
            path.addLine(to: pt(38.124, 8.86))
            path.addQuadCurve(to: pt(45, 12.3), control: pt(44.5, 8.5))
            path.closeSubpath()
            context.fill(path, with: .color(Color(hex: 0xFBC02D)))
        }
        .frame(width: size, height: size * 0.78)   // the mark is wider than tall
        .accessibilityHidden(true)
    }
}

/// Empty state — the web's "No applications tracked yet" equivalent.
struct EmptyNote: View {
    var symbol: String
    var title: String
    var message: String

    var body: some View {
        VStack(spacing: 10) {
            RoundedRectangle(cornerRadius: Radius.tile, style: .continuous)
                .fill(Palette.tile)
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: symbol)
                        .font(.system(size: 18))
                        .foregroundStyle(Palette.ink400)
                }
            Text(title)
                .font(Font2.rowTitle)
                .foregroundStyle(Palette.ink)
            Text(message)
                .font(Font2.caption)
                .foregroundStyle(Palette.ink500)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}

// MARK: - Previews

/// The component gallery: every piece of the vocabulary on one canvas, so a token
/// change can be judged everywhere at once instead of screen by screen.
#if DEBUG
#Preview("Component gallery") {
    ScrollView {
        VStack(alignment: .leading, spacing: 20) {
            ScreenHeader(title: "Japan matches", subtitle: "173 verified live roles") {
                StreakPill(count: 6)
            }

            HStack(spacing: 12) {
                ForEach(ApplicationStatus.allCases) { status in
                    StatusChip(status: status)
                }
            }

            HStack(spacing: 8) {
                FilterChip(label: "All tracks", count: nil, isOn: true) {}
                FilterChip(label: "Tokyo", count: 72, isOn: false) {}
            }

            HStack(spacing: 12) {
                StatCard(symbol: "mappin.and.ellipse", tint: .blue, value: "72", label: "Tokyo")
                StatCard(symbol: "globe", tint: .teal, value: "122", label: "English")
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ActionCard(symbol: "location.north.circle", tint: .teal,
                           title: "Radar", subtitle: "173 matches") {}
                ActionCard(symbol: "briefcase", tint: .purple,
                           title: "Applications", subtitle: "3 tracked") {}
            }

            MatchCard(item: .sampleHennge) {}
            ApplicationCard(record: .sampleInterview) {}
            ShimmerBox(height: 76)
            EmptyNote(symbol: "tray", title: "No applications yet",
                      message: "Track a role from Radar and it will show up here.")
        }
        .padding(20)
    }
    .background(Palette.canvas)
}
#endif
