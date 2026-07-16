// Home — the reference's HomeTab, wired to real catalog + tracker data.
// Greeting, streak, 2×2 launcher, Tokyo opportunities, recent applications.
import SwiftUI

struct HomeView: View {
    @Environment(CatalogStore.self) private var store
    @Binding var tab: Tab
    @Binding var route: Route?

    private var greeting: String {
        let hour = CatalogStore.tokyoCalendar.component(.hour, from: .now)
        switch hour {
        case 5..<12: return "Good morning, Mohamed"
        case 12..<17: return "Good afternoon, Mohamed"
        default: return "Good evening, Mohamed"
        }
    }

    /// The status line under the greeting states the thing most worth knowing,
    /// rather than a generic hello.
    private var statusLine: String {
        let interviews = store.count(of: .interview)
        if interviews > 0 {
            return "\(interviews) interview\(interviews == 1 ? "" : "s") in progress"
        }
        if store.tracker.isEmpty { return "Nothing tracked yet" }
        return "\(store.tracker.count) applications tracked"
    }

    private var tokyoPicks: [Internship] {
        Array(store.untracked.filter(\.isTokyo).prefix(3))
    }

    var body: some View {
        TabScroll {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(greeting)
                        .font(.system(size: 22, weight: .semibold))
                        .tracking(-0.4)
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(statusLine)
                        .font(Font2.body)
                        .foregroundStyle(Palette.ink500)
                }
                Spacer(minLength: 12)
                StreakPill(count: store.count(of: .applied) + store.count(of: .interview))
            }
            .padding(.bottom, 24)

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                ActionCard(
                    symbol: "location.north.circle", tint: .teal,
                    title: "Radar",
                    subtitle: store.internships.isEmpty ? "Loading…" : "\(store.internships.count) matches"
                ) { tab = .radar }

                ActionCard(
                    symbol: "briefcase", tint: .purple,
                    title: "Applications",
                    subtitle: "\(store.tracker.count) tracked"
                ) { tab = .applications }

                ActionCard(
                    symbol: "calendar", tint: .blue,
                    title: "Calendar",
                    subtitle: nextEventLabel
                ) { tab = .calendar }

                ActionCard(
                    symbol: "person.crop.circle", tint: .orange,
                    title: "Profile",
                    subtitle: "Résumé & keys"
                ) { route = .profile }
            }
            .padding(.bottom, 28)

            SectionHeader(title: "Tokyo opportunities", actionLabel: "See all") { tab = .radar }
                .padding(.bottom, 12)

            if store.phase == .loading && store.internships.isEmpty {
                VStack(spacing: 10) {
                    ForEach(0..<3, id: \.self) { _ in ShimmerBox(height: 76) }
                }
                .padding(.bottom, 24)
            } else if tokyoPicks.isEmpty {
                EmptyNote(
                    symbol: "location.slash",
                    title: "No new Tokyo roles",
                    message: "Every Tokyo listing is already in your applications."
                )
                .padding(.bottom, 24)
            } else {
                VStack(spacing: 10) {
                    ForEach(tokyoPicks) { item in
                        MatchCard(item: item) { route = .internship(item) }
                    }
                }
                .padding(.bottom, 28)
            }

            SectionHeader(title: "Recent applications")
                .padding(.bottom, 12)

            if store.records.isEmpty {
                EmptyNote(
                    symbol: "tray",
                    title: "No applications tracked yet",
                    message: "Save or start a role in Radar and it will appear here."
                )
            } else {
                VStack(spacing: 10) {
                    ForEach(store.records.prefix(3)) { record in
                        ApplicationCard(record: record) { route = .record(record) }
                    }
                }
            }
        }
    }

    private var nextEventLabel: String {
        let today = CatalogStore.dayKey(.now)
        let upcoming = store.events.filter { $0.date >= today }.sorted { $0.date < $1.date }
        guard let next = upcoming.first else { return "No events" }
        let parts = next.date.split(separator: "-")
        guard parts.count == 3, let month = Int(parts[1]), let day = Int(parts[2]) else { return "Deadlines" }
        let names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return "Next \(names[month]) \(day)"
    }
}

/// The reference's streak chip. Here it counts live applications rather than a
/// habit streak — a number that means something in this app.
struct StreakPill: View {
    var count: Int

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "flame.fill")
                .font(.system(size: 13))
                .foregroundStyle(Palette.orange400)
            Text("\(count)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Palette.ink)
                .monospacedDigit()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Palette.card, in: .capsule)
        .cardShadow()
        .accessibilityLabel("\(count) active applications")
    }
}

// MARK: - Previews

#Preview("Home — with data") {
    @Previewable @State var tab: Tab = .home
    @Previewable @State var route: Route?
    AmbientCanvas { HomeView(tab: $tab, route: $route) }
        .environment(CatalogStore.preview)
}

#Preview("Home — nothing tracked") {
    @Previewable @State var tab: Tab = .home
    @Previewable @State var route: Route?
    AmbientCanvas { HomeView(tab: $tab, route: $route) }
        .environment(CatalogStore.previewEmpty)
}

#Preview("Home — loading") {
    @Previewable @State var tab: Tab = .home
    @Previewable @State var route: Route?
    AmbientCanvas { HomeView(tab: $tab, route: $route) }
        .environment(CatalogStore.previewLoading)
}
