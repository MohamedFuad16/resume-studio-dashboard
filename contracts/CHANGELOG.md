# Contract changelog — newest first

Every entry: date · who · what changed · what the OTHER side must do.

- **2026-07-20 · iOS · REQUEST to web — company facts in the research payload.**
  iOS now has a company page (tap an orb in Companies → it expands into
  `CompanyDetailView`) that shows real stats: catalog popularity, listings, the
  owner's per-role history, and the `research-company` job's summary + verified
  openings. The owner wants funding, work-life balance, headcount and similar
  facts there. iOS will NOT invent these client-side. Ask: extend the
  research-company job JSON with an optional `facts` object —
  `{funding, workLifeBalance, employees, founded, rating}`, strings, each
  omitted when the search cannot ground it (grounded like everything else in
  that pipeline; no guesses). iOS already decodes and renders `facts` if
  present (`ResearchJob.Facts` in `Views/CompanyDetailView.swift`), so shipping
  it lights the page up with no app update.

- **2026-07-20 · both · The owner can overrule the pipeline: `statusPinned` +
  tombstones (ADR-S-004).** The tracker was a cache of classifier output — the
  owner deleted a wrong row and the next rescan re-created it; they knew they were
  rejected and the record said "applied" until the classifier was repaired. Now:
  a status set by hand sets `statusPinned: true` and no drain ever moves that
  record's status, stamps or milestones again (detail enrichment still applies;
  pinned records survive the rebuild purge whatever `source` says). Deleting a
  record writes a `(companyKey, roleKey)` tombstone stored BESIDE the tracker map
  in the SAME document write; a drain never re-creates a tombstoned pair, and an
  `applied` action strictly newer than the tombstone lifts it. Full rules in
  `contracts/tracker-record.md` "User truth outranks the pipeline".
  **Both clients implement this identically** — iOS commit 6d939f9, web commit
  79cf962. This entry is late by one commit on the iOS side (rule 2 says same
  commit); noted here rather than hidden.


- **2026-07-20 · both · Tracker records are keyed by COMPANY + ROLE, not company
  (SPEC-per-role-keying.md).** The drain kept one record per company, so repeated
  applications to one firm collapsed into a single row that then lied about its
  status: five Rakuten applications became one row reading "rejected" while three
  were still live, and HENNGE's rejection + application + **interview** became one
  row reading "rejected". Records are now `(companyKey, roleKey)`; synthetic ids
  are `gmail-<companyKey>-<roleKey>`. A rejection email usually omits the role, so
  a roleless action resolves to the company's most recently updated non-terminal
  DRAIN-OWNED record (never a hand-added one) instead of spawning a phantom row.
  Company keys now NFKC-normalize first — full-width Latin (`Ｓｋｙ株式会社`) folded
  to an empty key and the company was dropped silently, interview included.
  Company matching is exact-key equality over sorted collections; the old two-way
  substring test over unordered iteration merged firms whose keys nest and
  returned a different record between runs on identical input.
  **Both clients implement the SAME spec — `contracts/SPEC-per-role-keying.md` is
  the authority and is now tracked.** Web: `useGmailInbox.js` + `reapplyCooldown.js`
  (commit 1f1250c). iOS: `GmailDrain.swift` (commit 4bc962b). Rules 6–8 were added
  after review caught three defects: string-compared timestamps across mixed
  offsets, a tie-break that read a randomly-generated id, and a path that could
  stamp `source=gmail` onto a hand-added row and get it purged. **If you touch the
  drain, read the spec first — divergence here corrupts shared user data and
  neither client's own tests catch it.**
  Existing rows keyed `gmail-<company>` do not match the new ids and want a
  re-derive from the Gmail queue; do it FETCH-FIRST, never purge-then-refetch
  (ADR-I-015).


- **2026-07-20 · server · Bulk headers are evidence, not a verdict; actions carry
  their kind's reason.** The bulk-mail guard shipped hours earlier dropped 27 of 80
  messages on its first production run and took real records with it — Sky's
  REJECTION vanished, LAPRAS and Atom11 never arrived — because Japanese ATSs
  deliver personally-addressed mail through bulk services (mail.axol.jp, HERP) that
  set `List-Unsubscribe` exactly like a newsletter. A bulk message is now admitted
  when it is written TO the owner (personal salutation, first-party application
  phrasing, or a sender company already holding one of their applications) and
  skipped otherwise; the addressee is what separates an ATS rejection from a digest
  quoting a stranger. Telemetry splits `bulkSkipped` / `bulkAdmitted`.
  **Queue shape gained `kindRule` + `kindEvidence`** (gmail-action.md) — diagnostic
  only, round-trip them like any unknown field. **Clients: nothing to change.**
  (This entry was meant to land with web commit 3e6f2f7; the insertion silently
  no-opped and was caught during the main merge.)

- **2026-07-20 · repo · Agentic toolkit checked in — `.claude/` + `scripts/`
  (ADR-S-003).** Four subagents, four skills, four hooks, and two verification
  batteries (`scripts/verify-web.sh`, `scripts/verify-ios.sh`) now live in the
  repo instead of in each device's head. Commits and PRs carry **no AI
  attribution** — a `PreToolUse` hook blocks the ones that do (CLAUDE.md rule 7).
  **Other side: pull, then RESTART your Claude Code session** — hook config is
  read once at session start, so a session older than the pull runs unguarded.
  Optionally set `CLAUDE_NOTIFY_IMESSAGE` in your own (uncommitted)
  `.claude/settings.local.json` for iMessage alerts; unset, the notifier is a
  silent no-op. Nothing about API routes, payloads, or Firestore paths changed.


- **2026-07-20 · web · Résumé list items now carry an `id` (ADR-0041).** Every
  item in `resume.education`, `resume.experience`, `resume.projects` and
  `resume.activities` gains a persisted `id` (UUID string), backfilled onto
  existing résumés the first time the web editor loads them. It exists purely to
  give the editor's reorderable lists a stable React key; nothing derives meaning
  from it. **iOS: round-trip it, don't drop it** (CLAUDE.md rule 4). iOS reads
  only `resume.personal` and never writes résumés, so this is a heads-up rather
  than a work item — but if that ever changes, a write that strips `id` would
  make the web editor re-mint ids and lose focus on the next reorder. The server
  needed no change: `validateResume` passes unknown per-item fields through, and
  LaTeX generation reads named fields only (output verified byte-identical).

- **2026-07-20 · doctor (owner-directed) · Résumé section items now carry a
  persisted `id`.** Education/experience/projects/activities entries gain a
  stable `id` (uuid, backfilled on load in `App.jsx#normalizeResume`, created at
  every add/import site) so React list keys track the ITEM across reorder/delete
  (issue #19). The résumé shape is not formally contract-bound, but iOS reads
  profile docs from the same Firestore collection: **iOS: nothing to change** as
  long as unknown résumé fields are round-tripped (rule 4); LaTeX generation and
  server validation ignore the field.

- **2026-07-19 · web · Storage engine swapped; Vercel is static-only (ADR-0040).**
  The server now runs native SQLite (working copy + snapshot to the mount) instead
  of sql.js, and the Vercel origin no longer serves `/api` at all. **iOS: nothing
  to change** — routes, payloads, and the Azure base URL are all unchanged; this is
  purely how the server stores the shared catalog + Gmail queue. Worth knowing only
  if you ever pointed a build at the Vercel origin for `/api`: don't, it's static now.

- **2026-07-19 · web · W1+W2 attempted then REVERTED — SQLite can't write on
  Azure Files (SMB).** The better-sqlite3-direct-on-the-mount swap (W2) deployed
  with working reads but every WRITE failed `SQLITE_BUSY` (file-locking is
  unsupported on the SMB share; sql.js worked only because it rewrites the whole
  file, no locks). Rolled the container back to the sql.js image and reverted the
  commit; prod is stable, no data lost. **Owner decision: keep sql.js, W2 closed.**
  **iOS: nothing changed — API/shapes/base-URL all unchanged.** (If ever revived, a
  future W2 must run better-sqlite3 on a local path + snapshot to the mount — see
  agent/web/errors.md.)
- **2026-07-19 · web · DONE — enrichment fills known-but-sparse companies
  (ADR-0039).** Answers the iOS request below. `sync.js` no longer skips
  `enrichCompany` just because a company appears in the server-side tracker; it
  now skips only when details are ALREADY resolvable — a catalog listing, or a
  tracker record that already carries an `applyUrl`. A bare Gmail-created record
  (LAPRAS: name+role, no URL) is now enriched so its `url`/`location`/`deadline`
  fill in. Existing sparse records fill on their next `applied`/`offer` email or
  a backfill re-scan. The `enrichment` action shape is unchanged — iOS: nothing
  to change; you'll simply start receiving populated `enrichment` for these.
- **2026-07-19 · iOS · REQUEST to web — enrich known-but-sparse companies.**
  `sync.js` skips `enrichCompany` when the company is already known (catalog or
  tracker), so a Gmail-created record like LAPRAS carries only name+role — no
  URL, location, deadline, or role details — and no client can show more. Ask:
  when an `applied`/`offer` action's company is known but the matching record
  lacks `url`/`location`/`deadlineDate`, run enrichment anyway (or expose a
  client-callable research trigger). Owner wants the LLM actively filling in
  internship details, not just classifying. iOS already stores + round-trips
  `enrichment` fields and will render them (plan item I2).
- **2026-07-19 · iOS · Code-doctor account introduced.** `DOCTOR.md` at repo
  root is its operating prompt; CLAUDE.md rule 6 binds BOTH teams to verify →
  fix → close `doctor/*` PRs for their surface. Web: adopt rule 6 in your
  session habits; nothing else to change.
- **2026-07-18 · web · Reapply cooldown date is now computed in Asia/Tokyo
  (normalization.md §5).** `reapplyCooldown.js addMonths` did local-timezone month
  arithmetic and read the result back with `toISOString().slice(0,10)` (UTC), so
  `reapplyAfter` came out one day early for any rejection received before 09:00 JST
  and varied with the browser's timezone — diverging from iOS's `GmailDrain`
  (`tokyoCalendar` + Tokyo `dayKey`). It now adds months on the email's Tokyo civil
  date. iOS: nothing to do — already correct; do NOT revert `GmailDrain`'s Tokyo
  arithmetic.
- **2026-07-18 · iOS · companyKey aligned to the canonical normalizer
  (normalization.md §1).** `GmailDrain.companyKey` previously stripped EN
  suffixes as unanchored substrings (so `"Acme Co"` keyed `acme co` ≠ web's
  `acme`, and `"ABC Inc. Japan"` over-stripped to `abc japan`), and its
  `CharacterSet.alphanumerics` kept accented/fullwidth characters the web folds.
  It now mirrors web `normalizeCompany` exactly: JA markers removed anywhere,
  trailing-anchored `[,\s]+(inc|ltd|k.k|co).?$` peeled repeatedly, kept set
  exactly `a-z 0-9 U+3040–30FF U+4E00–9FFF`. Verified by a 20k-case mirror test
  against the web implementation (0 mismatches). Web: nothing to do.
- **2026-07-18 · web · Web-side action items 1–4 done (ADR-0038).** (1) merged
  `ios`→`main` per HANDOFF-WEB.md. (2) **Canonical company key adopted**: the
  JA+EN-suffix-stripping normalizer now lives once in `reapplyCooldown.js`
  (`normalizeCompany`/`companySlug`), and `useGmailInbox.js` imports it — the two
  can no longer drift. `"Acme, Inc."`, `"Acme Co., Ltd."`, `"Acme"` all key as
  `acme`; `Cisco`/`Costco` are protected; CJK preserved. iOS: verify
  `GmailDrain.swift` peels stacked suffixes (`Co., Ltd.`) the same way. (3)
  `validation.js` fixed — tracker keys now accept CJK ids (new `TRACKER_KEY`
  regex) and a bad/`http://` `applyUrl` is sanitized at ingest (upgrade→https,
  else drop) instead of 400ing the whole save. (4) No web company-name/gig
  filters existed to retire — detection is already the inclusive, evidence-based
  `roleFilter.js` (no hard-coded names). Both normalization.md open issues closed.
- **2026-07-18 · iOS · contracts/ created (ADR-S-001).** Baseline written from
  both teams' audits. Web must: (1) merge the `ios` branch into `main` per
  /HANDOFF-WEB.md; (2) adopt the canonical company key — extend `CORP`/`slug`
  in `useGmailInbox.js` + `reapplyCooldown.js` to strip EN corporate suffixes
  (normalization.md §1); (3) fix `validation.js` tracker-key regex rejecting
  CJK keys, and clean `http://` enrichment URLs at ingest instead of 400ing the
  save (api.md); (4) retire client-side gig/company-name filters per ADR-S-002.
- **2026-07-18 · iOS · receivedAt is guaranteed ISO 8601** (`sync.js toISO`,
  deployed as image `32fc6ae`). Web: nothing to do, but never revert — iOS
  cannot parse RFC 2822.
- **2026-07-18 · iOS · iOS now writes web-parity fields at drain time**
  (eventAt, appliedAt/rejectedAt/interviewAt/offerAt, sourceMeta, reapply trio)
  and round-trips all unknown TrackerRecord fields (`extra` passthrough).
  Web: nothing to do; new record fields you add will now survive iOS saves.
