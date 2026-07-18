# Contract changelog — newest first

Every entry: date · who · what changed · what the OTHER side must do.

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
