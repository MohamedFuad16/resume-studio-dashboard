# API — Express server (`editor/server/index.js`)

ESM Express app. Mounted locally on `:5005` (Vite proxies `/api` + `/public`), and
on Vercel via `editor/api/[...path].js`. All `/api` writes are size-limited
(`express.json({ limit: '12mb' })`) and validated by `server/validation.js`.
Errors go through `sendRequestError` (400 = validation, 500 = internal).
Client wrappers live in `editor/src/api/client.js`.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | Health + storage backend (`local-sqlite` / `vercel-blob-sqlite` / ephemeral). |
| GET | `/api/resume?profile=` | Read a profile's résumé JSON. |
| POST | `/api/resume?profile=` | Write résumé (validated). |
| POST | `/api/save?profile=` | Back-compat autosave alias for POST `/api/resume`. |
| GET | `/api/profiles` | List known profiles. |
| DELETE | `/api/profiles/:id` | Delete a profile (default `mohamed_fuad` protected). |
| GET | `/api/tracker?profile=` | Application tracker map (internshipId → record). |
| POST | `/api/tracker?profile=` | Replace tracker map (validated). |
| GET | `/api/internships` | `{ items, meta }` — merged internship catalog. |
| POST | `/api/internships` | Add a `live-…` researched internship (id-prefix gated). |
| GET | `/api/internships/custom` | Live-research / custom subset of the catalog. |
| POST | `/api/internships/custom` | Add a custom live internship to the dashboard. |
| POST | `/api/internships/research-company` | Start async company research job → `{ jobId }`. |
| GET | `/api/internships/research-company/:jobId` | Poll a research job (in-memory). |
| POST | `/api/chat/edit` | AI résumé edit from a natural-language instruction. |
| POST | `/api/compile` | `{ template, resume }` → tectonic PDF; returns `pdfUrl`. |
| GET | `/api/compiled/:file` | Serve last compiled PDF (`resume_<lang>_<nn>.pdf`). |
| GET | `/api/export/tex?template=&profile=` | Download populated `.tex`. |
| GET | `/api/export/json?profile=` | Download résumé JSON. |
| GET | `/api/export/pdf?template=&profile=` | Compile + download PDF. |
| GET | `/api/export/ai?profile=` | Download Markdown "job profile" (`buildAIProfile`). |
| GET | `/api/applications?profile=` | List logged applications + generated cover letters. |
| POST | `/api/applications?profile=` | Log an application; generates a cover letter. |
| `/public/*` | static | Seed PDFs etc. (`server/public`). |

Valid compile/export templates (`VALID_TEMPLATES`): `en_01..en_04`, `ja_01..ja_03`
(note: `ja_04` is intentionally not exposed).

## Data sources & seeds
- **Seed catalog**: `seeds/internships.js` (large static dataset, with
  `INTERNSHIP_RESEARCH_DATE` / `INTERNSHIP_RESEARCH_NOTE`) +
  `seeds/japan-wide-research-2026-06-29.js` (23 Japan-first ATS entries).
- **Enrichment**: `seeds/internship-enrichment.js` adds tech-stack / process / JA
  detail overrides at read time.
- **Profiles**: JSON under `server/profiles/` seed the store on first read; runtime
  state lives in the KV store (`storage.js`). Local mirror: `editor/resume.json`.

## External connectors (no secrets — see `agent/secrets.md`)
- **Tectonic** (`TECTONIC_PATH`): child process for LaTeX→PDF (compile/export).
- **Vercel Blob** (`@vercel/blob`, `BLOB_READ_WRITE_TOKEN`): durable SQLite snapshots.
- **Codex CLI** (`resume-chat.js`, `RESUME_CHAT_ENGINE`): AI résumé edits; falls back
  to deterministic local edits.
- **Company research** (`internship-research.js`): async live internship lookup
  (timeout `INTERNSHIP_RESEARCH_TIMEOUT_MS`); jobs held in-memory (lost on restart).
- **MCP** (`server/mcp-server.js`, `register-mcp.js`): optional Model Context Protocol
  surface; not part of the main HTTP API.
