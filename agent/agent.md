# Agent Knowledge Base — Resume (Resume Studio + LaTeX résumés)

Bilingual (EN/JA) résumé project: a React + Node "Resume Studio" web app (`editor/`)
plus a LaTeX résumé build pipeline (`en/`, `ja/` → `output/` PDFs via `build_all.sh`).

**Stack:** React 18 + Vite, Node/Express (ESM), sql.js (SQLite) + Vercel Blob,
Tectonic/XeLaTeX, Playwright, Tailwind. Deployed to Vercel (`editor/api/[...path].js`).

## Read this first, then route

| If the task concerns…                         | Read                         |
|-----------------------------------------------|------------------------------|
| Big picture, both tracks, data flow           | `agent/architecture.md`      |
| Install / run / build (THE build-system file) | `agent/setup.md`             |
| Express routes, seeds, connectors             | `agent/api.md`               |
| React components, hooks, utils                | `agent/components.md`        |
| Data models (internships, resume, tracker)    | `agent/data.md`              |
| Coding style + file/folder placement          | `agent/conventions.md`       |
| Test strategy + how to run                    | `agent/tests.md`             |
| Known bugs, gotchas, fixes                    | `agent/errors.md`            |
| Where keys/URLs/config live (pointers only)   | `agent/secrets.md`           |
| Architectural decisions (ADRs)                | `agent/decisions.md`         |
| Current state + recent changes                | `agent/state.md`             |
| Dependency / impact analysis                  | `agent/graph/graph.md`       |

## Before & after changes
- Before touching a module, check `agent/graph/` (graph.md + dependencies.json/.dot
  + architecture.svg) for who-imports-whom impact analysis.
- After changes, update `agent/state.md` (summary + dated entry) and append an ADR
  to `agent/decisions.md` for notable decisions. Record bugs in `agent/errors.md`.

Legacy/auxiliary (do NOT delete): `.agents/`, `.workflow/`, `graphify-out/`,
`graphify_root` (older coordination + code-structure artifacts).
