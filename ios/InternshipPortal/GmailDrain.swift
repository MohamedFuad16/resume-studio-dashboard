// Gmail → tracker, in the app. Port of the web's useGmailInbox.js.
//
// WHY THIS EXISTS: the server only QUEUES actions; a client has to apply them.
// Until now only the web drained, so mail classified days ago sat in the queue and
// the phone showed one rejection while nine waited. Now the app drains its own
// inbox, and the two clients converge on the same Firestore documents.
//
// WHAT IS AND ISN'T AN INTERNSHIP IS THE SERVER'S CALL, not this file's. The
// classifier only emits an action when the email itself QUOTES words that make it
// an internship, and the quote is verified against the email (see classify.js).
// An earlier version of this file carried a hardcoded list of gig companies; that
// was a denylist that would age badly and judged a firm by its name rather than by
// what it wrote. Anything reaching this drain has already earned its place.
//
// The rules here mirror useGmailInbox.js exactly, because both write the same
// records and a disagreement would show up as data that changes when you switch
// device:
//   • one record per COMPANY (applied + rejected for the same firm converge),
//   • statuses are monotonic — a re-classified email can never pull a record
//     backwards (saved < applying/applied < interview < rejected),
//   • milestones carry a deterministic id (gmail-<messageId>) so re-draining
//     the same email never duplicates a calendar entry.
import Foundation

// MARK: - Wire types

struct GmailAction: Decodable {
    struct Interview: Decodable { let date: String?; let time: String? }
    struct Reapply: Decodable { let min: Int?; let max: Int? }
    struct Enrichment: Decodable {
        let url: String?
        let location: String?
        let deadline: String?
        let deadlineDate: String?
    }

    let id: String
    let kind: String
    let company: String?
    let role: String?
    let gmailMessageId: String?
    let receivedAt: String?
    let subject: String?
    let interview: Interview?
    /// A rejection's stated wait window ("apply again after 9–12 months").
    let reapplyMonths: Reapply?
    let enrichment: Enrichment?
}

private struct PendingResponse: Decodable { let actions: [GmailAction] }

extension PortalAPI {
    static func gmailPending(profile: String) async throws -> [GmailAction] {
        var url = baseURL.appending(path: "api/integrations/gmail/pending")
        url.append(queryItems: [.init(name: "profile", value: profile)])
        let (data, response) = try await URLSession.shared.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
        return try JSONDecoder().decode(PendingResponse.self, from: data).actions
    }

    static func gmailAck(ids: [String], profile: String) async throws {
        var url = baseURL.appending(path: "api/integrations/gmail/ack")
        url.append(queryItems: [.init(name: "profile", value: profile)])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["ids": ids])
        let (_, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }
    }

    /// Ask the server to read new mail. Returns quietly on the gateway's 240s
    /// timeout — a long backfill keeps running server-side and its actions land in
    /// the queue regardless, so the drain that follows still finds them.
    static func gmailSyncNow(profile: String, backfillDays: Int? = nil) async {
        var url = baseURL.appending(path: "api/integrations/gmail/sync-now")
        var query: [URLQueryItem] = [.init(name: "profile", value: profile)]
        if let backfillDays { query.append(.init(name: "backfill", value: String(backfillDays))) }
        url.append(queryItems: query)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        // A backfill runs far longer than any client should wait — the server keeps
        // going after we disconnect, and its actions land in the queue regardless.
        // 45s is enough to kick it off and let a normal (incremental) sync finish;
        // the drain that follows reads whatever is queued by then. Waiting the full
        // gateway timeout (240s) only bought a four-minute spinner.
        request.timeoutInterval = backfillDays == nil ? 30 : 45
        _ = try? await URLSession.shared.data(for: request)
    }
}

// MARK: - The drain

@MainActor
extension CatalogStore {
    /// Company key: strip the corporate suffix and fold punctuation, so
    /// 株式会社ABEJA and "ABEJA" are one company. CJK is deliberately KEPT —
    /// stripping it turned 株式会社カナリー into an empty string and dropped it.
    nonisolated static func companyKey(_ raw: String?) -> String {
        var text = (raw ?? "").lowercased()
        for suffix in ["株式会社", "合同会社", "有限会社", "(株)", "（株）", ", inc.", " inc.", ", inc", " inc", " ltd.", " ltd", " k.k.", " co."] {
            text = text.replacingOccurrences(of: suffix, with: " ")
        }
        let kept = text.unicodeScalars.map { scalar -> Character in
            if CharacterSet.alphanumerics.contains(scalar) { return Character(scalar) }
            // Keep CJK; fold everything else to a space.
            switch scalar.value {
            case 0x3040...0x30FF, 0x4E00...0x9FFF: return Character(scalar)
            default: return " "
            }
        }
        return String(kept).split(separator: " ").joined(separator: " ")
    }

    /// Throw away everything Gmail wrote and rebuild it from a fresh re-scan.
    ///
    /// WHY A REBUILD AND NOT A PATCH: the tracker holds rows an older, weaker
    /// classifier wrote — companies that were never internships, and dates stamped
    /// with the drain's clock instead of the email's ("applied 6 minutes ago" for
    /// mail from last week, and a calendar entry on today for an application made
    /// days earlier). Both are STORED values. Fixing the classifier and the date
    /// handling changes what gets written NEXT; it cannot reach back into rows
    /// already saved. Only re-deriving them from the mail can.
    ///
    /// Safe because Gmail rows are DERIVED data: the emails are the source of
    /// truth and are still sitting in the inbox. Anything you added by hand has a
    /// different `source` and is not touched.
    func rebuildFromGmail(days: Int = 90) async {
        guard !isRebuilding else { return }
        isRebuilding = true
        defer { isRebuilding = false }

        let profile = profileID ?? PortalAPI.profile
        guard (try? await PortalAPI.gmailStatus(profile: profile))?.connected == true else {
            toast = String(localized: "Connect Gmail first to rebuild.")
            return
        }
        let doomed = tracker.filter { $0.value.source == "gmail" }.count

        // STEP 1 — purge every Gmail-derived row NOW and persist. This is the part
        // that must not depend on timing: the stale rows an old classifier wrote
        // (a Revolut role never applied to, micro1, gig "internships", phantom
        // interviews, dates stamped as today) are gone the moment Rebuild runs,
        // whether or not the re-scan below finishes in time. Hand-added rows carry
        // a different `source` and are untouched.
        let previous = tracker
        tracker = tracker.filter { $0.value.source != "gmail" }
        do {
            if let uid, let profileID {
                try await FirestoreData.saveTracker(tracker, uid: uid, profile: profileID)
            } else {
                try await PortalAPI.saveTracker(tracker)
            }
        } catch {
            tracker = previous
            toast = String(localized: "Couldn't rebuild — check your connection.")
            return
        }
        // The re-adds that follow are old news, not new arrivals.
        Notifier.resetBaseline()

        // STEP 2 — re-scan and re-add only what the CURRENT classifier confirms.
        // Whatever is already queued applies immediately; a fresh backfill fills in
        // the rest. The re-scan is fast (known companies skip web enrichment) but
        // still ~a minute, so poll. If it doesn't land in time, the routine drain
        // picks it up on the next open — the bad rows are already gone regardless.
        toast = String(localized: "Rebuilding from Gmail — re-reading your inbox…")
        await PortalAPI.gmailSyncNow(profile: profile, backfillDays: days)

        var actions = (try? await PortalAPI.gmailPending(profile: profile)) ?? []
        var waited = 0
        while actions.isEmpty && waited < 120 {
            try? await Task.sleep(for: .seconds(6))
            waited += 6
            actions = (try? await PortalAPI.gmailPending(profile: profile)) ?? []
        }

        if !actions.isEmpty {
            // Already purged above, so this applies additively onto the clean base.
            let added = await applyGmailActions(actions, profile: profile, replacingGmailRows: false)
            toast = String(localized: "Rebuilt \(added) from Gmail — \(doomed) old rows cleared.")
        } else {
            toast = String(localized: "Cleared \(doomed) old rows — your internships will reappear as Gmail re-syncs.")
        }
    }

    /// The routine drain: pull whatever Gmail has queued, apply it additively, ack
    /// it. Safe to call repeatedly — on load and on every foreground.
    /// - Parameter backfillDays: rescan older mail (ignores the processed list).
    /// - Returns: how many records the drain touched.
    @discardableResult
    func drainGmail(backfillDays: Int? = nil) async -> Int {
        // A rebuild owns the queue while it runs; an additive drain here would
        // apply the backfill's actions on top of the old rows the rebuild is about
        // to purge, and ack them out from under it.
        guard !isRebuilding else { return 0 }

        let profile = profileID ?? PortalAPI.profile
        guard (try? await PortalAPI.gmailStatus(profile: profile))?.connected == true else { return 0 }

        await PortalAPI.gmailSyncNow(profile: profile, backfillDays: backfillDays)

        guard let actions = try? await PortalAPI.gmailPending(profile: profile), !actions.isEmpty else {
            return 0
        }
        return await applyGmailActions(actions, profile: profile, replacingGmailRows: false)
    }

    /// Apply a batch of Gmail actions to the tracker and ack them. Shared by the
    /// routine drain (additive) and the rebuild (replacing every Gmail row).
    /// - Parameter replacingGmailRows: start from a tracker with all Gmail-sourced
    ///   rows removed, so the batch fully reconstructs them — used by the rebuild
    ///   to drop rows an older classifier got wrong.
    @discardableResult
    func applyGmailActions(
        _ actions: [GmailAction], profile: String, replacingGmailRows: Bool
    ) async -> Int {
        // Everything a rebuild re-adds is old news, not new arrivals.
        if replacingGmailRows { Notifier.resetBaseline() }

        // Oldest first, so the newest email's status wins (applied → then
        // rejected = rejected), sharing one session map for company convergence.
        let ordered = actions.sorted { ($0.receivedAt ?? "") < ($1.receivedAt ?? "") }

        var session: [String: (item: Internship, rank: Int?)] = [:]
        // Hand-added records keep a different `source` and survive a rebuild; the
        // emails are the source of truth for the rest and are still in the inbox.
        var next = replacingGmailRows ? tracker.filter { $0.value.source != "gmail" } : tracker
        var touched = 0
        var acked: [String] = []
        var discovered: [(key: String, company: String, role: String,
                          status: ApplicationStatus, candidates: [String])] = []

        for action in ordered {
            // ACK regardless: a skipped action must still leave the queue, or it
            // is re-offered forever. The queue dedupes by message:kind anyway.
            acked.append(action.id)

            guard let status = Self.status(forKind: action.kind) else { continue }

            let key = Self.companyKey(action.company)
            guard !key.isEmpty else { continue }

            // One record per company: reuse a base resolved earlier in THIS drain,
            // else an existing tracked record, else a catalog listing, else a
            // synthetic entry keyed by company.
            var base: Internship
            var rank: Int?
            if let hit = session[key] {
                base = hit.item
                rank = hit.rank
            } else if let existing = next.values.first(where: {
                let other = Self.companyKey($0.company)
                return other.contains(key) || key.contains(other)
            }) {
                base = Internship(
                    id: existing.internshipId ?? "gmail-\(key.replacingOccurrences(of: " ", with: "-"))",
                    company: existing.company, role: existing.role, location: existing.location,
                    deadline: existing.deadline, deadlineDate: existing.deadlineDate,
                    url: existing.applyUrl, companyDomain: existing.companyDomain,
                    logoUrl: existing.logoUrl
                )
                rank = existing.appStatus.rank
            } else if let match = internships.first(where: {
                let other = Self.companyKey($0.company)
                return other.contains(key) || key.contains(other)
            }) {
                base = match
            } else {
                base = Internship(
                    id: "gmail-\(key.replacingOccurrences(of: " ", with: "-"))",
                    company: action.company, role: action.role ?? "Application",
                    location: action.enrichment?.location,
                    deadline: action.enrichment?.deadline ?? "Not stated",
                    deadlineDate: action.enrichment?.deadlineDate,
                    url: action.enrichment?.url
                )
            }

            // Backfill better details from whichever email has them — the
            // application email usually carries the role/URL the rejection lacks.
            if (base.role ?? "").isEmpty || base.role == "Application", let role = action.role, !role.isEmpty {
                base.role = role
            }
            if (base.url ?? "").isEmpty, let url = action.enrichment?.url {
                base.url = url
                if (base.location ?? "").isEmpty { base.location = action.enrichment?.location }
                if base.deadline == "Not stated", let deadline = action.enrichment?.deadline {
                    base.deadline = deadline
                    base.deadlineDate = action.enrichment?.deadlineDate
                }
            }

            // Monotonic: never downgrade a terminal outcome.
            let incoming = status.rank
            let shouldSet = rank == nil || incoming >= rank!
            session[key] = (base, shouldSet ? incoming : rank)

            if shouldSet {
                // Announce only what the tracker did not already say. A record
                // that merely gets richer (a role backfilled from a second email)
                // is not news; a company arriving, or moving to a new status, is.
                let previousStatus = tracker[base.id]?.appStatus
                if previousStatus != status {
                    discovered.append(
                        (key: "gmail-\(key)-\(status.rawValue)",
                         company: base.displayCompany,
                         role: base.displayRole,
                         status: status,
                         candidates: logoCandidateURLs(
                            logoUrl: base.logoUrl, domain: base.companyDomain, name: base.company
                         ))
                    )
                }

                var record = next[base.id] ?? TrackerRecord()
                record.internshipId = base.id
                record.company = base.company
                record.role = base.role
                record.location = base.location
                record.deadline = base.deadline ?? "Not stated"
                record.deadlineDate = base.deadlineDate
                record.applyUrl = base.url
                record.companyDomain = base.companyDomain
                record.logoUrl = base.logoUrl
                record.status = status.rawValue
                record.source = "gmail"
                // The EMAIL's date, never `now`. Stamping the clock made every
                // ingested record read "applied 6 minutes ago" and dropped each
                // one on today's calendar — for mail that arrived days earlier.
                // Actions are applied oldest-first, so createdAt sticks at the
                // first email (the application) while updatedAt tracks the latest
                // (the rejection) — which is also what "Recent" should sort on.
                let emailDate = action.receivedAt ?? ISO8601DateFormatter.flexible.string(from: .now)
                record.updatedAt = emailDate
                record.createdAt = record.createdAt ?? emailDate
                record.milestones = record.milestones ?? []
                next[base.id] = record
                touched += 1
            }

            // WEB-PARITY STAMPS (contracts/normalization.md §4–5): the web client
            // writes per-status timestamps, source metadata, and reapply cooldowns
            // at drain time. Both clients drain the SAME queue and whoever acks
            // first wins — so a record drained by the phone must not be poorer
            // than one drained by the browser. Stamped even when the status was
            // rank-limited (the web does too: processing an older application
            // email after a rejection still records appliedAt). They live in
            // `extra` because iOS doesn't render them yet — but must write and
            // round-trip them.
            if var record = next[base.id], let receivedAt = action.receivedAt {
                record.extra["eventAt"] = .string(receivedAt)
                let stampKey: String? = switch action.kind {
                case "applied": "appliedAt"
                case "rejected": "rejectedAt"
                case "interview": "interviewAt"
                case "offer": "offerAt"
                default: nil
                }
                if let stampKey { record.extra[stampKey] = .string(receivedAt) }
                record.extra["sourceMeta"] = .object([
                    "gmailMessageId": .string(action.gmailMessageId ?? action.id),
                    "receivedAt": .string(receivedAt),
                    "subject": .string(action.subject ?? ""),
                ])

                // A rejection stating a wait window → company-wide cooldown.
                // reapplyAfter = receipt date + the MINIMUM stated months (the
                // earliest the company says you may reapply), Tokyo calendar.
                if action.kind == "rejected", let months = action.reapplyMonths?.min, months > 0,
                   let received = ISO8601DateFormatter.parse(receivedAt),
                   let after = Self.tokyoCalendar.date(byAdding: .month, value: months, to: received) {
                    let maxMonths = action.reapplyMonths?.max ?? months
                    record.extra["reapplyAfter"] = .string(Self.dayKey(after))
                    record.extra["reapplyMonths"] = .object([
                        "min": .number(Double(months)), "max": .number(Double(maxMonths)),
                    ])
                    let window = maxMonths != months ? "\(months)–\(maxMonths)" : "\(months)"
                    record.extra["reapplyNote"] = .string(
                        "\(base.displayCompany) asks applicants to wait \(window) months before reapplying."
                    )
                }
                next[base.id] = record
            }

            // Interview date → calendar, deduped by message id.
            if let date = action.interview?.date, date.count == 10,
               var record = next[base.id] {
                let milestone = Milestone(
                    id: "gmail-\(action.gmailMessageId ?? action.id)",
                    kind: "interview", date: date, time: action.interview?.time,
                    title: "Interview — \(base.displayCompany)"
                )
                var existing = record.milestones ?? []
                let duplicate = existing.contains { $0.id == milestone.id }
                    || existing.contains {
                        $0.kind == milestone.kind && $0.date == milestone.date
                            && $0.time == milestone.time && ($0.title ?? "") == (milestone.title ?? "")
                    }
                if !duplicate {
                    existing.append(milestone)
                    record.milestones = existing
                    next[base.id] = record
                }
            }
        }

        // Write once, not per action: one Firestore round-trip for the whole drain.
        let previous = tracker
        tracker = next
        do {
            if let uid, let profileID {
                try await FirestoreData.saveTracker(tracker, uid: uid, profile: profileID)
            } else {
                try await PortalAPI.saveTracker(tracker)
            }
            try? await PortalAPI.gmailAck(ids: acked, profile: profile)
        } catch {
            tracker = previous
            toast = String(localized: "Couldn't save the inbox sync — check your connection.")
            return 0
        }

        // Only after the save: a banner for a record that failed to persist would
        // be a notification about something that does not exist.
        if Notifier.hasBaseline {
            for item in discovered {
                await Notifier.announce(
                    key: item.key, company: item.company, role: item.role,
                    status: item.status, logoCandidates: item.candidates
                )
            }
        } else {
            // First ever drain: the whole backlog is "new" but none of it is news.
            Notifier.seed(discovered.map(\.key))
            Notifier.markBaselineSeeded()
        }

        if touched > 0 {
            toast = String(localized: "Synced \(touched) applications from Gmail")
        }
        return touched
    }

    private static func status(forKind kind: String) -> ApplicationStatus? {
        switch kind {
        case "applied": .applied
        case "rejected": .rejected
        case "interview": .interview
        case "offer": .applied   // there is no offer status; applied is the floor
        default: nil
        }
    }
}
