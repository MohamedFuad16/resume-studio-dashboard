# Web knowledge base — Resume (Resume Studio + LaTeX résumés)

Bilingual (EN/JA) résumé project: a React + Node "Resume Studio" web app (`editor/`)
plus a LaTeX résumé build pipeline (`en/`, `ja/` → `output/` PDFs via `build_all.sh`).

**Stack:** React 18 + Vite, Node/Express (ESM), sql.js (SQLite) + Vercel Blob,
Tectonic/XeLaTeX, Playwright, Tailwind. Deployed to Vercel (`editor/api/[...path].js`) + Azure Container Apps (compile/Gmail).

> This is the WEB team's knowledge base. iOS lives in `agent/ios/`; anything both
> clients depend on is contract-bound in `contracts/` — read `contracts/README.md`
> before touching /api routes, tracker/Gmail shapes, Firestore rules, or
> normalization. New here? The split is ADR-S-001 in `contracts/decisions.md`.

## Read this first, then route

| If the task concerns…                         | Read                         |
|-----------------------------------------------|------------------------------|
| Big picture, both tracks, data flow           | `agent/web/architecture.md`      |
| Install / run / build (THE build-system file) | `agent/web/setup.md`             |
| Express routes, seeds, connectors             | `agent/web/api.md`               |
| React components, hooks, utils                | `agent/web/components.md`        |
| Data models (internships, resume, tracker)    | `agent/web/data.md`              |
| Coding style + file/folder placement          | `agent/web/conventions.md`       |
| Test strategy + how to run                    | `agent/web/tests.md`             |
| Known bugs, gotchas, fixes                    | `agent/web/errors.md`            |
| Where keys/URLs/config live (pointers only)   | `agent/web/secrets.md`           |
| Architectural decisions (ADRs)                | `agent/web/decisions.md`         |
| Current state + recent changes                | `agent/web/state.md`             |
| Dependency / impact analysis                  | `agent/web/graph/graph.md`       |

## Before & after changes
- Before touching a module, check `agent/web/graph/` (graph.md + dependencies.json/.dot
  + architecture.svg) for who-imports-whom impact analysis.
- After changes, update `agent/web/state.md` (summary + dated entry) and append an ADR
  to `agent/web/decisions.md` for notable decisions. Record bugs in `agent/web/errors.md`.

Legacy/auxiliary (do NOT delete): `.agents/`, `.workflow/`, `graphify-out/`,
`graphify_root` (older coordination + code-structure artifacts).
