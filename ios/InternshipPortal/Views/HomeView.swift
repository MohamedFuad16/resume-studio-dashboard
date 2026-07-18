// Home — greeting, insight cards, recent applications, then Tokyo picks.
//
// Laid out like the Solace reference: a big greeting with the streak flame on the
// right, then a 2×2 grid of soft cards. Here the cards carry the STATE of the
// search — a pipeline donut and the figures that change week to week — because
// Applications and Calendar have their own tabs and don't need launcher doors.
import SwiftUI

struct HomeView: View {
    @Environment(CatalogStore.self) private var store
    @Binding var tab: AppTab
    @Binding var route: Route?

    private var greeting: String {
        let hour = CatalogStore.tokyoCalendar.component(.hour, from: .now)
        switch hour {
        case 5..<12: return String(localized: "Good morning, Mohamed")
        case 12..<17: return String(localized: "Good afternoon, Mohamed")
        default: return String(localized: "Good evening, Mohamed")
        }
    }

    /// The status line under the greeting states the thing most worth knowing,
    /// rather than a generic hello.
    private var statusLine: String {
        let interviews = store.count(of: .interview)
        if interviews == 1 { return String(localized: "1 interview in progress") }
        if interviews > 1 { return String(localized: "\(interviews) interviews in progress") }
        if store.tracker.isEmpty { return String(localized: "Nothing tracked yet") }
        return String(localized: "\(store.tracker.count) applications tracked")
    }

    /// The flame's number: applications that moved past "saved" in the last
    /// seven days — this week's actual output, not an all-time total.
    private var appliedThisWeek: Int {
        let cutoff = Date.now.addingTimeInterval(-7 * 24 * 3600)
        return store.records.filter { record in
            guard record.appStatus != .saved,
                  let date = ISO8601DateFormatter.parse(record.createdAt ?? record.updatedAt)
            else { return false }
            return date > cutoff
        }.count
    }

    private var tokyoPicks: [Internship] {
        Array(store.untracked.filter(\.isTokyo).prefix(3))
    }

    var body: some View {
        TabScroll {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 12) {
                    Text(greeting)
                        .font(Font2.title(26))
                        .tracking(-0.4)
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    StreakPill(count: appliedThisWeek)
                }
                Text(statusLine)
                    .font(Font2.body)
                    .foregroundStyle(Palette.ink500)
            }
            .padding(.bottom, 22)

            InsightGrid(tab: $tab)
                .padding(.bottom, 26)

            SectionHeader(title: String(localized: "Recent applications"), actionLabel: String(localized: "See all")) { tab = .applications }
                .padding(.bottom, 12)

            if store.records.isEmpty {
                EmptyNote(
                    symbol: "tray",
                    title: String(localized: "No applications tracked yet"),
                    message: String(localized: "Save or start a role in Radar and it will appear here.")
                )
                .padding(.bottom, 26)
            } else {
                VStack(spacing: 10) {
                    ForEach(store.records.prefix(3)) { record in
                        ApplicationCard(record: record) { route = .record(record) }
                    }
                }
                .padding(.bottom, 26)
            }

            SectionHeader(title: String(localized: "Tokyo opportunities"), actionLabel: String(localized: "See all")) { tab = .radar }
                .padding(.bottom, 12)

            if store.phase == .loading && store.internships.isEmpty {
                VStack(spacing: 10) {
                    ForEach(0..<3, id: \.self) { _ in ShimmerBox(height: 76) }
                }
            } else if tokyoPicks.isEmpty {
                EmptyNote(
                    symbol: "location.slash",
                    title: String(localized: "No new Tokyo roles"),
                    message: String(localized: "Every Tokyo listing is already in your applications.")
                )
            } else {
                VStack(spacing: 10) {
                    ForEach(tokyoPicks) { item in
                        MatchCard(item: item) { route = .internship(item) }
                    }
                }
            }
        }
    }
}

/// The insight block: the web dashboard's Status-breakdown donut (centre total,
/// legend with counts) as a full-width card, then the reference's 2×2 grid with
/// the figures worth checking daily.
private struct InsightGrid: View {
    @Environment(CatalogStore.self) private var store
    @Binding var tab: AppTab

    // The donut above already counts applied / interview / rejected, so these four
    // deliberately answer questions it CANNOT: how am I doing, what is next, what
    // is about to expire, and am I still moving. Repeating the donut's numbers in
    // tiles was four cards of decoration.

    /// Share of sent applications that got ANY answer (interview or rejection).
    private var heardBack: String {
        let sent = store.count(of: .applied) + store.count(of: .interview) + store.count(of: .rejected)
        guard sent > 0 else { return "—" }
        let answered = store.count(of: .interview) + store.count(of: .rejected)
        return "\(Int((Double(answered) / Double(sent) * 100).rounded()))%"
    }

    private var today: String { CatalogStore.dayKey(.now) }

    /// The soonest interview still ahead of you — the one thing on this screen
    /// that is a commitment rather than a statistic.
    private var nextInterview: (value: String, sub: String) {
        let upcoming = store.events
            .filter { $0.kind == "interview" && $0.date >= today }
            .sorted { $0.date < $1.date }
        guard let next = upcoming.first else {
            return (value: "—", sub: String(localized: "nothing booked"))
        }
        return (value: Self.shortDate(next.date), sub: next.company)
    }

    /// Deadlines inside the next two weeks — what will quietly expire if ignored.
    private var closingSoon: Int {
        let horizon = CatalogStore.dayKey(Date(timeIntervalSinceNow: 14 * 86_400))
        return store.events.filter { $0.kind == "deadline" && $0.date >= today && $0.date <= horizon }.count
    }

    /// Applications first tracked this calendar month — momentum, not total.
    private var sentThisMonth: Int {
        let month = String(today.prefix(7))   // YYYY-MM
        return store.tracker.values.filter { record in
            guard let stamp = record.createdAt,
                  let date = ISO8601DateFormatter.parse(stamp) else { return false }
            return CatalogStore.dayKey(date).hasPrefix(month)
        }.count
    }

    /// "2026-07-24" → "Jul 24", in the user's locale.
    private static func shortDate(_ key: String) -> String {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return key }
        var components = DateComponents()
        components.year = parts[0]; components.month = parts[1]; components.day = parts[2]
        guard let date = CatalogStore.tokyoCalendar.date(from: components) else { return key }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    var body: some View {
        VStack(spacing: 12) {
            StatusBreakdownCard { tab = .applications }

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                InsightCard(
                    title: String(localized: "Heard back"),
                    subtitle: String(localized: "of sent applications"),
                    value: heardBack,
                    action: { tab = .applications }
                ) {
                    IconTile(symbol: "arrow.uturn.left", tint: .teal, size: 36, glyph: 16)
                }

                InsightCard(
                    title: String(localized: "Next interview"),
                    subtitle: nextInterview.sub,
                    value: nextInterview.value,
                    action: { tab = .calendar }
                ) {
                    IconTile(symbol: "calendar.badge.clock", tint: .yellow, size: 36, glyph: 16)
                }

                InsightCard(
                    title: String(localized: "Closing soon"),
                    subtitle: String(localized: "deadlines in 14 days"),
                    value: "\(closingSoon)",
                    action: { tab = .calendar }
                ) {
                    IconTile(symbol: "clock.badge.exclamationmark", tint: .orange, size: 36, glyph: 16)
                }

                InsightCard(
                    title: String(localized: "This month"),
                    subtitle: String(localized: "new applications"),
                    value: "\(sentThisMonth)",
                    action: { tab = .applications }
                ) {
                    IconTile(symbol: "chart.line.uptrend.xyaxis", tint: .blue, size: 36, glyph: 16)
                }
            }
        }
    }
}

/// The web dashboard's Status-breakdown panel, verbatim in spirit: a thick donut
/// with the total in the hole, and a legend that names every stage with its
/// count — colour is never the only signal.
private struct StatusBreakdownCard: View {
    @Environment(CatalogStore.self) private var store
    var action: () -> Void

    private var present: [ApplicationStatus] {
        ApplicationStatus.allCases.filter { store.count(of: $0) > 0 }
    }

    var body: some View {
        PressableCard(action: action) {
            Card(padding: 18) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("Status breakdown")
                            .font(Font2.sectionTitle)
                            .foregroundStyle(Palette.ink)
                        Spacer()
                        Text(store.tracker.isEmpty ? String(localized: "Nothing yet") : String(localized: "\(store.tracker.count) tracked"))
                            .font(Font2.caption)
                            .foregroundStyle(Palette.ink400)
                            .monospacedDigit()
                    }

                    HStack(spacing: 20) {
                        PipelineDonut(size: 96, line: 15)

                        if present.isEmpty {
                            Text("Track a role in Radar and the breakdown starts here.")
                                .font(Font2.caption)
                                .foregroundStyle(Palette.ink500)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(present) { status in
                                    HStack(spacing: 7) {
                                        Circle()
                                            .fill(status.tint.fg)
                                            .frame(width: 7, height: 7)
                                        Text(status.label)
                                            .font(Font2.caption)
                                            .foregroundStyle(Palette.ink600)
                                        Spacer(minLength: 10)
                                        Text("\(store.count(of: status))")
                                            .font(.system(size: 13, weight: .semibold))
                                            .foregroundStyle(Palette.ink)
                                            .monospacedDigit()
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Status breakdown. "
                + (present.isEmpty
                    ? "Nothing tracked yet."
                    : present.map { "\($0.label) \(store.count(of: $0))" }.joined(separator: ", "))
        )
    }
}

/// One soft card in the grid — top visual, then (optionally) a big figure, then
/// title + quiet subtitle, all left-aligned like the reference boxes.
private struct InsightCard<Top: View>: View {
    var title: String
    var subtitle: String
    var value: String?
    var action: () -> Void
    @ViewBuilder var top: () -> Top

    init(
        title: String, subtitle: String, value: String? = nil,
        action: @escaping () -> Void, @ViewBuilder top: @escaping () -> Top
    ) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.action = action
        self.top = top
    }

    var body: some View {
        PressableCard(action: action) {
            Card(padding: 16) {
                VStack(alignment: .leading, spacing: 0) {
                    top()
                    Spacer(minLength: 12)
                    if let value {
                        Text(value)
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(Palette.ink)
                            .monospacedDigit()
                            .padding(.bottom, 1)
                    }
                    Text(title)
                        .font(Font2.cardTitle)
                        .foregroundStyle(Palette.ink)
                    Text(subtitle)
                        .font(Font2.caption)
                        .foregroundStyle(Palette.ink500)
                        .lineLimit(1)
                        .padding(.top, 2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .aspectRatio(1.06, contentMode: .fit)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(value.map { "\($0), " } ?? "")\(subtitle)")
    }
}

/// The pipeline as a donut: one arc per status with a count in the middle.
/// Legend lives in the statuses' own colours plus the Applications tab — on a
/// 44pt chart, labels would be noise.
private struct PipelineDonut: View {
    @Environment(CatalogStore.self) private var store
    var size: CGFloat
    var line: CGFloat

    private var slices: [(status: ApplicationStatus, from: Double, to: Double)] {
        let total = store.tracker.count
        guard total > 0 else { return [] }
        var start = 0.0
        return ApplicationStatus.allCases.compactMap { status in
            let count = store.count(of: status)
            guard count > 0 else { return nil }
            let end = start + Double(count) / Double(total)
            defer { start = end }
            return (status, start, end)
        }
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Palette.hairline, lineWidth: line)

            ForEach(slices, id: \.status) { slice in
                Circle()
                    .trim(from: slice.from, to: slice.to)
                    .stroke(
                        slice.status.tint.fg,
                        style: StrokeStyle(lineWidth: line, lineCap: slices.count == 1 ? .butt : .round)
                    )
                    .rotationEffect(.degrees(-90))
            }

            // The web donut's centre: the total, named.
            VStack(spacing: 0) {
                Text("\(store.tracker.count)")
                    .font(.system(size: size * 0.24, weight: .bold))
                    .foregroundStyle(Palette.ink)
                    .monospacedDigit()
                if size >= 80 {
                    Text("tracked")
                        .font(Font2.nano)
                        .foregroundStyle(Palette.ink400)
                }
            }
        }
        .frame(width: size, height: size)
        .padding(line / 2)
        .accessibilityHidden(true)   // the card's combined label carries the numbers
    }
}

/// The reference's streak chip. Here it counts this week's applications rather
/// than a habit streak — a number that means something in this app.
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
        .accessibilityLabel("\(count) applications this week")
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Home — with data") {
    @Previewable @State var tab: AppTab = .home
    @Previewable @State var route: Route?
    AmbientCanvas { HomeView(tab: $tab, route: $route) }
        .environment(CatalogStore.preview)
}

#Preview("Home — nothing tracked") {
    @Previewable @State var tab: AppTab = .home
    @Previewable @State var route: Route?
    AmbientCanvas { HomeView(tab: $tab, route: $route) }
        .environment(CatalogStore.previewEmpty)
}

#Preview("Home — loading") {
    @Previewable @State var tab: AppTab = .home
    @Previewable @State var route: Route?
    AmbientCanvas { HomeView(tab: $tab, route: $route) }
        .environment(CatalogStore.previewLoading)
}
#endif
