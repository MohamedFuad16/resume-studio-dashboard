// Company logo loading, shared by the cards and the bubbles.
//
// Logos come from a CANDIDATE CHAIN (see logoCandidateURLs in Models.swift):
// gstatic faviconV2 at 256px, the site's own apple-touch-icon, DuckDuckGo for
// coverage, the catalog's logoUrl last. No favicon service behaves like a plain
// image host, so the loader carries two defenses:
//   • DDG never 404s — unknown domains get a constant grey placeholder at HTTP
//     200. It is byte-identical every time, so it is detected by hash.
//   • The chain takes the LARGEST candidate, not the first acceptable one. Taking
//     the first ≥48px meant a 48px DDG icon beat a 256px gstatic one purely by
//     ordering, then got stretched over a 90pt bubble — that is what "low quality"
//     looked like across the app. Only a genuinely big result (≥120px) short-
//     circuits the walk; anything less keeps looking for better.
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

    /// Big enough that nothing later in the chain could look meaningfully better
    /// on a 90pt bubble at 3x — stop walking once something this good arrives.
    private static let goodEnough = 120

    /// Walks the chain and returns the BIGGEST logo it finds.
    ///
    /// Not the first acceptable one: the chain is ordered by expected quality, but
    /// expectation is not measurement — a domain with no gstatic entry falls
    /// through to a 32px DDG favicon, and "first ≥48px" would have shipped that
    /// while a large apple-touch-icon sat unread later in the list. Measuring every
    /// candidate costs a few requests the URLCache mostly absorbs, and it is the
    /// difference between a crisp mark and a blurred one.
    static func load(candidates: [String]) async -> CompanyLogo? {
        var best: CompanyLogo?
        var bestWidth = 0
        for urlString in candidates {
            guard let image = await load(urlString) else { continue }
            let width = image.cgImage?.width ?? 0
            guard width > bestWidth else { continue }
            best = CompanyLogo(image: image, background: background(of: image, key: urlString))
            bestWidth = width
            if width >= goodEnough { break }
        }
        return best
    }

    /// Warm the cache for several candidate chains at once.
    ///
    /// An animated cluster must not start moving until its artwork is in hand: the
    /// glass ball would fly in and its mark would pop in a beat later, so the parts
    /// read as arriving separately instead of as one finished bubble. Returns when
    /// every logo has resolved OR `timeout` elapses — a slow network delays the
    /// intro by at most that, it never blocks it.
    static func preload(_ chains: [[String]], timeout: Double) async {
        // Plain Tasks rather than a task group: every group formulation of this
        // trips Swift 6's region-based isolation checker on the @MainActor loader.
        // Creating the tasks starts them all at once, which is the concurrency we
        // actually wanted.
        let running = chains.filter { !$0.isEmpty }.map { chain in
            Task { @MainActor in _ = await LogoLoader.load(candidates: chain) }
        }
        let deadline = ContinuousClock.now.advanced(by: .seconds(timeout))
        for task in running {
            if ContinuousClock.now >= deadline { break }
            _ = await task.value
        }
        // Stragglers are deliberately NOT cancelled — they keep warming the cache
        // in the background so the logo is there the moment its bubble needs it.
    }

    /// One candidate URL → artwork, or nil if this source has nothing real.
    ///
    /// "Nothing real" is not the same as an HTTP error. Both favicon services
    /// answer 200 for domains they have never heard of — DDG with a constant grey
    /// placeholder (caught by hash) and gstatic with an HTML redirect page (caught
    /// by UIImage simply failing to decode it). A status check alone would let both
    /// through and they would render as a grey smudge on the bubble.
    private static func load(_ urlString: String) async -> UIImage? {
        let key = urlString as NSString
        if let hit = cache.object(forKey: key) { return hit }
        if missing.contains(urlString) { return nil }

        guard let url = URL(string: urlString) else { return nil }
        // A short per-request timeout: the default 60s would let one unreachable
        // favicon host hold the splash's preload open far past its own deadline.
        var request = URLRequest(url: url)
        request.timeoutInterval = 6
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode)
        else {
            missing.insert(urlString)
            return nil
        }

        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        guard digest != ddgPlaceholderSHA256, let image = UIImage(data: data) else {
            missing.insert(urlString)
            return nil
        }

        cache.setObject(image, forKey: key)
        return image
    }

    /// The artwork's background, read from its outer ring.
    ///
    /// Sampling the EDGE, not the average: a logo's average is the mark mixed with
    /// its field (Cloudflare came back muddy brown); the edge IS the field.
    ///
    /// Transparent samples are IGNORED rather than counted against the logo. Most
    /// brand tiles are ROUNDED squares, so their corners are transparent by
    /// design — the old rule ("more than a third transparent → no field") threw
    /// away Cloudflare's orange for exactly that reason and left an orange square
    /// sitting on a white bubble. What matters is whether the OPAQUE part of the
    /// ring agrees with itself.
    private static func background(of image: UIImage, key: String) -> Color? {
        if let hit = backgrounds[key] { return hit }

        guard let cg = image.cgImage else { return nil }
        let side = 24
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        guard let ctx = CGContext(
            data: &pixels, width: side, height: side, bitsPerComponent: 8,
            bytesPerRow: side * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: side, height: side))

        // Sample the ring one pixel in (favicons carry a stray outline on the
        // outermost row), but SKIP THE CORNERS. Brand tiles are rounded squares:
        // their sides are the field colour, their corners are white or transparent.
        // Averaging the whole ring let those corners poison the result — Nokia's
        // blue tile read as "not one flat field" (blue sides + white corners) and
        // got rejected, so it insets as a blue square on a white circle. The sides
        // alone tell the truth.
        var samples: [(Double, Double, Double)] = []
        var ringCount = 0
        let inset = 1
        let cornerSkip = 4
        for y in inset..<(side - inset) {
            for x in inset..<(side - inset)
            where x == inset || y == inset || x == side - inset - 1 || y == side - inset - 1 {
                let nearX = x <= inset + cornerSkip || x >= side - inset - 1 - cornerSkip
                let nearY = y <= inset + cornerSkip || y >= side - inset - 1 - cornerSkip
                if nearX && nearY { continue }   // a corner cell — skip it
                ringCount += 1
                let i = (y * side + x) * 4
                let a = Double(pixels[i + 3]) / 255
                if a < 0.9 { continue }   // transparent / antialiased → not the field
                samples.append((Double(pixels[i]) / 255 / a,
                                Double(pixels[i + 1]) / 255 / a,
                                Double(pixels[i + 2]) / 255 / a))
            }
        }

        var result: Color?
        // Need most of the (corner-free) ring to be opaque for a field to exist at
        // all; a bare mark on transparent shows almost nothing here.
        if samples.count >= max(4, Int(Double(ringCount) * 0.5)) {
            // The field is the DOMINANT colour, not the average: find the sample
            // whose neighbours (within 0.12) are most numerous. A tile with a subtle
            // gradient still clusters; a busy/photographic edge does not, so it
            // stays nil and falls back to white rather than inventing a colour.
            var best: (c: (Double, Double, Double), count: Int) = (samples[0], 0)
            for candidate in samples {
                let count = samples.filter {
                    max(abs($0.0 - candidate.0), abs($0.1 - candidate.1), abs($0.2 - candidate.2)) < 0.12
                }.count
                if count > best.count { best = (candidate, count) }
            }
            if Double(best.count) >= Double(samples.count) * 0.6 {
                let cluster = samples.filter {
                    max(abs($0.0 - best.c.0), abs($0.1 - best.c.1), abs($0.2 - best.c.2)) < 0.12
                }
                let n = Double(cluster.count)
                result = Color(
                    .sRGB,
                    red: cluster.reduce(0) { $0 + $1.0 } / n,
                    green: cluster.reduce(0) { $0 + $1.1 } / n,
                    blue: cluster.reduce(0) { $0 + $1.2 } / n
                )
            }
        }
        backgrounds[key] = result
        return result
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
