// Wire models for the Internship Portal backend (editor/server, deployed as the
// Azure container app). Field names mirror the catalog JSON emitted by
// GET /api/internships — see editor/server/validation.js validateInternship.
// Decoding is deliberately tolerant: every field but `id` is optional, because
// live-researched entries carry fewer fields than seeded ones.
import Foundation

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
    var aboutJa: String?
    var techStack: [String]?
    var workAuth: String?

    var displayCompany: String { company ?? "Unknown company" }
    var displayRole: String { role ?? "Internship" }
    var displayLocation: String { location ?? city ?? "Location not stated" }
    var isTokyo: Bool { displayLocation.localizedCaseInsensitiveContains("tokyo") }
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
