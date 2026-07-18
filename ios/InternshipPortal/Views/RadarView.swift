// Radar — the reference's RadarTab over the live catalog.
// Search, filter chips, stat strip (over the radar-sweep shader), ranked matches.
import SwiftUI

struct RadarView: View {
    @Environment(CatalogStore.self) private var store
    @Binding var route: Route?

    @State private var query = ""
    @State private var location: LocationFilter = .all
    @State private var language: LanguageFilter = .all
    @State private var sort: RadarSort = .match

    enum LocationFilter: String, CaseIterable, Identifiable {
        case all, tokyo, remote, elsewhere
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: String(localized: "All locations")
            case .tokyo: String(localized: "Tokyo")
            case .remote: String(localized: "Remote")
            case .elsewhere: String(localized: "Elsewhere")
            }
        }
        var symbol: String {
            switch self {
            case .all: "globe.asia.australia"
            case .tokyo: "mappin.and.ellipse"
            case .remote: "laptopcomputer.and.iphone"
            case .elsewhere: "map"
            }
        }
    }

    enum LanguageFilter: String, CaseIterable, Identifiable {
        case all, english, japanese
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: String(localized: "All languages")
            case .english: String(localized: "English-first")
            case .japanese: String(localized: "Japanese")
            }
        }
        var symbol: String {
            switch self {
            case .all: "globe"
            case .english: "textformat.abc"
            case .japanese: "character.bubble"
            }
        }
    }

    enum RadarSort: String, CaseIterable, Identifiable {
        case match, deadline, company
        var id: String { rawValue }
        var label: String {
            switch self {
            case .match: String(localized: "Best match")
            case .deadline: String(localized: "Deadline")
            case .company: String(localized: "Company A–Z")
            }
        }
        var symbol: String {
            switch self {
            case .match: "sparkles"
            case .deadline: "clock"
            case .company: "textformat"
            }
        }
    }

    private static func isRemote(_ item: Internship) -> Bool {
        (item.workMode ?? "").localizedCaseInsensitiveContains("remote")
            || item.displayLocation.localizedCaseInsensitiveContains("remote")
    }

    private var results: [Internship] {
        var items = store.internships

        switch location {
        case .all: break
        case .tokyo: items = items.filter(\.isTokyo)
        case .remote: items = items.filter(Self.isRemote)
        case .elsewhere: items = items.filter { !$0.isTokyo && !Self.isRemote($0) }
        }

        switch language {
        case .all: break
        case .english: items = items.filter(\.isEnglishFirst)
        case .japanese: items = items.filter { !$0.isEnglishFirst }
        }

        let trimmed = query.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            items = items.filter {
                $0.displayCompany.localizedCaseInsensitiveContains(trimmed)
                    || $0.displayRole.localizedCaseInsensitiveContains(trimmed)
                    || $0.displayLocation.localizedCaseInsensitiveContains(trimmed)
                    || ($0.track ?? "").localizedCaseInsensitiveContains(trimmed)
            }
        }

        switch sort {
        case .match:
            // The catalog arrives ranked; keep that order (score with tie-breaks).
            return items
        case .deadline:
            // deadlineDate is YYYY-MM-DD, so string order IS date order; roles
            // without one sink to the bottom rather than fake urgency.
            return items.sorted {
                let a = $0.deadlineDate ?? "9999", b = $1.deadlineDate ?? "9999"
                return a == b ? ($0.score ?? 0) > ($1.score ?? 0) : a < b
            }
        case .company:
            return items.sorted {
                $0.displayCompany.localizedCaseInsensitiveCompare($1.displayCompany) == .orderedAscending
            }
        }
    }

    /// The control row: three menus — sort, location, language. Menus, not chip
    /// toggles: each has 3–4 options and the current choice must stay readable.
    /// An active filter wears the ink fill, same as the old selected chip.
    private var sortMenu: some View {
        FilterMenuPill(icon: "arrow.up.arrow.down", label: sort.label, isActive: false) {
            Picker("Sort by", selection: $sort) {
                ForEach(RadarSort.allCases) { option in
                    Label(option.label, systemImage: option.symbol).tag(option)
                }
            }
        }
        .accessibilityLabel("Sort by \(sort.label)")
    }

    private var locationMenu: some View {
        FilterMenuPill(icon: "mappin.and.ellipse", label: location.label, isActive: location != .all) {
            Picker("Location", selection: $location) {
                ForEach(LocationFilter.allCases) { option in
                    Label(option.label, systemImage: option.symbol).tag(option)
                }
            }
        }
        .accessibilityLabel("Location: \(location.label)")
    }

    private var languageMenu: some View {
        FilterMenuPill(icon: "globe", label: language.label, isActive: language != .all) {
            Picker("Language", selection: $language) {
                ForEach(LanguageFilter.allCases) { option in
                    Label(option.label, systemImage: option.symbol).tag(option)
                }
            }
        }
        .accessibilityLabel("Language: \(language.label)")
    }

    var body: some View {
        TabScroll {
            ScreenHeader(
                title: String(localized: "Japan matches"),
                subtitle: store.internships.isEmpty ? String(localized: "Loading catalog…") : String(localized: "\(store.internships.count) verified live roles")
            )
            .padding(.bottom, 18)

            SearchField(query: $query)
                .padding(.bottom, 14)

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    sortMenu
                    locationMenu
                    languageMenu
                }
                .padding(.horizontal, 20)
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -20)
            .padding(.bottom, 14)

            ScrollView(.horizontal) {
                HStack(spacing: 12) {
                    StatCard(symbol: "mappin.and.ellipse", tint: .blue, value: "\(store.tokyoCount)", label: String(localized: "Tokyo"))
                    StatCard(symbol: "star", tint: .indigo, value: "\(store.japanCount)", label: String(localized: "Japan total"))
                    StatCard(symbol: "globe", tint: .teal, value: "\(store.englishFirstCount)", label: String(localized: "English"))
                }
                .padding(.horizontal, 20)
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -20)
            .padding(.bottom, 18)

            switch store.phase {
            case .loading where store.internships.isEmpty:
                VStack(spacing: 10) {
                    ForEach(0..<5, id: \.self) { _ in ShimmerBox(height: 76) }
                }
            case .failed(let message):
                FailureNote(message: message) { Task { await store.load() } }
            default:
                if results.isEmpty {
                    EmptyNote(
                        symbol: "magnifyingglass",
                        title: String(localized: "No roles match"),
                        message: String(localized: "Try a different search or clear the filters.")
                    )
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(Array(results.enumerated()), id: \.element.id) { index, item in
                            MatchCard(item: item) { route = .internship(item) }
                                .smoothAppear(index)
                        }
                    }
                }
            }
        }
    }
}

/// A menu wearing the FilterChip's clothes: pill, icon, current value, and the
/// ink fill when its filter is narrowing the list.
private struct FilterMenuPill<Content: View>: View {
    var icon: String
    var label: String
    var isActive: Bool
    @ViewBuilder var content: () -> Content

    var body: some View {
        Menu(content: content) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                Text(label)
                Image(systemName: "chevron.down")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(isActive ? .white.opacity(0.65) : Palette.ink400)
            }
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(isActive ? .white : Palette.ink600)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background {
                if isActive {
                    Capsule().fill(Palette.ink)
                } else {
                    Capsule().fill(Palette.card).cardShadow()
                    Capsule().strokeBorder(Palette.hairline, lineWidth: 1)
                }
            }
        }
    }
}

struct SearchField: View {
    @Binding var query: String
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Palette.ink400)
            TextField("Search company or role…", text: $query)
                .font(Font2.body)
                .foregroundStyle(Palette.ink)
                .focused($focused)
                .submitLabel(.search)
                .autocorrectionDisabled()
            if !query.isEmpty {
                Button {
                    query = ""
                    focused = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 15))
                        .foregroundStyle(Palette.ink300)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .background(Palette.card, in: .rect(cornerRadius: Radius.row, style: .continuous))
        .cardShadow()
    }
}

/// The web hangs forever on a failed load; this says what happened and offers the
/// one action that helps.
struct FailureNote: View {
    var message: String
    var retry: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 22))
                .foregroundStyle(Palette.ink400)
            Text("Couldn't reach the portal")
                .font(Font2.rowTitle)
                .foregroundStyle(Palette.ink)
            Text(message)
                .font(Font2.caption)
                .foregroundStyle(Palette.ink500)
                .multilineTextAlignment(.center)
            Button("Try again", action: retry)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(Palette.ink, in: .capsule)
                .buttonStyle(.plain)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Radar — ranked list") {
    @Previewable @State var route: Route?
    AmbientCanvas { RadarView(route: $route) }
        .environment(CatalogStore.preview)
}

#Preview("Radar — loading") {
    @Previewable @State var route: Route?
    AmbientCanvas { RadarView(route: $route) }
        .environment(CatalogStore.previewLoading)
}

#Preview("Radar — offline") {
    @Previewable @State var route: Route?
    AmbientCanvas { RadarView(route: $route) }
        .environment(CatalogStore.previewFailed)
}
#endif
