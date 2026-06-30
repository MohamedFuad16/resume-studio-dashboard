# Known issues, gotchas & fixes

## Fixed

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
- None currently tracked. (ISSUE-002/003/004 resolved 2026-06-29 — see above.)

## Environment gotchas
- **Tectonic required:** `/api/compile`, `/api/export/pdf`, and `build_all.sh` need the
  `tectonic` binary (`TECTONIC_PATH`). Without it, compile falls back to the last saved
  PDF and the LaTeX tests fail.
- **Prod durability:** Without `BLOB_READ_WRITE_TOKEN`, Vercel writes are ephemeral.
- **Research jobs are in-memory:** `/api/internships/research-company/:jobId` returns
  404 after a server restart.
