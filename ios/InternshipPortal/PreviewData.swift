// Fixtures for the Xcode canvas.
//
// Every screen in this app is driven by CatalogStore, so a preview without a
// pre-filled store shows an empty state and teaches you nothing. These build a
// store with realistic data and NO network, so the canvas renders instantly and
// works offline / on a plane / in a locked-down CI box.
//
// The sample rows are real listings from the production catalog, so what you see
// in the canvas is what ships — including awkward truths like long role names and
// a company with no logo.
#if DEBUG
import Foundation

extension Internship {
    static let sampleHennge = Internship(
        id: "jp-hennge-01",
        company: "HENNGE",
        role: "Global Internship Program - Front-End Pathway",
        location: "Shibuya, Tokyo, Japan",
        city: "Tokyo",
        workMode: "On-site",
        language: "English (fluent); Japanese not required",
        languageType: "English-first",
        duration: "5 weeks",
        deadline: "Not stated",
        deadlineDate: nil,
        compensation: "Unpaid; monthly subsidy, airfare and other support provided",
        track: "Frontend / Full-stack",
        score: 99,
        priority: true,
        reasons: [
            "Exact React 19 and TypeScript fit",
            "Strong mobile-first UI portfolio",
            "AWS and full-stack breadth",
            "English-first Tokyo program",
        ],
        fitNote: "Frontend application training in TypeScript and React or Vue.",
        url: "https://challenge.hennge.com/",
        companyDomain: "hennge.com",
        logoUrl: nil,
        verifiedDate: "2026-07-02",
        prestigeTier: "Japan flagship",
        about: "Frontend pathway for building TypeScript applications with React or Vue, then applying DevOps practices in a Tokyo engineering environment.",
        techStack: ["TypeScript", "React or Vue", "Unix-like OS", "Git", "DevOps", "Cloud basics"],
        eligibility: [
            "Third-year undergraduate or higher",
            "React or Vue with TypeScript",
            "Unix-like development environment knowledge",
        ],
        process: ["Apply online", "Document screening", "Technical / team interview", "Result notification"]
    )

    static let sampleRakuten = Internship(
        id: "jp-rakuten-02",
        company: "Rakuten Group",
        role: "TECH Camp - Applications Engineer",
        location: "Rakuten Crimson House, Tokyo",
        languageType: "Bilingual",
        duration: "4-6 weeks",
        deadline: "2026-07-31 23:59 JST",
        deadlineDate: "2026-07-31",
        track: "Backend / Cloud",
        score: 98,
        priority: true,
        url: "https://global.rakuten.com/corp/careers/",
        companyDomain: "rakuten.com",
        about: "Build production services alongside Rakuten's applications engineering teams.",
        techStack: ["Java", "Go", "Kubernetes"]
    )

    static let sampleAtilika = Internship(
        id: "jp-atilika-03",
        company: "Atilika",
        role: "Intern Software Engineer",
        location: "Tokyo, Japan / Oslo, Norway",
        languageType: "English-first",
        duration: "Flexible; 2-12 months; part-time or full-time",
        deadline: "Not stated",
        track: "Software Engineering",
        score: 95,
        url: "https://www.atilika.com/en/careers/#job-openings",
        companyDomain: "atilika.com"
    )

    static let samples: [Internship] = [sampleHennge, sampleRakuten, sampleAtilika]
}

extension TrackerRecord {
    /// An interview with a milestone on the calendar — the richest tracked state.
    static let sampleInterview = TrackerRecord(
        internshipId: "jp-hennge-01",
        company: "HENNGE",
        role: "Global Internship Program - Front-End Pathway",
        location: "Shibuya, Tokyo, Japan",
        deadline: "Not stated",
        applyUrl: "https://challenge.hennge.com/",
        companyDomain: "hennge.com",
        status: "interview",
        source: "gmail",
        updatedAt: "2026-07-15T09:00:00.000Z",
        createdAt: "2026-07-10T09:00:00.000Z",
        milestones: [
            Milestone(id: "gmail-abc", kind: "interview", date: "2026-07-24",
                      time: "14:00", title: "Interview — HENNGE")
        ]
    )

    /// A deadline-bearing record, so the calendar has something to draw.
    static let sampleApplied = TrackerRecord(
        internshipId: "jp-rakuten-02",
        company: "Rakuten Group",
        role: "TECH Camp - Applications Engineer",
        location: "Rakuten Crimson House, Tokyo",
        deadline: "2026-07-31 23:59 JST",
        deadlineDate: "2026-07-31",
        status: "applied",
        source: "web",
        updatedAt: "2026-07-14T02:00:00.000Z",
        createdAt: "2026-07-14T02:00:00.000Z",
        milestones: []
    )

    /// Rejected is a real outcome the UI must show as calmly as any other.
    static let sampleRejected = TrackerRecord(
        internshipId: "jp-abeja-09",
        company: "ABEJA",
        role: "ML Engineer Intern",
        location: "Minato-ku, Tokyo",
        status: "rejected",
        source: "gmail",
        updatedAt: "2026-07-12T05:00:00.000Z",
        createdAt: "2026-07-01T05:00:00.000Z"
    )
}

@MainActor
extension CatalogStore {
    /// A loaded store with data. Use for the normal case.
    static var preview: CatalogStore {
        let store = CatalogStore()
        store.internships = Internship.samples
        store.tracker = [
            "jp-hennge-01": .sampleInterview,
            "jp-rakuten-02": .sampleApplied,
            "jp-abeja-09": .sampleRejected,
        ]
        store.phase = .loaded
        return store
    }

    /// Catalog loaded, nothing tracked — the state a new user actually opens the
    /// app in, and the one empty states are written for.
    static var previewEmpty: CatalogStore {
        let store = CatalogStore()
        store.internships = Internship.samples
        store.phase = .loaded
        return store
    }

    /// Skeletons.
    static var previewLoading: CatalogStore {
        let store = CatalogStore()
        store.phase = .loading
        return store
    }

    /// The failure path, which is easy to forget until it happens on a train.
    static var previewFailed: CatalogStore {
        let store = CatalogStore()
        store.phase = .failed("The server answered with status 503.")
        return store
    }
}
#endif
