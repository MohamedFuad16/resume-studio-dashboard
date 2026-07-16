// Roles — the full catalog as a browsable, sectioned list (the planner's
// "to-do list" analog). Search is deliberately a small pill INSIDE the content,
// not a navigation-bar field and not a tab: browsing is the primary mode, and
// the reference has no search chrome anywhere.
import SwiftUI

struct RadarView: View {
    @Environment(CatalogStore.self) private var catalog
    @State private var query = ""
    @FocusState private var searchFocused: Bool

    private var results: [Internship] {
        guard !query.isEmpty else { return catalog.internships }
        return catalog.internships.filter { item in
            [item.company, item.role, item.location, item.track,
             item.techStack?.joined(separator: " ")]
                .compactMap { $0 }
                .contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }

    private var priority: [Internship] { results.filter { $0.priority == true } }
    private var tokyo: [Internship] { results.filter { $0.priority != true && $0.isTokyo } }
    private var worldwide: [Internship] { results.filter { $0.priority != true && !$0.isTokyo } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    searchPill

                    switch catalog.phase {
                    case .idle, .loading:
                        ProgressView("Loading live roles…")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 80)
                    case .failed(let message):
                        ContentUnavailableView("Couldn't reach the portal",
                                               systemImage: "wifi.slash",
                                               description: Text(message))
                    case .loaded:
                        if results.isEmpty {
                            ContentUnavailableView.search(text: query)
                                .padding(.vertical, 40)
                        } else {
                            if !priority.isEmpty {
                                RoleSection(icon: "star", title: "Priority", items: priority)
                            }
                            if !tokyo.isEmpty {
                                RoleSection(icon: "sun.horizon", title: "Tokyo", items: tokyo)
                            }
                            if !worldwide.isEmpty {
                                RoleSection(icon: "globe.asia.australia", title: "Worldwide", items: worldwide)
                            }
                        }
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

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Roles")
                .font(.title2.weight(.bold))
                .foregroundStyle(Theme.ink)
            Text("\(catalog.internships.count) verified, checked against official sources")
                .font(.subheadline)
                .foregroundStyle(Theme.muted)
        }
        .padding(.top, 6)
    }

    // White capsule search field — content, not chrome.
    private var searchPill: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Theme.faint)
            TextField("Company, role, or keyword", text: $query)
                .focused($searchFocused)
                .font(.subheadline)
                .foregroundStyle(Theme.ink)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !query.isEmpty {
                Button {
                    query = ""
                    searchFocused = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Theme.faint)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .background(Theme.card, in: .capsule)
        .overlay(Capsule().strokeBorder(Theme.chipLine))
    }
}

// Section header + shared rows, identical language to the dashboard sections.
private struct RoleSection: View {
    let icon: String
    let title: String
    let items: [Internship]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.title3.weight(.regular))
                    .foregroundStyle(Theme.muted)
                Text(title)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Spacer()
                Text("\(items.count)")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.faint)
            }
            .padding(.top, 12)
            .padding(.bottom, 4)

            ForEach(items) { item in
                NavigationLink(value: item) {
                    InternshipRow(item: item)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

#Preview {
    MainTabView().environment(SessionStore())
}
