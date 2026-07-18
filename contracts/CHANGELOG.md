# Contract changelog — newest first

Every entry: date · who · what changed · what the OTHER side must do.

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
