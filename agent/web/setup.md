# Setup — build & run (the build-system-specific file)

## Prerequisites
- **Node.js** ≥ 18 (project tested on Node 20).
- **Tectonic** (XeLaTeX engine) for PDF compilation — both the web app and the LaTeX
  pipeline shell out to it. Default path `/opt/homebrew/bin/tectonic` (override with
  `TECTONIC_PATH`). Install: `brew install tectonic`.
- **Python 3** + `PyMuPDF` (`pip install pymupdf`) only for the LaTeX E2E tests.
- (Optional) **d2** for regenerating `agent/web/graph/architecture.svg`: `brew install d2`.

## Internship Portal web app (`editor/`)

```bash
cd editor
npm install
npm run dev      # runs Vite (client, http://127.0.0.1:5173) + Express (server, :5005) together
```

Open `http://127.0.0.1:5173/?profile=mohamed_fuad`.

Other scripts (`editor/package.json`):
- `npm run dev:client` — Vite only (`--host 127.0.0.1`).
- `npm run dev:server` — Express only (`node server/index.js`).
- `npm run build` — production client build (Vite → `editor/dist`).
- `npm run preview` — preview the built client.
- `npm run test:e2e` / `test:e2e:ui` — Playwright E2E (auto-starts `npm run dev`).
  First run requires `npx playwright install chromium`.

The Vite dev server proxies `/api` and `/public` to `http://localhost:5005`
(`editor/vite.config.js`).

### Environment variables (web app)
All optional for local dev; see `agent/web/secrets.md` for full pointers.
- `PORT` (default `5005`), `RESUME_STUDIO_DATA_DIR` (default `server/.data` — where
  the durable SQLite snapshot lives; the Azure Files mount `/data` in prod).
- `RESUME_STUDIO_DB_WORKDIR` — where the LIVE better-sqlite3 working copy opens
  (default: OS tmpdir). Must be real local disk; SQLite locking does not work on
  the SMB mount (ADR-0040 — see `server/storage.js` header).
- `TECTONIC_PATH` (default `/opt/homebrew/bin/tectonic`).
- `RESUME_CHAT_ENGINE=local` forces deterministic edits; default is OpenRouter
  (`OPENROUTER_API_KEY`). `RESUME_CHAT_CODEX_TIMEOUT_MS` is the request timeout
  (legacy name; no Codex CLI involved).
- `INTERNSHIP_RESEARCH_TIMEOUT_MS`.
- `RESUME_STUDIO_APP_ORIGIN`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` — CORS.
- `VITE_API_BASE_URL` (client) — MUST point at the Azure API in prod; the Vercel
  origin is static-only. Same-origin default works only in local dev (Vite proxy).

### Deploy
Client: Vite build served statically by Vercel (`vercel deploy --prod` from the
repo root) — the Vercel origin serves NO `/api`. Server (API + compile + Gmail +
catalog loops): the root `Dockerfile` deployed to Azure Container Apps
(`portal-compile-jp`, RG `internship-portal`, japaneast) with Azure Files mounted
at `/data` (`RESUME_STUDIO_DATA_DIR=/data`). Build with `az acr build --file
Dockerfile .`, then update the container app — see `docs/azure-deploy.md`.

## LaTeX résumé pipeline (repo root)

```bash
./build_all.sh   # compiles en/ 01–04 and ja/ 01–03 with tectonic → output/*.pdf
```

`build_all.sh` reads `TECTONIC=/opt/homebrew/bin/tectonic` and writes PDFs to
`output/`. Edit the `TECTONIC` line if your binary lives elsewhere.

Run the LaTeX test suite (compiles then validates the PDFs):
```bash
python3 tests/run_tests.py
```
