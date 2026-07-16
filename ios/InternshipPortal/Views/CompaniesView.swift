// Companies — the market as three clusters of merged glass bubbles.
//
// Built like Wabi's splash: a single signed-distance field over one canvas, warped
// by a loupe shader, rather than N independent circle views. Neighbours merge with
// a meniscus because they are evaluated into the same field (see `bubbleField` in
// Shaders.metal); separate views could only ever overlap.
//
// Two design rules do the work here:
//   • Only the leading companies in each tier get a bubble. All 103 fit on screen,
//     but 70 of them list exactly one role — as identical minimum-size dots they
//     carried no information and turned the field into foam.
//   • Clusters are the grouping, so the shader's merge means something: bubbles
//     fuse with their own tier and stay clear of the others.
import SwiftUI

/// One company, aggregated across the catalog and the tracker.
struct CompanyBubble: Identifiable, Equatable {
    let id: String            // normalised company name
    let name: String
    let logoURL: String?
    let roleCount: Int        // listings in the catalog — the size signal
    let bestScore: Int
    let status: ApplicationStatus?
    let tier: CompanyTier
    let tint: Color6

    var isTracked: Bool { status != nil }
}

/// A bubble with a place and a size in the field.
struct PlacedBubble: Identifiable, Equatable {
    let bubble: CompanyBubble
    var center: CGPoint
    var radius: CGFloat
    var id: String { bubble.id }
}

/// A tier's cluster: its bubbles, and the band of the canvas they live in.
struct BubbleCluster: Identifiable {
    let tier: CompanyTier
    let shown: [CompanyBubble]
    let hiddenCount: Int
    var id: String { tier.rawValue }
}

struct CompaniesView: View {
    @Environment(CatalogStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var selected: CompanyBubble?

    /// How many bubbles each tier shows. Eight per cluster keeps every bubble big
    /// enough to carry a legible logo.
    private static let perTier = 8

    private var clusters: [BubbleCluster] {
        let all = Self.aggregate(store)
        return CompanyTier.allCases.map { tier in
            let group = all.filter { $0.tier == tier }
            return BubbleCluster(
                tier: tier,
                shown: Array(group.prefix(Self.perTier)),
                hiddenCount: max(0, group.count - Self.perTier)
            )
        }
        .filter { !$0.shown.isEmpty }
    }

    /// Bubble size is driven by the company's footprint in the catalog — how many
    /// distinct roles they list. It is the only "how big is this company" signal
    /// the data actually contains; headcount is not in the catalog, and inventing
    /// it from prestige tiers would be a guess dressed as a fact.
    static func aggregate(_ store: CatalogStore) -> [CompanyBubble] {
        var grouped: [String: [Internship]] = [:]
        for item in store.internships {
            let key = item.displayCompany.lowercased().trimmingCharacters(in: .whitespaces)
            guard !key.isEmpty else { continue }
            grouped[key, default: []].append(item)
        }

        return grouped.compactMap { key, items -> CompanyBubble? in
            guard let first = items.first else { return nil }
            let tracked = items.compactMap { store.status(for: $0.id) }
            // Show the furthest-along status: an interview matters more than the
            // four saved roles at the same company.
            let status = tracked.max { $0.rank < $1.rank }
            let tier = first.tier
            return CompanyBubble(
                id: key,
                name: first.displayCompany,
                logoURL: items.compactMap(\.logoUrl).first,
                roleCount: items.count,
                bestScore: items.compactMap(\.score).max() ?? 0,
                status: status,
                tier: tier,
                tint: tier.tint
            )
        }
        .sorted { ($0.roleCount, $0.bestScore) > ($1.roleCount, $1.bestScore) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Palette.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(clusters) { cluster in
                            ClusterBand(cluster: cluster) { selected = $0 }
                        }
                    }
                    .padding(.bottom, 24)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Companies")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
            .sheet(item: $selected) { CompanyRolesSheet(company: $0) }
        }
    }
}

/// One tier: a heading, then its bubbles fused into a single blob.
private struct ClusterBand: View {
    var cluster: BubbleCluster
    var onTap: (CompanyBubble) -> Void

    /// Tall enough for eight bubbles to cluster without the spiral having to reach
    /// for the edges.
    private var height: CGFloat { cluster.shown.count > 4 ? 250 : 170 }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Circle()
                    .fill(cluster.tier.tint.fg)
                    .frame(width: 7, height: 7)
                Text(cluster.tier.label)
                    .font(Font2.sectionTitle)
                    .foregroundStyle(Palette.ink)
                Text(cluster.tier.blurb)
                    .font(Font2.caption)
                    .foregroundStyle(Palette.ink400)
                Spacer()
                // Never silently truncate: say what is not on screen.
                if cluster.hiddenCount > 0 {
                    Text("+\(cluster.hiddenCount) more")
                        .font(Font2.micro)
                        .foregroundStyle(Palette.ink400)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 2)

            GeometryReader { proxy in
                BubbleField(bubbles: cluster.shown, size: proxy.size, onTap: onTap)
            }
            .frame(height: height)
        }
    }
}

/// The merged field: contents drawn normally, then bent by one shader pass.
struct BubbleField: View {
    var bubbles: [CompanyBubble]
    var size: CGSize
    var onTap: (CompanyBubble) -> Void

    private var placed: [PlacedBubble] { Self.pack(bubbles, in: size) }

    /// (x, y, radius) triples for the shader's SDF loop.
    private var packedFloats: [Float] {
        placed.flatMap { [Float($0.center.x), Float($0.center.y), Float($0.radius)] }
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
            let t = ShaderClock.seconds(timeline.date)

            contents
                .layerEffect(
                    ShaderLibrary.bubbleField(
                        .float2(size),
                        .floatArray(packedFloats),
                        .float(t),
                        // Blend radius, in points. Tuned down from 14: at that value
                        // the field fused into foam and individual companies stopped
                        // being readable. ~9 lets a cluster read as one body while
                        // each company keeps its own dome.
                        .float(9),
                        .float(1.45),   // IOR — roughly crown glass
                        .float(0.18)    // chromatic spread at the rim
                    ),
                    // Must cover the largest offset the loupe can produce (34pt),
                    // plus the drift, or the refraction clips at the edges.
                    maxSampleOffset: CGSize(width: 44, height: 44)
                )
                .overlay { taps }
        }
    }

    /// What lives inside the glass. The shader refracts whatever this renders, so
    /// each bubble needs real structure — a lit pole, a shadowed pole, a mark.
    private var contents: some View {
        ZStack(alignment: .topLeading) {
            // The shader reads this layer's alpha; a clear ground keeps everything
            // outside the field transparent.
            Color.clear

            ForEach(placed) { item in
                BubbleContents(bubble: item.bubble, diameter: item.radius * 2)
                    .position(x: item.center.x, y: item.center.y)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    /// Hit targets sit above the shader: the warp moves pixels, not geometry, so
    /// tapping what you see means tapping the real circle underneath.
    private var taps: some View {
        ZStack(alignment: .topLeading) {
            ForEach(placed) { item in
                Circle()
                    .fill(.clear)
                    .contentShape(.circle)
                    .frame(width: item.radius * 2, height: item.radius * 2)
                    .position(x: item.center.x, y: item.center.y)
                    .onTapGesture { onTap(item.bubble) }
                    .accessibilityElement()
                    .accessibilityLabel(
                        "\(item.bubble.name), \(item.bubble.roleCount) role"
                            + (item.bubble.roleCount == 1 ? "" : "s")
                            + (item.bubble.status.map { ", \($0.label)" } ?? "")
                    )
                    .accessibilityAddTraits(.isButton)
            }
        }
    }

    // MARK: - Packing

    /// Radius scales with the SQUARE ROOT of the role count, so four roles reads as
    /// four times the *area* of one — area is what the eye compares. Linear radius
    /// would make the big companies absurdly dominant.
    static func pack(_ bubbles: [CompanyBubble], in size: CGSize) -> [PlacedBubble] {
        guard size.width > 0, size.height > 0, !bubbles.isEmpty else { return [] }

        let weights = bubbles.map { sqrt(CGFloat($0.roleCount)) }
        let totalWeightArea = weights.reduce(0) { $0 + $1 * $1 }
        // ~34% coverage: tight enough for a cluster to fuse into one body, open
        // enough that each company still reads as its own dome.
        let usable = size.width * size.height * 0.34
        var unit = sqrt(usable / (.pi * max(totalWeightArea, 1)))

        // Shrink and retry until everything fits. The coverage figure above is a
        // guess at how efficiently a spiral will pack; when it guesses high, the
        // honest fix is a smaller unit, not dropping companies. Relative sizes are
        // preserved because every radius scales by the same factor.
        for _ in 0..<12 {
            if let result = attempt(bubbles, weights: weights, unit: unit, in: size) {
                return result
            }
            unit *= 0.92
        }
        return attempt(bubbles, weights: weights, unit: unit, in: size, minRadius: 10) ?? []
    }

    /// One packing pass. Returns nil if any bubble could not be placed — never a
    /// partial field, because a silently missing company is a lie about the data.
    private static func attempt(
        _ bubbles: [CompanyBubble], weights: [CGFloat], unit: CGFloat,
        in size: CGSize, minRadius: CGFloat = 20
    ) -> [PlacedBubble]? {
        var placed: [PlacedBubble] = []
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let maxStep = max(size.width, size.height)

        for (index, bubble) in bubbles.enumerated() {
            let radius = max(minRadius, weights[index] * unit)

            // Spiral outward from the cluster's centre until the bubble no longer
            // collides. Deterministic: same data, same picture every launch. A
            // physics simulation would look livelier for one second and then make
            // this view impossible to reason about, screenshot, or test.
            var spot: CGPoint?
            var angle = Double(index) * 2.399963   // golden angle — no spokes
            var step: CGFloat = 0

            while step < maxStep {
                let candidate = CGPoint(
                    x: center.x + cos(angle) * step * 1.25,   // wider than tall
                    y: center.y + sin(angle) * step * 0.72
                )
                let fits = placed.allSatisfy { other in
                    // Rims sit ~4pt apart so the shader's blend bridges neighbours
                    // into one cluster body without swallowing them.
                    hypot(candidate.x - other.center.x, candidate.y - other.center.y)
                        > (radius + other.radius) - 4
                }
                let inBounds = candidate.x - radius > 10 && candidate.x + radius < size.width - 10
                    && candidate.y - radius > 6 && candidate.y + radius < size.height - 6
                if fits && inBounds {
                    spot = candidate
                    break
                }
                angle += 0.3
                step += 1.4
            }

            guard let spot else { return nil }
            placed.append(PlacedBubble(bubble: bubble, center: spot, radius: radius))
        }
        return placed
    }
}

/// The inside of one bubble: tint, poles, and the company's mark.
struct BubbleContents: View {
    var bubble: CompanyBubble
    var diameter: CGFloat

    private var monogram: String {
        bubble.name.trimmingCharacters(in: .whitespaces).first.map { String($0).uppercased() } ?? "?"
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [bubble.tint.bg, bubble.tint.fg.opacity(0.5)],
                        center: .init(x: 0.35, y: 0.3),
                        startRadius: 0,
                        endRadius: diameter * 0.7
                    )
                )

            // A bright pole and a dark pole give the refraction something with real
            // structure to bend; a flat fill refracts into a flat fill.
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.white.opacity(0.7), .clear, bubble.tint.fg.opacity(0.45)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                )

            Group {
                if let logoURL = bubble.logoURL, let url = URL(string: logoURL) {
                    AsyncImage(url: url) { phase in
                        if case .success(let image) = phase {
                            image.resizable().scaledToFit()
                        } else {
                            monogramView
                        }
                    }
                } else {
                    monogramView
                }
            }
            .frame(width: diameter * 0.42, height: diameter * 0.42)

            // Tracked companies wear a ring, so status survives the glass.
            if let status = bubble.status {
                Circle()
                    .strokeBorder(status.tint.fg.opacity(0.95), lineWidth: max(2, diameter * 0.035))
                    .padding(1.5)
            }
        }
        .frame(width: diameter, height: diameter)
    }

    private var monogramView: some View {
        Text(monogram)
            .font(.system(size: diameter * 0.3, weight: .bold))
            .foregroundStyle(Palette.ink.opacity(0.7))
            .minimumScaleFactor(0.4)
            .lineLimit(1)
    }
}

/// A single bubble outside the field — used by the Applications entry button and
/// the roles sheet, where there is no cluster to merge into.
struct GlassOrb: View {
    var bubble: CompanyBubble
    var diameter: CGFloat

    var body: some View {
        BubbleContents(bubble: bubble, diameter: diameter)
            .layerEffect(
                ShaderLibrary.glassOrb(
                    .float2(CGSize(width: diameter, height: diameter)),
                    .float(1.45),
                    .float(0.16)
                ),
                maxSampleOffset: CGSize(width: diameter, height: diameter)
            )
            .frame(width: diameter, height: diameter)
            .accessibilityHidden(true)
    }
}

/// Tapping a bubble: what this company is actually hiring for.
private struct CompanyRolesSheet: View {
    @Environment(CatalogStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var company: CompanyBubble
    @State private var route: Internship?

    private var roles: [Internship] {
        store.internships
            .filter { $0.displayCompany.lowercased().trimmingCharacters(in: .whitespaces) == company.id }
            .sorted { ($0.score ?? 0) > ($1.score ?? 0) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    GlassOrb(bubble: company, diameter: 116)
                        .padding(.top, 8)

                    HStack(spacing: 8) {
                        Text(company.tier.label)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(company.tier.tint.fg)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(company.tier.tint.bg, in: .capsule)
                        if let status = company.status {
                            StatusChip(status: status)
                        }
                    }

                    ForEach(roles) { item in
                        MatchCard(item: item) { route = item }
                    }
                }
                .padding(20)
            }
            .scrollIndicators(.hidden)
            .background(Palette.canvas)
            .navigationTitle(company.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
            .sheet(item: $route) { InternshipSheet(item: $0) }
        }
        .presentationDetents([.fraction(0.75), .large])
        .presentationCornerRadius(Radius.sheet)
    }
}

// MARK: - Previews

#Preview("Companies — clusters") {
    CompaniesView().environment(CatalogStore.preview)
}

#Preview("One orb") {
    ZStack {
        Palette.canvas
        GlassOrb(
            bubble: CompanyBubble(
                id: "hennge", name: "HENNGE", logoURL: nil, roleCount: 4,
                bestScore: 99, status: .interview, tier: .flagship, tint: .indigo
            ),
            diameter: 180
        )
    }
    .ignoresSafeArea()
}
