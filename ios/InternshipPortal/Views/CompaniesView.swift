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

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drag: CGSize = .zero
    @State private var dragging = false

    private var phase: Double {
        Double(abs(item.bubble.id.hashValue) % 977) / 977.0 * 6.28318
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: reduceMotion)) { timeline in
            let t = ShaderClock.seconds(timeline.date)
            // The bob pauses while you hold the bubble — a thing you are touching
            // should not also be drifting under your finger.
            let bob = (reduceMotion || dragging) ? 0 : sin(t * 0.5 + phase) * 2.5

            GlassOrb(bubble: item.bubble, diameter: item.radius * 2)
                // Lifted while held: bigger, with a longer shadow.
                .shadow(
                    color: .black.opacity(dragging ? 0.24 : 0.16),
                    radius: item.radius * (dragging ? 0.4 : 0.22),
                    y: item.radius * (dragging ? 0.3 : 0.16)
                )
                .scaleEffect(dragging ? 1.08 : 1)
                .offset(x: drag.width, y: drag.height + bob)
                .zIndex(dragging ? 1 : 0)
        }
        .position(x: item.center.x, y: item.center.y)
        .gesture(
            // Pull a bubble out of the cluster and it springs home — the cluster
            // is where it belongs, and the snap is what says so. minimumDistance 0
            // so the same gesture carries the tap.
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    if !dragging {
                        withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                            dragging = true
                        }
                    }
                    // Rubber-banding: the further out you pull, the more the
                    // cluster resists — it reads as elastic rather than free.
                    let pull = hypot(value.translation.width, value.translation.height)
                    let give = pull > 0 ? min(1, 90 / pull * 1.6) : 1
                    drag = CGSize(
                        width: value.translation.width * max(0.35, give),
                        height: value.translation.height * max(0.35, give)
                    )
                }
                .onEnded { value in
                    let moved = hypot(value.translation.width, value.translation.height)
                    // A bouncy spring, not a linear ease: the bubble should
                    // overshoot slightly and settle, the way a tethered thing does.
                    withAnimation(.spring(response: 0.55, dampingFraction: 0.55)) {
                        drag = .zero
                        dragging = false
                    }
                    if moved < 12 { action() }
                }
        )
        .accessibilityElement()
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(
            "\(item.bubble.name), \(item.bubble.roleCount) role"
                + (item.bubble.roleCount == 1 ? "" : "s")
                + (item.bubble.status.map { ", \($0.label)" } ?? "")
        )
        .accessibilityAction { action() }
    }
}

/// The inside of one bubble: tint, poles, and the company's mark.
struct BubbleContents: View {
    var bubble: CompanyBubble
    var diameter: CGFloat

    /// The logo's own background, once known. Cloudflare's orange, BMO's blue —
    /// the brand's field becomes the bubble's field, so the sphere reads as that
    /// company rather than as a white chip with a sticker on it.
    @State private var brand: Color?

    private var monogram: String {
        bubble.name.trimmingCharacters(in: .whitespaces).first.map { String($0).uppercased() } ?? "?"
    }

    /// Bare marks (transparent artwork) get white — the field a logo is designed
    /// against — not the tier pastel, which tinted every mark the wrong colour.
    private var field: Color { brand ?? .white }

    var body: some View {
        ZStack {
            // ONE circle, filling the whole sphere. The old white chip inside a
            // pastel ball left a visible ring and made the mark look pasted on;
            // the brand field IS the bubble now, edge to edge.
            Circle()
                .fill(field)
                .overlay {
                    // A touch of depth so the lens has something to bend: light at
                    // the key-light pole, a shade at the far one.
                    Circle().fill(
                        LinearGradient(
                            colors: [.white.opacity(0.28), .clear, .black.opacity(0.10)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        )
                    )
                }

            LogoImage(candidates: bubble.logoCandidates, onBackground: { colour in
                withAnimation(.easeOut(duration: 0.25)) { brand = colour }
            }) {
                monogramView
            }
            // ALWAYS inset, even when the mark brings its own field. Brand tiles
            // are squares whose artwork runs to the corners (Nokia's slash goes
            // corner to corner) — filling a CIRCLE with one crops the mark, which
            // is what read as "oversized". Insetting keeps the mark whole, and the
            // tile's own background disappears into the sphere behind it because
            // that sphere is painted the very same colour.
            .padding(diameter * 0.17)
            .clipShape(.circle)

            // Tracked companies wear a presence badge at mid-radius, where the
            // lens doesn't smear it.
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
        // On white, the tier tint is the only colour the mark has.
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
