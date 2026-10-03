# Knowledge base — Internship Portal (web)

The React + Node "Internship Portal" web app (`editor/`): a Japan-first
internship and job tracker. The repo is web-only since 2026-10-03; the iOS app,
the shared `contracts/` layer and the LaTeX résumés moved to
`~/Documents/InternshipPortal-archive`.

**Rebuild in progress.** `docs/rebuild-plan.md` holds the target architecture,
the owner's decisions and the phase list. The files below describe the app as
it stands today, which the plan replaces phase by phase.

**Stack today:** React 18 + Vite, Node/Express (ESM), better-sqlite3 (local working
copy + snapshot to the durable mount, ADR-0040), Firebase Auth + client-direct
Firestore (per-user data), a browser-side PDF parser (pdf.js) for résumé import,
Playwright, Tailwind. There is no LaTeX/Tectonic compile any more (ADR-0042,
2026-09-24). Deployed as a static Vite client on Vercel + the full API in a Docker
container on EC2 (`api.mohamedfuad.com`; the Vercel origin serves NO `/api`).

## Read this first, then route

| If the task concerns…                         | Read                         |
|-----------------------------------------------|------------------------------|
| Big picture, data flow                        | `agent/architecture.md`      |
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
| Rebuild target, decisions, phases             | `docs/rebuild-plan.md`       |
| Dependency / impact analysis                  | `agent/graph/graph.md`       |

## Before & after changes
- Before touching a module, check `agent/graph/` (graph.md + dependencies.json/.dot
  + architecture.svg) for who-imports-whom impact analysis.
- After changes, update `agent/state.md` (summary + dated entry) and append an ADR
  to `agent/decisions.md` for notable decisions. Record bugs in `agent/errors.md`.

