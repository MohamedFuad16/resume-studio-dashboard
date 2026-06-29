# Secrets & config — POINTERS ONLY (never store real values here)

No secrets are committed in source. Configuration is environment-variable driven.

## Where config / secret values live
- `editor/.env.local` — local dev env (git-ignored). Real values go here.
- `editor/.vercel/.env.preview.local` — Vercel-pulled preview env (git-ignored).
- Vercel project settings (dashboard) — production env vars + Blob store binding.
- `editor/vercel.json`, `editor/.vercel/project.json` — deploy config (no secrets).

## Environment variables (consumed in code)
Secret / sensitive:
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write token (durable SQLite snapshots,
  used in `server/storage.js`). **Secret.**

Configuration (not secret, but environment-specific):
- `PORT` (default `5005`) — Express port (`server/index.js`).
- `RESUME_STUDIO_DATA_DIR` (default `server/.data`) — local SQLite dir.
- `RESUME_STUDIO_DB_BLOB_KEY` (default `resume-studio/resume-studio.sqlite`) — Blob key.
- `TECTONIC_PATH` (default `/opt/homebrew/bin/tectonic`) — LaTeX engine path.
- `RESUME_CHAT_ENGINE` (`local` to force deterministic edits; otherwise Codex CLI),
  `RESUME_CHAT_CODEX_TIMEOUT_MS` (default `90000`) — `server/resume-chat.js`.
- `INTERNSHIP_RESEARCH_TIMEOUT_MS` (default `120000`) — `server/internship-research.js`.
- `RESUME_STUDIO_APP_ORIGIN`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` — CORS
  allow-list (`server/index.js`).
- `VERCEL` — set by the platform; toggles ephemeral storage / local mirroring.
- `VITE_API_BASE_URL` — client API base (`src/api/client.js`); default same-origin.
- `CI` — Playwright behavior (`playwright.config.ts`).

## Rules
- Never hardcode tokens; read from `process.env`. Keep `.env.local` and `.vercel/`
  out of git (already git-ignored). The `resume-chat`/`internship-research` connectors
  rely on a locally authenticated Codex CLI, not on committed API keys.
