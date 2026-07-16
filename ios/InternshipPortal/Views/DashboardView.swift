// Dashboard — the task-planner reference, one to one:
//   avatar + "Today ▾" + date, two circular buttons (search / add)
//   outlined stat chips
//   the glowing green focus card (our single best match) with a Start-style CTA
//   sectioned lists ("Tokyo first" / "Beyond Tokyo") with Add-style pills,
//   rows = pastel circle icon, title + inline chips, gray subtitle.
// All numbers are the live public catalog.
import SwiftUI

struct DashboardView: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(NavModel.self) private var nav

    private var topMatch: Internship? { catalog.internships.first }
    private var tokyo: [Internship] { catalog.internships.dropFirst().filter(\.isTokyo) }
    private var beyond: [Internship] { catalog.internships.dropFirst().filter { !$0.isTokyo } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    statChips

                    if let top = topMatch {
                        NavigationLink(value: top) {
                            FocusCard(item: top)
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 4)
                    }

                    if case .failed(let message) = catalog.phase {
                        ContentUnavailableView("Couldn't reach the portal",
                                               systemImage: "wifi.slash",
                                               description: Text(message))
                    } else if catalog.internships.isEmpty {
                        ProgressView().frame(maxWidth: .infinity).padding(.vertical, 60)
                    } else {
                        MatchSection(icon: "sun.horizon", title: "Tokyo first", items: Array(tokyo.prefix(4)))
                        MatchSection(icon: "sun.max", title: "Beyond Tokyo", items: Array(beyond.prefix(4)))
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
            }
            .background(Theme.canvas)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Internship.self) { InternshipDetailView(item: $0) }
            .refreshable { await catalog.load() }
        }
    }

    // ── Avatar · Today ▾ · date  |  ○search ○plus ────────────────────────
    private var header: some View {
        HStack(spacing: 12) {
            // Avatar with the reference's green presence dot.
            ZStack(alignment: .bottomTrailing) {
                Text("IP")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.tileGreen.glyph)
                    .frame(width: 44, height: 44)
                    .background(Theme.tileGreen.fill, in: .circle)
                Circle()
                    .fill(Theme.accent)
                    .frame(width: 11, height: 11)
                    .overlay(Circle().strokeBorder(.white, lineWidth: 2))
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text("Today")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Theme.ink)
                    Image(systemName: "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.muted)
                }
                Text(Date.now, format: .dateTime.weekday(.wide).month().day())
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)
            }

            Spacer()

            CircleButton(icon: "magnifyingglass") { nav.tab = .roles }
            CircleButton(icon: "plus") { nav.tab = .timeline }
        }
        .padding(.top, 6)
    }

    // ── "7 tasks · 2h 30m planned · 3 done" → live catalog stats ─────────
    private var statChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                StatPill(icon: "list.bullet.rectangle", text: "\(catalog.internships.count) roles")
                StatPill(icon: "mappin.and.ellipse", text: "\(catalog.tokyoCount) in Tokyo")
                StatPill(icon: "checkmark.circle", text: "\(catalog.englishFirstCount) English-first", iconTint: Theme.accent)
            }
        }
        .scrollClipDisabled()
    }
}

// White circular icon button (the reference's search / plus).
struct CircleButton: View {
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.body.weight(.medium))
                .foregroundStyle(Theme.ink)
                .frame(width: 44, height: 44)
                .background(Theme.card, in: .circle)
                .cardShadow()
        }
        .buttonStyle(.plain)
    }
}

// Thin outlined pill with a leading icon — the reference's stat chips.
struct StatPill: View {
    let icon: String
    let text: String
    var iconTint: Color = Theme.muted

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.footnote)
                .foregroundStyle(iconTint)
            Text(text)
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.ink)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 9)
        .background(Theme.card, in: .capsule)
        .overlay(Capsule().strokeBorder(Theme.chipLine))
    }
}

// The reference's glowing "Focus block": pale-green circular icon, title,
// two gray chips beneath, and the big green Start pill.
struct FocusCard: View {
    let item: Internship

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "scope")
                .font(.title3.weight(.medium))
                .foregroundStyle(Theme.tileGreen.glyph)
                .frame(width: 48, height: 48)
                .background(Theme.tileGreen.fill, in: .circle)

            VStack(alignment: .leading, spacing: 7) {
                Text(item.displayCompany)
                    .font(.headline)
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let score = item.score {
                        ValueChip(text: "\(score)% fit")
                    }
                    ValueChip(text: item.displayLocation.components(separatedBy: ",").first ?? "")
                }
            }

            Spacer(minLength: 10)

            HStack(spacing: 7) {
                Image(systemName: "arrow.right")
                Text("View")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            // The CTA never compresses; the title/chips column truncates instead.
            .fixedSize()
            .padding(.horizontal, 20)
            .padding(.vertical, 13)
            .background(Theme.accent, in: .capsule)
        }
        .padding(16)
        .background(Theme.card, in: .rect(cornerRadius: Theme.cardRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardRadius)
                .strokeBorder(Theme.accent.opacity(0.30), lineWidth: 1.5)
        )
        .shadow(color: Theme.accent.opacity(0.20), radius: 18, y: 4)
    }
}

// Section = "Morning / Add" header + plain rows straight on the canvas.
struct MatchSection: View {
    @Environment(NavModel.self) private var nav
    let icon: String
    let title: String
    let items: [Internship]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                HStack(spacing: 10) {
                    Image(systemName: icon)
                        .font(.title3.weight(.regular))
                        .foregroundStyle(Theme.muted)
                    Text(title)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                }
                Spacer()
                Button {
                    nav.tab = .roles
                } label: {
                    Text("See all")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Theme.ink)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(Theme.card, in: .capsule)
                        .overlay(Capsule().strokeBorder(Theme.chipLine))
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 10)
            .padding(.bottom, 6)

            ForEach(items) { item in
                NavigationLink(value: item) {
                    InternshipRow(item: item)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// Tiny filled value chip (the "50 min" chips on the reference's rows).
struct ValueChip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(Theme.muted)
            // A chip must never wrap mid-word ("Shibuy/a"); it keeps its
            // intrinsic width and the row truncates elsewhere instead.
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(Theme.chipFill, in: .capsule)
    }
}

// The reference's task row, one to one: 56pt pastel circle with an icon glyph,
// bold title with the gray value chip right after it, muted subtitle, and no
// trailing chevron (the whole row is the tap target). Shared by every list.
struct InternshipRow: View {
    let item: Internship

    var body: some View {
        HStack(spacing: 16) {
            CompanyMark(item: item)

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 10) {
                    Text(item.displayCompany)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    if let score = item.score {
                        ValueChip(text: "\(score)%")
                    }
                }
                Text(item.displayRole)
                    .font(.callout)
                    .foregroundStyle(Theme.muted)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 14)
        .contentShape(.rect)
    }
}

// The pastel icon circle. The glyph comes from the role's TRACK (the
// reference's icon language: a concept per row, not a logo or lettermark);
// the pastel pairing stays hash-stable per company.
struct CompanyMark: View {
    let item: Internship

    var body: some View {
        let tile = Theme.tile(for: item.displayCompany)
        Image(systemName: Self.glyph(for: item.track))
            .font(.system(size: 26, weight: .regular))
            .foregroundStyle(tile.glyph)
            .frame(width: 60, height: 60)
            .background(tile.fill, in: .circle)
    }

    static func glyph(for track: String?) -> String {
        let t = (track ?? "").lowercased()
        if t.contains("front") { return "macwindow" }
        if t.contains("mobile") || t.contains("ios") { return "iphone" }
        if t.contains("ai") || t.contains("data") || t.contains("machine") { return "brain.head.profile" }
        if t.contains("back") || t.contains("server") { return "server.rack" }
        if t.contains("cloud") || t.contains("devops") || t.contains("infra") { return "cloud" }
        if t.contains("security") { return "lock.shield" }
        if t.contains("qa") || t.contains("test") { return "checkmark.seal" }
        if t.contains("game") { return "gamecontroller" }
        if t.contains("embed") || t.contains("hardware") || t.contains("robot") { return "cpu" }
        if t.contains("full") { return "square.stack.3d.up" }
        return "briefcase"
    }
}

#Preview {
    MainTabView().environment(SessionStore())
}
