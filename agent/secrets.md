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
- `RESUME_STUDIO_DB_BLOB_KEY` (default `resume-studio/resume-studio.sqlite`) — Blob key
  (internal id; user-facing name is Internship Portal).
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
  (see `src/data/firestoreData.js`). The `/api/*` KV/Blob path is retained only for the
  no-auth/E2E case. Export endpoints gained POST variants that take the résumé in the body.
- **Committed Firebase config** (no secrets): `editor/firebase.json`, `editor/.firebaserc`,
  `editor/firestore.rules`, `editor/firestore.indexes.json`. CLI artifacts (`.firebase/`,
  `firebase-debug.log`, …) are git-ignored.
- Firestore security rules: a signed-in user may read/write ONLY `users/{uid}` and its
  subcollections; everything else denied. Deploy with
  `firebase deploy --only firestore:rules` from `editor/`.
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
