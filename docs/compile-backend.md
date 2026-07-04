# Live PDF preview — compile backend

The résumé PDF preview needs **LaTeX (Tectonic)** to actually compile. Vercel's
serverless runtime can't run Tectonic, so on the Vercel deployment the preview falls
back to a prebaked sample PDF (it does **not** reflect live edits).

To get a real live preview, run the existing Node/Express server in a **container that
has Tectonic + Japanese fonts**, and point the Vercel frontend at it.

- Root **`Dockerfile`** — Node 22 (Debian trixie) + Tectonic 0.16.9 + Noto CJK fonts,
  runs `editor/server/index.js`. Verified: it compiles all EN/JA templates (JA uses
  Noto Serif/Sans CJK via `RESUME_FONT_PROFILE=linux`).
- Root **`render.yaml`** — a Render Blueprint for one-click deploy.

The frontend already routes every `/api/*` call through `VITE_API_BASE_URL`
(`editor/src/api/client.js`), so pointing it at the container moves the whole backend
there. The compile endpoint already accepts the résumé in the request body, so it
compiles the user's **live** data. Per-user data stays in Firestore (unchanged).

## Deploy (Render, free tier)

1. Push this repo to GitHub (already done).
2. On **render.com** → **New → Blueprint** → connect this repo. Render reads
   `render.yaml`, builds the `Dockerfile`, and deploys a web service. First build
   takes a few minutes (it warms the Tectonic bundle cache). Copy the service URL,
   e.g. `https://internship-portal-compile.onrender.com`.
3. In the **Vercel** project (`editor`) → Settings → Environment Variables, add:
   `VITE_API_BASE_URL = https://internship-portal-compile.onrender.com` (Production).
4. Redeploy the frontend: `cd editor && vercel --prod`.
5. Open the app, edit your résumé — the preview now compiles live. 🎉

> Render's free web service sleeps after ~15 min idle; the first request after a sleep
> cold-starts (~30–60 s). Fine for personal use. Railway / Fly.io / a small VPS work
> the same way (build the Dockerfile, set `RESUME_FONT_PROFILE=linux`, expose `$PORT`).

## Notes

- **CORS**: the server already trusts `https://editor-omega-two.vercel.app`. For a
  different frontend domain, set `RESUME_STUDIO_APP_ORIGIN` on the container.
- **Persistence**: without `BLOB_READ_WRITE_TOKEN` the container uses ephemeral local
  SQLite — the internship catalog re-seeds on boot; custom (researched) companies don't
  persist across restarts. Set `BLOB_READ_WRITE_TOKEN` to share the Vercel Blob store.
- **Fonts**: `RESUME_FONT_PROFILE=linux` swaps the JA templates from Hiragino→Noto Serif
  CJK (Mincho) and Noto Sans CJK (Gothic). Visually near-identical. Local dev (macOS,
  unset) keeps Hiragino. EN templates use default LaTeX fonts (no change).
- **Build/run locally**:
  `docker build --platform linux/amd64 -t portal-compile . && docker run -p 8090:8080 portal-compile`
  then `POST http://localhost:8090/api/compile` with `{template, resume}`.
