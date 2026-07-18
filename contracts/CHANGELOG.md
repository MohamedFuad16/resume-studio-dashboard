# Contract changelog — newest first

Every entry: date · who · what changed · what the OTHER side must do.

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
