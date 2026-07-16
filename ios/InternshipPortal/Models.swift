// Wire models for the Internship Portal backend (editor/server, deployed as the
// Azure container app). Field names mirror the JSON the web app reads and writes —
// see editor/server/validation.js and editor/src/hooks/useApplicationTracker.js.
// Decoding is deliberately tolerant: almost everything is optional, because
// live-researched entries carry fewer fields than seeded ones, and Gmail-ingested
// tracker records carry fewer still.
import Foundation

// MARK: - Catalog

struct Internship: Decodable, Identifiable, Hashable {
    let id: String
    var company: String?
    var role: String?
    var location: String?
    var city: String?
    var workMode: String?
    var language: String?
    var languageType: String?
    var duration: String?
    var deadline: String?
    var deadlineDate: String?
    var compensation: String?
    var track: String?
    var score: Int?
    var priority: Bool?
    var reasons: [String]?
    var fitNote: String?
    var url: String?
    var sourceUrl: String?
    var companyDomain: String?
    var logoUrl: String?
    var verifiedDate: String?
    var prestigeTier: String?
    var about: String?
    var techStack: [String]?
    var eligibility: [String]?
    var process: [String]?

    var displayCompany: String { company ?? "Unknown company" }
    var displayRole: String { role ?? "Internship" }
    var displayLocation: String { location ?? city ?? "Location not stated" }
    var isTokyo: Bool { displayLocation.localizedCaseInsensitiveContains("tokyo") }
    var isEnglishFirst: Bool { (languageType ?? "").localizedCaseInsensitiveContains("english") }
    var matchText: String { score.map { "\($0)%" } ?? "—" }

    /// The web hides the "JST"/time suffix in list rows; mirror that here.
    var shortDeadline: String {
        guard let deadline, !deadline.isEmpty else { return "Not stated" }
        return deadline.replacingOccurrences(
            of: #"\s+JST\b"#, with: "", options: .regularExpression
        )
    }
}

/// GET /api/internships responds `{ "items": [...] }`; older paths returned a
/// bare array. Accept both so a server change doesn't brick the client.
struct CatalogResponse: Decodable {
    let items: [Internship]

    init(from decoder: Decoder) throws {
        if let keyed = try? decoder.container(keyedBy: CodingKeys.self),
           let wrapped = try? keyed.decode([Internship].self, forKey: .items) {
            items = wrapped
            return
        }
        items = try decoder.singleValueContainer().decode([Internship].self)
    }

    private enum CodingKeys: String, CodingKey { case items }
}

// MARK: - Tracker

/// The five statuses the server whitelists (validation.js TRACKER_STATUSES).
/// Order is the pipeline order the web dashboard shows.
enum ApplicationStatus: String, CaseIterable, Codable, Identifiable {
    case saved, applying, applied, interview, rejected

    var id: String { rawValue }

    var label: String {
        switch self {
        case .saved: "Saved"
        case .applying: "Applying"
        case .applied: "Applied"
        case .interview: "Interview"
        case .rejected: "Rejected"
        }
    }

    var icon: String {
        switch self {
        case .saved: "bookmark"
        case .applying: "square.and.pencil"
        case .applied: "paperplane"
        case .interview: "calendar.badge.clock"
        case .rejected: "circle.slash"
        }
    }

    /// Rejected is a real outcome, not a failure to hide — it keeps a muted voice
    /// rather than shouting in red.
    var tint: Color6 {
        switch self {
        case .saved: .indigo
        case .applying: .purple
        case .applied: .blue
        case .interview: .orange
        case .rejected: .gray
        }
    }

    /// Monotonic rank — mirrors useGmailInbox's STATUS_RANK so a re-classified
    /// email can never pull a record backwards (BUG-014).
    var rank: Int {
        switch self {
        case .saved: 0
        case .applying, .applied: 1
        case .interview: 2
        case .rejected: 3
        }
    }
}

/// Model-layer tint token; Theme.swift maps these to real colors so this file
/// stays free of SwiftUI.
enum Color6 { case teal, purple, orange, blue, indigo, gray }

struct Milestone: Codable, Identifiable, Hashable {
    var id: String
    var kind: String?
    var date: String?
    var time: String?
    var title: String?

    var kindLabel: String {
        switch kind {
        case "interview": "Interview"
        case "coding-test": "Coding test"
        case "application-submitted": "Application submitted"
        case "follow-up": "Follow-up"
        case "deadline": "Deadline"
        case "applied": "Applied"
        default: "Event"
        }
    }

    var tint: Color6 {
        switch kind {
        case "interview", "coding-test": .orange
        case "deadline": .gray
        case "applied", "application-submitted": .teal
        default: .blue
        }
    }
}

struct TrackerRecord: Codable, Identifiable, Hashable {
    var internshipId: String?
    var company: String?
    var role: String?
    var location: String?
    var deadline: String?
    var deadlineDate: String?
    var applyUrl: String?
    var companyDomain: String?
    var logoUrl: String?
    var status: String?
    var source: String?
    var updatedAt: String?
    var createdAt: String?
    var milestones: [Milestone]?

    var id: String { internshipId ?? UUID().uuidString }
    var displayCompany: String { company ?? "Unknown company" }
    var displayRole: String { role ?? "Internship" }
    var displayLocation: String { location ?? "Location not stated" }
    var appStatus: ApplicationStatus { ApplicationStatus(rawValue: status ?? "saved") ?? .saved }
    /// Ingested from Gmail rather than added in-app (server stamps `source`).
    var fromGmail: Bool { source == "gmail" }

    /// Relative "Applied 2 days ago" line the reference's ApplicationCard shows.
    var appliedAgo: String {
        guard let stamp = createdAt ?? updatedAt,
              let date = ISO8601DateFormatter.flexible.date(from: stamp)
        else { return "Tracked" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return "Applied \(formatter.localizedString(for: date, relativeTo: .now))"
    }
}

// MARK: - Calendar events

/// A calendar cell's content, derived from tracker records the same way
/// ApplicationCalendar.jsx's calendarEvents() does.
struct CalendarEvent: Identifiable, Hashable {
    let id: String
    let date: String          // YYYY-MM-DD
    let company: String
    let title: String
    let time: String?
    let kind: String
    let recordId: String

    var tint: Color6 {
        switch kind {
        case "deadline": .gray
        case "interview", "coding-test": .orange
        case "applied", "application-submitted": .teal
        default: .blue
        }
    }
}

extension ISO8601DateFormatter {
    /// The server writes fractional seconds; older rows don't have them.
    ///
    /// ISO8601DateFormatter isn't Sendable, so a shared `static let` is a data race
    /// under Swift 6. Each call gets its own — allocation is cheap next to the
    /// network round-trip that produced the string.
    static var flexible: ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }

    static func parse(_ value: String?) -> Date? {
        guard let value else { return nil }
        if let date = flexible.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }
}
