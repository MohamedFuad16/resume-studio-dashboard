// A company's page — what the card-expand gesture opens when you tap an orb.
//
// This is where the expansion treatment lives, and deliberately NOT on the
// Applications cards: those open RecordSheet, a finished view with its own
// chrome, and expanding into it doubled the close buttons (owner's screenshot,
// 2026-07-20). An orb has no chrome of its own, so the page below owns the whole
// canvas and there is exactly one X — the expander's.
//
// STATS HONESTY: every number here is real or absent. Popularity is the catalog
// score; footprint is listings counted; your history is the tracker. Funding /
// work-life balance / headcount are NOT invented client-side — the server's
// research payload doesn't carry them yet (requested in contracts/CHANGELOG.md,
// 2026-07-20). `FactsGrid` below already renders a `facts` object if the job
// JSON ever includes one, so the web team shipping it lights this page up
// without an app update.
import SwiftUI

// MARK: - Research wire types (see editor/server/index.js research-company)

struct ResearchJob: Decodable, Equatable {
    struct Opening: Decodable, Equatable, Identifiable {
        let id: String?
        let role: String?
        let location: String?
        let workMode: String?
        let language: String?
        let url: String?
        let deadline: String?
        var listID: String { id ?? "\(role ?? "?")|\(location ?? "?")" }
    }
    /// Forward-compatible: the server does not send this yet. When it does
    /// (funding, workLifeBalance, employees, founded…), the grid lights up.
    struct Facts: Decodable, Equatable {
        let funding: String?
        let workLifeBalance: String?
        let employees: String?
        let founded: String?
        let rating: String?
    }

    let jobId: String?
    let status: String
    let company: String?
    let summary: String?
    let results: [Opening]?
    let facts: Facts?
    let error: String?
}

extension PortalAPI {
    static func researchCompany(_ company: String, profile: String) async throws -> ResearchJob {
        var request = URLRequest(url: baseURL.appending(path: "api/internships/research-company"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["company": company, "profile": profile])
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode), http.statusCode != 202 {
            throw APIError.badStatus(http.statusCode)
        }
        return try JSONDecoder().decode(ResearchJob.self, from: data)
    }

    static func researchJob(_ id: String) async throws -> ResearchJob {
        let (data, response) = try await URLSession.shared.data(
            from: baseURL.appending(path: "api/internships/research-company/\(id)")
        )
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
        return try JSONDecoder().decode(ResearchJob.self, from: data)
    }
}

// MARK: - The page

struct CompanyDetailView: View {
    @Environment(CatalogStore.self) private var store

    let bubble: CompanyBubble

    @State private var research: ResearchJob?
    @State private var researching = false
    /// Sheets, as before — the neat presentation the owner asked to keep for
    /// application records and postings.
    @State private var recordSheet: TrackerRecord?
    @State private var postingSheet: Internship?

    private var listings: [Internship] {
        store.internships.filter {
            $0.displayCompany.lowercased().trimmingCharacters(in: .whitespaces) == bubble.id
        }
    }

    private var myRecords: [TrackerRecord] {
        let key = CatalogStore.companyKey(bubble.name)
        return store.tracker.values
            .filter { CatalogStore.companyKey($0.company) == key }
            .sorted { ($0.updatedAt ?? "") > ($1.updatedAt ?? "") }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                statTiles
                if !myRecords.isEmpty { applicationsSection }
                if !listings.isEmpty { openingsSection }
                researchSection
            }
            .padding(.horizontal, 20)
            // Clears the expander's close button, which sits at the top-right.
            .padding(.top, 96)
            .padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
        .background(Palette.canvas)
        .sheet(item: $recordSheet) { RecordSheet(record: $0) }
        .sheet(item: $postingSheet) { InternshipSheet(item: $0) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                GlassOrb(bubble: bubble, diameter: 64)
                VStack(alignment: .leading, spacing: 3) {
                    Text(bubble.name)
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(Palette.ink)
                    Text(tierLine)
                        .font(Font2.caption)
                        .foregroundStyle(Palette.ink500)
                }
            }
            if let status = bubble.status {
                HStack(spacing: 8) {
                    StatusChip(status: status)
                    Text("your furthest stage here")
                        .font(Font2.caption)
                        .foregroundStyle(Palette.ink500)
                }
            }
        }
    }

    private var tierLine: String {
        switch bubble.tier {
        case .flagship: String(localized: "Flagship — a market anchor")
        case .scaleUp: String(localized: "Scale-up — growing fast")
        case .startup: String(localized: "Startup — small team, wide surface")
        }
    }

    private var statTiles: some View {
        // The two facts the catalog actually contains. Popularity is the best
        // listing score — the same number that drives Radar ordering, so the page
        // agrees with the rest of the app rather than inventing a second scale.
        HStack(spacing: 10) {
            StatTile(
                label: String(localized: "Popularity"),
                value: "\(bubble.bestScore)",
                detail: String(localized: "catalog score · drives Radar rank"),
                fraction: Double(bubble.bestScore) / 100
            )
            StatTile(
                label: String(localized: "Openings"),
                value: "\(bubble.roleCount)",
                detail: bubble.roleCount == 1
                    ? String(localized: "listing in the catalog")
                    : String(localized: "listings in the catalog"),
                fraction: nil
            )
        }
    }

    private var applicationsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(String(localized: "Your applications"))
            ForEach(myRecords, id: \.id) { record in
                Button { recordSheet = record } label: {
                    Card(radius: Radius.row, padding: 13) {
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(record.displayRole)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(Palette.ink)
                                    .lineLimit(1)
                                if record.statusPinned == true {
                                    HStack(spacing: 4) {
                                        Image(systemName: "hand.raised.fill").font(.system(size: 8))
                                        Text("Set by you")
                                    }
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundStyle(Palette.ink500)
                                }
                            }
                            Spacer()
                            StatusChip(status: record.appStatus)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var openingsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(String(localized: "In the catalog"))
            ForEach(listings) { item in
                Button { postingSheet = item } label: {
                    Card(radius: Radius.row, padding: 13) {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.displayRole)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(Palette.ink)
                                    .lineLimit(1)
                                Text(item.deadline ?? String(localized: "Not stated"))
                                    .font(Font2.caption)
                                    .foregroundStyle(Palette.ink500)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Palette.ink500)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var researchSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(String(localized: "Company brief"))

            if let facts = research?.facts {
                FactsGrid(facts: facts)
            }

            if let summary = research?.summary, research?.status == "complete" {
                Card(radius: Radius.row, padding: 14) {
                    Text(summary)
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let openings = research?.results, !openings.isEmpty {
                    ForEach(openings) { opening in
                        Card(radius: Radius.row, padding: 13) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(opening.role ?? String(localized: "Role"))
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(Palette.ink)
                                Text([opening.location, opening.workMode, opening.language]
                                    .compactMap { $0 }.filter { !$0.isEmpty && $0 != "Not stated" }
                                    .joined(separator: " · "))
                                    .font(Font2.caption)
                                    .foregroundStyle(Palette.ink500)
                            }
                        }
                    }
                }
            } else if let error = research?.error {
                Card(radius: Radius.row, padding: 14) {
                    Text(error).font(Font2.caption).foregroundStyle(Palette.red)
                }
            } else {
                Button { runResearch() } label: {
                    Card(radius: Radius.row, padding: 14) {
                        HStack(spacing: 10) {
                            if researching {
                                ProgressView().controlSize(.small)
                                Text("Reading the live web — up to a minute…")
                            } else {
                                Image(systemName: "sparkle.magnifyingglass")
                                Text("Research this company")
                            }
                            Spacer()
                        }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Palette.ink)
                    }
                }
                .buttonStyle(.plain)
                .disabled(researching)
            }
        }
    }

    private func runResearch() {
        guard !researching else { return }
        researching = true
        Task {
            defer { researching = false }
            do {
                var job = try await PortalAPI.researchCompany(bubble.name, profile: store.profileID ?? PortalAPI.profile)
                // The server answers 202 immediately and keeps working; poll. The
                // cap matches the server's own search budget, not impatience.
                var waited = 0
                while job.status == "researching", waited < 90, let id = job.jobId {
                    try? await Task.sleep(for: .seconds(3))
                    waited += 3
                    job = try await PortalAPI.researchJob(id)
                }
                research = job
            } catch {
                research = ResearchJob(
                    jobId: nil, status: "error", company: bubble.name,
                    summary: nil, results: nil, facts: nil,
                    error: String(localized: "Couldn't reach the research service — try again in a moment.")
                )
            }
        }
    }
}

// MARK: - Pieces

private struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Palette.ink500)
            .textCase(.uppercase)
            .kerning(0.6)
    }
}

private struct StatTile: View {
    let label: String
    let value: String
    let detail: String
    let fraction: Double?

    var body: some View {
        Card(radius: Radius.row, padding: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(label).font(Font2.caption).foregroundStyle(Palette.ink500)
                Text(value).font(.system(size: 24, weight: .bold)).foregroundStyle(Palette.ink)
                if let fraction {
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Palette.hairline)
                            Capsule().fill(Palette.teal)
                                .frame(width: proxy.size.width * fraction)
                        }
                    }
                    .frame(height: 4)
                }
                Text(detail).font(.system(size: 10)).foregroundStyle(Palette.ink500)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct FactsGrid: View {
    let facts: ResearchJob.Facts

    private var rows: [(String, String)] {
        [(String(localized: "Funding"), facts.funding),
         (String(localized: "Work-life balance"), facts.workLifeBalance),
         (String(localized: "Employees"), facts.employees),
         (String(localized: "Founded"), facts.founded),
         (String(localized: "Rating"), facts.rating)]
            .compactMap { label, value in value.map { (label, $0) } }
    }

    var body: some View {
        Card(radius: Radius.row, padding: 14) {
            VStack(spacing: 8) {
                ForEach(rows, id: \.0) { label, value in
                    HStack {
                        Text(label).font(Font2.caption).foregroundStyle(Palette.ink500)
                        Spacer()
                        Text(value).font(.system(size: 13, weight: .medium)).foregroundStyle(Palette.ink)
                    }
                }
            }
        }
    }
}

#Preview("Company page") {
    CompanyDetailView(bubble: .init(
        id: "hennge", name: "HENNGE", logoCandidates: [], roleCount: 4,
        bestScore: 99, status: .rejected, tier: .flagship, tint: .indigo
    ))
    .environment(CatalogStore())
}
