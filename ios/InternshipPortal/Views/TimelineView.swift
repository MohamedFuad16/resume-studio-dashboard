// Application timeline — deadline-first, from live catalog data. The web's
// calendar shows the user's tracked applications; until sign-in lands this
// shows upcoming catalog deadlines, which are real and public. The red date
// badge is the same marker the web calendar uses for "today".
import SwiftUI

struct TimelineView: View {
    @Environment(CatalogStore.self) private var catalog

    private static let wireFormat: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        // Deadlines are Japan-time dates on the server (see the web's BUG-009).
        formatter.timeZone = TimeZone(identifier: "Asia/Tokyo")
        return formatter
    }()

    private var upcoming: [(date: Date, items: [Internship])] {
        let today = Calendar.current.startOfDay(for: .now)
        let dated: [(Date, Internship)] = catalog.internships.compactMap { item in
            guard let raw = item.deadlineDate, let date = Self.wireFormat.date(from: raw),
                  date >= today else { return nil }
            return (date, item)
        }
        return Dictionary(grouping: dated, by: \.0)
            .map { (date: $0.key, items: $0.value.map(\.1)) }
            .sorted { $0.date < $1.date }
    }

    var body: some View {
        NavigationStack {
            Group {
                if upcoming.isEmpty {
                    ContentUnavailableView(
                        "No dated deadlines",
                        systemImage: "calendar.badge.checkmark",
                        description: Text("Most catalog roles are rolling admission. Deadline-dated roles appear here as they're verified.")
                    )
                } else {
                    List {
                        ForEach(upcoming, id: \.date) { group in
                            Section {
                                ForEach(group.items) { item in
                                    NavigationLink(value: item) {
                                        InternshipRow(item: item)
                                    }
                                    .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
                                    .listRowSeparator(.hidden)
                                }
                            } header: {
                                DeadlineBadge(date: group.date)
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Timeline")
            .navigationSubtitle("Upcoming application deadlines")
            .navigationDestination(for: Internship.self) { InternshipDetailView(item: $0) }
            .refreshable { await catalog.load() }
        }
    }
}

// The red day badge from the web calendar (layered red, pale-pink numeral),
// built with glass + tint instead of CSS gradients.
struct DeadlineBadge: View {
    let date: Date

    var body: some View {
        HStack(spacing: 10) {
            Text(date, format: .dateTime.day())
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Color(red: 1.0, green: 0.82, blue: 0.84))
                .frame(width: 34, height: 34)
                .glassEffect(.regular.tint(Theme.deadline), in: .circle)
            Text(date, format: .dateTime.weekday(.wide).month().day())
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.muted)
        }
        .textCase(nil)
        .padding(.vertical, 2)
    }
}

#Preview {
    MainTabView().environment(SessionStore())
}
