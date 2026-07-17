// Company logo loading, shared by the cards and the bubbles.
//
// Logos come from a CANDIDATE CHAIN (see logoCandidateURLs in Models.swift):
// Google s2 at 128px for real resolution, DuckDuckGo favicons for coverage, the
// catalog's own logoUrl last. Neither favicon service behaves like a plain image
// host, so the loader carries two defenses:
//   • DDG never 404s — unknown domains get a constant grey placeholder at HTTP
//     200. It is byte-identical every time, so it is detected by hash.
//   • s2 404s for unknown domains (checked), and small sources are served as-is:
//     a 16px icon stretched over a 90pt bubble is what "low quality" looked
//     like, so the chain prefers the first candidate ≥48px and only settles for
//     a smaller one when nothing better exists anywhere in the chain.
import CryptoKit
import SwiftUI

/// SHA-256 of DuckDuckGo's "unknown domain" placeholder (1478 bytes, constant —
/// verified against multiple made-up domains).
private let ddgPlaceholderSHA256 =
    "e5db88ea2322863ca17817b99d60006c625a31cff0dad49cf05d3c6d16a75c17"

/// Main-actor confined: the caches are plain mutable state, and every caller is a
/// SwiftUI view task anyway.
@MainActor
enum LogoLoader {
    /// In-memory results so a logo that appears in the radar, a bubble, and a
    /// sheet is fetched once. URLCache still handles the HTTP layer underneath.
    private static let cache = NSCache<NSString, UIImage>()
    private static var missing: Set<String> = []

    /// Pixel width good enough to fill a bubble without visible softness.
    private static let crispWidth = 48

    /// Walks the chain and returns the first crisp image; a small image only
    /// wins when no candidate anywhere in the chain is crisp.
    static func load(candidates: [String]) async -> UIImage? {
        var small: UIImage?
        for urlString in candidates {
            guard let image = await load(urlString) else { continue }
            if (image.cgImage?.width ?? 0) >= crispWidth { return image }
            if small == nil { small = image }
        }
        return small
    }

    static func load(_ urlString: String) async -> UIImage? {
        if let hit = cache.object(forKey: urlString as NSString) { return hit }
        if missing.contains(urlString) { return nil }

        guard let url = URL(string: urlString) else { return nil }
        guard let (data, response) = try? await URLSession.shared.data(from: url) else { return nil }

        // s2 (and any well-behaved host) says "unknown" with a status code; DDG
        // says it with a placeholder body, caught by the hash below.
        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            missing.insert(urlString)
            return nil
        }

        let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        guard hash != ddgPlaceholderSHA256, let image = UIImage(data: data) else {
            missing.insert(urlString)
            return nil
        }
        cache.setObject(image, forKey: urlString as NSString)
        return image
    }
}

/// Drop-in replacement for the AsyncImage call sites: shows the company's logo,
/// or the provided fallback when there is none worth showing.
struct LogoImage<Fallback: View>: View {
    var candidates: [String]
    @ViewBuilder var fallback: () -> Fallback

    @State private var image: UIImage?
    @State private var resolved = false

    init(candidates: [String], @ViewBuilder fallback: @escaping () -> Fallback) {
        self.candidates = candidates
        self.fallback = fallback
    }

    /// Single-URL convenience for call sites that only ever have one source.
    init(urlString: String?, @ViewBuilder fallback: @escaping () -> Fallback) {
        self.init(candidates: urlString.map { [$0] } ?? [], fallback: fallback)
    }

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                fallback()
                    // Avoid a monogram flash before the fetch settles.
                    .opacity(resolved || candidates.isEmpty ? 1 : 0)
            }
        }
        .task(id: candidates) {
            guard !candidates.isEmpty else { return }
            image = await LogoLoader.load(candidates: candidates)
            resolved = true
        }
    }
}
