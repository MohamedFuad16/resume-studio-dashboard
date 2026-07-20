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
//   • one record per COMPANY **AND ROLE** — see contracts/SPEC-per-role-keying.md.
//     This file used to key on company alone, so applied + rejected for the same
//     firm converged; that collapsed five Rakuten applications into one row
//     reading "rejected" and hid a live HENNGE interview. DO NOT "restore parity"
//     by reintroducing the collapse: the web client made the identical change, and
//     per-role keying is the contract both clients now implement.
//   • statuses are monotonic — a re-classified email can never pull a record
//     backwards (saved < applying/applied < interview < rejected),
//   • milestones carry a deterministic id (gmail-<messageId>) so re-draining
//     the same email never duplicates a calendar entry.
import Foundation
import OSLog

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
    /// Company key — the CANONICAL normalizer (contracts/normalization.md §1),
    /// mirroring the web's `normalizeCompany` in reapplyCooldown.js exactly, so
    /// 株式会社ABEJA and "ABEJA" are one company and both clients derive the same
    /// key. CJK is deliberately KEPT — stripping it turned 株式会社カナリー into an
    /// empty string and dropped it. The EN suffix is a TRAILING-anchored regex
    /// peeled repeatedly, not an unanchored substring list: unanchored stripping
    /// keyed "Acme Co" ≠ web ("acme co" vs "acme") and over-stripped mid-string
    /// tokens ("ABC Inc. Japan" → "abc japan" while the web keeps "abc inc japan").
    ///
    /// NFKC FIRST (contracts/SPEC-per-role-keying.md Rule 1): full-width Latin
    /// (Ｓｋｙ株式会社) sits outside every kept range, so without compatibility
    /// mapping the key folded to "" and the `key.isEmpty` guard dropped the whole
    /// company — silently. NFKC maps full-width Latin/digits to ASCII and leaves
    /// kana and CJK ideographs alone. It must run BEFORE lowercasing, so that
    /// half-width katakana normalizes to full-width kana first.
    nonisolated static func companyKey(_ raw: String?) -> String {
        // JA corporate markers vanish wherever they appear (web: replace with "").
        var text = (raw ?? "").precomposedStringWithCompatibilityMapping.lowercased()
        for marker in ["株式会社", "合同会社", "有限会社", "(株)", "（株）"] {
            text = text.replacingOccurrences(of: marker, with: "")
        }
        // A trailing EN corporate suffix: an optional comma, a separator, then one
        // of the canonical tokens (inc, ltd, k.k., co) with an optional period, at
        // the END. The required leading separator protects single-token names
        // ("cisco"/"costco" keep their "co"); peeled repeatedly so stacked
        // suffixes ("co., ltd.") fully unwind.
        while true {
            let peeled = text.replacingOccurrences(
                of: #"[,\s]+(?:inc|ltd|k\.?k|co)\.?\s*$"#,
                with: "", options: .regularExpression)
            if peeled == text { break }
            text = peeled
        }
        // Keep exactly what the web keeps — a-z, 0-9, hiragana/katakana, CJK
        // ideographs — and fold everything else (incl. accented/fullwidth forms,
        // which CharacterSet.alphanumerics would wrongly keep) to a space.
        return foldToKeptScalars(text)
    }

    /// Role key (contracts/SPEC-per-role-keying.md Rule 2) — the second half of a
    /// record's identity. Same normalization as `companyKey` minus the corporate
    /// marker/suffix peeling, which is meaningless for a role. Empty folds to the
    /// sentinel `"general"`, which Rule 3 then resolves onto a live application
    /// instead of letting it mint a phantom row.
    /// The id a Gmail-derived record gets when no catalog listing or existing
    /// row supplies one. Shared so the tombstone check and the record builder can
    /// never disagree about what a pair's id would be.
    nonisolated static func syntheticID(company: String, role: String) -> String {
        "gmail-\(company)-\(role)".replacingOccurrences(of: " ", with: "-")
    }

    nonisolated static func roleKey(_ raw: String?) -> String {
        let folded = foldToKeptScalars(
            (raw ?? "").precomposedStringWithCompatibilityMapping.lowercased()
        )
        return folded.isEmpty ? "general" : folded
    }

    /// Keep exactly what the web keeps — a-z, 0-9, hiragana/katakana, CJK
    /// ideographs — and fold everything else (incl. accented forms, which
    /// CharacterSet.alphanumerics would wrongly keep) to a space; then collapse
    /// runs of spaces and trim. Input must already be NFKC'd and lowercased.
    nonisolated private static func foldToKeptScalars(_ text: String) -> String {
        let kept = text.unicodeScalars.map { scalar -> Character in
            switch scalar.value {
            case 0x30...0x39, 0x61...0x7A,          // 0-9, a-z (input is lowercased)
                 0x3040...0x30FF, 0x4E00...0x9FFF:  // ぀-ヿ, 一-鿿
                return Character(scalar)
            default:
                return " "
            }
        }
        return String(kept).split(separator: " ").joined(separator: " ")
    }

    /// Rule 3 — resolve an action that carries NO role onto an existing record for
    /// the same company, rather than minting `<company>-general` beside the real
    /// rows. Rejections routinely omit the role ("we will not be moving forward"),
    /// and they must land on the application still in flight.
    ///
    /// Order, exactly as specified: exactly one record → that one; several → the
    /// most recently `updatedAt` NON-terminal one; all terminal → the most recently
    /// `updatedAt`; none → nil (caller creates `<company>-general`).
    ///
    /// Rule 8: only records the DRAIN OWNS are candidates. Rule 3 hunts for any
    /// record of the company and the caller then stamps it `source = "gmail"` —
    /// applied to a row the user typed by hand that flips it Gmail-derived, and the
    /// next rebuild purge deletes it. Silent, permanent, user-authored data loss.
    /// A company whose only row is hand-added therefore falls through to nil and
    /// the caller mints `<company>-general` beside it.
    ///
    /// Rule 6: `updatedAt` is compared as an INSTANT, never lexicographically.
    /// Records carry whatever `ISO8601DateFormatter.flexible` wrote; actions carry
    /// UTC `Z` straight off the wire, so `…T23:00:00+09:00` sorts *after*
    /// `…T15:30:00Z` as a string while being the EARLIER instant. Unparseable →
    /// `.distantPast`, so it can never outrank a real stamp.
    ///
    /// Rule 7: ties break on the tracker DICTIONARY KEY, never on `record.id` —
    /// `TrackerRecord.id` is `internshipId ?? UUID().uuidString` and `fetchTracker`
    /// does not backfill `internshipId`, so a record stored without that field
    /// yields a fresh random id on every evaluation. That is a non-deterministic
    /// comparator inside the very function Rule 4 exists to make deterministic.
    ///
    /// - Returns: the tracker key AND the record — the key is what the caller keys
    ///   the write on, and re-deriving it from the record is exactly the trap
    ///   Rule 7 describes.
    nonisolated private static func resolveRolelessRecord(
        company key: String, in records: [String: TrackerRecord]
    ) -> (key: String, record: TrackerRecord)? {
        let forCompany = records
            .filter { companyKey($0.value.company) == key && isGmailDerived($0.value) }
            .map { (key: $0.key, record: $0.value) }
            .sorted { $0.key < $1.key }
        guard forCompany.count > 1 else { return forCompany.first }

        // Sort is STABLE in Swift only by construction, so fold the tiebreak into
        // the comparator: newest updatedAt first, then lowest tracker key.
        func mostRecent(
            _ candidates: [(key: String, record: TrackerRecord)]
        ) -> (key: String, record: TrackerRecord)? {
            candidates.max { lhs, rhs in
                let left = ISO8601DateFormatter.parse(lhs.record.updatedAt) ?? .distantPast
                let right = ISO8601DateFormatter.parse(rhs.record.updatedAt) ?? .distantPast
                return left == right ? lhs.key > rhs.key : left < right
            }
        }
        let live = forCompany.filter { $0.record.appStatus != .rejected }
        return mostRecent(live) ?? mostRecent(forCompany)
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
    /// - Returns: true once the PURGE persisted (the repair happened), whether or
    ///   not the re-scan landed in time. Callers holding a one-shot trigger must
    ///   only consume it on true — an early version consumed the trigger even
    ///   when this bailed (offline, auth not ready, Gmail disconnected), which
    ///   burned the repair on a bad launch and left the stale rows forever.
    /// A row counts as Gmail-derived if it SAYS so or if it LOOKS so.
    ///
    /// Source stamping arrived after the first drains shipped, so the oldest junk
    /// — micro1, the gig "internships", the Revolut role never applied to — has
    /// `source` nil or `"web"` and survived every previous rebuild untouched.
    /// That is the whole reason "Refresh data" kept bringing the ghosts back: the
    /// purge was asking a question those rows were written before anyone thought
    /// to answer. The id prefix is the reliable tell — `gmail-<msgId>` is only
    /// ever minted by the drain, so it identifies the pre-stamping rows too.
    ///
    /// Hand-added rows match neither clause and are never touched.
    func isGmailDerived(_ record: TrackerRecord) -> Bool { Self.isGmailDerived(record) }

    /// The same test, reachable from the `nonisolated` key/resolution helpers
    /// (Rule 8 needs it inside `resolveRolelessRecord`).
    nonisolated static func isGmailDerived(_ record: TrackerRecord) -> Bool {
        // A pinned record is the owner's, whatever `source` says. Purging one
        // would delete a status they typed by hand and Gmail cannot re-derive —
        // ADR-I-015 wearing a different hat (contracts/tracker-record.md,
        // ADR-S-004).
        if record.statusPinned == true { return false }
        return record.source == "gmail" || (record.internshipId ?? "").hasPrefix("gmail-")
    }

    func rebuildFromGmail(days: Int = 90) async -> Bool {
        guard !isRebuilding else { return false }
        isRebuilding = true
        syncStartedAt = Date()
        defer {
            isRebuilding = false
            syncStage = nil
            syncStartedAt = nil
        }

        // A rebuild is only meaningful against the REAL tracker. On a cold launch
        // the first load can complete before Firebase finishes restoring the
        // session — uid still nil — and a rebuild in that window would purge the
        // signed-out KV tracker, report success, and leave the Firestore junk
        // untouched. That is precisely how earlier repair attempts "succeeded"
        // while micro1/Turing survived on the phone.
        guard uid != nil, profileID != nil else { return false }

        let profile = profileID ?? PortalAPI.profile
        guard (try? await PortalAPI.gmailStatus(profile: profile))?.connected == true else {
            toast = String(localized: "Connect Gmail first to rebuild.")
            return false
        }
        let doomed = tracker.filter { isGmailDerived($0.value) }.count

        // ORDER IS THE WHOLE DESIGN: fetch the replacement FIRST, purge only once
        // it is in hand.
        //
        // This used to run the other way round — purge, persist, then re-scan —
        // on the theory that the bad rows should die even if the re-scan was slow.
        // On 2026-07-20 that cost the owner their tracker. The purge wrote 21 rows
        // → 0, and the re-scan returned nothing: the server's own log shows
        // `listed=0 queued=0` for that sync, because three syncs fired
        // concurrently (load drain, foreground drain, this backfill) and raced on
        // the same connection record. The tracker sat empty until the actions were
        // recovered by hand. A rescan CAN return nothing, so a design that has
        // already deleted by the time it finds out is not a rebuild — it is a
        // delete with an optimistic follow-up.
        //
        // Below, nothing is destroyed until `actions` is non-empty. If the scan
        // comes back empty the tracker is exactly as it was.
        toast = String(localized: "Rebuilding from Gmail — re-reading your inbox…")

        // Let any drain that started before `isRebuilding` went up finish first —
        // the guard in drainGmail only turns away drains that start after us.
        var waitedForDrain = 0.0
        while isSyncing && waitedForDrain < 60 {
            syncStage = String(localized: "Waiting for a sync already in progress…")
            try? await Task.sleep(for: .seconds(1))
            waitedForDrain += 1
        }
        isSyncing = true
        defer { isSyncing = false }

        syncStage = String(localized: "Asking the server to re-read \(days) days of mail…")
        await PortalAPI.gmailSyncNow(profile: profile, backfillDays: days)

        syncStage = String(localized: "Waiting for classified results…")
        var actions = (try? await PortalAPI.gmailPending(profile: profile)) ?? []
        var waited = 0
        while actions.isEmpty && waited < 120 {
            try? await Task.sleep(for: .seconds(6))
            waited += 6
            actions = (try? await PortalAPI.gmailPending(profile: profile)) ?? []
        }

        guard !actions.isEmpty else {
            // The safe outcome, and the one that used to be catastrophic.
            log("rebuild aborted — scan returned no actions; tracker left untouched (\(tracker.count) rows)")
            toast = String(localized: "Couldn't re-read your mail just now — nothing was changed. Try again in a minute.")
            return false
        }

        // The replacement is in hand. NOW purge.
        let previous = tracker
        tracker = tracker.filter { !isGmailDerived($0.value) }

        // Purging rows is not enough. A phantom interview can ride on a row that
        // SURVIVES the purge: the drain attaches `gmail-<msgId>` milestones to
        // catalog-id rows (a real Rakuten application, say), so deleting only
        // Gmail-derived rows leaves the invented interview dates sitting on the
        // legitimate ones. Strip them and let the re-scan re-add whatever the
        // current classifier still stands behind.
        var strippedMilestones = 0
        for (key, var record) in tracker {
            guard let milestones = record.milestones else { continue }
            let kept = milestones.filter { !$0.id.hasPrefix("gmail-") }
            guard kept.count != milestones.count else { continue }
            strippedMilestones += milestones.count - kept.count
            record.milestones = kept.isEmpty ? nil : kept
            tracker[key] = record
        }

        log("purge: \(previous.count) rows → \(tracker.count) "
            + "(\(doomed) gmail-derived, \(strippedMilestones) stale milestones stripped), "
            + "replacing with \(actions.count) queued actions")

        // The re-adds that follow are old news, not new arrivals.
        Notifier.resetBaseline()
        syncStage = String(localized: "Applying \(actions.count) applications…")
        let added = await applyGmailActions(actions, profile: profile, replacingGmailRows: false)

        // applyGmailActions persists; if it wrote nothing the purge would still be
        // live in memory, so restore rather than leave the user staring at a gap.
        guard added > 0 else {
            tracker = previous
            try? await writeTracker()
            log("rebuild applied 0 of \(actions.count) actions — restored \(previous.count) rows")
            toast = String(localized: "Rebuild found nothing to apply — your applications were left as they were.")
            return false
        }

        // The profile id is in the toast deliberately: if the phone and the web
        // ever show different data, the first question is whether they are reading
        // the same tracker document — this answers it on sight.
        toast = String(localized: "Rebuilt \(added) from Gmail — \(doomed) old rows, \(strippedMilestones) stale dates cleared (\(profile)).")
        return true
    }

    /// Rebuild/migration breadcrumbs. os_log for a shipping build; stdout too in
    /// Debug, because reading os_log off an attached device requires root and the
    /// `--console` bridge only carries stdout.
    fileprivate func log(_ message: String) {
        Logger(subsystem: "com.mohamedfuad.internshipportal", category: "migrations")
            .info("\(message, privacy: .public)")
        #if DEBUG
        print("[migrations] \(message)")
        #endif
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
        // One sync at a time. Two drains racing produce two server-side scans on
        // one connection record, and the loser reports listing nothing.
        guard !isSyncing else { return 0 }
        isSyncing = true
        defer { isSyncing = false }

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
    // KNOWN DEBT — still over the limit of 15. Record resolution has since been
    // extracted to `gmailBase`/`resolveRolelessRecord`; what remains here is
    // monotonic status ranking, detail backfill, web-parity
    // stamps and milestone dedupe, because they all read the same per-action state
    // and splitting them means threading that state back through. The suppression
    // is deliberate and local rather than a raised global limit, so the rule keeps
    // catching anything else that grows this large. Extract when the drain is next
    // touched for a reason other than a data-correctness fix.
    // swiftlint:disable:next cyclomatic_complexity
    func applyGmailActions(
        _ actions: [GmailAction], profile: String, replacingGmailRows: Bool
    ) async -> Int {
        // Everything a rebuild re-adds is old news, not new arrivals.
        if replacingGmailRows { Notifier.resetBaseline() }

        // Oldest first, so the newest email's status wins (applied → then
        // rejected = rejected), sharing one session map — keyed "company|role" —
        // so the emails for ONE application converge while sibling roles at the
        // same company stay separate rows.
        let ordered = actions.sorted { ($0.receivedAt ?? "") < ($1.receivedAt ?? "") }

        var session: [String: (item: Internship, rank: Int?)] = [:]
        // Hand-added records keep a different `source` and survive a rebuild; the
        // emails are the source of truth for the rest and are still in the inbox.
        var next = replacingGmailRows ? tracker.filter { !isGmailDerived($0.value) } : tracker
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
            // A key that is STILL empty after NFKC is a dropped application, not a
            // routine outcome — it must leave a trace (Rule 1). Silence here is
            // what hid Ｓｋｙ株式会社, interview included.
            guard !key.isEmpty else {
                log("gmail action \(action.id) (\(action.kind)) skipped — "
                    + "company key empty after NFKC for company \"\(action.company ?? "")\"")
                continue
            }

            // Rule 2: identity is (companyKey, roleKey). Rule 3: an action with no
            // role attaches to a live application for that company instead of
            // minting a phantom "<company>-general" row beside the real ones.
            var role = Self.roleKey(action.role)
            // Carry the RESOLVED record through, not just its roleKey. Handing
            // `gmailBase` the key alone made it re-scan and it could land on a
            // DIFFERENT record whose role folds to the same key — resolving one
            // row and then writing another.
            var resolved: (key: String, record: TrackerRecord)?
            if role == "general" {
                resolved = Self.resolveRolelessRecord(company: key, in: next)
                if let resolved { role = Self.roleKey(resolved.record.role) }
            }
            // ADR-S-004: a pair the owner deleted is not re-created. Only blocks
            // CREATION — a record that still exists (they deleted a different role
            // at the same company) updates normally.
            //
            // Re-applying lifts it: an `applied` whose email is NEWER than the
            // deletion means the owner went back, so the tombstone has expired
            // rather than been overruled. Anything else — a late rejection for the
            // row they just threw away — stays buried.
            if next[Self.syntheticID(company: key, role: role)] == nil, resolved == nil,
               let stone = tombstones.first(where: { $0.companyKey == key && $0.roleKey == role }) {
                let reapplied = status == .applied
                    && (ISO8601DateFormatter.parse(action.receivedAt) ?? .distantPast)
                        > (ISO8601DateFormatter.parse(stone.at) ?? .distantFuture)
                if reapplied {
                    tombstones.removeAll { $0.companyKey == key && $0.roleKey == role }
                    log("tombstone lifted for \(key)|\(role) — reapplied")
                } else {
                    continue
                }
            }

            var (base, rank) = gmailBase(
                for: action, companyKey: key, roleKey: role,
                resolved: resolved, session: session, existing: next
            )

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
            session["\(key)|\(role)"] = (base, shouldSet ? incoming : rank)

            if shouldSet {
                // Announce only what the tracker did not already say. A record
                // that merely gets richer (a role backfilled from a second email)
                // is not news; a company arriving, or moving to a new status, is.
                let previousStatus = tracker[base.id]?.appStatus
                // The key is per RECORD, not per company: two roles at one company
                // both reaching "rejected" are two pieces of news.
                //
                // It is NOT byte-identical to the old "gmail-<company>-<status>"
                // key, and an earlier comment here wrongly claimed it was. The old
                // key kept the spaces in the company key ("gmail-tokyo
                // electron-rejected"); the new one is built from `base.id`, which
                // has spaces replaced by "-" and the roleKey appended
                // ("gmail-tokyo-electron-ai-engineer-rejected"). Every re-derived
                // row therefore MISSES the announced set and reads as brand new.
                //
                // That matters because the first `drainGmail(backfillDays:)` after
                // this ships re-offers already-processed mail and — unlike
                // rebuildFromGmail — does NOT call `Notifier.resetBaseline()`. Left
                // alone, every newly-split sibling row fires a banner: roughly six
                // for this user, all announcing mail they read weeks ago.
                //
                // So: a record that did not exist before this drain, carrying mail
                // older than the notification baseline, is backfill and not news.
                // Suppressed at the SOURCE rather than at `announce`, so the key
                // never enters the announced set and a genuine later status change
                // on the same row still announces normally. A status change on a
                // row that already existed is real news and is never suppressed,
                // whatever the email's age.
                // "New" is measured against the PRE-drain tracker, not `next`: a
                // row this same drain created one action ago is still backfill, and
                // testing `next` would announce the rejection half of every
                // applied→rejected pair it had just suppressed.
                let isBackfilledRow = tracker[base.id] == nil
                    && (ISO8601DateFormatter.parse(action.receivedAt) ?? .distantPast)
                        < Notifier.baselineDate
                if previousStatus != status, !isBackfilledRow {
                    discovered.append(
                        (key: "\(base.id)-\(status.rawValue)",
                         company: base.displayCompany,
                         role: base.displayRole,
                         status: status,
                         candidates: logoCandidateURLs(
                            logoUrl: base.logoUrl, domain: base.companyDomain, name: base.company
                         ))
                    )
                }

                let existingRecord = next[base.id]
                // Rule 8: the drain owns a row it created, or one already stamped
                // gmail. It must never CONVERT a hand-added row — that would make
                // the next rebuild purge delete data Gmail cannot re-derive.
                let drainOwnsRecord = existingRecord.map { isGmailDerived($0) } ?? true
                // ADR-S-004: the owner said what this is. The mail does not get a
                // vote any more. Detail below is still filled in — a pin is about
                // the STATUS, not about refusing a logo or a posting URL.
                let pinned = existingRecord?.statusPinned == true
                var record = existingRecord ?? TrackerRecord()
                record.internshipId = base.id
                record.company = base.company
                record.role = base.role
                record.location = base.location
                record.deadline = base.deadline ?? "Not stated"
                record.deadlineDate = base.deadlineDate
                record.applyUrl = base.url
                record.companyDomain = base.companyDomain
                record.logoUrl = base.logoUrl
                if !pinned {
                    record.status = status.rawValue
                    if drainOwnsRecord { record.source = "gmail" }
                    // The EMAIL's date, never `now`. Stamping the clock made every
                    // ingested record read "applied 6 minutes ago" and dropped each
                    // one on today's calendar — for mail that arrived days earlier.
                    // Actions are applied oldest-first, so createdAt sticks at the
                    // first email (the application) while updatedAt tracks the
                    // latest (the rejection) — which is also what "Recent" sorts on.
                    let emailDate = action.receivedAt ?? ISO8601DateFormatter.flexible.string(from: .now)
                    record.updatedAt = emailDate
                    record.createdAt = record.createdAt ?? emailDate
                }
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

            // Interview date → calendar, deduped by message id. Never onto a
            // pinned record: a stale interview appearing on the owner's calendar
            // is precisely what pinning a rejection is meant to stop (ADR-S-004).
            if let date = action.interview?.date, date.count == 10,
               var record = next[base.id], record.statusPinned != true {
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
            try await writeTracker()
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

    /// Resolve the record an action attaches to: a base resolved earlier in THIS
    /// drain, else an existing tracked record, else a catalog listing, else a
    /// synthetic entry — all keyed on the PAIR (companyKey, roleKey).
    ///
    /// Rule 4: matching is EXACT companyKey equality, never a substring test —
    /// `contains` merged genuinely different companies whose keys nest. And every
    /// scan runs over a collection sorted by record id, because `Dictionary.values`
    /// has unspecified order, so the old `first(where:)` landed an action on a
    /// different record between runs of the same data.
    private func gmailBase(
        for action: GmailAction, companyKey key: String, roleKey role: String,
        resolved: (key: String, record: TrackerRecord)? = nil,
        session: [String: (item: Internship, rank: Int?)],
        existing: [String: TrackerRecord]
    ) -> (item: Internship, rank: Int?) {
        if let hit = session["\(key)|\(role)"] { return hit }

        let syntheticId = Self.syntheticID(company: key, role: role)

        // Rule 3 already picked a record for a roleless action. Use THAT one —
        // re-scanning by folded roleKey can match a sibling row with the same
        // folded key and write to the wrong one. Its tracker key (not a derived
        // `record.id`, per Rule 7) is what the write is keyed on.
        if let resolved {
            let record = resolved.record
            let base = Internship(
                id: record.internshipId ?? resolved.key,
                company: record.company, role: record.role, location: record.location,
                deadline: record.deadline, deadlineDate: record.deadlineDate,
                url: record.applyUrl, companyDomain: record.companyDomain,
                logoUrl: record.logoUrl
            )
            return (base, record.appStatus.rank)
        }

        if let record = existing.sorted(by: { $0.key < $1.key }).first(where: {
            Self.companyKey($0.value.company) == key && Self.roleKey($0.value.role) == role
        })?.value {
            let base = Internship(
                id: record.internshipId ?? syntheticId,
                company: record.company, role: record.role, location: record.location,
                deadline: record.deadline, deadlineDate: record.deadlineDate,
                url: record.applyUrl, companyDomain: record.companyDomain,
                logoUrl: record.logoUrl
            )
            return (base, record.appStatus.rank)
        }

        // A catalog listing is only the base when it is the SAME role too. Taking
        // it on a company match alone would hand every role at that company one
        // shared listing id — the per-company collapse this change exists to stop.
        if let match = internships.sorted(by: { $0.id < $1.id }).first(where: {
            Self.companyKey($0.company) == key && Self.roleKey($0.role) == role
        }) {
            return (match, nil)
        }

        return (Internship(
            id: syntheticId,
            company: action.company, role: action.role ?? "Application",
            location: action.enrichment?.location,
            deadline: action.enrichment?.deadline ?? "Not stated",
            deadlineDate: action.enrichment?.deadlineDate,
            url: action.enrichment?.url
        ), nil)
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
