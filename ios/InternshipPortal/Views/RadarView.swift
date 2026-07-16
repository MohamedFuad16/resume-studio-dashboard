// Radar — the reference's RadarTab over the live catalog.
// Search, filter chips, stat strip (over the radar-sweep shader), ranked matches.
import SwiftUI

struct RadarView: View {
    @Environment(CatalogStore.self) private var store
    @Binding var route: Route?

    @State private var query = ""
    @State private var filter: RadarFilter = .all

    enum RadarFilter: String, CaseIterable, Identifiable {
        case all, tokyo, english, saved
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: "All tracks"
            case .tokyo: "Tokyo"
            case .english: "English"
            case .saved: "Saved"
            }
        }
    }

    private var results: [Internship] {
        var items = store.internships

        switch filter {
        case .all: break
        case .tokyo: items = items.filter(\.isTokyo)
        case .english: items = items.filter(\.isEnglishFirst)
        case .saved: items = items.filter { store.status(for: $0.id) == .saved }
        }

        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return items }
        return items.filter {
            $0.displayCompany.localizedCaseInsensitiveContains(trimmed)
                || $0.displayRole.localizedCaseInsensitiveContains(trimmed)
                || $0.displayLocation.localizedCaseInsensitiveContains(trimmed)
                || ($0.track ?? "").localizedCaseInsensitiveContains(trimmed)
        }
    }

    var body: some View {
        TabScroll {
            ScreenHeader(
                title: "Japan matches",
                subtitle: store.internships.isEmpty ? "Loading catalog…" : "\(store.internships.count) verified live roles"
            )
            .padding(.bottom, 18)

            SearchField(query: $query)
                .padding(.bottom, 14)

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(RadarFilter.allCases) { option in
                        FilterChip(
                            label: option.label,
                            count: option == .saved ? store.count(of: .saved) : nil,
                            isOn: filter == option
                        ) {
                            withAnimation(.easeOut(duration: 0.18)) { filter = option }
                        }
                    }
                }
                .padding(.horizontal, 20)
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -20)
            .padding(.bottom, 14)

            ScrollView(.horizontal) {
                HStack(spacing: 12) {
                    StatCard(symbol: "mappin.and.ellipse", tint: .blue, value: "\(store.tokyoCount)", label: "Tokyo")
                    StatCard(symbol: "star", tint: .indigo, value: "\(store.japanCount)", label: "Japan total")
                    StatCard(symbol: "globe", tint: .teal, value: "\(store.englishFirstCount)", label: "English")
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
                        title: "No roles match",
                        message: "Try a different search or clear the filters."
                    )
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(results) { item in
                            MatchCard(item: item) { route = .internship(item) }
                        }
                    }
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
