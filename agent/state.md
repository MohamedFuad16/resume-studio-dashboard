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
