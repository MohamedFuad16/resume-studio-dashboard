// Thin client for the production backend (Azure Container App portal-compile-jp,
// Japan East — the same instance the web app calls). The catalog endpoint is
// public by design: the server seeds and serves it without auth (per-user data
// lives in Firestore and is NOT fetched here until Firebase lands).
import Foundation

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

    /// Fetches the live internship catalog (the same 170+ verified roles the
    /// web radar shows), sorted best-match-first like the web's default sort.
    static func fetchCatalog() async throws -> [Internship] {
        let url = baseURL.appending(path: "api/internships")
        let (data, response) = try await URLSession.shared.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
        let catalog = try JSONDecoder().decode(CatalogResponse.self, from: data)
        return catalog.items.sorted { ($0.score ?? 0) > ($1.score ?? 0) }
    }
}

/// Catalog state shared by the tabs. One fetch feeds Dashboard and Radar.
@Observable
@MainActor
final class CatalogStore {
    enum Phase { case idle, loading, loaded, failed(String) }

    var phase: Phase = .idle
    var internships: [Internship] = []

    var tokyoCount: Int { internships.filter(\.isTokyo).count }
    var englishFirstCount: Int {
        internships.filter { ($0.languageType ?? "").localizedCaseInsensitiveContains("english") }.count
    }

    func load() async {
        if case .loading = phase { return }
        phase = .loading
        do {
            internships = try await PortalAPI.fetchCatalog()
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}
