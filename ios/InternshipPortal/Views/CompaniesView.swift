// Companies — the market as clusters of floating glass bubbles.
//
// Each bubble is its OWN body, like the Wabi hero: independent spheres that
// overlap in depth (large behind, small in front), each with its own glass
// shading and drop shadow. The earlier SDF metaball field merged neighbours into
// one skin — physically clever, but it read as smeared borders instead of
// floating bubbles, which is the look that actually matters.
//
// Two design rules do the work here:
//   • Only the leading companies in each tier get a bubble (the rest are one tap
//     away behind "+N more"). All 103 fit on screen, but 70 list exactly one
//     role — as identical minimum-size dots they carried no information.
//   • Clusters group by tier, so where bubbles crowd together it means something.
import SwiftUI

/// One company, aggregated across the catalog and the tracker.
struct CompanyBubble: Identifiable, Equatable {
    let id: String            // normalised company name
    let name: String
    let logoCandidates: [String]
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
    let all: [CompanyBubble]
    var hiddenCount: Int { max(0, all.count - shown.count) }
    var id: String { tier.rawValue }
}

struct CompaniesView: View {
    @Environment(CatalogStore.self) private var store

    @State private var selected: CompanyBubble?
    @State private var listing: BubbleCluster?

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
                all: group
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
                logoCandidates: items.map(\.logoCandidates).first(where: { !$0.isEmpty }) ?? [],
                roleCount: items.count,
                bestScore: items.compactMap(\.score).max() ?? 0,
                status: status,
                tier: tier,
                tint: tier.tint
            )
        }
        .sorted { ($0.roleCount, $0.bestScore) > ($1.roleCount, $1.bestScore) }
    }

    // A PAGE, not a sheet: it is pushed from Applications and gets the system
    // back button. Only the company detail below is a sheet — a market overview
    // is a place you go, a single company is a card you lift.
    var body: some View {
        ZStack {
            Palette.canvas.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    ForEach(clusters) { cluster in
                        ClusterBand(
                            cluster: cluster,
                            onTap: { selected = $0 },
                            onMore: { listing = $0 }
                        )
                    }
                }
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("Companies")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarVisibility(.visible, for: .navigationBar)
        .sheet(item: $selected) { CompanyRolesSheet(company: $0) }
        .sheet(item: $listing) { cluster in
            TierListSheet(cluster: cluster) { bubble in
                listing = nil
                selected = bubble
            }
        }
    }
}

/// One tier: a heading, then its bubbles fused into a single blob.
private struct ClusterBand: View {
    var cluster: BubbleCluster
    var onTap: (CompanyBubble) -> Void
    var onMore: (BubbleCluster) -> Void

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
                // What's not on screen is one tap away — never a dead label.
                if cluster.hiddenCount > 0 {
                    Button {
                        onMore(cluster)
                    } label: {
                        HStack(spacing: 3) {
                            Text("+\(cluster.hiddenCount) more")
                            Image(systemName: "chevron.right").font(.system(size: 8, weight: .bold))
                        }
                        .font(Font2.micro)
                        .foregroundStyle(Palette.ink500)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(Palette.card, in: .capsule)
                        .cardShadow()
                    }
                    .buttonStyle(.plain)
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
        // Independent orbs, painted LARGE→SMALL so small bubbles sit in front —
        // the depth stacking the Wabi hero uses. Each carries its own glass
        // shading and drop shadow, so every bubble reads as its own body floating
        // over the canvas; nothing merges, nothing draws a shared skin.
        ZStack(alignment: .topLeading) {
            ForEach(placed.sorted { $0.radius > $1.radius }) { item in
                FloatingOrb(item: item) { onTap(item.bubble) }
            }
        }
        .frame(width: size.width, height: size.height)
    }

    // MARK: - Packing

    /// Radius scales with the SQUARE ROOT of the role count, so four roles reads as
    /// four times the *area* of one — area is what the eye compares. Linear radius
    /// would make the big companies absurdly dominant.
    static func pack(_ bubbles: [CompanyBubble], in size: CGSize) -> [PlacedBubble] {
        guard size.width > 0, size.height > 0, !bubbles.isEmpty else { return [] }

        let weights = bubbles.map { sqrt(CGFloat($0.roleCount)) }
        let totalWeightArea = weights.reduce(0) { $0 + $1 * $1 }
        // ~46% coverage: a dense cloud (34% read as scattered dots), but with the
        // shallow-overlap rule the spiral needs a little slack or the shrink-retry
        // loop erodes every radius to fit.
        let usable = size.width * size.height * 0.46
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
                    // A shallow overlap (~18% of the smaller radius) lets small
                    // bubbles tuck in FRONT of big ones, Wabi-style — the paint
                    // order (large first) keeps every logo readable.
                    hypot(candidate.x - other.center.x, candidate.y - other.center.y)
                        > (radius + other.radius) - min(radius, other.radius) * 0.18
                }
                let inBounds = candidate.x - radius > 4 && candidate.x + radius < size.width - 4
                    && candidate.y - radius > 3 && candidate.y + radius < size.height - 3
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

/// One placed bubble: contents → glass shader → drop shadow → slow bob. The bob
/// phase is seeded from the company id so the field breathes out of step, which
/// is what keeps a still layout from looking frozen.
private struct FloatingOrb: View {
    var item: PlacedBubble
    var action: () -> Void

    private var phase: Double {
        Double(abs(item.bubble.id.hashValue) % 977) / 977.0 * 6.28318
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            let t = ShaderClock.seconds(timeline.date)
            let bob = sin(t * 0.5 + phase) * 2.5

            Button(action: action) {
                GlassOrb(bubble: item.bubble, diameter: item.radius * 2)
                    // The float: a soft shadow well below the ball, scaled to it.
                    .shadow(
                        color: .black.opacity(0.16),
                        radius: item.radius * 0.22,
                        y: item.radius * 0.16
                    )
            }
            .buttonStyle(.plain)
            .offset(y: bob)
        }
        .position(x: item.center.x, y: item.center.y)
        .accessibilityLabel(
            "\(item.bubble.name), \(item.bubble.roleCount) role"
                + (item.bubble.roleCount == 1 ? "" : "s")
                + (item.bubble.status.map { ", \($0.label)" } ?? "")
        )
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
            // Sky-to-depth gradient: light where the key light sits, saturated at
            // the bottom, so the magnification has real structure to bulge. The
            // white highlights come from the shader now, not painted here — the
            // old painted white pole doubled with the shader's and looked plastic.
            Circle()
                .fill(
                    RadialGradient(
                        colors: [bubble.tint.bg, bubble.tint.fg.opacity(0.72)],
                        center: .init(x: 0.38, y: 0.28),
                        startRadius: diameter * 0.06,
                        endRadius: diameter * 0.85
                    )
                )

            // The mark rides on a white circular chip. Favicons are square; drawn
            // bare they read as stretched stickers once the lens magnifies them —
            // a circle inside a sphere stays a circle from every angle.
            ZStack {
                Circle()
                    .fill(.white.opacity(0.92))
                // Inscribed, not clipped: a square logo fits inside the circular
                // chip when its side is diameter/√2 — padding ≈ 0.147 of the chip.
                // The old tighter padding cut every square favicon's corners off,
                // which is exactly "the logo doesn't fit the bubble".
                LogoImage(candidates: bubble.logoCandidates) { monogramView }
                    .padding(diameter * 0.19)
            }
            // The chip fills the sphere (~97%) — like the Wabi orbs, where the
            // picture IS the bubble. The tint survives as a sliver at the rim and
            // in the glass shading; a small chip on a flat ball read as a button.
            .frame(width: diameter * 0.97, height: diameter * 0.97)

            // Tracked companies wear their status as a crisp presence badge. With
            // the chip at 97% a ring would hug the refracting rim again (the smear
            // this replaced); a dot at mid-radius stays legible under the lens.
            if let status = bubble.status {
                let badge = max(12, diameter * 0.18)
                Circle()
                    .fill(status.tint.fg)
                    .frame(width: badge, height: badge)
                    .overlay {
                        Circle().strokeBorder(.white, lineWidth: max(1.5, badge * 0.14))
                    }
                    .offset(x: diameter * 0.27, y: diameter * 0.27)
            }
        }
        .frame(width: diameter, height: diameter)
    }

    private var monogramView: some View {
        Text(monogram)
            .font(.system(size: diameter * 0.32, weight: .bold))
            .foregroundStyle(bubble.tint.fg)
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
                    .float(0.16),   // matches the field, so orbs and clusters are one material
                    .float(0.035)
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

/// Every company in a tier, as a plain list — the bubbles show the leaders, this
/// shows everyone. Tapping a row opens the same roles sheet the bubbles do.
private struct TierListSheet: View {
    @Environment(\.dismiss) private var dismiss

    var cluster: BubbleCluster
    var onSelect: (CompanyBubble) -> Void

    var body: some View {
        NavigationStack {
            List(cluster.all) { bubble in
                Button {
                    dismiss()
                    onSelect(bubble)
                } label: {
                    HStack(spacing: 12) {
                        CompanyMark(company: bubble.name, candidates: bubble.logoCandidates, size: 38)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(bubble.name)
                                .font(Font2.rowTitle)
                                .foregroundStyle(Palette.ink)
                                .lineLimit(1)
                            Text(bubble.roleCount == 1 ? String(localized: "1 role") : String(localized: "\(bubble.roleCount) roles"))
                                .font(Font2.caption)
                                .foregroundStyle(Palette.ink500)
                        }
                        Spacer()
                        if let status = bubble.status {
                            StatusChip(status: status)
                        }
                        Chevron()
                    }
                }
                .buttonStyle(.plain)
                .listRowBackground(Palette.card)
            }
            .scrollContentBackground(.hidden)
            .background(Palette.canvas)
            .navigationTitle("\(cluster.tier.label) · \(cluster.all.count)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.large])
        .presentationCornerRadius(Radius.sheet)
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Companies — clusters") {
    NavigationStack { CompaniesView() }
        .environment(CatalogStore.preview)
}

#Preview("One orb") {
    ZStack {
        Palette.canvas
        GlassOrb(
            bubble: CompanyBubble(
                id: "hennge", name: "HENNGE", logoCandidates: [], roleCount: 4,
                bestScore: 99, status: .interview, tier: .flagship, tint: .indigo
            ),
            diameter: 180
        )
    }
    .ignoresSafeArea()
}
#endif
