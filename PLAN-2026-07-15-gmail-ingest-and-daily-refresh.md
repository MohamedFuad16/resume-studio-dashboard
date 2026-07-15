# PLAN — Gmail ingest + self-healing daily catalog refresh

**Date:** 2026-07-15 · **Author:** Claude (planning pass; implementation intended for a separate Opus session)
**Branch context:** `feat/design-overhaul-azure-storage` (UI overhaul committed as `7414ac9`, `afe495a`)

This plan covers four asks:
1. Fix the failing daily GitHub Action and make it **self-healing** (verify every catalog company daily with an LLM, update deadlines, auto-remove dead listings, optionally add new ones).
2. **Gmail integration**: user connects Gmail (read-only OAuth) in Settings; the app continuously ingests application-related emails → auto-adds/updates Applications, adds interview dates to Calendar, shows Gmail-source badges.
3. **Model strategy**: which OpenRouter models for search vs. cheap 24/7 triage, with today's pricing.
4. **Slow app load**: diagnosis + fixes.

---

## 0. Current-state findings (verified 2026-07-15, do not re-derive)

### CI (the failing action)
- Workflow: [.github/workflows/validate-catalog.yml](.github/workflows/validate-catalog.yml). Runs on push/PR + daily `0 6 * * *` + manual.
- **Why it fails every day:** the liveness step finds 2 genuinely dead listings and hard-fails by design; nothing ever retires them, so the same failure repeats daily:
  - `https://job-boards.greenhouse.io/harbingermotors/jobs/5164341007` (dead/expired, redirects to not-found)
  - `https://job-boards.greenhouse.io/rocketlab/jobs/7736776003` (same)
- **`OPENROUTER_API_KEY` repo secret is NOT configured** (env shows empty in run logs) → the LLM audit step (`server/audit-catalog-llm.js`, advisory-only) never runs. The user has agreed to set this secret.
- The workflow already files/updates a `catalog-liveness` tracking issue on failure — keep that.

### Catalog data flow (what "update the database" means)
- The radar catalog's **source of truth is a committed seed file**: [editor/server/seeds/internships.js](editor/server/seeds/internships.js) (~170 URLs / ~156 roles, entries have `id, company, role, location, deadline, deadlineDate, url, verifiedDate ('27 Jun 2026'-style), score, priority, …`).
- The sql.js/Blob "DB" holds **per-user** tracker/resume data only, not the catalog. So the daily job updates the catalog by **editing the seed file and committing** (direct commit or auto-PR — see A1).
- `editor/server/validate-catalog.js` = schema + duplicate + DB round-trip + (with `--links`) HTTP liveness. `npm run validate:catalog[:links]` from `editor/`.

### Models (answering "which one is set right now")
- Search model default: **`openai/gpt-5-mini`** — *not* Perplexity. The Settings UI is showing the truth. Search works because [editor/server/internship-research.js](editor/server/internship-research.js) `researchModel()` appends **`:online`** (OpenRouter's Exa web-search plugin) to any slug without `:`.
- Audit model default: **`openai/gpt-5-nano`** (`LLM_AUDIT_MODEL` / `OPENROUTER_AUDIT_MODEL` env override).
- Settings dropdown (`SELECTABLE_MODELS` in [editor/src/components/SettingsPanel.jsx](editor/src/components/SettingsPanel.jsx)) only offers those two; user-chosen values persist via the settings API and reach the server per-request.
- ⚠️ Bug to fix while here: `researchModel()` would turn `perplexity/sonar` into `perplexity/sonar:online` — wrong/wasteful; Perplexity models are natively online. Skip the suffix for `perplexity/*`.

### Load-time (measured)
- Dev SPA after warm cache: DOMContentLoaded ~53 ms — the shell itself is fine.
- `/api/compile` (tectonic LaTeX → PDF for the editor preview) measured **~1.9 s** locally; on serverless it's worse or impossible (no tectonic binary) — biggest single perceived delay when opening the Editor.
- Server boot log shows **Vercel Blob 403 → SQLite fallback**. Per `agent/errors.md` BUG-011 this is the **exhausted Vercel free-tier Blob quota** (2,000 Advanced Requests), *not* a bad token — and per ADR-0032 **prod already runs on Azure Files mounted at `/data`** (`RESUME_STUDIO_DATA_DIR=/data`, container `portal-compile-jp`, pinned to 1 replica per ADR-0019). Local dev just needs the stale `BLOB_READ_WRITE_TOKEN` removed from `editor/.env.local` so boot stops burning the failed Blob round-trip.
- `editor/src/index.css` line 1: render-blocking Google Fonts `@import` chain (4 families).
- Dashboard fires ~40 external icon requests (cdn.simpleicons.org, icons.duckduckgo.com) — visible pop-in, no caching layer.

---

## 1. Model strategy & pricing (researched 2026-07-15)

| Use case | Recommended | Price (OpenRouter) | Notes |
|---|---|---|---|
| **Company/deadline search** (radar research, daily verification, Gmail enrichment) | `perplexity/sonar` | $1/M in · $1/M out · + $5–12/1k search requests ≈ **~0.6–1.3¢/lookup** | Native web search, best accuracy-per-cent for "is this posting still open / what's the deadline". Also a **latency fix**: `agent/errors.md` documents `gpt-5-mini:online` live search at 120–245 s (needed the research timeout raised to 280 s); sonar typically answers in seconds. |
| Search fallback / heavy cases | current `openai/gpt-5-mini:online` | $0.25/$2 per M + Exa **$4/1k results** (5 results default ⇒ ~2¢/req) | Keep selectable; sonar-pro ($3/$15) only if sonar misses. |
| **24/7 cheap triage** (Gmail classification, CI audit "leader") | keep `openai/gpt-5-nano`; alt `google/gemini-2.5-flash-lite` ($0.10/$0.40) or DeepSeek V4 Flash ($0.14/$0.28) | pennies/month at our volume (≤ a few hundred emails/day) | Classification is easy; don't overpay. nano is already wired end-to-end. |

Concrete changes:
- Add `perplexity/sonar` (and `sonar-pro`, `gemini-2.5-flash-lite`, `deepseek/deepseek-chat`) to `SELECTABLE_MODELS`; make **`perplexity/sonar` the new `DEFAULT_SEARCH_MODEL`**.
- Fix `researchModel()` to not append `:online` for `perplexity/*`.
- Show the *effective* slug (with/without `:online`) in Settings so "which model is actually used" is never a mystery again.
- Monthly cost ballpark at expected volume: daily refresh ~170 lookups ≈ $1.5–2.5/mo; Gmail triage < $1/mo; enrichment per new company ~1¢.

Sources: [OpenRouter sonar](https://openrouter.ai/perplexity/sonar) · [sonar-pro pricing](https://openrouter.ai/perplexity/sonar-pro/pricing) · [OpenRouter web-search plugin ($4/1k, Exa)](https://openrouter.ai/docs/guides/features/plugins/web-search) · [Gemini 2.5 Flash-Lite pricing](https://pricepertoken.com/pricing-page/model/google-gemini-2.5-flash-lite) · [LLM price comparisons](https://www.cloudzero.com/blog/llm-api-pricing-comparison/)

---

## 2. Workstream A — Self-healing daily catalog refresh

**Goal:** the daily job verifies every catalog entry, updates deadlines, retires dead listings, and (stretch) adds new ones — instead of failing on the same corpses forever.

### A1 — Auto-retire dead listings (P0)
New script `editor/server/refresh-catalog.js` (run by the schedule branch of the workflow):
1. Run the existing liveness pass programmatically (reuse the checker inside `validate-catalog.js` — export it rather than copy).
2. For each BROKEN/dead-redirect URL: confirm with the search model (`perplexity/sonar`, JSON output): *"Is {company} {role} internship still accepting applications? Return {open: bool, evidenceUrl, deadline?}"*. Two independent signals (HTTP + LLM) → retire.
3. Retire = remove the entry from `seeds/internships.js` **and** append `{id, company, role, retiredAt, reason, evidenceUrl}` to a new `editor/server/seeds/retired.js` (audit trail; also lets the UI show "expired" instead of 404ing saved/tracked roles — tracker records referencing a retired id keep working because recent-apps already falls back to the record itself).
4. Re-run `npm run validate:catalog` as a gate; write the diff summary to `$GITHUB_STEP_SUMMARY`.
5. **Commit path (decision):** default to an **auto-PR** (`peter-evans/create-pull-request`, branch `bot/catalog-refresh`, label `catalog-refresh`) — safe, reviewable, and push-protection-friendly. Optional `AUTO_MERGE=true` env to enable auto-merge once trusted. (Direct commit to main is a one-line switch later.)
6. Keep the failure→issue step for *infra* errors only; a run that successfully self-heals is **green**.

Workflow changes: `permissions: contents: write, pull-requests: write` on the schedule job; add `OPENROUTER_API_KEY` secret (user sets it); split schedule job from push/PR validation job so PR validation never mutates anything.

### A2 — Daily deadline verification/update (P0)
Same script, second pass over entries where `deadlineDate` is within 14 days, is null with `deadline: 'Not stated'`, or `verifiedDate` > 21 days old:
- Ask sonar for current status/deadline; update `deadline`, `deadlineDate`, `verifiedDate` on change.
- Batch with concurrency ≤ 4 and a per-run budget cap (`MAX_LLM_CALLS`, default 200) so cost is bounded.

### A3 — Discover & add new listings (stretch, behind a flag)
- Reuse `internship-research.js`'s search prompt per target company list (`seeds/catalog.js` companies + user-tracked companies) to find *new* postings; validate against the entry schema; dedup by `(company, role)` slug; cap adds (≤10/run); adds go into the same auto-PR. Never auto-merge adds initially.

**Acceptance:** after merging, day-1 run opens a PR retiring harbinger/rocketlab entries and the scheduled run goes green; a listing whose deadline changed on the company site is updated within 24 h.

---

## 3. Workstream B — Gmail integration

### Architecture reality check
"Gmail MCP" — MCP servers fit desktop/agent tooling, not a multi-user production backend. For an in-app, always-on feature the right shape is the **Gmail REST API with server-side OAuth** (`gmail.readonly`), synced by our own scheduler. Same outcome the user wants; supportable 24/7 even when the browser is closed.

### ⚠️ The one hard constraint to accept up front
`gmail.readonly` is a **restricted scope**:
- **Testing mode** (what we'll start with): up to 100 test users, consent screen shows a warning, and **refresh tokens expire every 7 days** → the app must show a "reconnect Gmail" banner weekly. Fine for personal use now.
- **Production for real users** requires Google verification (+ CASA security assessment; weeks + potentially $). Decide only if this becomes multi-user.
- Cheap escape hatch if verification is ever unacceptable: an app-owned ingest address (user auto-forwards application emails; no OAuth at all). Design the pipeline so the *source* (OAuth sync vs forwarded mail) is pluggable.

### B1 — OAuth connect (Settings)
- GCP project + consent screen (External/Testing) + web OAuth client. Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GMAIL_TOKEN_ENC_KEY` (32-byte).
- New server module `editor/server/gmail/oauth.js`; routes in `server/index.js`:
  - `GET /api/integrations/gmail/auth-url` (uid-bound `state`, PKCE) → `GET /api/integrations/gmail/callback` (exchange, encrypt+store) → `GET /status` → `POST /disconnect` (revoke + delete) → `POST /sync-now`.
- Token storage: AES-256-GCM-encrypted refresh token per Firebase uid, in Firestore `users/{uid}/integrations/gmail` (fits the existing `users/{uid}` scaffold in [editor/src/data/userProfile.js](editor/src/data/userProfile.js); rules: owner-only, and tokens only ever decrypted server-side).
- Settings UI card "Connect Gmail": connect button → popup flow; connected state shows address, last sync, toggles (`auto-add applications`, `auto-add interview dates`), disconnect; the 7-day-expiry reconnect banner.

### B2 — Sync engine (24/7)
- **Baseline: polling** every 5 min per connected user: `history.list` from stored `historyId` (cheap incremental; on 404-stale fall back to `messages.list q="newer_than:2d category:primary"`); store new baseline.
- **Where it runs:** the Azure Container App `portal-compile-jp` — already the blessed always-on runtime (pinned to exactly 1 replica per ADR-0019, which also makes a naive in-process cron safe: no duplicate-sync races). A `node-cron` loop in `server/index.js` works even when the user is logged out. (Vercel serverless alternative: `vercel.json` crons hitting `/api/internal/gmail-sync` with a shared secret. Implement the loop as a callable function so both work.)
- **Upgrade path (optional):** Pub/Sub push via `users.watch` — remember watches expire ≤7 days and must be renewed daily by cron ([Gmail push guide](https://developers.google.com/workspace/gmail/api/guides/push), [renewal gotchas](https://www.unipile.com/gmail-api-push-notifications/)). Not required for v1; polling at our volume is free-tier trivial.
- Idempotency: `processedMessageIds` per uid (capped ring buffer in the store); every action records `sourceMeta.gmailMessageId`.

### B3 — Classification → action pipeline (`server/gmail/classify.js`, `apply.js`)
Per new message (headers + text part, truncated ~4k chars) → **triage model** (`gpt-5-nano`, JSON schema):
```json
{ "isApplicationRelated": bool, "kind": "applied|rejected|interview|offer|other",
  "company": str, "role": str|null, "interview": {"date":"YYYY-MM-DD","time":"HH:mm"|null}|null,
  "confidence": 0-1 }
```
Then match against tracker records (`useApplicationTracker` data via the server store): normalized company+role fuzzy match.
- **Match found:** `applied` → status `applied`; `rejected` → status `rejected`; `interview` → status `interview` + `addMilestone({kind:'interview', date, time, timeZone:'Asia/Tokyo'})` (shape already supported — see [editor/src/hooks/useApplicationTracker.js](editor/src/hooks/useApplicationTracker.js)). Never downgrade (e.g. interview → applied).
- **No match ("not covered"):** enrich via search model (sonar): official posting URL, location, deadline → create a tracker record `status:'applied', source:'gmail'` (+ optionally a radar catalog *candidate* — candidates go to the A3 auto-PR, not straight into seeds).
- `confidence < 0.75` or `auto-apply` toggle off → land in a **review queue** (`users/{uid}/gmailSuggestions`) surfaced in the Applications view ("From Gmail — confirm?") instead of silent writes. Default ON for the queue in v1; flip to full-auto once trusted.

### B4 — UI: badges & provenance
- Tracker records gain `source: 'web'|'gmail'` + `sourceMeta` + `unseenFromGmail` flag (set on create/update by sync, cleared when the Applications view mounts).
- Gmail glyph (inline SVG, like the GitHub/LinkedIn marks in `ProfileDashboard.jsx`) on rows in **Applications** and Dashboard "Recent applications", with tooltip "Added from Gmail · {date}".
- Sidebar `side-badge` on **Applications** = count of unseen Gmail-sourced changes (NAV badge logic already exists for dashboard count in `App.jsx` — extend, never show 0).
- Calendar entries created from email get the same provenance in their milestone `title`.

**Acceptance:** connect Gmail in Settings; send yourself a "thank you for applying to X" test email → within 5 min an `applied` record for X exists (badge visible, Gmail glyph, enriched URL/deadline); an interview email with a date creates the calendar milestone; disconnect removes tokens and stops sync.

---

## 4. Workstream C — App load-time fixes (ordered quick wins)

1. **Stop the dead Blob round-trip in dev:** prod already uses Azure Files (ADR-0032); the local 403 is the exhausted Blob quota (BUG-011). Remove `BLOB_READ_WRITE_TOKEN` from `editor/.env.local` (and consider deleting the Blob path from `storage.js` once Azure is fully trusted) so cold boots stop paying for a guaranteed-failing call.
2. **Fonts:** replace the render-blocking `@import` (index.css:1) with `<link rel="preconnect">` + `<link rel="stylesheet" media="print" onload>` swap in `index.html`, or self-host WOFF2 for Inter/Noto Sans JP only (drop Instrument Serif/Noto Serif JP if unused).
3. **Editor PDF compile (~1.9 s):** show the editor instantly and compile lazily (already partially true); cache last PDF per (resume-hash, template) server-side; on serverless, gate `/api/compile` behind a capability check so it fails fast with a clear message instead of hanging.
4. **Icon pop-in:** proxy/cache company logos + tech icons through the server with long-lived cache headers (or at least `loading="lazy"` + fixed dimensions everywhere — partially done).
5. Code-split the editor sections/`pdf.js` (dynamic import on editor open) so dashboard-first loads don't pay for them.

---

## 5. Rollout order & effort

| Phase | Contents | Effort |
|---|---|---|
| 1 | A1+A2 (self-healing action) + model strategy changes + set `OPENROUTER_API_KEY` secret | ~1 day |
| 2 | B1 OAuth connect + B2 polling sync (Azure cron) | ~1–2 days |
| 3 | B3 pipeline + B4 badges + review queue | ~2 days |
| 4 | C perf batch, A3 discovery, optional Pub/Sub push | opportunistic |

## 6. Open questions for the user (answer before/while implementing)
1. Catalog changes: auto-PR (recommended default) or direct commit to main?
2. Gmail actions: start with review-queue-then-apply (recommended) or full-auto from day one?
3. Multi-user ambition: if yes eventually, budget for Google restricted-scope verification (CASA) — or accept the forwarding-address fallback for non-owner users.
   (24/7 host is already answered by the repo: the single-replica Azure Container App per ADR-0019/0032.)

## 7. Explicitly out of scope here
- CV file storage in the Profile view (separately deferred).
- Migrating per-user data to Firestore (existing ADR keeps sql.js/Blob for now).
