# Setup — build & run (the build-system-specific file)

## Prerequisites
- **Node.js** ≥ 18 (project tested on Node 20).
- **Tectonic** (XeLaTeX engine) for PDF compilation — both the web app and the LaTeX
  pipeline shell out to it. Default path `/opt/homebrew/bin/tectonic` (override with
  `TECTONIC_PATH`). Install: `brew install tectonic`.
- **Python 3** + `PyMuPDF` (`pip install pymupdf`) only for the LaTeX E2E tests.
- (Optional) **d2** for regenerating `agent/graph/architecture.svg`: `brew install d2`.

## Resume Studio web app (`editor/`)

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
All optional for local dev; see `agent/secrets.md` for full pointers.
- `PORT` (default `5005`), `RESUME_STUDIO_DATA_DIR` (default `server/.data`).
- `TECTONIC_PATH` (default `/opt/homebrew/bin/tectonic`).
- `BLOB_READ_WRITE_TOKEN`, `RESUME_STUDIO_DB_BLOB_KEY` — Vercel Blob persistence.
- `RESUME_CHAT_ENGINE` (`local` | default Codex), `RESUME_CHAT_CODEX_TIMEOUT_MS`.
- `INTERNSHIP_RESEARCH_TIMEOUT_MS`.
- `RESUME_STUDIO_APP_ORIGIN`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` — CORS.
- `VITE_API_BASE_URL` (client; default same-origin).

### Deploy
From `editor/`: `vercel`. Client is a Vite build; the Express API is exposed via
`editor/api/[...path].js`. For durable prod writes, connect a Vercel Blob store and
set `BLOB_READ_WRITE_TOKEN` (otherwise writes are ephemeral per cold start).

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
