// Client for the production backend (Azure Container App portal-compile-jp, Japan
// East — the same instance the web app calls).
//
// SCOPE NOTE: these endpoints are the server's KV path, keyed by profile id. The
// web app's signed-in users keep their data in Firestore instead; until the
// Firebase SDK lands here, iOS reads/writes the `mohamed_fuad` profile's KV
// records. It is real, persistent tracking — just not yet the same store as a
// signed-in web session.
import Foundation
import Observation

enum APIError: LocalizedError {
    case badStatus(Int)

    var errorDescription: String? {
        switch self {
        case .badStatus(let code): "The server answered with status \(code)."
        }
    }
}

struct PortalAPI {
    static let baseURL = URL(string: "https://portal-compile-jp.redgrass-10389803.japaneast.azurecontainerapps.io")!
    static let profile = "mohamed_fuad"

    private static func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        var url = baseURL.appending(path: path)
        if !query.isEmpty { url.append(queryItems: query) }
        let (data, response) = try await URLSession.shared.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    /// The live catalog — the same verified roles the web radar shows.
    static func fetchCatalog() async throws -> [Internship] {
        let catalog: CatalogResponse = try await get("api/internships")
        return catalog.items.sorted { ($0.score ?? 0) > ($1.score ?? 0) }
    }

    /// The tracker is a dictionary keyed by internship id.
    static func fetchTracker() async throws -> [String: TrackerRecord] {
        try await get("api/tracker", query: [.init(name: "profile", value: profile)])
    }

    static func saveTracker(_ tracker: [String: TrackerRecord]) async throws {
        var url = baseURL.appending(path: "api/tracker")
        url.append(queryItems: [.init(name: "profile", value: profile)])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(tracker)
        let (_, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
    }
}

/// Catalog + tracker state, shared by every tab. One load feeds them all.
@Observable
@MainActor
final class CatalogStore {
    enum Phase: Equatable { case idle, loading, loaded, failed(String) }

    var phase: Phase = .idle
    var internships: [Internship] = []
    var tracker: [String: TrackerRecord] = [:]
    /// Surfaced as a toast; mirrors the reference's toast pattern.
    var toast: String?

    // ── Catalog derivations ──────────────────────────────────────────────
    var tokyoCount: Int { internships.filter(\.isTokyo).count }
    var japanCount: Int {
        internships.filter { $0.displayLocation.localizedCaseInsensitiveContains("japan") || $0.isTokyo }.count
    }
    var englishFirstCount: Int { internships.filter(\.isEnglishFirst).count }

    // ── Tracker derivations ──────────────────────────────────────────────
    var records: [TrackerRecord] {
        tracker.values.sorted { ($0.updatedAt ?? "") > ($1.updatedAt ?? "") }
    }

    func records(in status: ApplicationStatus) -> [TrackerRecord] {
        records.filter { $0.appStatus == status }
    }

    func count(of status: ApplicationStatus) -> Int {
        tracker.values.count { $0.appStatus == status }
    }

    func status(for id: String) -> ApplicationStatus? {
        tracker[id].map(\.appStatus)
    }

    /// Roles not yet in the tracker — what Home should surface as opportunities.
    var untracked: [Internship] {
        internships.filter { tracker[$0.id] == nil }
    }

    /// Every tracked record's deadline + milestones, flattened into calendar
    /// events. Mirrors ApplicationCalendar.jsx: a record with a real deadlineDate
    /// emits a deadline event; applied-type records without one emit an "applied"
    /// marker on their updated date; milestones always emit.
    var events: [CalendarEvent] {
        var out: [CalendarEvent] = []
        for record in records {
            let company = record.displayCompany

            if let deadline = record.deadlineDate, deadline.count == 10 {
                out.append(CalendarEvent(
                    id: "\(record.id)-deadline", date: deadline, company: company,
                    title: "Application deadline", time: nil, kind: "deadline",
                    recordId: record.id
                ))
            } else if [.applying, .applied, .interview].contains(record.appStatus),
                      let stamp = record.updatedAt ?? record.createdAt,
                      let date = ISO8601DateFormatter.parse(stamp) {
                out.append(CalendarEvent(
                    id: "\(record.id)-applied", date: Self.dayKey(date), company: company,
                    title: "Application logged", time: nil, kind: "applied",
                    recordId: record.id
                ))
            }

            for milestone in record.milestones ?? [] {
                guard let date = milestone.date, date.count == 10 else { continue }
                out.append(CalendarEvent(
                    id: milestone.id, date: date, company: company,
                    title: milestone.title?.isEmpty == false ? milestone.title! : milestone.kindLabel,
                    time: milestone.time, kind: milestone.kind ?? "other",
                    recordId: record.id
                ))
            }
        }
        return out
    }

    func events(on day: String) -> [CalendarEvent] {
        events.filter { $0.date == day }.sorted { ($0.time ?? "") < ($1.time ?? "") }
    }

    /// Tokyo time is the app's clock — deadlines are JST and the user is in Japan.
    static var tokyoCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Tokyo") ?? .current
        calendar.firstWeekday = 2 // Monday, matching the web grid
        return calendar
    }

    static func dayKey(_ date: Date) -> String {
        let parts = tokyoCalendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    func load() async {
        if phase == .loading { return }
        phase = .loading
        do {
            async let catalog = PortalAPI.fetchCatalog()
            // A tracker failure must not blank the catalog — treat it as empty.
            async let tracked = try? PortalAPI.fetchTracker()
            internships = try await catalog
            tracker = await tracked ?? [:]
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    /// Optimistic status write, mirroring the web's updateStatus contract.
    /// Passing nil untracks the role.
    func setStatus(_ status: ApplicationStatus?, for item: Internship) async {
        let previous = tracker
        if let status {
            var record = tracker[item.id] ?? TrackerRecord()
            record.internshipId = item.id
            record.company = item.company
            record.role = item.role
            record.location = item.location
            record.deadline = item.deadline ?? "Not stated"
            record.deadlineDate = item.deadlineDate
            record.applyUrl = item.url
            record.companyDomain = item.companyDomain
            record.logoUrl = item.logoUrl
            record.status = status.rawValue
            record.source = record.source ?? "ios"
            record.updatedAt = ISO8601DateFormatter.flexible.string(from: .now)
            record.createdAt = record.createdAt ?? record.updatedAt
            record.milestones = record.milestones ?? []
            tracker[item.id] = record
        } else {
            tracker[item.id] = nil
        }
        await persist(rollingBackTo: previous)
    }

    /// Status change straight from a tracked record (Applications tab), where
    /// there may be no catalog entry behind it (Gmail-synthesised rows).
    func setStatus(_ status: ApplicationStatus, forRecord id: String) async {
        guard var record = tracker[id] else { return }
        let previous = tracker
        record.status = status.rawValue
        record.updatedAt = ISO8601DateFormatter.flexible.string(from: .now)
        tracker[id] = record
        await persist(rollingBackTo: previous)
    }

    /// Add a milestone. Dedupes on id and on identical kind+date+time+title, the
    /// same guard useApplicationTracker.js applies (BUG-013).
    func addMilestone(_ milestone: Milestone, to recordId: String) async {
        guard var record = tracker[recordId] else { return }
        var existing = record.milestones ?? []
        if existing.contains(where: { $0.id == milestone.id }) { return }
        if existing.contains(where: {
            $0.kind == milestone.kind && $0.date == milestone.date
                && $0.time == milestone.time && ($0.title ?? "") == (milestone.title ?? "")
        }) { return }

        let previous = tracker
        existing.append(milestone)
        record.milestones = existing
        record.updatedAt = ISO8601DateFormatter.flexible.string(from: .now)
        tracker[recordId] = record
        await persist(rollingBackTo: previous)
    }

    func removeMilestone(_ milestoneId: String, from recordId: String) async {
        guard var record = tracker[recordId] else { return }
        let previous = tracker
        record.milestones = (record.milestones ?? []).filter { $0.id != milestoneId }
        record.updatedAt = ISO8601DateFormatter.flexible.string(from: .now)
        tracker[recordId] = record
        await persist(rollingBackTo: previous)
    }

    private func persist(rollingBackTo previous: [String: TrackerRecord]) async {
        do {
            try await PortalAPI.saveTracker(tracker)
        } catch {
            tracker = previous   // never let the UI lie about what saved
            toast = "Couldn't save — check your connection."
        }
    }
}
