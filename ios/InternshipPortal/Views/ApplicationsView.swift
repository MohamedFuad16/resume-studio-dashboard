// Applications — every company tracked, with logos, status and next step.
// Web counterpart: components/ApplicationsView.jsx.
import SwiftUI

struct ApplicationsView: View {
    @Environment(CatalogStore.self) private var store
    @Binding var route: Route?

    @State private var filter: ApplicationStatus?

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
    }
}
