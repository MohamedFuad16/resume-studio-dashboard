# Known issues, gotchas & fixes

## Fixed

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
