# Known issues, gotchas & fixes

## Fixed

### BUG-007 — "Saved (N)" radar filter shows an empty table — FIXED 2026-07-03
- **Date:** 2026-07-03 · **File:** `editor/src/components/InternshipDashboard.jsx`
- **Symptom:** The Saved button could read e.g. "Saved (1)" while the filtered table was
  empty; the status `<select>` also offered Applying/Applied/Interview options that never
  matched anything.
- **Root cause:** (1) `savedCount` counted raw tracker records with `status==='saved'`, but
  the `savedOnly` filter ran over `visibleCatalog`, which had already dropped expired-deadline
  saved roles and retired-id roles — so count > rows. (2) `visibleCatalog` excludes applied-type
  statuses up front, so the applied-type filter options were guaranteed-empty.
- **Fix:** (a) `isVisibleInRadar` now keeps `status==='saved'` roles visible even past their
  deadline (shown with the existing urgent/expired styling). (b) `savedCount` is derived from
  `visibleCatalog` with the same `statusFor(id)==='saved'` predicate the filter uses, so count ≡
  rows. (c) the radar status filter excludes `APPLIED_TYPE_STATUSES`, leaving only Saved.
- **Verified:** build green, E2E 5/5; predicates are identical by construction so count == rows.
  NOTE: a saved role retired from the catalog is excluded from both count and rows (no mismatch);
  a dismissible "saved role no longer listed" notice remains a possible future enhancement.

### BUG-008 — Stale `profile:temp` (nameEn "fdf") KV row lingered — FIXED 2026-07-03
- **Date:** 2026-07-03 · **File:** `editor/server/index.js`
- **Symptom:** The scratch profile `temp` (`server/profiles/temp.json` deleted long ago) still
  had a `profile:temp` KV row locally and in the prod Blob snapshot.
- **Fix:** Added `RETIRED_PROFILE_IDS = ['temp']` + `purgeRetiredProfiles()` (deletes
  `profile:`/`tracker:`/`applications:` keys), run in `initPersistentStore()` on every boot;
  `listProfiles()` also excludes retired ids defensively. Idempotent; rewrites the Blob snapshot
  so prod is cleaned on the next deploy.
- **Verified:** local KV had `profile:temp` before boot, `(none)` after; `/api/profiles` lists
  only `aiko_tanaka` + `mohamed_fuad`.

### BUG-009 — Module-scope clock (`NOW`/`TODAY`) went stale across midnight — FIXED 2026-07-03
- **Date:** 2026-07-03 · **File:** `editor/src/components/InternshipDashboard.jsx`
- **Symptom:** `NOW`/`TODAY` were computed once at module load, so a tab left open across
  midnight JST evaluated deadline expiry/urgency against yesterday.
- **Fix:** Replaced the module constants with per-call helpers `nowDate()` / `todayIso()` used
  at every site (`isExpiredDeadline`, `deadlineClass`, verified-date copy). `ApplicationCalendar.jsx`
  already computed `new Date()` per render — no change needed.
- **Verified:** build green, E2E 5/5.

### BUG-006 — Retired internships survived seed cleanup via persisted catalog — FIXED 2026-07-02
- **Date:** 2026-07-02 · **Files:** `editor/server/index.js`,
  `editor/server/seeds/catalog.js`, `editor/server/seeds/catalog-audit-2026-07-02.js`
- **Symptom:** Removing or filtering a static seed did not remove the old row from the
  running catalog; `readInternshipCatalog()` classified the stored copy as a non-seed row
  and merged it back. A stale Apple live-research row also returned a generic careers shell.
- **Root cause:** Seed membership was the only distinction between current and stored data;
  there was no durable retirement concept shared by seed assembly and persistence merges.
- **Fix:** A dated audit owns exact retired IDs and current record patches. The seed builder
  applies it, while catalog reads, legacy custom merges, and writes all reject retired IDs.
  Restarting the server rewrote SQLite from 185 stale rows to exactly 173 current rows.
- **Verified:** API count 173, no retired IDs, research date 2026-07-02; catalog schema/DB
  passes and all 173 unique official URLs pass liveness. See ADR-0013.

### BUG-005 — "Validate Catalog" CI flaky-fails on Nuro `UND_ERR_SOCKET` — FIXED 2026-06-30
- **Date:** 2026-06-30 · **Files:** `editor/server/validate-catalog.js`,
  `editor/server/seeds/internships.js`
- **Symptom:** The `Validate Catalog` GitHub Action failed on `main` (eae7ca8). The
  link-liveness step reported exactly **1 broken** URL —
  `https://nuro.ai/careersitem?gh_jid=7594577` (`global-035`, Nuro Data Scientist Intern)
  with `✗ BROKEN UND_ERR_SOCKET` — while everything else passed (183 entries, 0 format
  errors, DB ok, 179/180 links). The same URL passed **180/180 locally**.
- **Root cause:** `UND_ERR_SOCKET` is a transport-level connection reset (undici "other
  side closed"), here triggered by Nuro's anti-bot layer hanging up on GitHub runner IPs —
  **not** a dead posting. Confirmed live via Nuro's Greenhouse board API
  (`boards-api.greenhouse.io/v1/boards/nuro/jobs/7594577` → "Data Scientist Intern", updated
  2026-06-26) and HTTP 200 from `nuro.ai`/`www.nuro.ai`. The old `checkUrl` treated **all**
  pre-HTTP network errors as HARD failures and did no retries, so any single anti-bot/flaky
  reset failed the whole daily run.
- **Fix:** (1) Kept the verified-live URL, bumped `global-035` `verifiedDate`
  2026-06-27→2026-06-30. (2) `checkUrl` now **retries** transport-level errors
  (`VALIDATE_LINK_RETRIES`=2, linear backoff `VALIDATE_LINK_RETRY_BACKOFF_MS`=600ms) with
  fuller browser-like headers (`LIVENESS_HEADERS`: UA + Accept + Sec-Fetch/
  Upgrade-Insecure-Requests). New `classifyNetworkError` downgrades **persistent**
  resets/timeouts (`UND_ERR_SOCKET`, `ECONNRESET`, `ETIMEDOUT`, undici connect/headers/body
  timeouts, "socket hang up"/"other side closed", `EAI_AGAIN`) to a **SOFT warning**; genuine
  dead links stay **HARD** — DNS-not-found (`ENOTFOUND`), non-HTTPS/malformed, dead redirects,
  HTTP 4xx/5xx (HTTP responses are never retried, returned immediately). Exit-code contract
  unchanged (non-zero only on hard failures); soft-print omits a `(0)` status.
- **Verified:** `validate:catalog` 184 entries / 0 errors / DB ok; `validate:catalog:links`
  **181/181 ok · 0 broken** (exit 0); `npm run build` green. Logic unit-checked with mocked
  fetch: `UND_ERR_SOCKET` & "socket hang up" → soft (`hard:false`); `ENOTFOUND` & HTTP 404 →
  hard. See ADR-0011.
- **Note:** If Nuro persistently resets the runner even after retries, it will show as a
  single SOFT `⚠ network reset after 3 tries (UND_ERR_SOCKET)` warning — informational, does
  not fail CI. Tune `VALIDATE_LINK_RETRIES`/`VALIDATE_LINK_RETRY_BACKOFF_MS` if needed.

### BUG-004 — Application calendar shows only "Rakuten Group" — FIXED 2026-06-30
- **Date:** 2026-06-30 · **File:** `editor/src/components/ApplicationCalendar.jsx`
- **Symptom:** The calendar/timeline displayed only the two Rakuten roles, even though
  several other internships were tracked/applied (NVIDIA, ispace, HENNGE, …).
- **Root cause:** `calendarEvents()` only pushed an event when `record.deadlineDate` matched
  `YYYY-MM-DD`. Only the 2 Rakuten roles had an exact deadline; every other record (including
  applied ones) had `deadlineDate: null` ("Not stated"), so they produced no events. Event ids
  are unique (`${id}-deadline`, milestone ids) — there was **no** company-dedupe bug.
- **Fix:** applied-type records `{applying, applied, interview}` without a deadline now emit a
  green "applied" marker on the applied date (`record.updatedAt || createdAt`), in addition to
  all deadline + milestone events. Also hardened `ProfileDashboard.jsx`'s off-catalog record
  fallback so untracking a record not in the loaded catalog resolves `.id`/`.url` correctly.
  See ADR-0010.
- **Verified:** `npm run build` green.

### BUG-003 — Duplicated eligibility bullets + untranslated JA strings — FIXED 2026-06-30
- **Date:** 2026-06-30 · **Files:** `editor/src/utils/internshipDisplay.js`,
  `editor/server/seeds/internships.js`
- **Symptom:** The DetailPanel eligibility list repeated the same bullet (esp. in JA, where
  several distinct EN lines mapped to one generic JA fallback); many entries still showed
  English in JA mode (bare `English`/`Japanese`, untranslated roles/tracks/dates/places);
  `global-081` (Geotab) had garbled scraped role/compensation text.
- **Root cause:** Eligibility was merged/derived at render time without de-duplication; the
  JA `displayValue/displayRole/jaDisplay` maps were missing many terms; scrape artifacts in
  one seed entry.
- **Fix:** `internshipDetails()` now de-dupes `eligibility`/`eligibilityJa` (case-insensitive,
  trimmed) — 31 entries collapsed, 0 dups remain. Added the missing JA mappings (languages,
  ~30 role/section terms + fallbacks, month/date phrases, 19 `TRACK_LABELS_JA`, JP places).
  Cleaned `global-081` role/compensation/fitNote. Verified: `validate:catalog` 0 errors, build
  green. See ADR-0009.
- **Note:** The non-displayed `workAuth` field still contains scraped question text on a few
  US entries (1174/1244/2119/2154) — harmless (not rendered), left as-is.

### BUG-002 — Internship Radar table forces a horizontal scrollbar — FIXED 2026-06-30
- **Date:** 2026-06-30 · **File:** `editor/src/index.css`
- **Symptom:** The radar results table overflowed the viewport and showed an unwanted
  horizontal scrollbar; some `<select>`s (esp. the per-row status select) had a large gap
  between the label and the dropdown chevron.
- **Root cause:** Four drifted `.intern-table-head,.intern-row` `grid-template-columns`
  definitions existed; the *winning* late block set `min-width: 1180px` together with
  `.intern-results { overflow-x: auto }`, forcing overflow. Status selects used
  `width:100%` (native select right-aligns the chevron → big middle gap).
- **Fix:** Collapsed to one shrink-safe fluid grid (`minmax(0,…)`/`fr`, `column-gap:12px`),
  removed `min-width`/`overflow-x`, added `min-width:0` to grid ancestors, dropped dead
  1450/1250px overrides; normalized all selects with a shared `appearance:none` + custom
  chevron rule and content-sized width for status selects. See ADR-0008.
- **Verified:** `npm run build` green; headless Chromium shows
  `scrollWidth - clientWidth === 0` at 1024/1280/1440 + mobile widths.
- **2026-07-04 update:** `index.css` was split into `editor/src/styles/*.css` (ADR-0018). The
  split preserves source order exactly (consecutive slices → ordered `@import`s → byte-identical
  compiled bundle), so this fix's winning override still wins. The radar rules now live in
  `styles/radar.css` + `styles/overrides.css` + `styles/overrides-tail.css` (grid/select overrides).
  **Gotcha for future CSS edits:** these files' `@import` order in `styles/index.css` is
  load-bearing — reordering them can resurrect the drifted-duplicate cascade that caused this bug.

### BUG-001 — Track filter returns no results in Japanese mode
- **Date:** 2026-06-29 · **File:** `editor/src/components/InternshipDashboard.jsx`
- **Symptom:** In JA (`?lang`/JA toggle), choosing any value in the **Track** filter
  emptied the internship table ("No internships match these filters").
- **Root cause:** The track `<select>` options had no explicit `value`, so the option
  value defaulted to its rendered text. In JA, `trackLabel(option, true)` returns a
  Japanese label, so `setTrack` stored the Japanese string while catalog items keep
  English `item.track` → `item.track === track` was always false. The sibling
  `region` filter had already been given `value={option}` in the in-progress work;
  `track` was missed.
- **Fix:** Added `value={option}` to the track options so the stored value is always
  the raw (English) track regardless of display language.
- **Verified:** `npm run build` passes; no lint errors; logic now mirrors the working
  `region`/`language`/`status` selects (which all carry explicit values).

### ISSUE-002 — Duplicated JA translation logic (drift risk) — RESOLVED 2026-06-29
`components/InternshipDashboard.jsx` used to define a near-identical local `jaDisplay` /
`displayValue` / `displayRole` alongside the exports in `utils/internshipDisplay.js`,
and they had drifted. **Unified** into the single `utils/internshipDisplay.js` module:
the comprehensive radar chain now lives there (as `jaDisplay` + exported `displayValue`/
`displayRole`); the dashboard imports them and the inline copies were deleted. All three
consumers (`ProfileDashboard`, `InternshipDashboard`, `ApplicationCalendar`) now share
one source. New phrases go in **one** place. (Folding in the superset also fixed a latent
typo where `Class of 2028 Security Engineer Internship` rendered as ソフトウェア… in the
util copy.) See `agent/decisions.md` ADR-0006.

### ISSUE-003 — `displayValue` partial translation for `Not stated; …` — RESOLVED 2026-06-29
The generic `.replace(/Not stated;\s*/gi,'記載なし・')` ran before the specific
`^Not stated; PC and transport benefits listed$` rule, leaving it dead and rendering the
string half-translated. **Fixed** by hoisting the specific full-string rule above the
generic prefix replace in the unified `jaDisplay` chain
(`displayValue('Not stated; PC and transport benefits listed', true)` →
`記載なし・PC/交通費支給あり`).

### ISSUE-004 — Playwright spec drift vs. current UI — RESOLVED 2026-06-29
The old `editor/tests/e2e/editor.spec.ts` (~59 cases) targeted an idealized form-first
UI (`input[name="fullName"]`, a `/api/resume` → `personalInfo` contract) that the
dashboard-first app never shipped. A full run (browser installed) confirmed **57 failed
on drift, 2 passed** (both language-toggle checks against the real shell). The stale file
was deleted and replaced with `editor/tests/e2e/app-smoke.spec.ts` (4 cases, all green)
covering the real shell: language switcher, rapid toggle stability, and dashboard ↔ radar
↔ editor navigation. Build remains the primary client gate. See ADR-0007 and `tests.md`.

## Known / open (non-blocking)
- None currently tracked. (ISSUE-002/003/004 resolved 2026-06-29 — see above.)

## Environment gotchas
- **Tectonic required:** `/api/compile`, `/api/export/pdf`, and `build_all.sh` need the
  `tectonic` binary (`TECTONIC_PATH`). Without it, compile falls back to the last saved
  PDF and the LaTeX tests fail.
- **Prod durability:** Without `BLOB_READ_WRITE_TOKEN`, Vercel writes are ephemeral.
- **Research jobs are in-memory:** `/api/internships/research-company/:jobId` returns
  404 after a server restart.
- **Large research+edit worker tasks can hit `resource_exhausted`:** the internship apply-link
  audit overran an agent's context twice when research-subagent fan-out + seed edits +
  validation were combined in one worker. Mitigation: ship the already-complete sub-fixes
  first, then run the link audit as a small pre-scoped worklist (the validator's `[1b]`
  generic-apply-url list) in a fresh lean worker, and have research subagents return only
  compact `id → url` verdicts (never page dumps).
