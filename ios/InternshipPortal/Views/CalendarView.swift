// Calendar — monthly grid + agenda for the selected day.
// Web counterpart: components/ApplicationCalendar.jsx (month view).
//
// The clock is Asia/Tokyo everywhere: deadlines are published in JST and the user
// is in Japan, so "today" must not drift with the device timezone.
import SwiftUI

struct CalendarView: View {
    @Environment(CatalogStore.self) private var store
    @Binding var route: Route?

    @State private var anchor = Date()
    @State private var selected = CatalogStore.dayKey(.now)

    private var calendar: Calendar { CatalogStore.tokyoCalendar }
    private let weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: anchor)
    }

    /// Leading blanks + every day of the anchor's month, as day keys.
    private var grid: [String?] {
        guard let interval = calendar.dateInterval(of: .month, for: anchor) else { return [] }
        let first = interval.start
        let count = calendar.range(of: .day, in: .month, for: anchor)?.count ?? 30
        // firstWeekday is Monday(2), so shift the Sunday-based weekday index.
        let weekday = calendar.component(.weekday, from: first)
        let leading = (weekday - calendar.firstWeekday + 7) % 7

        var cells: [String?] = Array(repeating: nil, count: leading)
        for offset in 0..<count {
            if let day = calendar.date(byAdding: .day, value: offset, to: first) {
                cells.append(CatalogStore.dayKey(day))
            }
        }
        return cells
    }

    private var monthEventCount: Int {
        let prefix = String(selected.prefix(7))
        return store.events.filter { $0.date.hasPrefix(prefix) }.count
    }

    var body: some View {
        TabScroll {
            ScreenHeader(title: String(localized: "Calendar"), subtitle: agendaSubtitle) {
                HStack(spacing: 8) {
                    Button("Today") {
                        withAnimation(.easeOut(duration: 0.2)) {
                            anchor = .now
                            selected = CatalogStore.dayKey(.now)
                        }
                    }
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Palette.ink600)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Palette.card, in: .capsule)
                    .cardShadow()
                    .buttonStyle(.plain)

                    Button {
                        route = .addEvent
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus").font(.system(size: 11, weight: .bold))
                            Text("Event")
                        }
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Palette.ink, in: .capsule)
                    }
                    .buttonStyle(.plain)
                    .disabled(store.tracker.isEmpty)
                    .opacity(store.tracker.isEmpty ? 0.4 : 1)
                }
            }
            .padding(.bottom, 20)

            HStack {
                MonthStep(symbol: "chevron.left", label: "Previous month") { step(-1) }
                Spacer()
                Text(monthTitle)
                    .font(Font2.sectionTitle)
                    .foregroundStyle(Palette.ink)
                    .contentTransition(.numericText())
                Spacer()
                MonthStep(symbol: "chevron.right", label: "Next month") { step(1) }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 16)

            Card(padding: 14) {
                VStack(spacing: 6) {
                    HStack(spacing: 4) {
                        ForEach(weekdays, id: \.self) { day in
                            Text(day)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Palette.ink400)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.bottom, 2)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
                        ForEach(Array(grid.enumerated()), id: \.offset) { _, key in
                            if let key {
                                DayCell(
                                    key: key,
                                    isSelected: key == selected,
                                    isToday: key == CatalogStore.dayKey(.now),
                                    events: store.events(on: key)
                                ) {
                                    withAnimation(.easeOut(duration: 0.15)) { selected = key }
                                }
                            } else {
                                Color.clear.aspectRatio(1, contentMode: .fit)
                            }
                        }
                    }
                }
            }
            .padding(.bottom, 24)

            SectionHeader(title: longDate(selected))
                .padding(.bottom, 12)

            let dayEvents = store.events(on: selected)
            if dayEvents.isEmpty {
                EmptyNote(
                    symbol: "calendar",
                    title: String(localized: "Nothing on this day"),
                    message: store.tracker.isEmpty
                        ? String(localized: "Track a role first — its deadline lands here.")
                        : String(localized: "Deadlines and interviews will appear here.")
                )
            } else {
                VStack(spacing: 10) {
                    ForEach(dayEvents) { event in
                        EventRow(event: event) {
                            if let record = store.tracker[event.recordId] {
                                route = .record(record)
                            }
                        }
                    }
                }
            }
        }
    }

    private var agendaSubtitle: String {
        if monthEventCount == 0 { return String(localized: "No events this month") }
        if monthEventCount == 1 { return String(localized: "1 event this month") }
        return String(localized: "\(monthEventCount) events this month")
    }

    private func step(_ months: Int) {
        withAnimation(.easeOut(duration: 0.2)) {
            anchor = calendar.date(byAdding: .month, value: months, to: anchor) ?? anchor
        }
    }

    private func longDate(_ key: String) -> String {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return key }
        var components = DateComponents()
        components.year = parts[0]; components.month = parts[1]; components.day = parts[2]
        guard let date = calendar.date(from: components) else { return key }
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: date)
    }
}

private struct MonthStep: View {
    var symbol: String
    var label: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Palette.ink600)
                .frame(width: 32, height: 32)
                .background(Palette.card, in: .circle)
                .cardShadow()
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

private struct DayCell: View {
    var key: String
    var isSelected: Bool
    var isToday: Bool
    var events: [CalendarEvent]
    var action: () -> Void

    private var day: String {
        String(Int(key.split(separator: "-").last.map(String.init) ?? "0") ?? 0)
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                ZStack {
                    // The web's calendar theme, verbatim: the SELECTED day wears
                    // the red disc; today (unselected) keeps a soft red wash so
                    // "where am I" survives without stealing the selection's voice.
                    if isSelected {
                        Circle().fill(Palette.red)
                    } else if isToday {
                        Circle().fill(Palette.red.opacity(0.12))
                    } else if !events.isEmpty {
                        Circle().fill(Palette.tile)
                    }
                    Text(day)
                        .font(.system(size: 13, weight: isSelected || isToday ? .semibold : .medium))
                        .foregroundStyle(isSelected ? .white : (isToday ? Palette.red : Palette.ink600))
                        .monospacedDigit()
                }
                .frame(width: 32, height: 32)
                // No extra ring when today is also selected: the old negative-
                // padding stroke spilled outside the cell, colliding with the
                // event dots below and reading as a glitch. The red disc already
                // says "you are here"; selection elsewhere gets the ink disc.

                // Up to three dots; identity also carries in the agenda below, so
                // colour is never the only signal.
                HStack(spacing: 2) {
                    ForEach(events.prefix(3)) { event in
                        Circle()
                            .fill(event.tint.fg)
                            .frame(width: 4, height: 4)
                    }
                }
                .frame(height: 4)
            }
            .frame(maxWidth: .infinity)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(day), \(events.count) event\(events.count == 1 ? "" : "s")")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

private struct EventRow: View {
    var event: CalendarEvent
    var action: () -> Void

    var body: some View {
        PressableCard(action: action) {
            Card(radius: Radius.row, padding: 14) {
                HStack(spacing: 12) {
                    IconTile(symbol: symbol, tint: event.tint, size: 40, glyph: 16)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(event.company)
                            .font(Font2.rowTitle)
                            .foregroundStyle(Palette.ink)
                            .lineLimit(1)
                        Text(event.title)
                            .font(Font2.caption)
                            .foregroundStyle(Palette.ink500)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    if let time = event.time {
                        Text(time)
                            .font(Font2.micro)
                            .foregroundStyle(Palette.ink400)
                            .monospacedDigit()
                    }
                    Chevron()
                }
            }
        }
    }

    private var symbol: String {
        switch event.kind {
        case "deadline": "clock"
        case "interview": "calendar.badge.clock"
        case "coding-test": "chevron.left.forwardslash.chevron.right"
        case "applied", "application-submitted": "paperplane"
        case "follow-up": "arrow.uturn.right"
        default: "circle"
        }
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Calendar — with events") {
    @Previewable @State var route: Route?
    AmbientCanvas { CalendarView(route: $route) }
        .environment(CatalogStore.preview)
}

#Preview("Calendar — empty month") {
    @Previewable @State var route: Route?
    AmbientCanvas { CalendarView(route: $route) }
        .environment(CatalogStore.previewEmpty)
}
#endif
