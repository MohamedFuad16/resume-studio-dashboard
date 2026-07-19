# API — Express server (`editor/server/index.js`)

ESM Express app. Mounted locally on `:5005` (Vite proxies `/api` + `/public`); in
prod it runs ONLY on the Azure Container App (`portal-compile-jp`) — the Vercel
origin is static-only (ADR-0040). All `/api` writes are size-limited
(`express.json({ limit: '12mb' })`) and validated by `server/validation.js`.
Errors go through `sendRequestError` (400 = validation, 500 = internal).
Client wrappers live in `editor/src/api/client.js`.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | Health + storage backend (`sqlite-snapshot`; persistence probed by a real write, not a label). |
| GET | `/api/resume?profile=` | Read a profile's résumé JSON. |
| POST | `/api/resume?profile=` | Write résumé (validated). |
| POST | `/api/save?profile=` | Back-compat autosave alias for POST `/api/resume`. |
| GET | `/api/profiles` | List known profiles. |
| DELETE | `/api/profiles/:id` | Delete a profile + its `tracker:`/`applications:` keys (protected set is configurable via `RESUME_PROTECTED_PROFILE_IDS`; defaults to the primary `mohamed_fuad`). |
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
  `seeds/japan-wide-research-2026-06-29.js` +
  `seeds/japan-wide-research-2026-06-30.js`, composed by `seeds/catalog.js`.
- **Enrichment**: `seeds/internship-enrichment.js` adds tech-stack / process / JA
  detail overrides at read time.
- **Current audit**: `seeds/catalog-audit-2026-07-02.js` applies exact current-posting
  patches and filters retired IDs from seed and persisted catalog paths.
- **Profiles**: JSON under `server/profiles/` seed the store on first read; runtime
  state lives in the KV store (`storage.js`). Local mirror: `editor/resume.json`.
  Sample profiles in `SAMPLE_PROFILE_IDS` (`mohamed_fuad`, `aiko_tanaka`) are force-seeded
  on boot via `ensureSampleProfiles()` (only when their `profile:<id>` key is missing AND
  `<id>.json` exists) so a fresh DB lists both. New profiles are created by POST
  `/api/resume?profile=<newId>` (no dedicated create route).

## External connectors (no secrets — see `agent/web/secrets.md`)
- **Tectonic** (`TECTONIC_PATH`): child process for LaTeX→PDF (compile/export).
- **OpenRouter** (`resume-chat.js`, `internship-research.js`, `gmail/classify.js`;
  `OPENROUTER_API_KEY`): AI résumé edits, live research, Gmail triage. Deterministic
  local edits when keyless or `RESUME_CHAT_ENGINE=local`.
- **Gmail** (`server/gmail/*`; `GOOGLE_CLIENT_ID`/`SECRET`, `GMAIL_TOKEN_ENC_KEY`):
  read-only OAuth inbox sync feeding the per-profile action queue
  (`/api/integrations/gmail/*` — contract-bound, see `contracts/api.md`).
- **Company research** (`internship-research.js`): async live internship lookup
  (timeout `INTERNSHIP_RESEARCH_TIMEOUT_MS`); jobs held in-memory (lost on restart).
- **MCP** (`server/mcp-server.js`, `register-mcp.js`): optional Model Context Protocol
  surface; not part of the main HTTP API.
