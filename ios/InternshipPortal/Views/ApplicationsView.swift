// Applications — every company tracked, with logos, status and next step.
// Web counterpart: components/ApplicationsView.jsx.
import SwiftUI

struct ApplicationsView: View {
    @Environment(CatalogStore.self) private var store
    @Binding var route: Route?

    @State private var filter: ApplicationStatus?
    @State private var showCompanies = false
    /// Set by the row's Remove action; drives the confirmation below. Deleting a
    /// tracked application is not undoable, so it asks first.
    @State private var pendingRemoval: TrackerRecord?

    private var companyCount: Int {
        Set(store.internships.map { $0.displayCompany.lowercased() }).count
    }

    private var results: [TrackerRecord] {
        guard let filter else { return store.records }
        return store.records(in: filter)
    }

    var body: some View {
        // The stack exists so Companies can be PUSHED as a full page — it is a
        // destination, not a card. The AmbientCanvas sits INSIDE the stack (the
        // stack's own ground is opaque and would cover it), and the tab's screen
        // keeps its custom header, so the bar stays hidden until a push.
        NavigationStack {
            // Application records open as SHEETS, deliberately. The card-expand
            // treatment was tried here first and produced a double chrome — the
            // expander's close button stacked over RecordSheet's own — because
            // RecordSheet is a finished view with its own header. Expansion lives
            // where a view can own the whole canvas: the Companies orbs
            // (CompanyDetailView). Owner's call, 2026-07-20.
            AmbientCanvas(active: route == nil) { content }
                .navigationDestination(isPresented: $showCompanies) { CompaniesView() }
                .toolbar(.hidden, for: .navigationBar)
        }
    }

    private var content: some View {
        TabScroll {
            ScreenHeader(
                title: String(localized: "Applications"),
                subtitle: store.tracker.isEmpty
                    ? String(localized: "Nothing tracked yet")
                    : String(localized: "\(store.tracker.count) companies · synced from Gmail")
            )
            .padding(.bottom, 18)

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    FilterChip(label: String(localized: "All"), count: store.records.count, isOn: filter == nil) {
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
                    title: filter == nil ? String(localized: "No applications yet") : String(localized: "Nothing in \(filter!.label)"),
                    message: filter == nil
                        ? String(localized: "Track a role from Radar and it will show up here.")
                        : String(localized: "No company is at this stage right now.")
                )
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(Array(results.enumerated()), id: \.element.id) { index, record in
                        ApplicationCard(record: record) { route = .record(record) }
                            .smoothAppear(index)
                            // Long-press to remove. Not `.swipeActions` — that is
                            // List-only and this is a LazyVStack of cards. The
                            // classifier decides what ARRIVES, but nothing else
                            // could remove a row it got wrong (a role you never
                            // applied to), so the tracker had no correction path
                            // short of a full rebuild.
                            .contextMenu {
                                Button(role: .destructive) {
                                    pendingRemoval = record
                                } label: {
                                    Label(String(localized: "Remove"), systemImage: "trash")
                                }
                            }
                    }
                }
                // The whole list is replaced when a filter changes; without this it
                // swaps in one frame.
                .animation(.snappy(duration: 0.35), value: filter)
            }
        }
        .alert(
            String(localized: "Remove this application?"),
            isPresented: .init(get: { pendingRemoval != nil }, set: { if !$0 { pendingRemoval = nil } }),
            presenting: pendingRemoval
        ) { record in
            Button(String(localized: "Remove"), role: .destructive) {
                let id = record.id
                pendingRemoval = nil
                Task { await store.removeRecord(id) }
            }
            Button(String(localized: "Cancel"), role: .cancel) { pendingRemoval = nil }
        } message: { record in
            Text("\(record.displayCompany) — \(record.displayRole) will be removed from your tracker. If Gmail still has the email, a future sync can bring it back; rebuild from Settings to re-derive everything.")
        }
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
        .init(id: "a", name: "HENNGE", logoCandidates: [], roleCount: 4, bestScore: 99,
              status: .interview, tier: .flagship, tint: .indigo),
        .init(id: "b", name: "Rakuten", logoCandidates: [], roleCount: 3, bestScore: 98,
              status: .applied, tier: .scaleUp, tint: .teal),
        .init(id: "c", name: "Sakana", logoCandidates: [], roleCount: 2, bestScore: 92,
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

#if DEBUG
#Preview("Applications — tracked") {
    @Previewable @State var route: Route?
    ApplicationsView(route: $route)
        .environment(CatalogStore.preview)
}

#Preview("Applications — empty") {
    @Previewable @State var route: Route?
    ApplicationsView(route: $route)
        .environment(CatalogStore.previewEmpty)
}
#endif
