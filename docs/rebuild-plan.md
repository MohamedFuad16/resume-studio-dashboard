# Rebuild plan: web-only Internship Portal

Started 2026-10-03. This file is the source of truth for the rebuild until
`agent/state.md` takes over. Hand it to a new session with: "Read
docs/rebuild-plan.md in ~/Documents/Resume-web and continue from the first
open phase."

## Why

The owner stopped the Gmail connectors, the Gmail polling, LLM-driven
internship research and the related views by hand, because they were slow,
expensive and sometimes wrong (a rejection showed up as accepted). The rebuild
keeps the current UI and replaces what sits behind it.

## Decisions (owner, 2026-10-03)

| Topic | Decision |
|---|---|
| Auth | Firebase Authentication only. No Firestore for user data. |
| User data | One database on the EC2 host. Existing Firestore data is migrated once. |
| Job sources | Company job boards (Greenhouse, Lever, Ashby, HRMOS, HERP, Talentio), English job boards, and other major Japan job sites. Per-site method and terms review: `docs/private/` (local only). |
| Scraper limits | Polite rates (about one request per second per host), a contact address in the user agent, ETag caching, and normal HTTP or headless-browser fetches only. No CAPTCHA solving and no bot-detection bypass. A source behind a bot challenge is reached through the research agent's web search instead. |
| LLM | OpenRouter. Primary `google/gemini-3.8-flash` ($0.75 / $3.75 per M tokens), fallback `openai/gpt-6-luna` ($0.10 / $0.50), set as `models: [primary, fallback]` with `require_parameters: true` and low reasoning effort. Prices and structured-output support verified on the public models API 2026-10-03; about $8.64/month at the estimated volume (inferred). |
| Gmail transport | Gmail REST API with incremental history sync, polled every few hours by a server worker. Not MCP. |
| PDF | The server renders the HTML preview to PDF with headless Chromium. |
| iOS | Out of the repo for now. Web first; iOS is rebuilt later. |
| Repo | Single branch `main`. iOS app, `contracts/`, LaTeX résumés and old plan docs move to `~/Documents/InternshipPortal-archive`. |
| UI | Keep the current look. New components follow it; the owner's design library is the reference for additions. |

## Target architecture

```
Browser (React + Vite, current UI)
  │  Firebase Auth for sign-in
  │  REST; every request carries the Firebase ID token
  ▼
API on EC2, Tokyo (Node/Express; firebase-admin verifies the token)
  ├─ SQLite on the EC2 disk (WAL mode, FTS5 search), nightly copy to S3
  ├─ GET  /api/me              everything the dashboard needs, one request
  ├─ GET  /api/jobs/search     plain-English query -> LLM filters -> FTS5 + filters
  ├─ GET  /api/companies/:id   summary, selection steps, why it fits the user
  ├─ /api/applications         CRUD; type = internship | new_grad | full_time
  ├─ /api/calendar             events, including "next selection step"
  ├─ /api/mailboxes            link / unlink several Gmail accounts per user
  └─ /api/documents            tailored résumé or cover letter -> edit -> PDF
Workers (same image, separate process on the same host)
  ├─ collectors   every 6-12 h per source -> normalize -> dedupe -> jobs
  ├─ enricher     LLM company summary + selection process, cached per company,
  │               re-run only when the source page hash changes
  ├─ research     LLM agent with tools (see below), for gaps the collectors miss
  └─ gmail-sync   every 3 h per mailbox, last 30 days by default -> classify -> applications
```

### Research agent (LLM backup for search and enrichment)

The owner's idea, 2026-10-03: when the index cannot answer ("show me
internships at <company>") or a scheduled refresh needs facts the collectors
do not have, an LLM on the EC2 worker does the research itself and returns
structured JSON the app can show.

```
trigger (user search with too few hits · scheduled refresh · new company)
  -> worker builds the system prompt + task + JSON schema
  -> OpenRouter model loop, at most N tool calls:
       web_search(query)   OpenRouter's server-side search tool; returns titles,
                           snippets and URLs from a search provider, so our server
                           does not crawl the site to find a listing
       open_page(url)      headless Chromium on EC2 loads the page, returns its
                           text and JSON-LD; same politeness rules as collectors
  -> JSON validated on the server -> jobs / companies tables -> shown in the app
```

- Both chosen models list native web search on their OpenRouter endpoints
  (research 2026-10-03). Search costs about $0.01 to $0.014 per call on top of
  tokens.
- Every run has a step cap and a token cap, and is logged to `llm_calls`.
- `open_page` follows the scraper limits: no CAPTCHA solving, no bot-detection
  bypass. A page behind a challenge is answered from search results only.
- Unknown: whether web search and strict JSON output work in the same call.
  If not, the agent searches first and structures the result in a second call.

Why this is faster than today: the current dashboard waits on three
Firestore round trips in a row (seed check, profile list, profile) behind a
full-screen spinner, and Gmail results travel server -> queue -> browser ->
Firestore. In the new design the browser makes one request to a server about
20 ms away (measured 2026-10-03 from Tokyo) and paints a cached copy while it
waits.

## Data model (first draft)

- `users` uid, email, name, settings_json, created_at
- `mailboxes` id, uid, email, refresh_token_enc, history_id, window_days (30), last_sync_at, status
- `applications` id, uid, company_id, company_name, role, job_type, status
  (saved / applying / applied / interview / offer / rejected), status_pinned,
  source (manual / gmail), mailbox_id, applied_at, updated_at
- `application_events` id, application_id, kind, at, mailbox_id, gmail_message_id,
  subject, evidence (the quoted text that justified the status, so every
  status can be checked)
- `calendar_events` id, uid, application_id, kind, starts_at, title, source
- `companies` id, name, name_ja, domain, summary_json, selection_steps_json,
  fit_json, source_hash, enriched_at
- `jobs` id, company_id, title, job_type, location, remote, language,
  experience_required, deadline, url, source, source_job_id, first_seen,
  last_seen, active, raw_json; plus `jobs_fts`
- `master_profile` uid, profile_json (extracted once by the LLM from the
  uploaded résumé; not hand-edited), source_file_name, updated_at
- `documents` id, uid, job_id, kind (resume / cv / rirekisho / shokumu_keirekisho /
  cover_letter), lang (en / ja), content_json, created_at, updated_at
- `llm_calls` id, uid, purpose, model, tokens_in, tokens_out, cost_usd, at
  (spend ledger; a monthly cap lives in the env file and only the owner changes it)
- `scrape_runs` id, source, started_at, finished_at, found, added, removed, errors

## Phases

Each phase ends with its check passing and a dated entry in the state file.

### Phase 1: repo cleanup (2026-10-03, ADR-0044)
- Tag the last iOS commit and the pre-cleanup tree on GitHub.
- DONE 2026-10-03: `~/Documents/InternshipPortal-archive` holds the iOS app,
  `contracts/`, the LaTeX pipeline, old plan docs, the uncommitted files from the
  iOS checkout, and a verified git bundle of all 24 refs. See its README.
- Remove them from the repo; flatten `agent/web/` to `agent/`; rewrite
  `CLAUDE.md`, `AGENTS.md`, `DOCTOR.md`, the hooks and `README.md` for one surface.
- Merge `web` into `main`; delete the other branches after the owner confirms.
- Check: `scripts/verify-web.sh` passes; `git branch -r` shows only `main`
  (and the catalog bot branch if kept).

### Phase 2: server foundation
- firebase-admin token check on every `/api` route except health, with each
  query scoped to the caller's uid.
- SQLite schema above, migrations, nightly backup to S3.
- One-time import of the owner's Firestore data (profile, tracker, settings).
- `GET /api/me`; the client switches from Firestore to the API and caches the
  last response for an instant first paint.
- Check: sign-in to dashboard under 1.5 s on a warm session; `/api/me` p95
  under 200 ms on EC2; the auth test suite covers every data route.

### Phase 3: jobs index, company pages, search
- One collector module per source with a shared interface. v1 sources,
  from the 2026-10-03 survey:
  - documented public job-board APIs: Greenhouse, Lever, Ashby;
  - company boards with JSON-LD: HRMOS (has an internship filter), HERP
    company boards, Talentio;
  - Japan Dev (sitemap plus JSON-LD);
  - other job sites, method per site in `docs/private/`;
  - everything else through the research agent's web search.
- A seed list of 50 to 100 Japanese tech companies with their job-board type
  and slug. Found by checking each careers page for a job-board hostname.
- Job type from `employmentType` plus title patterns (インターン, 新卒,
  2[7-9]卒, intern, new grad, junior).
- Normalize to `jobs`, dedupe across sources by company + title + URL.
- Enricher: company summary, selection steps (選考フロー), why it fits the
  user's master profile. Structured JSON, cached.
- Radar search: the LLM turns a query such as "internships with no experience
  needed in AI engineering" into filters; FTS5 runs them. Live web search only
  when the index returns too few results.
- Company page: steps shown in order; "add next step to calendar"; Apply opens
  the official application page and marks the application applied.
- Check: each collector run is logged in `scrape_runs`; search answers in under
  300 ms without the LLM and under 3 s with it.

### Phase 4: Gmail, several mailboxes per account
- OAuth per mailbox, tokens encrypted at rest, tied to the Firebase uid.
- Worker sync every 3 h, last 30 days by default, internship and new-grad mail.
- Classifier returns status, job type and the quoted evidence.
- Accuracy check: label every application email from the owner's two inboxes
  for the last month by hand, run the classifier, fix until it passes.
- Applications view split into internship, new grad and full time.
- Check: zero rejected-as-offer errors on the labeled set; status accuracy at
  least 95 percent; job-type accuracy at least 90 percent.
- Caveat: Gmail read access is a restricted scope. In Testing mode only listed
  test users can connect and tokens expire after 7 days (per Google's OAuth
  docs; re-check before relying on it). Opening it to everyone needs Google
  verification and a yearly security assessment.

### Phase 5: résumé and cover letter
- First upload: the LLM extracts a master profile once; no manual editing of it.
- Per job: "Create a résumé for this role" generates structured JSON (STAR
  bullets) in EN or JA. The AI suggests the format: English résumé or CV, or
  履歴書 plus 職務経歴書 for Japanese companies. Cover letter likewise.
- The user edits the generated document before download.
- HTML template -> headless Chromium on EC2 -> PDF, with Noto CJK fonts in the image.
- Check: EN and JA PDFs render with selectable text and correct fonts; a
  generated document never invents employers, dates or degrees absent from the
  master profile (tested against the owner's profile).

### Phase 6: UI pass, docs, deploy
- New components styled from the owner's design library.
- README rebrand: web-first, useful for any job seeker in Japan.
- Deploy API and worker containers to EC2; client to Vercel; verify served
  bytes against the local build.

## Approval gates (owner's standing rules)

- Any run that spends OpenRouter credits (classifier accuracy runs, enrichment
  of the full catalog, résumé generation tests) is proposed with an estimate
  first and runs only after the owner says yes.
- Pushes, branch deletions and production deploys each need an explicit yes.
- Spend caps change only by the owner's hand.

## Open items

- Who builds the seed company list (50 to 100 companies), and from what: the owner's targets, a ranking, or both.
- Which job sites to contact for a feed or partnership.
- Gemini 3.8 Flash's Japanese score comes from a knowledge benchmark, not business writing or 選考フロー extraction. GPT-6 Luna has no published Japanese score. A small paid comparison (about 30 JA emails and 10 JA cover letters) needs the owner's approval.
- Whether `openrouter:web_search` works together with strict JSON output on these models: one live call will tell.
- EC2 access: AWS CLI session expired on 2026-10-03; access method (SSH or
  SSM) to come from the owner.
- Product name for the rebrand, if it changes.
