# Secrets & config — POINTERS ONLY (never store real values here)

No secrets are committed in source. Configuration is environment-variable driven.

## Where config / secret values live
- `editor/.env.local` — local dev env (git-ignored). Real values go here.
- `editor/.vercel/.env.preview.local` — Vercel-pulled preview env (git-ignored).
- Vercel project settings (dashboard) — client-side env vars (`VITE_*`) only; the
  origin is static (ADR-0040), so no server secrets live there.
- Azure Container App `portal-compile-jp` — server env vars + secrets
  (`az containerapp secret set` / `--set-env-vars`).
- `editor/vercel.json`, `editor/.vercel/project.json` — deploy config (no secrets).

## Environment variables (consumed in code)
Secret / sensitive:
- `GOOGLE_CLIENT_SECRET` (with `GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH_REDIRECT_URI`) —
  Gmail read-only OAuth (`server/gmail/*`). **Secret.**
- `GMAIL_TOKEN_ENC_KEY` — AES-256-GCM key encrypting the stored Gmail token
  (`server/gmail/store.js`). **Secret.**

Retired (do NOT set; no code reads them since ADR-0040 / the Azure move):
`BLOB_READ_WRITE_TOKEN`, `RESUME_STUDIO_DB_BLOB_KEY` — the Vercel Blob path is
gone; durable storage is the Azure Files mount (`RESUME_STUDIO_DATA_DIR=/data`)
with a local better-sqlite3 working copy (`RESUME_STUDIO_DB_WORKDIR`, defaults
to the OS tmpdir — must be real local disk, not the SMB mount).

Configuration (not secret, but environment-specific):
- `PORT` (default `5005`) — Express port (`server/index.js`).
- `RESUME_STUDIO_DATA_DIR` (default `server/.data`) — durable SQLite snapshot dir
  (`/data` mount in prod); `RESUME_STUDIO_DB_WORKDIR` — live working-copy dir
  (see Retired note above for why it must be local disk).
- `TECTONIC_PATH` (default `/opt/homebrew/bin/tectonic`) — LaTeX engine path.
- `OPENROUTER_API_KEY` — OpenRouter API key for AI resume chat and live internship
  research (`server/resume-chat.js`, `server/internship-research.js`). **Secret.**
- `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`) — OpenRouter API base URL.
- `OPENROUTER_MODEL` — model id for chat/research (each connector may append `:online` for
  web search). Defaults are defined in the server modules.
- `RESUME_CHAT_ENGINE` (`local` to force deterministic edits without OpenRouter),
  `RESUME_CHAT_CODEX_TIMEOUT_MS` (default `90000`) — request timeout for resume chat
  (`server/resume-chat.js`). **Codex CLI is obsolete** for chat; OpenRouter is used when
  `OPENROUTER_API_KEY` is set.
- `INTERNSHIP_RESEARCH_TIMEOUT_MS` (default `120000`) — overall research request timeout
  (`server/internship-research.js`). **Codex CLI is obsolete** for research; OpenRouter is
  used when `OPENROUTER_API_KEY` is set.
- `INTERNSHIP_RESEARCH_LINK_TIMEOUT_MS` (default `8000`) — per-link fetch timeout during
  research result validation (`server/internship-research.js`).
- `RESUME_STUDIO_APP_ORIGIN`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` — CORS
  allow-list (`server/index.js`).
- `VERCEL` — set by the platform; toggles ephemeral storage / local mirroring.
- `VITE_API_BASE_URL` — client API base (`src/api/client.js`); default same-origin.
- `CI` — Playwright behavior (`playwright.config.ts`).

## Firebase (auth gate + Firestore) — added 2026-07-03
- Project: **`resume-841f9`** (number `501333131661`). Web app id
  `1:501333131661:web:15135d8b04c44d1c77fdc4`. Firestore db `(default)` in
  `asia-northeast1` (Tokyo). Providers enabled: **Email/Password** + **Google**.
- The Firebase **web config is PUBLIC**, not a secret (apiKey identifies the project;
  access is protected by Firestore rules + authorized-domains, not by hiding it). It is
  intentionally hardcoded as fallbacks in `editor/src/auth/firebase.js` so builds work
  without extra config, and is ALSO mirrored in `editor/.env.local` as `VITE_FIREBASE_*`
  overrides. Committing these values is fine; they are not sensitive.
- `VITE_AUTH_DISABLED=true` bypasses the auth gate (set in `playwright.config.ts`
  webServer env so E2E has no login wall). Do not set in production.
- `VITE_OWNER_EMAILS` (comma-sep, default `flashxjapan@gmail.com`) — accounts seeded from the
  `mohamed_fuad` sample on first login (client-direct Firestore migration, ADR-0015). Not secret.
- Per-user data now lives in Firestore: `users/{uid}/{profiles,trackers,applications}/{profileId}`
  (see `src/data/firestoreData.js`). The `/api/*` KV path is retained only for the
  no-auth/E2E case. Export endpoints gained POST variants that take the résumé in the body.
- **Committed Firebase config** (no secrets): `editor/firebase.json`, `editor/.firebaserc`,
  `editor/firestore.rules`, `editor/firestore.indexes.json`. CLI artifacts (`.firebase/`,
  `firebase-debug.log`, …) are git-ignored.
- **iOS app** — see `agent/ios/setup.md` (Firebase iOS app id + plist rules live there).
- **Before deploying to Vercel:** add the production domain (e.g. the `*.vercel.app`
  alias) to Firebase Auth **authorized domains** (Console → Authentication → Settings),
  else Google sign-in fails with `auth/unauthorized-domain`. `localhost` is already listed.
- The Firebase CLI stores an OAuth token at
  `~/.config/configstore/firebase-tools.json`; if it expires, run `firebase login --reauth`.

## Rules
- Never hardcode tokens; read from `process.env`. Keep `.env.local` and `.vercel/`
  out of git (already git-ignored). Set `OPENROUTER_API_KEY` in `editor/.env.local`
  (local) and in Vercel project settings (production). Without it, resume chat falls
  back to the deterministic local engine and live internship research is disabled.
- Firebase web config values are public and safe to commit (see above); never treat them
  as secrets. No Firebase admin / service-account keys are used yet — do not commit any.
