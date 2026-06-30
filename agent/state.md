# Project state

## Current state summary
Two-track résumé project. **Track A — Resume Studio** (`editor/`): React 18 + Vite
client and an ESM Node/Express server with sql.js (SQLite) KV storage (Vercel Blob in
prod), Tectonic-based LaTeX compile, an internship radar/tracker, an application
calendar, and an AI application assistant. **Track B**: static LaTeX résumés (`en/`,
`ja/`) compiled by `build_all.sh` to `output/`, validated by a Python/PyMuPDF suite
(`tests/`). The latest work is a Japan-first internship expansion — a new dated seed file
(`server/seeds/japan-wide-research-2026-06-29.js`), the catalog merge now dedups by `id`
only, broader EN/JA display localization, a new `Global` region filter, and language
persistence in `localStorage` — plus a finalize/cleanup pass: the JA-translation helpers
are unified into one module, the half-translated `Not stated; …` string is fixed, and the
drifted form-first E2E spec was replaced by a green dashboard-shell smoke suite.
`npm run build` is green (bundle ~329 KB, down ~7 KB after dedup); the server boots and
`/api/internships` returns a valid, dedup'd catalog; `npm run test:e2e` is green (4/4).
The full change set (radar WIP + BUG-001 + cleanup + the `agent/` KB + root pointers) was
committed and pushed to `origin/main` this session.

## Recent changes
- **2026-06-30 — Application-tracker UX fixes + catalog CI + apply-URL audit (2 parallel
  workers + coordinator recovery).** (1) **Recent applications = applied-only**
  (`ProfileDashboard.jsx`): the list now filters to applied-type statuses
  `{applying, applied, interview}`, so "Saved"/untracked items no longer appear; a new
  **"Not applied"** option (`value=""` → `updateStatus(item,'')` untracks) lets the user
  change applied→not-applied and the row drops off immediately (derived from tracker state).
  (2) **Calendar no longer shows only Rakuten** (`ApplicationCalendar.jsx`): it previously
  emitted events only for records with an exact `deadlineDate` (just the 2 Rakuten roles had
  one); applied-type records without a deadline now get a distinct green "applied" pill on
  the day applied (`updatedAt||createdAt`), alongside all deadlines/milestones (no duplicate
  for deadline-dated rows). (3) **Selector gap** (`index.css`): `.application-row select`
  joined the content-sized select rule (`width:auto`), removing the big text↔chevron gap in
  the Saved/Applied dropdowns. (4) **GitHub Actions** (`.github/workflows/validate-catalog.yml`):
  runs `validate:catalog` + `validate:catalog:links` on push/PR to `editor/**`, a daily
  06:00 UTC cron, and manual dispatch (Node 20) — the automated daily gate ADR-0009
  anticipated. (5) **Validator heuristic** (`validate-catalog.js`): new soft (non-failing)
  `generic-apply-url` warning + `[1b]` report flagged **14** likely-generic apply URLs.
  (6) **Apply-URL audit** (seeds): replacing those 14 generic landings with the specific
  posting page per role where one exists (genuine single-program pages stay flagged) — run
  in a fresh lean worker. Verified: `npm run build` green, `validate:catalog` 183 entries /
  0 errors / DB ok. PROCESS NOTE: a single combined worker hit `resource_exhausted` twice on
  the link audit; recovered by shipping the 5 complete fixes first and re-scoping the URL
  audit to the validator's `[1b]` worklist. See ADR-0010, BUG-004.
- **2026-06-30 — Internship catalog overhaul + automated validation.** (1) **Expiry
  filter:** the radar now auto-hides internships whose `deadlineDate` is before today
  UNLESS the user has applied (tracker status in `{applying, applied, interview}`); no-deadline
  ("Not stated") entries always show. `dynamicStats`/track filter/live-search all derive from
  the visible set (`InternshipDashboard.jsx`). (2) **Catalog expanded 153 → 183** (Japan-based
  53 → **83**, English-first **129**): new verified seed file
  `editor/server/seeds/japan-wide-research-2026-06-30.js` (30 real Tokyo/Japan roles with
  live official URLs + inline JA fields), assembled via the new
  `editor/server/seeds/catalog.js` `buildSeedCatalog()` (shared by server + validator). (3)
  **Automated validator** `editor/server/validate-catalog.js` (npm `validate:catalog` /
  `validate:catalog:links`): checks formatting/shape (aligned with `validation.js`, incl.
  duplicate-id + duplicated-list-item detection), DB round-trip through `storage.js`
  (save→load structural equality), and optional link liveness (GET+redirect, soft vs hard
  fail). Exits non-zero on hard failure — wire into the daily ingestion/CI. (4) **Eligibility
  de-dupe** at render source (`internshipDisplay.js` `internshipDetails` → `dedupeList`,
  case-insensitive; 31 entries collapsed, 0 dups remain). (5) **JA localization** filled in
  (`internshipDisplay.js`): bare `English`/`Japanese` language values (100 entries), ~30
  role/section terms + single-word fallbacks, month/date phrases, missing
  `TRACK_LABELS_JA` (19 tracks), and JP place names. (6) **Data cleanup:** fixed garbled
  scrape artifacts on `global-081` (Geotab) role/compensation/fitNote. Verified:
  `validate:catalog(:links)` → 183 entries, 0 errors, DB ok, **177/177 links live**;
  `npm run build` green. Done by 2 parallel workers (disjoint files) after a first
  single-worker attempt hit a resource limit. NOTE: this Vercel project does NOT auto-deploy
  from GitHub — must `vercel --prod --yes` from `editor/` after pushing.
- **2026-06-30 — Radar UI fixes + Japanese résumé redesign (2 parallel workers).**
  (1) **Internship Radar layout** (`editor/src/index.css`, no JSX changes): the radar
  table's horizontal scroll was caused by a late grid block with `min-width:1180px`
  paired with `.intern-results{overflow-x:auto}`; there were **four** drifted
  `.intern-table-head,.intern-row` grid definitions. Reconciled them all to one
  shrink-safe fluid grid (`32px minmax(0,2fr) 68px minmax(0,1fr) … 106px 66px 32px`,
  `column-gap:12px`), removed the `min-width`/`overflow-x`, added `min-width:0` to
  `.intern-content/.intern-results/.intern-rows`, and dropped the dead 1450/1250px
  language-hide overrides. Verified zero horizontal overflow at 1024/1280/1440 (+ mobile
  860/768/560/390) via headless Chromium. (2) **Selector spacing:** consolidated all
  radar/dashboard `<select>`s (`.intern-filter-row select`, `.intern-sort select`,
  `.intern-row-status`, `.intern-status-control select`, `.application-row select`) to a
  shared `appearance:none` + custom-chevron rule; the row status select now sizes to
  content (`width:auto`) so the "Applying" mid-gap is gone. (3) **Calendar source banner:**
  restyled `.calendar-source-note` into an on-brand info notice (subtle blue tint, soft
  border, radius, aligned brand-blue icon) for both EN/JA. (4) **Japanese résumés
  redesigned** (`editor/server/templates.js`, `genJa01/02/03` only — EN templates and the
  `generateLatex` signature untouched): `genJa01` 履歴書 → clean JIS-style rirekisho
  (side-by-side identity table + bordered 4cm×3cm photo box + 年/月 学歴・職歴 timeline,
  page 2 with 免許・資格 / 学業・ゼミ / 自己PR・ガクチカ / 本人希望記入欄); `genJa02`
  インターン応募シート → polished one-pager with accent section rules; `genJa03` 職務経歴書
  → refined full-bleed dark-sidebar + content layout. Recompiled with Tectonic: clean, 0
  errors/overfull, page counts 2/1/1. Verified: `npm run build` green (bundle ~329 KB).
- **2026-06-29 — HENNGE CV + cover letter revision pass.** Verbatim rewrite of both
  `en/01_jakes_clean.tex` and `en/05_cover_letter_hennge.tex`: removed em-dashes,
  reformatted the phone number to `+81 80-7535-2988` international format, added spacing
  in the Education/Experience headings, reordered Projects (WebDrop 2026 current, Agent
  Swarm 2026, Tutor-System 2026, TokaiHub 2025), strengthened the WebDrop bullets, and
  rewrote the cover letter in a more natural student voice (dropped the "37-tool"
  phrasing). To keep the CV at one page, applied all three spacing fallbacks
  (`\resumeSubheading` `\vspace{-5pt}`, `\resumeItemListStart` `[topsep=1pt]`, Summary
  `\vspace{3pt}`). Recompiled with Tectonic to `output/Mohamed_Fuad_CV.pdf` +
  `en_01_jakes_clean.pdf` and `output/Mohamed_Fuad_Cover_Letter.pdf` +
  `en_05_cover_letter_hennge.pdf`; both verified at exactly 1 page, previews rendered to
  `output/preview/cv.png` and `cl.png`.
- **2026-06-29 — HENNGE cover letter + CV emphasis pass.** Added an English cover letter
  (`en/05_cover_letter_hennge.tex`) for the HENNGE Global Internship Program and applied
  light AI/agent-orchestration emphasis edits to `en/01_jakes_clean.tex` (added a Summary
  section, added the Agent Swarm project, sharpened the Tutor-System bullets, added an
  "AI & Agents" skills line, and removed the Codex Account Switcher project). Compiled both
  with Tectonic to upload-ready PDFs in `output/` (`Mohamed_Fuad_Cover_Letter.pdf`,
  `Mohamed_Fuad_CV.pdf`); to keep the CV to one page the Activities section was removed.
  Both PDFs verified at exactly 1 page.
- **2026-06-29 — Finalize/cleanup pass (session: finalize worker).** (1) **JA-translation
  unified** — moved the comprehensive `jaDisplay`/`displayValue`/`displayRole` chain into
  the single `utils/internshipDisplay.js`; `InternshipDashboard.jsx` now imports it and
  the inline duplicate was deleted (ISSUE-002 resolved, ADR-0006). Also fixed the
  `Not stated; PC and transport benefits listed` ordering so it fully localizes (ISSUE-003)
  and a latent Security-role typo. (2) **Stale E2E spec removed** — measured 57 drift
  failures / 2 real passes, deleted `editor/tests/e2e/editor.spec.ts`, added the green
  `editor/tests/e2e/app-smoke.spec.ts` (4/4) for the real dashboard shell (ISSUE-004,
  ADR-0007). (3) **Diagram re-render verified** clean (ELK, no overlaps/crossings).
  (4) Verified: `npm run build` green, `npm run test:e2e` 4/4 green. Committed + pushed.
- **2026-06-29 — Agent KB bootstrap.** Created the `agent/` knowledge base (router +
  architecture, setup, api, components, data, conventions, tests, errors, secrets,
  decisions, state) and `graph/` (real madge dependency graph in `dependencies.json`/
  `.dot`, `graph.md`, D2 `architecture.d2` rendered to `architecture.svg`). Added thin
  root pointers (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/agent-folder.mdc`). Preserved
  legacy `.agents/`, `.workflow/`, `graphify-out/`, `graphify_root`.
- **2026-06-29 — BUG-001 fix.** Track filter returned no results in Japanese mode
  because the track `<select>` options lacked an explicit `value`, so the JA label was
  stored instead of the raw track. Added `value={option}`
  (`editor/src/components/InternshipDashboard.jsx`). Verified via `npm run build`
  (passes) + lint (clean). See `agent/errors.md` BUG-001 and `agent/decisions.md`
  ADR-0005. Recorded open issues: duplicated JA helpers (ISSUE-002), partial
  `Not stated;` translation (ISSUE-003), Playwright spec drift (ISSUE-004).
- **2026-06-29 — Architecture diagram re-rendered (clean ELK layout).** Rewrote
  `agent/graph/architecture.d2` to the clean-layout authoring rules: prepended the
  `vars.d2-config` ELK header (`layout-engine: elk`, `pad: 40`, `center: true`) with
  `direction: down`, and reordered containers into data-flow order (React client →
  Node/Express server → Data & seeds / SQLite store → Tectonic); the standalone LaTeX
  build pipeline is its own column feeding the shared `tectonic` hub at the bottom.
  Same nodes/edges/labels as before — layout only. Title switched from a clipping `md`
  block to a single-line `text` shape. Re-rendered `architecture.svg`; verified via a
  Quick Look PNG: no connector crosses any box and no containers overlap.
