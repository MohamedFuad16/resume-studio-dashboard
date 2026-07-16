// Applications — every company tracked, with logos, status and next step.
// Web counterpart: components/ApplicationsView.jsx.
import SwiftUI

struct ApplicationsView: View {
    @Environment(CatalogStore.self) private var store
    @Binding var route: Route?

    @State private var filter: ApplicationStatus?
    @State private var showCompanies = false

    private var companyCount: Int {
        Set(store.internships.map { $0.displayCompany.lowercased() }).count
    }

    private var results: [TrackerRecord] {
        guard let filter else { return store.records }
        return store.records(in: filter)
    }

    var body: some View {
        TabScroll {
            ScreenHeader(
                title: "Applications",
                subtitle: store.tracker.isEmpty
                    ? "Nothing tracked yet"
                    : "\(store.tracker.count) companies · synced from Gmail"
            )
            .padding(.bottom, 18)

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    FilterChip(label: "All", count: store.records.count, isOn: filter == nil) {
                        withAnimation(.easeOut(duration: 0.18)) { filter = nil }
                    }
                    ForEach(ApplicationStatus.allCases) { status in
                        FilterChip(
                            label: status.label,
                            count: store.count(of: status),
                            isOn: filter == status
                        ) {
                            withAnimation(.easeOut(duration: 0.18)) { filter = status }
                        }
                    }
                }
                .padding(.horizontal, 20)
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -20)
            .padding(.bottom, 14)

            CompaniesButton(count: companyCount) { showCompanies = true }
                .padding(.bottom, 18)

            if store.phase == .loading && store.tracker.isEmpty {
                VStack(spacing: 10) {
                    ForEach(0..<4, id: \.self) { _ in ShimmerBox(height: 92) }
                }
            } else if results.isEmpty {
                EmptyNote(
                    symbol: "tray",
                    title: filter == nil ? "No applications yet" : "Nothing in \(filter!.label)",
                    message: filter == nil
                        ? "Track a role from Radar and it will show up here."
                        : "No company is at this stage right now."
                )
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(results) { record in
                        ApplicationCard(record: record) { route = .record(record) }
                    }
                }
            }
        }
        .sheet(isPresented: $showCompanies) { CompaniesView() }
        .task {
            // Screenshot hook: `simctl launch … -sheet companies`.
            if UserDefaults.standard.string(forKey: "sheet") == "companies" {
                showCompanies = true
            }
        }
    }
}

/// Entry to the bubble field. It previews the thing it opens — three small orbs —
/// rather than describing it, because "Companies" alone gives no reason to tap.
private struct CompaniesButton: View {
    var count: Int
    var action: () -> Void

    private static let preview: [CompanyBubble] = [
        .init(id: "a", name: "HENNGE", logoURL: nil, roleCount: 4, bestScore: 99,
              status: .interview, tier: .flagship, tint: .indigo),
        .init(id: "b", name: "Rakuten", logoURL: nil, roleCount: 3, bestScore: 98,
              status: .applied, tier: .scaleUp, tint: .teal),
        .init(id: "c", name: "Sakana", logoURL: nil, roleCount: 2, bestScore: 92,
              status: nil, tier: .startup, tint: .orange),
    ]

    var body: some View {
        PressableCard(action: action) {
            Card(radius: Radius.row, padding: 14) {
                HStack(spacing: 12) {
                    HStack(spacing: -14) {
                        ForEach(Self.preview) { bubble in
                            GlassOrb(bubble: bubble, diameter: 38)
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Companies")
                            .font(Font2.rowTitle)
                            .foregroundStyle(Palette.ink)
                        Text("\(count) hiring · sized by role count")
                            .font(Font2.caption)
                            .foregroundStyle(Palette.ink500)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    Chevron()
                }
            }
        }
        .accessibilityLabel("Companies. \(count) hiring.")
    }
}

// MARK: - Previews

#Preview("Applications — tracked") {
    @Previewable @State var route: Route?
    AmbientCanvas { ApplicationsView(route: $route) }
        .environment(CatalogStore.preview)
}

#Preview("Applications — empty") {
    @Previewable @State var route: Route?
    AmbientCanvas { ApplicationsView(route: $route) }
        .environment(CatalogStore.previewEmpty)
}
