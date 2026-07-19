# Architecture

The repo has **two independent tracks** that share the same résumé content.

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

## Track B — LaTeX résumé pipeline (root)

Static LaTeX sources compiled to PDFs, independent of the web app.

```
en/*.tex   (4 English templates: Jake's, Awesome-CV, Alta, Slate)
ja/*.tex   (Japanese 履歴書 / 職務経歴書 templates)
   │  build_all.sh  → tectonic (XeLaTeX) per file
   ▼
output/*.pdf        (compiled artifacts)
tests/              → Python (PyMuPDF) opaque-box E2E suite over the PDFs
```

`build_all.sh` compiles EN 01–04 and JA 01–03 with `tectonic`, copies results into
`output/`, and prints a pass/fail tally. The `tests/` suite (see `agent/web/tests.md`)
validates page counts, fonts (Mincho vs Gothic), no-italic-CJK, and content accuracy.

### Where the two tracks meet
The web app's `templates.js` reuses the design language of the LaTeX templates and
shells out to the same `tectonic` binary, so a résumé edited in the app produces a
PDF consistent with the static `ja/` and `en/` sources. The internship-radar feature
is web-app-only.

## Diagrams
- Source: `agent/web/graph/architecture.d2`
- Rendered: `agent/web/graph/architecture.svg`
- Module dependency graph: `agent/web/graph/dependencies.json` / `.dot`, summarized in
  `agent/web/graph/graph.md`.
