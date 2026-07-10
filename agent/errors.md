# Known issues, gotchas & fixes

## Fixed

### BUG-010…018 — Agent-team sweep (races, isolation, robustness) — FIXED 2026-07-10
Found by a three-reviewer agent team (UI architecture / perf & polling / deployment)
with devil's-advocate verification; all confirmed by code tracing. See ADR-0027.
- **BUG-010 · Tracker saves race** (`hooks/useApplicationTracker.js`): `commit()` was
  fire-and-forget and its ack event re-applied the *sent* snapshot, so two quick writes
  (status change + interview milestone fire back-to-back) could land/ack out of order
  and durably drop the later one. Fixed: saves are serialized on a promise chain and the
  ack broadcasts `trackerRef.current` (newest state). Also added a staleness guard to
  `refresh()` so a slow profile-A fetch can't overwrite profile B's tracker (and then be
  committed into B's storage).
- **BUG-011 · Compiled-PDF cross-user leak/race** (`server/index.js`): compile results
  were stored under `compiled:<template>` and served to *anyone* from
  `/api/compiled/resume_<template>.pdf` — concurrent compiles clobbered each other and
  could serve user A's résumé PDF to user B. Fixed: each successful compile returns a
  one-time `?rid=` token backed by an in-memory TTL map (10 min, cap 40; single-replica
  host per ADR-0019); the KV entry remains only as the no-tectonic fallback.
- **BUG-012 · AI chat applied a stale résumé** (`App.jsx handleResumeChat`): the LLM
  response (round trip up to ~90s) replaced the whole résumé from the submit-time
  snapshot, wiping edits made meanwhile. Fixed: if the résumé changed in flight the edit
  is refused with an explanatory chat message.
- **BUG-013 · Compile races + silent stale fallback** (`App.jsx compile`): no sequencing
  meant an older in-flight compile (e.g. armed pre-profile-switch — `cmpTimer` also
  wasn't cleared on switch) could win `setPdfSrc` and show the wrong profile's PDF; a
  `cached: true` fallback response was treated as a successful compile (cached under the
  resume's cacheKey, warning dropped) so a broken backend never surfaced and never
  retried. Fixed: compile sequence token, timer cleared on switch, `cached` responses
  surface the warning as a toast and don't set `lastCompiled`.
- **BUG-014 · Research-job UI died on one poll blip; start failures invisible**
  (`InternshipDashboard.jsx`): a single rejected 1.5s poll marked the job errored, which
  tore down the interval for good while the server job (up to 280s) kept running; a
  *start* failure set `researchJob=null`, and the panel gates `error` on
  `researchJob.company === query`, so the user saw the idle prompt instead of the error.
  Fixed: 4 consecutive failures required (+ overlap guard), and start failures keep a
  company-tagged error job.
- **BUG-015 · PDF-import wizard crash + desynced ID input** (`App.jsx`): the heuristic
  parser emitted experience-shaped `{company, role}` activities while the Step-7 editor
  and `ActivitiesSec` expect `{title, org}` → `item.title.trim()` threw (no error
  boundary → white screen); the Step-8 profile-ID input was uncontrolled so it desynced
  from `wizardData._profileId` after Back/forward. Fixed: parser maps to the activities
  shape, `.trim()` guards, input is controlled.
- **BUG-016 · Storage init bricked by one transient error** (`server/storage.js`): a
  rejected first `init()` was memoized forever — every later call returned the same
  rejected promise until restart. Fixed: reset `ready = null` on failure so the next
  call retries.
- **BUG-017 · Research job maps grew forever** (`server/index.js`): jobs were only ever
  `set`, never deleted, on the always-on host. Fixed: lazy 60-min TTL prune of finished
  jobs (+ orphaned company pointers) on each research start.
- **BUG-018 · `\href{}` LaTeX breakage from user fields** (`server/templates.js`):
  email (never URL-validated) / linkedin / github were interpolated raw into
  `\href{...}` — a `}`/`%` in the value aborted the compile, which then silently served
  the stale cached PDF (see BUG-013). Fixed: new `texUrl()` percent-encodes
  `\ { } % #` + whitespace at every href site (visible text still uses `esc()`).
- **Smaller fixes**, same date: boot now `replaceState`s the resolved profile into the
  URL (pushState left a bare-URL history entry; Back resolved to the hardcoded
  `mohamed_fuad` and errored for Firestore users whose profile is `primary`); the radar
  "Next 7/30 days" filter now computes the horizon in JST like all other deadline logic
  (UTC lagged a day between 00:00–09:00 JST); the auto-research spend gate matches the
  FULL catalog, not the filtered visible set (a company whose rows were all
  expired/applied triggered a paid auto-search).

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
From the 2026-07-10 agent-team sweep — verified real but deliberately NOT fixed in that
pass (need ops work, product decisions, or architecture changes; see ADR-0027):
- **ISSUE-005 · No auth on `/api/*` writes; Origin guard bypassable.** The server never
  verifies Firebase ID tokens; the cross-origin write guard passes requests with NO
  Origin header (curl/scripts), so anyone can write the shared `internships:catalog`
  (served to all users, incl. signed-in ones), read/write the sample profiles via
  `?profile=`, and delete `aiko_tanaka` (only `mohamed_fuad` is protected). Real fix =
  server-side ID-token verification (already flagged as open scope in ADR-0014).
- **ISSUE-006 · Azure compile/research host runs without `BLOB_READ_WRITE_TOKEN`**
  (`docs/azure-deploy.md` create command omits it) → backend is `ephemeral-local-sqlite`;
  user-added research internships and no-auth profile writes vanish on container
  recycle. The "ephemeral without token" caveat is documented for Vercel but this is the
  PRIMARY backend. Fix = set the token on the Container App (or accept + document).
- **ISSUE-007 · Vercel preview deploys are CORS-rejected by the Azure backend** (trusted
  origins = hardcoded prod alias + env); previews get random `*.vercel.app` origins →
  all writes 403. Also: photo/body size limits (validation ~8.1 MB data-URL, Express
  12 MB) exceed Vercel's 4.5 MB request cap → opaque 413s on the no-auth Vercel path.
- **ISSUE-008 · WebP résumé photos are silently dropped on Linux compile hosts**
  (`materializeResumePhoto` shells to macOS-only `/usr/bin/sips`; the Docker image has no
  converter). Low impact: the client re-encodes uploads to JPEG (`imageUpload.js`), so
  only direct-API writers hit it. Fix = a Linux converter in the image or reject WebP.
- **ISSUE-009 · Dead "application assistant" state in App.jsx**: `applications` is
  fetched on every boot/profile switch but never rendered; `setActiveApp` is only ever
  called with `null` so the detail modal is unreachable. Product decision: render or
  remove (App.jsx split is already a deferred task).
- **ISSUE-010 · No-auth multi-profile mode has no switching UI**: App passes
  `onSwitch`/`onNew`/`onDelete` to `ProfileSwitcher`, which (deliberately, post-Firebase)
  ignores them — in `VITE_AUTH_DISABLED` mode only hand-editing `?profile=` switches
  between the two server-seeded samples.
- **Perf (by design, documented):** on the Blob backend every KV read/write round-trips
  the ENTIRE SQLite DB (which also stores base64 compiled PDFs), and `GET /api/compiled`
  re-persists seed PDFs (a write on a read path); `saveProfileImmediately`'s
  refresh-from-server can revert keystrokes made during the round trip.

## Environment gotchas
- **Tectonic required:** `/api/compile`, `/api/export/pdf`, and `build_all.sh` need the
  `tectonic` binary (`TECTONIC_PATH`). Without it, compile falls back to the last saved
  PDF and the LaTeX tests fail.
- **Prod durability:** Without `BLOB_READ_WRITE_TOKEN`, Vercel writes are ephemeral.
- **Research jobs are in-memory:** `/api/internships/research-company/:jobId` returns
  404 after a server restart. **Corollary — the compile/research host must run a single
  replica:** the job Map is per-process, so the start-POST and poll-GETs must hit the same
  instance. Azure Container Apps was first created with `--max-replicas 2`; on scale-up the
  ingress round-robined polls onto a replica with no job → 404 → UI "search failed". Fixed
  by pinning `--min-replicas 1 --max-replicas 1` (2026-07-06, ADR-0019).
- **gpt-5-mini live search is slow (120–245 s):** the `:online` web search regularly
  exceeds a 200 s LLM timeout on the slow tail → job errors as "search failed". Default
  `INTERNSHIP_RESEARCH_TIMEOUT_MS` raised to 280000; the client polls indefinitely so the
  long wait itself is fine (staged "thinking → searching → compiling" progress covers it).
- **Large research+edit worker tasks can hit `resource_exhausted`:** the internship apply-link
  audit overran an agent's context twice when research-subagent fan-out + seed edits +
  validation were combined in one worker. Mitigation: ship the already-complete sub-fixes
  first, then run the link audit as a small pre-scoped worklist (the validator's `[1b]`
  generic-apply-url list) in a fresh lean worker, and have research subagents return only
  compact `id → url` verdicts (never page dumps).
