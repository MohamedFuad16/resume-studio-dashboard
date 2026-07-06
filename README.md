<div align="center">

# Resume Studio

**A bilingual (EN / 日本語) résumé editor, internship tracker, and LaTeX → PDF compiler.**

[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![Node](https://img.shields.io/badge/Node_Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://expressjs.com/)
[![LaTeX](https://img.shields.io/badge/LaTeX_(Tectonic)-008080?style=for-the-badge&logo=latex&logoColor=white)](https://tectonic-typesetting.github.io/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

---

## Overview

Resume Studio is a bilingual internship portal (インターンポータル) that combines
three things a job-hunting student actually needs:

1. **A live résumé editor** — edit structured résumé content in the browser and
   see a compiled PDF preview update as you type.
2. **An internship tracker + radar** — browse a catalog of internships and track
   your applications through each stage.
3. **A LaTeX résumé pipeline** — professional, print-ready LaTeX templates
   (English + Japanese) compiled to PDF.

The repository has **two independent tracks** that share the same résumé content.

## Features

### Track A — Resume Studio web app (`editor/`)

- **Live résumé editing** — a React SPA where form edits auto-save (debounced) and,
  with auto-compile on, trigger a debounced LaTeX compile that renders a live PDF preview.
- **Multiple templates** — the app's `templates.js` reuses the design language of
  the LaTeX templates and shells out to the same `tectonic` binary, so an
  in-app résumé produces a PDF consistent with the static sources.
- **Internship radar & tracker** — a browsable internship catalog (seed dataset,
  enriched at read time and merged with live-research / custom entries) plus an
  application tracker that keeps multiple views in sync via in-tab events.
- **AI application assistant** — a résumé chat helper (local heuristics or Codex CLI)
  and live company internship research jobs.
- **Export** — PDF, `.tex`, or `.json` for any résumé.
- **Bilingual** — full English / 日本語 support.
- **Durable persistence** — a single key→JSON KV store backed by `sql.js` (WASM
  SQLite) locally and versioned **Vercel Blob** snapshots in production. Every
  write is validated (size/shape/URL checks, prototype-pollution guards).

### Track B — LaTeX résumé pipeline (root)

- **English templates** (`en/`) — Jake's Clean, Awesome-CV, Alta Classic, Slate Modern, plus a cover letter.
- **Japanese templates** (`ja/`) — 履歴書 (rirekisho) grid and 職務経歴書 (shokumu) modern layouts.
- **One-command build** — `build_all.sh` compiles every template with `tectonic`
  (XeLaTeX) into `output/*.pdf` and prints a pass/fail tally.
- **PDF test suite** — a Python (PyMuPDF) end-to-end suite validating page counts,
  fonts (Mincho vs Gothic), no-italic-CJK, and content accuracy.

## Architecture

```
Track A — Resume Studio web app
  Browser (React 18 + Vite SPA, editor/src)
    │  fetch /api/*  (vite dev proxy → :5005, or Vercel function in prod)
    ▼
  Express app (editor/server/index.js, ESM)
    ├─ storage.js     → sql.js (SQLite) KV, mirrored to Vercel Blob in prod
    ├─ templates.js   → generateLatex(template, resume) → tectonic → PDF bytes
    ├─ seeds/*        → internship catalog (static, enriched at read)
    ├─ resume-chat.js → AI application assistant
    └─ internship-research.js → live company internship lookup (async jobs)

Track B — LaTeX pipeline
  en/*.tex, ja/*.tex ── build_all.sh → tectonic → output/*.pdf
                                          │
                                     tests/ (PyMuPDF E2E)
```

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js / Express (ESM) |
| Persistence | `sql.js` (WASM SQLite) KV, Vercel Blob (versioned snapshots) |
| PDF engine | Tectonic (XeLaTeX) |
| Testing | Playwright (web app), Python + PyMuPDF (LaTeX PDFs) |
| Deploy | Vercel (`editor/api/[...path].js`) |

## Getting Started

### Web app

```bash
cd editor
npm install
npm run dev
```

Open <http://127.0.0.1:5173/?profile=mohamed_fuad>.

### LaTeX pipeline

```bash
./build_all.sh              # compiles en/ + ja/ templates → output/*.pdf
python tests/run_tests.py   # validate the compiled PDFs
```

> Requires a `tectonic` binary on `PATH`.

## Deployment (Vercel)

Deploy from the `editor` directory:

```bash
cd editor
vercel
```

The Vite frontend is built and the Express API is exposed through
`editor/api/[...path].js`. For durable production persistence, connect a Vercel
Blob store and set:

```bash
BLOB_READ_WRITE_TOKEN=...
```

Without that token the Vercel functions still run, but writes are not durable
across deployments / cold starts.

## Repository Layout

```
editor/          # Resume Studio web app (React + Express)
en/              # English LaTeX résumé templates
ja/              # Japanese LaTeX résumé templates (履歴書 / 職務経歴書)
build_all.sh     # Compile all LaTeX templates → output/
tests/           # PyMuPDF PDF validation suite
docs/            # Deployment & compile notes
agent/           # Agent knowledge base (architecture, api, components, …)
```
