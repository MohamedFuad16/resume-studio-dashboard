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

/// A logo plus the colour it wants to sit on.
///
/// Favicons come in two shapes: a coloured tile with the mark knocked out
/// (Cloudflare's orange, BMO's blue) or a dark mark on transparent/white. Painting
/// both on a white chip is what made half the bubbles look like stickers — the
/// brand's own field is the bubble's colour, so read it off the artwork instead of
/// guessing a pastel.
struct CompanyLogo {
    let image: UIImage
    /// The artwork's own background, sampled from its edges. nil when the edges
    /// are transparent (a bare mark), in which case the caller supplies white.
    let background: Color?
}

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
    private static var backgrounds: [String: Color?] = [:]
    private static var missing: Set<String> = []

    /// Pixel width good enough to fill a bubble without visible softness.
    private static let crispWidth = 48

    /// Walks the chain and returns the first crisp logo; a small one only wins
    /// when no candidate anywhere in the chain is crisp.
    static func load(candidates: [String]) async -> CompanyLogo? {
        var small: CompanyLogo?
        for urlString in candidates {
            guard let image = await load(urlString) else { continue }
            let logo = CompanyLogo(image: image, background: background(of: image, key: urlString))
            if (image.cgImage?.width ?? 0) >= crispWidth { return logo }
            if small == nil { small = logo }
        }
        return small
    }

    /// The artwork's background, read from its outer ring.
    ///
    /// Sampling the EDGE, not the average: the average of a logo is the mark mixed
    /// with its field (Cloudflare would come back muddy brown). The edge is the
    /// field itself. A ring that is mostly transparent means a bare mark → nil, and
    /// a ring that disagrees with itself (a photo, a gradient) is not a flat brand
    /// colour → nil as well, rather than a confident wrong answer.
    private static func background(of image: UIImage, key: String) -> Color? {
        if let hit = backgrounds[key] { return hit }

        guard let cg = image.cgImage else { return nil }
        let side = 16
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        guard let ctx = CGContext(
            data: &pixels, width: side, height: side, bitsPerComponent: 8,
            bytesPerRow: side * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: side, height: side))

        var samples: [(Double, Double, Double)] = []
        var transparent = 0
        for y in 0..<side {
            for x in 0..<side where x == 0 || y == 0 || x == side - 1 || y == side - 1 {
                let i = (y * side + x) * 4
                let a = Double(pixels[i + 3]) / 255
                if a < 0.5 { transparent += 1; continue }
                // Un-premultiply so a semi-transparent edge doesn't read as dark.
                samples.append((Double(pixels[i]) / 255 / a,
                                Double(pixels[i + 1]) / 255 / a,
                                Double(pixels[i + 2]) / 255 / a))
            }
        }

        let ring = (side - 1) * 4
        var result: Color?
        if transparent <= ring / 3, !samples.isEmpty {
            let n = Double(samples.count)
            let mean = (samples.reduce(0) { $0 + $1.0 } / n,
                        samples.reduce(0) { $0 + $1.1 } / n,
                        samples.reduce(0) { $0 + $1.2 } / n)
            // Reject a busy edge: if any sample is far from the mean, this is not
            // one flat brand colour.
            let spread = samples.map { max(abs($0.0 - mean.0), abs($0.1 - mean.1), abs($0.2 - mean.2)) }.max() ?? 0
            if spread < 0.18 {
                result = Color(.sRGB, red: mean.0, green: mean.1, blue: mean.2)
            }
        }
        backgrounds[key] = result
        return result
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
    /// Fires when the artwork's own background colour is known, so a bubble can
    /// paint itself in the brand's field.
    var onBackground: ((Color?) -> Void)?
    @ViewBuilder var fallback: () -> Fallback

    @State private var logo: CompanyLogo?
    @State private var resolved = false

    init(candidates: [String], onBackground: ((Color?) -> Void)? = nil,
         @ViewBuilder fallback: @escaping () -> Fallback) {
        self.candidates = candidates
        self.onBackground = onBackground
        self.fallback = fallback
    }

    /// Single-URL convenience for call sites that only ever have one source.
    init(urlString: String?, @ViewBuilder fallback: @escaping () -> Fallback) {
        self.init(candidates: urlString.map { [$0] } ?? [], fallback: fallback)
    }

    var body: some View {
        Group {
            if let logo {
                Image(uiImage: logo.image)
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
            logo = await LogoLoader.load(candidates: candidates)
            resolved = true
            onBackground?(logo?.background)
        }
    }
}
