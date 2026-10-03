# Architecture

This describes the app before the 2026-10-03 rebuild. The target architecture is
in `docs/rebuild-plan.md`; sections here get replaced as each phase lands. The
LaTeX résumé pipeline (formerly "Track B") moved to the archive.

## Track A — Internship Portal web app (`editor/`)

A bilingual résumé editor, internship tracker, and LaTeX→PDF compiler. Signed-in
users' data lives client-direct in Firestore (`users/{uid}/**`, CLAUDE.md rule 4);
the Express server holds only the shared catalog, compile, and the Gmail queue.

```
Browser (React 18 + Vite SPA, editor/src)
  │  fetch  /api/*   (vite dev proxy → :5005 locally; the Azure Container App in
  │                   prod via VITE_API_BASE_URL — the Vercel origin is static-only)
  ▼
Express app (editor/server/index.js, ESM)
  ├─ storage.js      → better-sqlite3 KV table `kv` (ADR-0040): live working copy
  │                     on LOCAL disk (RESUME_STUDIO_DB_WORKDIR), snapshotted to
  │                     the durable path after every write
  │                     local: server/.data/resume-studio.sqlite
  │                     prod:  Azure Files mount /data (SMB — no SQLite locking,
  │                            hence the working-copy design; see storage.js header)
  ├─ templates.js    → generateLatex(template, resume) → .tex string
  │                     → tectonic (XeLaTeX) child process → PDF bytes
  ├─ seeds/*         → internship catalog (static dataset, enriched at read)
  ├─ resume-chat.js  → AI "application assistant" (OpenRouter; deterministic local
  │                     edits when keyless or RESUME_CHAT_ENGINE=local)
  ├─ gmail/*         → read-only Gmail OAuth + classify → per-profile action queue
  │                     (clients drain it into Firestore; contracts/gmail-action.md)
  └─ internship-research.js → live company internship lookup (async jobs)
```

### Client data flow
- `App.jsx` is the root: holds `resume`, `template`, `lang`, `autoCompile`, theme,
  sidebar tab (editor vs AI chat), and the top-level view (`dashboard` | `editor` |
  `radar`/internships).
- On load it fetches the active profile's résumé (`/api/resume?profile=…`).
  Form edits (`components/sections.jsx`) update `resume` and **auto-save** (debounced)
  via `/api/save`; when `autoCompile` is on, a debounced `/api/compile` produces the
  live PDF preview.
- `ProfileDashboard` and `InternshipDashboard` read the **internship catalog**
  (`hooks/useInternshipCatalog`) and the **application tracker**
  (`hooks/useApplicationTracker`). Both hooks talk to the Express API and broadcast
  in-tab changes through `window` `CustomEvent`s so multiple components stay in sync.
- Export: PDF / `.tex` / `.json` via `/api/export/*`.

### Server responsibilities
- **Persistence** is a single key→JSON KV store (`storage.js`). Keys: `profile:<id>`,
  `tracker:<id>`, `applications:<id>`, `internships:catalog`, `customInternships`.
- **Catalog merge** (`readInternshipCatalog`): seed dataset (`seeds/internships.js`
  + `seeds/japan-wide-research-2026-06-29.js`) is enriched
  (`seeds/internship-enrichment.js`), validated, then merged with any stored
  live-research / custom entries (dedup by `id`).
- **Compile** (`/api/compile`): builds `.tex` from `templates.js`, runs `tectonic`
  into a temp dir, returns/serves the PDF and mirrors it to `server/public` locally.
- **Validation**: every write goes through `server/validation.js` (size/shape/URL/
  data-URL checks, prototype-pollution guards).

## Diagrams
- Source: `agent/graph/architecture.d2`
- Rendered: `agent/graph/architecture.svg`
- Module dependency graph: `agent/graph/dependencies.json` / `.dot`, summarized in
  `agent/graph/graph.md`.
