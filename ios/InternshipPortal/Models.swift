// Wire models for the Internship Portal backend (editor/server, deployed as the
// Azure container app). Field names mirror the JSON the web app reads and writes —
// see editor/server/validation.js and editor/src/hooks/useApplicationTracker.js.
// Decoding is deliberately tolerant: almost everything is optional, because
// live-researched entries carry fewer fields than seeded ones, and Gmail-ingested
// tracker records carry fewer still.
import Foundation

// MARK: - Catalog

/// A logo.dev publishable token. Publishable by design (like a Stripe pk_): it is
/// meant to ship in a client. Swap in your own free one from https://logo.dev —
/// registering ties the quota to your account instead of this shared demo key.
private let logoDevToken = "pk_X-1ZO13GSgeOoUrIuJ6GMQ"

/// Logo sources for a company, best-first.
///
/// logo.dev leads because it is the only source that returns a UNIFORM 256×256 for
/// every domain — measured against the real list, gstatic gave Geotab a 16px
/// favicon (the pixelation) and NVIDIA nothing usable, while logo.dev returned a
/// clean 256 for both. The rest stay as a fallback chain so a logo still resolves
/// if logo.dev is ever unreachable: gstatic's faviconV2 (Nokia/Mercari 128–192),
/// the site's own apple-touch-icon, then DuckDuckGo. LogoLoader keeps the LARGEST
/// result, so ordering is a preference, not a commitment — a bigger fallback still
/// wins if logo.dev happens to be small.
///
/// NOT google.com/s2/favicons: it answers with an HTML redirect page, never an
/// image, so everything fell through to DuckDuckGo's 32px favicon — the original
/// "low quality" across the app.
func logoCandidateURLs(logoUrl: String?, domain: String?) -> [String] {
    var list: [String] = []
    if let domain, !domain.isEmpty {
        // fallback=404 is load-bearing: without it, logo.dev answers a domain it
        // has no real logo for with a generated MONOGRAM at 256px, which would then
        // beat a real 128px favicon from gstatic (LogoLoader keeps the largest).
        // With it, logo.dev 404s when it has nothing real, and the chain falls
        // through to the actual favicon instead of a grey letter.
        list.append("https://img.logo.dev/\(domain)?token=\(logoDevToken)&size=256&format=png&retina=true&fallback=404")
        list.append("https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://\(domain)&size=256")
        list.append("https://\(domain)/apple-touch-icon.png")
        list.append("https://icons.duckduckgo.com/ip3/\(domain).ico")
    }
    if let logoUrl, !logoUrl.isEmpty { list.append(logoUrl) }
    return list
}

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

    /// The logos to try, best first — see `logoCandidateURLs`.
    var logoCandidates: [String] {
        logoCandidateURLs(logoUrl: logoUrl, domain: companyDomain)
    }

    /// Which band of the market this listing's company sits in.
    ///
    /// `prestigeTier` is messy by history — some rows carry a bare "1"/"2"/"3" from
    /// the global seed batch, others a sentence like "Japan AI startup / verified
    /// ATS". Both are real signal, so read both rather than pick one and drop half
    /// the catalog into "unknown". Spot-checked against the live data: "1" is
    /// NVIDIA/Nokia/Cloudflare/Blue Origin, "2" is Hitachi/Formlabs/Geotab,
    /// "3" is the smaller firms.
    var tier: CompanyTier {
        let raw = (prestigeTier ?? "").lowercased()
        if raw.isEmpty { return .scaleUp }
        if raw == "1" || raw.contains("tier 1") || raw.contains("global elite")
            || raw.contains("global reputed") { return .flagship }
        if raw == "3" || raw.contains("startup") { return .startup }
        return .scaleUp
    }

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
        case .saved: String(localized: "Saved")
        case .applying: String(localized: "Applying")
        case .applied: String(localized: "Applied")
        case .interview: String(localized: "Interview")
        case .rejected: String(localized: "Rejected")
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

    /// A ramp, not a traffic light. Pure red/green/blue side by side fought each
    /// other — three saturated primaries with nothing to relate them. These walk
    /// the wheel in pipeline order (slate → amber → sky → violet → rose), so the
    /// donut reads as one family and progress reads as movement along it. Rose
    /// still lands unmistakably on "rejected" without shouting.
    var tint: Color6 {
        switch self {
        case .saved: .gray
        case .applying: .amber
        case .applied: .sky
        case .interview: .violet
        case .rejected: .rose
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
enum Color6 { case teal, purple, orange, blue, indigo, gray, amber, sky, violet, rose }

/// The three bands the Companies view clusters by.
enum CompanyTier: String, CaseIterable, Identifiable {
    case flagship, scaleUp, startup

    var id: String { rawValue }

    var label: String {
        switch self {
        case .flagship: String(localized: "Flagships")
        case .scaleUp: String(localized: "Scale-ups")
        case .startup: String(localized: "Startups")
        }
    }

    var blurb: String {
        switch self {
        case .flagship: String(localized: "Tier-1 and global names")
        case .scaleUp: String(localized: "Established and growing")
        case .startup: String(localized: "Early-stage teams")
        }
    }

    var tint: Color6 {
        switch self {
        case .flagship: .indigo
        case .scaleUp: .teal
        case .startup: .orange
        }
    }
}

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

    /// Same candidate chain as Internship.logoCandidates.
    var logoCandidates: [String] {
        logoCandidateURLs(logoUrl: logoUrl, domain: companyDomain)
    }

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
