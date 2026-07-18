<div align="center">

# Internship Portal

**A bilingual (EN / 日本語) internship tracker, résumé editor, and LaTeX → PDF compiler — on the web and on iOS.**

[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![Swift](https://img.shields.io/badge/SwiftUI_iOS_27-F05138?style=for-the-badge&logo=swift&logoColor=white)](https://developer.apple.com/swiftui/)
[![Node](https://img.shields.io/badge/Node_Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://expressjs.com/)
[![Azure](https://img.shields.io/badge/Server_on_Azure-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/en-us/products/container-apps)
[![Firebase](https://img.shields.io/badge/Auth_+_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

</div>

---

## Overview

One repository, **two products** that share one backend and one user-data store:

| Surface | Tree | Branch | What it is |
|---|---|---|---|
| **Web app** | `editor/` | `web` | React SPA — résumé editor, internship radar, tracker, calendar, LaTeX PDF preview |
| **iOS app** | `ios/` | `ios` | SwiftUI (iOS 27) — the tracker away from a desk: radar, applications, calendar, Gmail sync, notifications |
| **Shared contracts** | `contracts/` | both | The API routes, data shapes, and algorithms **both** clients depend on |
| **LaTeX pipeline** | `en/`, `ja/`, `build_all.sh` | `web` | Standalone print-ready résumé sources → `output/*.pdf` |

Branches integrate through `main`. The rules both teams follow are in
[`CLAUDE.md`](CLAUDE.md); the knowledge bases are [`agent/web/`](agent/web/agent.md)
and [`agent/ios/`](agent/ios/agent.md).

## Architecture

The single most important thing to understand: **user data never touches the
server.** Clients talk to Firestore directly under owner-only rules; the server
owns only shared data (the internship catalog and the Gmail action queue).

```
┌──────────────────────┐          ┌──────────────────────┐
│  Web (React SPA)     │          │  iOS (SwiftUI)       │
│  static on Vercel    │          │  on device           │
└──────────┬───────────┘          └──────────┬───────────┘
           │                                 │
           │  ── user data (client-direct) ──┤
           ▼                                 ▼
     ┌───────────────────────────────────────────────┐
     │  Firebase Auth  +  Firestore                  │
     │  users/{uid}/{profiles,trackers,applications} │
     │  owner-only rules — the server cannot read it │
     └───────────────────────────────────────────────┘
           │                                 │
           │  ── shared data + compute ──────┤
           ▼                                 ▼
     ┌───────────────────────────────────────────────┐
     │  Express server — Azure Container Apps        │
     │  portal-compile-jp (japaneast, always-on)     │
     │    ├─ /api/internships   shared catalog       │
     │    ├─ /api/compile       Tectonic → PDF       │
     │    ├─ /api/integrations/gmail/*  ingest queue │
     │    └─ storage.js  SQLite (working copy)       │
     │             └─ snapshot → /data (Azure Files) │
     └───────────────────────────────────────────────┘
```

**Vercel hosts static files only.** The SPA calls the Azure origin directly via
`VITE_API_BASE_URL`; there is no serverless copy of the server. Azure runs
always-on (`min = max = 1` replica) because live-research jobs hold in-memory
state and the Gmail poller needs a long-lived process.

### Storage: why it looks unusual

`/data` is an **Azure Files (SMB)** mount, and SQLite cannot lock a file over
SMB — opening the database directly there makes every write fail `SQLITE_BUSY`.
So SQLite runs on a **local working copy** (where locking works) and the mount
only ever receives a whole-file `copyFile` of the finished database after each
write. Durability is unchanged; the mount never sees a lock. See ADR-0040 and
`agent/web/errors.md`.

### Gmail ingest

The server reads the inbox, classifies each message, and **queues** actions; the
clients drain that queue into their own Firestore tracker (the server can't).
Internship detection is **evidence-based, never a company list**: the model must
quote the email's own words, and the quote is verified against the message.
Contract: [`contracts/gmail-action.md`](contracts/gmail-action.md).

## Features

**Both clients** — internship radar with match scoring, application tracker
(saved → applying → applied → interview → rejected), calendar of deadlines and
interviews, automatic Gmail ingest, company logos, EN/JA localization.

**Web only** — live résumé editor with a compiled PDF preview, multiple EN/JA
LaTeX templates, AI application assistant, live company research, export to
PDF / `.tex` / `.json`.

**iOS only** — Metal-shaded glass UI (Liquid Glass), the Companies bubble field,
and background app refresh that syncs Gmail and posts a notification with the
company's logo when a new application is detected.

**LaTeX pipeline** — `en/` (Jake's Clean, Awesome-CV, Alta Classic, Slate Modern,
cover letter) and `ja/` (履歴書 grid, 職務経歴書 modern), built by `build_all.sh`
with Tectonic and validated by a PyMuPDF suite.

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Web client | React 18, Vite, hand-written CSS (Tailwind available, migration in progress) |
| iOS client | SwiftUI (iOS 27), Swift 6, Metal, XcodeGen |
| Server | Node.js / Express (ESM) on Azure Container Apps |
| Auth + user data | Firebase Auth, Firestore (client-direct, owner-only rules) |
| Shared data | SQLite (`better-sqlite3`) — local working copy, snapshotted to Azure Files |
| PDF engine | Tectonic (XeLaTeX) |
| LLM | OpenRouter — `gpt-5-nano` (mail triage), `perplexity/sonar` (company research) |
| Testing | Playwright (web), PyMuPDF (PDFs), `validate:catalog` (data + storage) |
| Hosting | Vercel (static SPA) · Azure Container Apps (server) |

## Getting Started

### Web app

```bash
cd editor
npm install
npm run dev          # http://127.0.0.1:5173
```

Runs the SPA and the Express server together (Vite proxies `/api` → `:5005`).

### iOS app

```bash
cd ios
xcodegen generate    # regenerate after adding/removing any file
open InternshipPortal.xcodeproj
```

Requires Xcode 27 (iOS 27 SDK). Signing must stay **on** even for the simulator —
Firebase Auth needs a keychain entitlement. See [`agent/ios/setup.md`](agent/ios/setup.md).

### LaTeX pipeline

```bash
./build_all.sh              # en/ + ja/ → output/*.pdf
python tests/run_tests.py   # validate the compiled PDFs
```

Requires `tectonic` on `PATH`.

## Deployment

**Web client (Vercel)** — static only; pushing to `main` auto-deploys. The API
origin is baked in at build time via `VITE_API_BASE_URL`.

**Server (Azure)** — manual, and *not* triggered by a push:

```bash
az acr build --registry ca7959c48768acr --image portal-compile:<sha> \
  --platform linux/amd64 --file Dockerfile .
az containerapp update -n portal-compile-jp -g internship-portal \
  --image ca7959c48768acr.azurecr.io/portal-compile:<sha>
```

> ⚠️ `portal-compile-jp` (japaneast) is the live app — it holds the Gmail
> connection and queue on its Azure Files mount. Always verify a **write** path
> (`POST /api/integrations/gmail/sync-now` → 200) after deploying, not just a
> read: a storage regression shows up only on writes.

## Repository Layout

```
editor/          # Web app — React SPA + Express server
ios/             # iOS app — SwiftUI
contracts/       # Shared API/data/algorithm contracts (both clients)
agent/web/       # Web knowledge base (architecture, api, decisions, state…)
agent/ios/       # iOS knowledge base
en/  ja/         # LaTeX résumé sources
build_all.sh     # Compile all LaTeX templates → output/
tests/           # PyMuPDF PDF validation suite
docs/            # Deployment + compile notes
CLAUDE.md        # Working rules for both surfaces
DOCTOR.md        # Operating prompt for the code-review account
PLAN-SIMPLIFICATION.md  # Architecture simplification plan + status
```

## Quality

A third **code-doctor** account audits the repo on a schedule and files findings
as `doctor/*` pull requests — React/iOS lint passes, dead-code sweeps, and
(highest value) **contract-conformance diffing** between the two clients'
implementations of the shared algorithms. Both surface teams verify, fix, and
close those PRs. See [`DOCTOR.md`](DOCTOR.md).
