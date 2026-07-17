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

// MARK: - Gmail integration (server-side OAuth; see editor/server/gmail)

struct GmailStatus: Decodable {
    var configured: Bool?
    var connected: Bool
    var email: String?
    var lastSyncAt: String?
    var lastError: String?
}

extension PortalAPI {
    static func gmailStatus(profile: String) async throws -> GmailStatus {
        var url = baseURL.appending(path: "api/integrations/gmail/status")
        url.append(queryItems: [.init(name: "profile", value: profile)])
        let (data, response) = try await URLSession.shared.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
        return try JSONDecoder().decode(GmailStatus.self, from: data)
    }

    /// The OAuth consent URL. Opened in the browser; the server stores the token
    /// on callback, so the app only ever polls status afterwards.
    static func gmailAuthURL(profile: String) async throws -> URL {
        struct Payload: Decodable { let url: String }
        var url = baseURL.appending(path: "api/integrations/gmail/auth-url")
        url.append(queryItems: [.init(name: "profile", value: profile)])
        let (data, response) = try await URLSession.shared.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
        let payload = try JSONDecoder().decode(Payload.self, from: data)
        guard let authURL = URL(string: payload.url) else { throw APIError.badStatus(500) }
        return authURL
    }

    static func gmailDisconnect(profile: String) async throws {
        var url = baseURL.appending(path: "api/integrations/gmail/disconnect")
        url.append(queryItems: [.init(name: "profile", value: profile)])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        let (_, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
    }
}

/// Catalog + tracker state, shared by every tab. One load feeds them all.
///
/// The tracker has two possible homes, and which one is live depends on the
/// session — exactly as on the web (api/client.js delegates to Firestore when a
/// user is signed in, else the /api/* KV path):
///   • signed in  → Firestore `users/{uid}/trackers/{profileId}` — the real data,
///                  the same documents the web writes.
///   • signed out → the server's KV path, keyed by profile id. Kept so the app
///                  still runs (and E2E/screenshots work) without an account.
/// The catalog is global and always comes from the server either way.
@Observable
@MainActor
final class CatalogStore {
    enum Phase: Equatable { case idle, loading, loaded, failed(String) }

    var phase: Phase = .idle
    var internships: [Internship] = []
    var tracker: [String: TrackerRecord] = [:]
    /// Surfaced as a toast; mirrors the reference's toast pattern.
    var toast: String?

    /// True while a Gmail rebuild is reconstructing the tracker. The routine
    /// auto-drains (on load and on foreground) must stand aside while it runs, or
    /// they would consume the backfill's queued actions additively before the
    /// rebuild can purge-and-replace with them.
    var isRebuilding = false

    /// Set by RootView from AuthService. nil = signed out → KV path.
    var uid: String?
    /// Which Firestore profile document the tracker lives in. Resolved on load.
    private(set) var profileID: String?

    var isCloudBacked: Bool { uid != nil && profileID != nil }

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

    /// Logo sources for a tracked record. Gmail-synthesised rows usually carry no
    /// logoUrl/companyDomain of their own, which is why the Applications list
    /// showed monograms for companies whose logos render fine everywhere else —
    /// so fall through to the catalog: by the record's internship id first, then
    /// by company name.
    func logoCandidates(for record: TrackerRecord) -> [String] {
        let own = record.logoCandidates
        if !own.isEmpty { return own }
        if let item = internships.first(where: { $0.id == record.internshipId }) {
            return item.logoCandidates
        }
        let key = record.displayCompany.lowercased().trimmingCharacters(in: .whitespaces)
        // Prefix match too: Gmail names arrive as "micro1.ai" / "Rakuten Group"
        // while the catalog says "micro1" / "Rakuten".
        if let item = internships.first(where: {
            let name = $0.displayCompany.lowercased().trimmingCharacters(in: .whitespaces)
            return name == key || key.hasPrefix(name) || name.hasPrefix(key)
        }) {
            return item.logoCandidates
        }
        return []
    }

    /// Every tracked record's deadline + milestones, flattened into calendar
    /// events. Mirrors ApplicationCalendar.jsx: a record with a real deadlineDate
    /// emits a deadline event; applied-type records without one emit an "applied"
    /// marker on their updated date; milestones always emit.
    var events: [CalendarEvent] {
        var out: [CalendarEvent] = []
        for record in records {
            let company = record.displayCompany
            let logos = record.logoCandidates

            if let deadline = record.deadlineDate, deadline.count == 10 {
                out.append(CalendarEvent(
                    id: "\(record.id)-deadline", date: deadline, company: company,
                    title: "Application deadline", time: nil, kind: "deadline",
                    recordId: record.id, logoCandidates: logos
                ))
            }

            // The APPLIED marker sits on the application email's day (createdAt),
            // never `updatedAt` — updatedAt tracks the latest email, so for a
            // rejected role it would drop the "applied" dot on the rejection's day.
            // Both dates come straight from Gmail (see GmailDrain), so the calendar
            // reflects when you actually applied and when you actually heard back.
            if let applied = ISO8601DateFormatter.parse(record.createdAt) {
                out.append(CalendarEvent(
                    id: "\(record.id)-applied", date: Self.dayKey(applied), company: company,
                    title: "Applied", time: nil, kind: "applied",
                    recordId: record.id, logoCandidates: logos
                ))
            }

            // The REJECTED marker sits on the rejection email's day (updatedAt, the
            // latest email, once the outcome is a rejection).
            if record.appStatus == .rejected,
               let rejected = ISO8601DateFormatter.parse(record.updatedAt) {
                out.append(CalendarEvent(
                    id: "\(record.id)-rejected", date: Self.dayKey(rejected), company: company,
                    title: "Rejected", time: nil, kind: "rejected",
                    recordId: record.id, logoCandidates: logos
                ))
            }

            for milestone in record.milestones ?? [] {
                guard let date = milestone.date, date.count == 10 else { continue }
                out.append(CalendarEvent(
                    id: milestone.id, date: date, company: company,
                    title: milestone.title?.isEmpty == false ? milestone.title! : milestone.kindLabel,
                    time: milestone.time, kind: milestone.kind ?? "other",
                    recordId: record.id, logoCandidates: logos
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
            // The catalog is the screen's reason to exist, so it decides the phase;
            // a tracker failure degrades to "nothing tracked" rather than blanking
            // the catalog behind an error.
            async let catalog = PortalAPI.fetchCatalog()
            async let tracked = loadTracker()
            internships = try await catalog
            tracker = await tracked
            phase = .loaded

            // Pull anything Gmail queued since last time. Detached from the load
            // so a slow inbox never delays the catalog appearing; it updates the
            // tracker in place when it lands.
            Task { await self.drainGmail() }
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    private func loadTracker() async -> [String: TrackerRecord] {
        guard let uid else {
            profileID = nil
            return (try? await PortalAPI.fetchTracker()) ?? [:]
        }
        do {
            let profile = try await FirestoreData.defaultProfileID(uid: uid)
            profileID = profile
            guard let profile else {
                // Signed in, but the account has no profile document yet — the web
                // seeds one on first login. Say so instead of showing a bare zero.
                toast = "No résumé profile in this account yet — open the web app once."
                return [:]
            }
            return try await FirestoreData.fetchTracker(uid: uid, profile: profile)
        } catch {
            toast = "Couldn't read your applications: \(error.localizedDescription)"
            return [:]
        }
    }

    /// Called when the signed-in user changes. Clears state that belonged to the
    /// previous account before loading the new one — never show account A's
    /// applications to account B, even for a frame.
    func setUser(_ uid: String?) async {
        guard self.uid != uid else { return }
        self.uid = uid
        tracker = [:]
        profileID = nil
        phase = .idle
        await load()
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

    /// Delete a tracked record outright. This is how legacy non-internship rows
    /// (gig/freelance emails ingested before the isInternship rule existed —
    /// 5CA, micro1) leave the tracker: the server only filters NEW mail, and the
    /// web expects these to be removed by hand.
    func removeRecord(_ id: String) async {
        guard tracker[id] != nil else { return }
        let previous = tracker
        tracker[id] = nil
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

    /// Writes go back to whichever store the read came from, so a signed-in edit
    /// lands in the same document the web reads.
    private func persist(rollingBackTo previous: [String: TrackerRecord]) async {
        do {
            if let uid, let profileID {
                try await FirestoreData.saveTracker(tracker, uid: uid, profile: profileID)
            } else {
                try await PortalAPI.saveTracker(tracker)
            }
        } catch {
            tracker = previous   // never let the UI lie about what saved
            toast = "Couldn't save — check your connection."
        }
    }
}
