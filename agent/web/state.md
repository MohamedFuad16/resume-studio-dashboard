# Project state

## Current state summary
Two-track résumé project. **Track A — Internship Portal** (`editor/`): React 18 + Vite
client and an ESM Node/Express server with a better-sqlite3 KV store (local working
copy + snapshot to the durable path per write, ADR-0040; prod durability = the Azure
Files mount `/data`), Tectonic-based LaTeX compile, an internship radar/tracker, an
application calendar, a Gmail→tracker ingest pipeline, and an AI application
assistant (OpenRouter). Signed-in users' data lives client-direct in Firestore
`users/{uid}/**` (project `resume-841f9`, owner-only rules); the server KV holds
only the shared catalog, the Gmail queue, and the no-auth/E2E path. Prod topology:
Vercel serves the static client (portal.mohamedfuad.com); ALL `/api` runs on Azure
Container Apps `portal-compile-jp` (japaneast) via `VITE_API_BASE_URL`. **Track B**:
static LaTeX résumés (`en/`, `ja/`) compiled by `build_all.sh` to `output/`.
(The 2026-07-03 overhaul-plan status that used to sit here described the
feat/firebase-auth-firestore rollout, long since merged and deployed — see the
dated entries below for history.)

## Recent changes

- **2026-07-19 (later) — README rewritten; W3 foundation laid; W4 spiked and deferred.**
  README documented a system that no longer exists (Vercel serverless + Blob, no iOS
  app, no Azure, no Firestore, no contracts); rewritten around what actually runs,
  including WHY storage looks unusual (SQLite cannot lock on SMB).
  **W3:** Tailwind emitted with `preflight: false` and the design tokens mapped onto
  the existing CSS variables, so utilities follow the theme switch — verified in the
  built bundle (`.bg-panel{background-color:var(--panel)}`), build green, before/after
  screenshot identical. Migration loop documented in PLAN-SIMPLIFICATION.md; ~8.3k CSS
  lines remain and `.auth-*` is the suggested first target (renderable without signing
  in, so parity is directly checkable).
  **W4:** measured, not assessed — Typst compiles a ported EN résumé cleanly and
  handles CJK, but is ~3.6x faster here (1.90s → 0.52s), NOT the 10–100x the plan
  claimed (corrected). Deferred against 8 template rewrites on the documents that
  produce real résumés. Evidence: docs/typst-spike.md.
  NB a Playwright run showed 5 failures purely because a dev server held port 5173;
  with it stopped, 5/5 pass. Not a regression.

- **2026-07-19 — W1+W2 SHIPPED on the second attempt (ADR-0040).** SUPERSEDES the
  "attempted, REVERTED" entry below — that rollback was real, but the conclusion
  ("native SQLite is impossible here") was too broad. What is impossible is opening
  the DB *directly on the mount*: SQLite needs fcntl locks and SMB has none. Running
  the engine on a LOCAL working copy and snapshotting the finished file to the mount
  avoids locking entirely — the same property that made sql.js survive. Shipped and
  verified in prod (revision 0000016): `storage: sqlite-snapshot`, 172 roles,
  `sync-now` HTTP 200 (the call that 500'd before), zero lock errors, mount file
  updating. Production DB backed up first. W1 rode along: Vercel is static-only,
  `@vercel/blob` + `sql.js` removed.
- **2026-07-19 — W1+W2 attempted, REVERTED (Azure Files can't do SQLite writes).**
  Swapped `storage.js` to native better-sqlite3 on the `/data` mount + made Vercel
  static-only. Reads worked in prod but every WRITE failed `SQLITE_BUSY` — SQLite
  file-locking is unsupported on the Azure Files **SMB** share (sql.js was immune
  because it rewrites the whole file, no locks). Rolled `-jp` back to `ac9b309`
  (writes restored, verified) and reverted commit `b9fedf2`; `main` == prod, no
  data lost, prod DB backed up. Full root-cause + the correct future approach
  (better-sqlite3 on a LOCAL path + snapshot to the mount) in `agent/web/errors.md`.
  **Owner decision (2026-07-19): keep sql.js, W2 closed** — the engine works on the
  SMB mount and its only cost is the WASM dep; W2's benefit didn't justify the
  local-path+snapshot complexity. W1 (Vercel static-only) is available as an
  optional standalone cleanup if wanted. Remaining plan items: W3 (Tailwind), W4
  (Typst, optional).
- **2026-07-19 — W5: enrich known-but-sparse companies (ADR-0039).** Merged the
  07-19 `ios` work into `main` (only conflict: `contracts/CHANGELOG.md`, resolved
  keeping both; my ADR-0038 work preserved) — brings `DOCTOR.md`,
  `PLAN-SIMPLIFICATION.md`, CLAUDE.md rule 6 (doctor PRs). Then the first plan
  item, **W5**: `sync.js` no longer skips `enrichCompany` for a company that only
  has a sparse tracker record — it skips only when details are already resolvable
  (catalog listing, or a tracker record with an `applyUrl`). A bare Gmail-created
  row (LAPRAS) now gets its url/location/deadline filled. `knownCompanyNames`→
  `resolvableCompanyNames`; server-only (takes effect on the Azure `-jp` deploy).
  Remaining web plan items: W1 (strip Vercel serverless/Blob), W2
  (sql.js→better-sqlite3), W3 (Tailwind migration, ongoing), W4 (Typst, optional).
- **2026-07-18 (ios→main merge + contract action items) — ADR-0038.** Merged the
  `ios` branch into `main` (clean fast-forward, per HANDOFF-WEB.md): the `agent/`
  KB split into `agent/web/` + `agent/ios/`, the new `contracts/` shared-surface
  layer, the iOS app, and server-side Gmail fixes (quote-grounded evidence-based
  internship detection in `classify.js`, ISO-8601 `receivedAt` in `sync.js`).
  Now on the new `web` working branch (no more direct commits to `main`). Then
  the four web action items from `contracts/CHANGELOG.md`: (1) **canonical
  company key** — one JA+EN-suffix normalizer in `reapplyCooldown.js`
  (`normalizeCompany`/`companySlug`), imported by `useGmailInbox.js` so they
  can't drift; `"Acme, Inc."`/`"Acme Co., Ltd."`/`"Acme"` → `acme`, `Cisco`/
  `Costco` protected, CJK kept. (2) **validation.js** — `TRACKER_KEY` regex
  accepts CJK ids (was 400ing the whole KV save); `applyUrl` sanitized at ingest
  (`http`→`https`, junk dropped) instead of throwing. (3) web had no company-name
  filters to retire (`roleFilter.js` is already inclusive/no-hardcoded). (4)
  `.dockerignore` now excludes `ios`/`contracts`; `docs/azure-deploy.md`
  corrected — **`portal-compile-jp` (japaneast) is the LIVE app** (holds the
  Gmail queue on Azure Files); `portal-compile` (westus2) is not. Build + 5/5
  E2E green; normalizer + validation unit-checked. **User to verify Vercel
  `VITE_API_BASE_URL` points at `-jp`.**
- **2026-07-18 (later) — Radar table spacing overhaul + tracker save debounce.**
  (1) Radar list de-cluttered: MapPin/Globe2 icons removed from row location/language
  cells (text only; secondary lines muted `#93a0b0`); grid re-proportioned in **all
  five** `.intern-table-head`/`.intern-row` definitions (base + 1450/1250/1050 media)
  to `40px minmax(0,2.4fr) 64px 1fr 1fr .75fr .85fr 100px 62px 32px`, gap 14, rows
  88px min. Header↔content alignment made exact: company header `padding-left: 46px`
  (34px logo + 12px gap), rank centered in both head and cell — JS-measured
  pixel-perfect (all 10 column x-positions equal; header text x 383 = name x 383).
  (2) `useApplicationTracker.commit` now **150ms trailing-debounced**: a Gmail drain
  applying N actions used to fire N sequential full-tracker POSTs (10 observed);
  every commit carries the complete snapshot so collapsing to the last one is
  lossless. Verified: 3 rapid toggles → exactly 1 POST. Triple sync-cycle at load is
  dev-only StrictMode double-mount, not a bug. Build + 5/5 E2E green; mobile 390px
  radar verified no-overflow.
- **2026-07-18 — Web UI polish batch (dashboard/radar/calendar/editor/mobile).** Branch
  rebased onto latest main (which already had `a371e34` lazy-compile/tracker-cache/phone-
  radar-grid). (1) Dashboard trend chart → smooth **line/area** chart (Catmull-Rom + GSAP
  draw-in), not bars; Recent apps drop freelance/gig records via new `utils/roleFilter.js`
  (`isGigRole`). (2) `CompanyLogo`: hi-res favicons (Google s2 sz=128 ≈114px) for curated
  domains, DDG fallback kept — fixes blurry Rakuten/etc. (3) Calendar date badges → **black
  chips** (today red); mobile month view compact. (4) Radar: tech-stack tags under each
  listing's role (where `techStack` exists; `resolveTechIcon`). "checked <date>" already
  correct locally (17 Jul); prod "Jul 2" was stale redeploy. (5) Editor: **section rail
  collapses** to an icon strip (persisted `railOpen`); compile **content-hash cache**
  (template+resume JSON) → identical recompile 2.05s→0.003s; debounce 700→400ms; education
  end-date/Expected pill aligned; bullet delete = clean full-height button. (6) Mobile: top
  nav fits ≤560px, editor stacks (rail-collapse neutralised ≤980 via `.editor-view`
  specificity), calendar compact. Verified in-browser at 390px; build green.
- **2026-07-16 (eve) — Performance + UI bug pass (ADR-0037, BUG-016/017/018).** Pulled
  origin/main into `ios-local` (merge commit; only `agent/state.md` conflicted). Fixes:
  LaTeX compile now lazy (only in the Editor view — a dashboard load no longer POSTs
  /api/compile); `useApplicationTracker` got a module-level per-profile cache +
  in-flight dedupe (6 → 1 tracker GET per load); `readInternshipCatalog` 60 s in-process
  memo (was rebuilding + double-stringifying the catalog per request); Vite manualChunks
  split the 1.18 MB bundle into react/firebase/ui vendor chunks; deadline coral now
  urgent-only; JA leaks mapped (Occasional hiring, Remote in USA/Canada, SpaceX site);
  phone-width radar rows re-gridded (company was ~80px wide; the ≤560px grid was dead —
  overridden by a later ≤860px grid). Build green, E2E 5/5, verified in-browser at
  375/1366px in EN+JA.
- **2026-07-16 (pm, round 3 — user feedback).** Drawer head is
  `logo | title | status select | score | close` — status sits beside the match %
  (`.intern-status-head`; the round-2 `.intern-status-top` row was removed; wraps to its
  own row ≤560px via explicit grid placements). Radar summary strip: outer border removed
  (`border: 0` on the 4236-area override). Calendar week view: today badge is a pill
  (fixed 26px circle overflowed the "Jul 16" label).
- **2026-07-16 (pm, round 2 — user feedback).** Radar: header "Tune my resume" button
  dropped (summary CTA is the only one); sort select sits beside the search bar again;
  `.intern-workspace` is borderless/full-width (no card box around the table). Drawer:
  width 470→560px so meta chips fit; the STATUS select moved to the TOP (row under the
  meta chips, `.intern-status-top`), out of the bottom actions. Trend chart re-proportioned
  (W640/H224, slimmer bars cap 34, radius 9, smaller count chip + softer shadow). Calendar
  overflow fix: `.calendar-view .calendar-days` rows were `minmax(0,1fr)` so 2+ event
  pills spilled out of short cells → `minmax(min-content,1fr)` (row grows, view scrolls).
- **2026-07-16 (pm) — GSAP charts, pill design standard, shared detail drawer.**
  (1) `gsap` added (editor dep). `DashboardCharts.jsx`: trend bars are now flat-bottomed
  paths (rounded top only) so they sit on the axis, GSAP staggered grow-in + donut sweep;
  tweens carry a setTimeout fail-safe (`progress(1)`) because throttled/background rAF can
  freeze them, and cleanup uses kill+clearProps (never `context.revert`, which froze bars
  mid-flight under React re-renders). Don't tween elements with an SVG `transform=` attr —
  GSAP clobbers it (peak-count chip). (2) Dashboard: resume-readiness ring REMOVED; hero's
  3rd column is now the Status-breakdown donut (`.profile-breakdown`); analytics row =
  Application trend + Tokyo opportunities side by side, borderless `.analytics-card`s;
  Tokyo section removed from below Projects. (3) **Pill radius (999px, Applications-tab
  style, navy `#18243a` active fill) is the app-wide control standard** — radar toolbar
  rebuilt: search alone on row 1, filter pills + SORT select on row 2; removed
  Filters-label chip, Priority toggle, All-statuses select (and their state); summary CTA
  is now "Tune my resume" (was Review priority list); `tracked applications` label no
  longer wraps (summary grid `repeat(4,auto) 1fr` + nowrap). (4) `DetailPanel` exported
  from `InternshipDashboard.jsx` and opened by clicking company names in ApplicationsView
  AND dashboard Recent applications (`.application-company-trigger`); panel guards
  synthetic Gmail records (no score/url/fitNote/source); `--intern-*` CSS vars are now
  declared on `.intern-detail` too (they were radar-scoped, drawer rendered unstyled
  outside it). Drawer: +top padding, tech-stack chips show brand icons via
  `resolveTechIcon` — whose substring matching is now word-bounded ("agenTS"→TypeScript,
  "sourCe"→C false hits fixed). (5) ProfileView skills grouped
  (Languages/Frameworks/Tools). Build green; verified in browser on :5176
  (`client-noauth` launch config added).
- **2026-07-16 — Dashboard analytics + calendar tooltip fix + Gmail internships-only +
  CJK company names (commits `b4095c2`, `f231e60`).** (1) Dashboard (CRM-reference design):
  analytics row under the pipeline strip — monthly "Application trend" bars (hatched
  de-emphasis, peak month accent + value chip; Gmail records bucket by email receivedAt
  from sourceMeta) + "Status breakdown" donut (center total, legend counts; palette
  dataviz-validated); readiness ring rebuilt as a thick masked conic donut; Tokyo
  opportunities moved below Projects as a 4-card row (right rail deleted). New
  `components/DashboardCharts.jsx` (plain SVG). (2) Calendar tooltip bug root cause:
  `.calendar-view .calendar-day{overflow:hidden}` clipped the hover card; also removed the
  duplicate native title, added data-col/row placement (flip below on row 0, pin on edge
  cols), hover z-index. (3) Gmail: classify emits `isInternship`; sync drops
  freelance/gig/annotation/part-time applications (micro1 "AI interview" + Turing "LLM
  Trainer" gigs removed from the local tracker; the user must delete them from prod
  Firestore via the UI if drained there). (4) CJK-aware norm/slug (株式会社カナリー was
  silently dropped; 株式会社ABEJA now matches catalog ABEJA). All shipped: Vercel prod +
  Azure image `portal-compile:f231e60`. Build green, E2E 5/5, verified in-browser
  (dashboard, tokyo row, calendar tooltip).
- **2026-07-16 — Gmail pipeline hardened via a REAL 90-day inbox audit (commits `0007973`,
  `46e89ea`, `4ed7638`; BUG-012/013/014).** Ran the full backfill three times against the
  real inbox (local server, same Gmail account as prod). Results: 12 companies auto-tracked
  with accurate kinds — 6 rejected (incl. JA 選考結果/ご応募のお礼-with-rejecting-body
  patterns), 3 interview (Rakuten Codility test invite correctly counted), 3 applied;
  interview milestones extracted w/ date+time; catalog matches carried real URLs. Fixes
  from the audit: (1) missing OPENROUTER_API_KEY now surfaces as `{skipped:'no-llm-key'}`
  instead of silently consuming messages (prod ran keyless!); backfill ignores the processed
  list. (2) Known companies (catalog OR tracker) skip the sonar search — user rule: update
  the dashboard record, never re-research. Verified: re-run queued 0 enrichments. (3)
  Calendar milestones dedupe (deterministic gmail-<msgId> id + content match) — verified: a
  full re-drain added 0 duplicates. (4) Statuses are monotonic across drains (nano
  flip-flop on Turing's "Next steps" email downgraded interview→applied once — now
  impossible). Prod: Azure on `portal-compile:46e89ea` (rev `--0000005`), frontend
  redeployed to portal.mohamedfuad.com (3×). **STILL BLOCKED: prod has NO
  OPENROUTER_API_KEY** — needs user-approved
  `az containerapp secret set -n portal-compile-jp -g internship-portal --secrets
  openrouter-api-key=<key>` + env `OPENROUTER_API_KEY=secretref:openrouter-api-key`; until
  then prod Gmail sync skips. After the key: run one
  `POST /api/integrations/gmail/sync-now?profile=mohamed_fuad&backfill=90` on Azure.
- **2026-07-16 — Gmail Phase 2 DEPLOYED TO PROD + refinement pass (commits `0c8b812`,
  `2f0452d`).** Azure `portal-compile-jp` now runs image `portal-compile:2f0452d`
  (revision `--0000003`) with the 4 Gmail env vars; prod frontend (portal.mohamedfuad.com)
  bundle points at the Azure API; Gmail connected in prod (mohamed.fuad.jp@gmail.com) and a
  live sync-now on the new revision verified clean (token + /data survived the roll).
  Refinements: (1) server — `sync-now?backfill=<days>` (cap 180) one-time keyword-filtered
  scan of older mail (EN+JA application terms; doesn't move the history cursor; 80-msg cap),
  classify prompt now counts coding tests / online assessments as "interview" + JA vocab;
  (2) client — the drain sorts oldest-first and converges per-company (one record for
  applied+rejected of the same company; terminal status never downgraded; details backfilled
  across emails), connected card shows a green presence dot instead of the Live badge and no
  post-OAuth success banner. Build green, E2E 5/5 (needed `npx playwright install chromium`
  after a Playwright bump). **PENDING: Vercel prod redeploy** (`vercel deploy --prod --yes`
  from repo root) to ship the client-side drain/card changes — blocked on user approval this
  session. Branch pushed; not merged to main.
- **2026-07-16 — Gmail ingest Phase 2 (2a connect + 2b sync pipeline), branch
  `feat/gmail-catalog-automation` (commits 5513866, 52beba0, 05ad392, c20954d; ADR-0035).**
  Read-only Gmail OAuth (server-side, raw fetch, node:crypto AES-256-GCM token — NO new deps;
  `server/gmail/*`). Settings "Gmail" card (connect/disconnect/live status, real Gmail logo).
  Pipeline: gmailClient (token refresh + history read + MIME extract) → classify (gpt-5-nano
  triage) → enrich (sonar) → sync pushes actions to a per-profile server queue → client
  `useGmailInbox` drains into the Firestore tracker/calendar full-auto (Option C: no
  firebase-admin, no rule changes) with Gmail source badges. 24/7 `setInterval` loop runs ONLY
  on the persistent process (isDirectRun → Azure container). **Verified end-to-end** against the
  real connected inbox (mohamed.fuad.jp@gmail.com): classify accurate, HENNGE(applied)+Rakuten
  (interview) matched to catalog, interview milestone created, badges render, queue acks.
  **GCP:** OAuth client + Gmail API + consent screen live (user set up); local `.env.local` has
  GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI + GMAIL_TOKEN_ENC_KEY. **NEXT = prod deploy to Azure**
  (`portal-compile-jp`, japaneast, durable /data): rebuild image w/ Gmail code, set the 4 env
  vars, point frontend API at Azure, add Azure callback to Google console. Prod topology: Vercel
  serves frontend at portal.mohamedfuad.com; `VITE_API_BASE_URL=""` (same-origin serverless
  today). I have `az`(akshay6.nitt) + `vercel`(mohamedfuadjp) CLI access on this machine.
- **2026-07-16 — Gmail/catalog plan Phase 1: model switch + self-healing catalog refresh
  (branch `feat/gmail-catalog-automation`, commits `fc460ea`, `f39a54f`; ADR-0034).**
  Search default → `perplexity/sonar` (native web search, ~2s w/ sources vs gpt-5-mini:online
  120-245s); `researchModel()` no longer appends `:online` to perplexity/*; Settings menu
  expanded + shows the effective slug. Self-healing daily catalog: `server/refresh-catalog.js`
  retires HTTP-dead listings (sonar double-checked — retire only if not "still open"; conflicts
  logged) + refreshes stale deadlines into the machine-owned `seeds/auto-refresh.json` overlay
  (wired into `buildSeedCatalog` + `isRetiredInternshipId`); workflow split into `validate`
  (push/PR, no flaky link gate) + `refresh` (schedule → heal → auto-PR via peter-evans).
  **Blocked on user:** add `OPENROUTER_API_KEY` GH Actions secret + enable "Allow Actions to
  create PRs". **Phase 2 (Gmail ingest) not started** — see PLAN §3. Decisions locked:
  catalog→auto-PR, Gmail→full-auto day one.
- **2026-07-15 — Design pass 4: inset-card shell, Applications + Profile views, small fixes
  (commits `7414ac9`, `afe495a`; ADR-0033).** Every view now renders as an inset white rounded
  card in a soft gutter (`.app-main` gradient, per-view card rule in index.css); sidebar keeps a
  grey→peach gradient, no hard divider. New nav order: Dashboard · Radar · **Applications (new
  view: all tracker records w/ status filter tabs)** · Calendar (renamed from Application
  timeline) · Editor · **Profile (new view: contact/skills/education/experience/summary +
  Résumés & CVs stub — file storage deferred)** · Settings. Dashboard: "Application" header,
  5 pipeline stats on one line (grid had 4 columns → Rejected wrapped), calmer type scale.
  Editor wrapped in `.editor-view` so the card radius clips it; Settings Back button removed;
  model selects restyled; collapsed-sidebar toggle centred. Committed the previously-missing
  `server/load-env.js` (fresh clones couldn't boot — see errors.md). **Planned (not built):**
  Gmail ingest + self-healing daily catalog refresh → `PLAN-2026-07-15-gmail-ingest-and-daily-refresh.md`
  (for a follow-up Opus session; includes CI failure root cause, model pricing, OAuth constraints).
- **2026-07-15 — Durable Azure storage + catalog delete + account deletion (ADR-0032).**
  **Production was never using Vercel Blob** — `portal-compile-jp` had no token, no volumes, so
  it ran on ephemeral container disk since launch and silently lost every live-research result
  on each restart. Fixed by mounting Azure Files (`internshipportaljpdata` /
  `resume-studio-data`) at `/data` with `RESUME_STUDIO_DATA_DIR=/data` — no code change needed;
  **verified by write → restart → read-back**. Revision `--0000001` (rollback: `--4u2g71t`).
  Added `DELETE /api/internships/custom/:id` (the catalog was add-only) + `validateInternshipId`.
  Added account deletion (`deleteAccount` in useAuth + `removeAllUserData`/`removeUserDoc`),
  Firestore-data-before-auth-user so nothing is orphaned, behind a typed DELETE confirm.
  **Open:** `/api/status` still reports `persistent: true` from a label check, not the mount;
  account deletion is untested end-to-end (needs a throwaway account).
- **2026-07-15 — BUG-011 FIXED: a Blob outage no longer 500s the API.** Root cause was NOT an
  expired token: the Vercel free-tier Blob quota (2,000 Advanced Requests) was exhausted and
  **store access is paused for 30 days**, so every read 403s. `storage.js` treated Blob as a hard
  dependency, so all `/api/*` returned 500 and the app hung on "Loading…". Blob is now
  best-effort: failures log once and fall back to local SQLite (500 → 200 verified with the
  paused token). Note per-user data is in **Firestore**, not Blob — Blob only held the
  (self-reseeding) internship catalog + `customInternships`. To drop Blob for good: unset
  `BLOB_READ_WRITE_TOKEN` and point `RESUME_STUDIO_DATA_DIR` at a persistent mount. See errors.md.
- **2026-07-15 — Design pass 3 (ADR-0031).** Sidebar icons → lucide (already a dependency);
  Application timeline promoted from a dashboard block to its own view; halo button replaced
  by a flat blue pill (`--halo-bg: #1a56f0`); account menu is Sign out only (Settings is a
  sidebar view) and no longer opens empty; `.tb` border/background dropped; mint→blue
  `--preview-bg` and body gradients neutralised; Settings widened to 1100px. E2E repointed
  from `.top-nav-btn` to `.side-nav-btn` — **all 5 tests pass**.
- **2026-07-15 — App shell overhaul: left sidebar + neutral palette + halo buttons (ADR-0030).**
  `.top-nav` replaced by `.app-sidebar` (brand, Views, icon rows with real count badges,
  language + profile in the footer, 236px→64px collapse persisted in
  `localStorage['sidebar-collapsed']`); the 58px `.tb` header is kept (five views use
  `calc(100vh - 58px)`) and now shows the view title. Sidebar is monochrome — selected row is
  a white card, matching the login mock. Primary buttons adopt the blue "halo" via `--halo-*`
  tokens; login/legal keep their black pills. App palette neutralised (`--career-blue`,
  `--intern-blue`, `--career-ink` → ink; blue-tinted surfaces → neutral), so blue now means
  "primary action" only. **Open:** E2E suite not yet checked for `.top-nav` selectors.
- **2026-07-15 — Legal pages: scroll fix + full-width card.** `#terms`/`#privacy` could not
  scroll: `html/body/#root` are `overflow:hidden` above 1180px, and the `<=1180px` queries flip
  them to `height:auto`, which collapsed a percentage height. `.legal-page` is now
  `position:fixed; inset:0; overflow-y:auto`, which scrolls at every width. Card fills the
  viewport with the text column centred at 780px (was a 760px card with wide gutters).
- **2026-07-15 — Public Terms + Privacy pages on a hash route (ADR-0029).** New
  `components/LegalPage.jsx` + `hooks/useHashRoute.js`, wired in `main.jsx` above AuthGate so
  `#terms`/`#privacy` render without signing in; the login page's placeholder legal links now
  resolve. Shares the login design language, bilingual EN/JA via the same
  `resume-studio-language` key. Copy is written against verified app behavior (Firestore
  storage; résumé text sent to OpenRouter on AI use per `server/resume-chat.js`; no analytics
  wired). **Not legally reviewed** — `OPERATOR`/`CONTACT_EMAIL`/`JURISDICTION` are placeholder
  constants at the top of LegalPage.jsx and must be filled before going public.
- **2026-07-15 — Login art-pane mock rebuilt to reference proportions.** The mock sat in the
  bottom-right corner; per the reference it now starts ~22% down the art pane and fills the
  rest, as a two-column window (icon rail + sidebar + main pane) bleeding off the bottom-right.
  Sidebar rows mirror real app surfaces (Dashboard / Internship Radar / Applications /
  Calendar / Editor / AI assistant / Profile) rather than invented screens.
- **2026-07-15 — LoginScreen restyled to the reference "split card" theme (ADR-0028).**
  Rewrote `components/LoginScreen.jsx` + the auth block of `index.css` to match a
  user-supplied reference design: split card on warm light gray — white form pane beside a
  CSS-gradient sunset art pane holding a floating product mock; **Instrument Serif** display
  headline (+ **Noto Serif JP** for JA) over small muted Inter copy; fully-rounded pill
  controls; black primary button that stays inert until the fields are filled. Auth behavior
  unchanged. Placeholder-only fields keep accessible names via `aria-label`. Art pane hides
  below 900px. Dropped the stale `[data-theme="dark"]` auth-page override — it was the only
  rule in the app that actually painted dark, so it produced a dark frame around a white
  card; the 2026 redesign block in `index.css` makes dark resolve to the light palette
  app-wide. The new Terms/Privacy line points at placeholder `#terms`/`#privacy` hrefs.
- **2026-07-09 — BUG-010: live company search fixed for keyless users (env fallback restored).**
  Searching a non-catalog company always errored "Live research needs an OpenRouter API key"
  unless a key was saved in Settings: the Node server never loaded `editor/.env.local` (no
  dotenv; Vite only exposes VITE_* to the client) and the Azure app `portal-compile-jp` has no
  `OPENROUTER_API_KEY` env var (probed directly). Added dependency-free `server/load-env.js`
  (first import of `server/index.js`; parses `.env.local`/`.env`, real env wins, no-op when
  absent). Verified in-browser: keyless "Airbnb" search runs the full research and completes.
  **Prod still needs** `az containerapp update -n portal-compile-jp -g internship-portal
  --set-env-vars OPENROUTER_API_KEY=<key>` (no az CLI/login on this machine); Settings-key
  path verified working against Azure meanwhile. Also updated `.claude/launch.json` preview
  config to pin `PORT=5005` (the preview harness was injecting PORT=5173, colliding Express
  with Vite) and `VITE_AUTH_DISABLED=true` (mirrors the Playwright E2E env) so browser
  verification works. See ADR-0027, BUG-010.
- **2026-07-05 — Compile/research backend moved to Azure Container Apps (always-on).** Render's
  free tier slept after ~15 min → cold starts made the first live-search/compile fail ("company
  research failed", e.g. Goldman Sachs). Deployed the same root `Dockerfile` to **Azure Container
  Apps** (`portal-compile`, RG `internship-portal`, env `portal-compile-env`, ACR `ca7959c48768acr`,
  region westus2) with **min-replicas 1 = always warm** (1 vCPU / 2 GiB). Build gotcha: `az
  containerapp up --source .` ignores the root Dockerfile and falls back to Oryx buildpacks →
  "Could not detect the language from repo"; the fix is `az acr build --file Dockerfile .` then
  `az containerapp create` from the pushed image. Also dropped the inline `FROM --platform=…`
  (ACR's dependency scanner can't parse it). Verified on Azure: `/api/status` ok, EN compile 200
  (~6.6s, 31 KB PDF), JA compile 200 (~3.8s, 104 KB CJK PDF). Frontend `VITE_API_BASE_URL` in
  Vercel repointed Render→Azure FQDN and redeployed. See `docs/azure-deploy.md`, ADR-0019.
- **2026-07-04 — Live PDF preview via a containerized compile backend (ADR-0018) + nav/onboarding
  fixes.** (1) **Compile backend**: Vercel can't run Tectonic, so the prod preview was a stale
  prebaked fallback. Added a root `Dockerfile` (node:22-trixie + Tectonic 0.16.9 + Noto CJK fonts,
  amd64) running the existing server, `render.yaml` Blueprint, and `docs/compile-backend.md`.
  `server/templates.js` now has an env-driven font profile (`RESUME_FONT_PROFILE=linux` → Noto
  Serif/Sans CJK; macOS default keeps Hiragino; EN templates unchanged). **Verified by building the
  image + compiling all EN/JA templates in the container** — JA renders Noto Mincho body + Gothic
  headings (bold auto-detected), 1 page, ~identical to Hiragino. The frontend routes `/api/*` via
  `VITE_API_BASE_URL`, so the user deploys the container (Render free) + sets that env + redeploys
  the frontend → live edits compile. (2) **Nav bar**: grouped the right-side header controls with
  `marginLeft:auto` (empty `.tb-actions` on non-editor views had let space-between spread them).
  (3) **New-account onboarding**: the résumé wizard (PDF import → heuristic parse) was unreachable
  after "+ New" removal; now it opens on first sign-in with a blank profile and saves into the
  current profile. Nav + onboarding built, deployed to prod; compile backend awaits the user's
  container deploy.
- **2026-07-03 — Post-review fixes (prod feedback) + deploy of Phases 1–8.** From the user reviewing
  the (Phase-0) prod site: (1) **Account menu simplified** (`ProfileSwitcher.jsx`) — with Firebase
  one account == one user, so removed profile switching + "+ New"; the avatar now opens just
  **Settings / Sign out** (+ shows the email). (2) **Sign-out clears `?profile=`** — the handler
  `history.replaceState`s to the clean root before signing out (`App.jsx`). (3) **Company logos**
  (`CompanyLogo.jsx`) — dropped Google's `s2/favicons` (it serves a generic GLOBE at HTTP 200 for
  unknown domains, so `onError` never fired). Now **DuckDuckGo favicon primary → `logoUrl` → text
  initials**: favicons read well at small sizes and 404 cleanly (→ initials), fixing both the globe
  icons (GEOTRA/CyberAgent/InsightX) and invisible white-wordmark `logoUrl`s (HENNGE). (4) **Wrong JA
  preview on prod** — root cause: Vercel has no Tectonic, so live compile always fails and the app
  serves a **prebaked/Blob-cached PDF**; the cached `resume_ja_01.pdf` predated the Jake's-Clean-JA
  redesign. Regenerated `seed-pdfs/resume_ja_0{1,2,3}.pdf` from current templates and added a
  versioned **`purgeStaleCompiledCache`** (bump `COMPILED_CACHE_VERSION`) that clears stale
  `compiled:*` KV entries on boot so prod re-seeds the fresh PDFs. Build green, E2E 5/5. Deploying
  all of Phases 1–8 + these fixes to prod. NOTE (flagged): live LaTeX compile does not run on Vercel
  — the prod PDF preview is always a prebaked fallback (not the user's live edits); a real fix needs
  a compile service/worker.
- **2026-07-03 — Phase 8 audit + targeted cleanup.** Most Phase 8 items were already resolved in
  Phases 0–2 (Saved filter, stale `temp` KV, module clock, dead `matchLabel`, fabricated research
  logo, `fitNote===about`, ProfileSwitcher inline styles, one-click delete X, `.gitignore` covers
  `server/.data/`). This pass fixed the rest: (1) **React key collisions** — `key={part}` on
  role/location/language/duration part lists in `InternshipDashboard.jsx` → `key={`${part}-${i}`}`.
  (2) **Radar row keyboard focus** — the row's Enter/Space handler now returns early when a child
  control (status `<select>` / company button) is focused (`event.target !== event.currentTarget`),
  so keyboard users operate the select without opening the drawer. (3) **Documented** the global
  `useInternshipCatalog` module cache (profile-independent — correct not to invalidate on switch).
  Audit tooling: `madge --circular` is **clean (0 cycles)**; there is no `lint` script configured
  (skipped). Build green, E2E 5/5. **DEFERRED (organization-only, high-risk/low-user-value — do as
  a dedicated pass with screenshot-diff verification):** splitting `App.jsx` (2328 lines; extract
  `ProfileWizard.jsx` + AI chat sidebar, target <800) and `index.css` (6694 lines; → `styles/{base,
  nav,dashboard,radar,editor,calendar,landing}.css` + tokens, no visual change). Uncommitted.
- **2026-07-03 — Phase 7 daily LLM catalog validity automation.** New
  `server/audit-catalog-llm.js` (npm `audit:catalog:llm`, ADR-0017): selects stale-risk catalog
  entries (deadline within N days / stale `verifiedDate` / generic apply URL), fetches page text,
  and asks a cheap audit model `{stillOpen, deadlineChanged, note}`; writes a dated advisory report
  (`seeds/llm-audit-<date>.json`, git-ignored + CI artifact) with token accounting. **Never
  auto-retires** — advisory only; exits 0 on any error and skips gracefully without
  `OPENROUTER_API_KEY`. Extended `.github/workflows/validate-catalog.yml` (daily 06:00 UTC cron)
  with a conditional LLM step keyed by the `OPENROUTER_API_KEY` secret + a report-artifact upload.
  Verified: `--dry` selects 24/173 candidates and writes the report (exit 0); one real LLM call
  returned a conservative "unknown" verdict for a JS-only page and logged 528 tokens; validate:catalog
  still passes; workflow YAML parses. Uncommitted.
- **2026-07-03 — Phase 6 Jake's Clean JA template redesign (`server/templates.js` genJa01).**
  Refined the app's first JA résumé option to faithfully mirror the EN Jake's-clean rhythm:
  **Mincho body** (Hiragino Mincho ProN W3/W6) for an elegant read, **Gothic** (Hiragino Kaku
  Gothic ProN W6) for the section headings + the name via a new `\gothicfont` CJK family, and a
  **monotone** grayscale palette (dropped the blue `accent`; role lines use `subtle` gray). Kept
  photoless (matching EN Jake's-clean) and the single-page rhythm. Verified by compiling the
  generated TeX with Tectonic: **0 errors, no overfull, 1 page**; PyMuPDF confirms HiraMinProN
  (W3+W6) body + HiraKakuProN W6 headings and no fake-italic CJK; page-1 render looks clean. Build
  green, E2E 5/5 (incl. the "first JA template is Jake's clean" assertion). NOTE: this is the
  app's genJa01 only — the static `ja/` résumés (shokumu_modern/rirekisho_grid/deedy_jp) + their
  PyMuPDF suite are a separate track, untouched. Uncommitted.
- **2026-07-03 — Phase 5 editor: Present/Expected toggle pill + spacing spot-check.** The bare
  checkbox + label in `MonthInput` (`components/ui.jsx`) is now a **brand-blue toggle pill**
  (`.month-ongoing-toggle`, `aria-pressed`, animated check) matching the app's segmented controls,
  for both `ongoingMode="present"` (Experience — disables the month) and `"expected"` (Education —
  keeps the graduation month). Verified both variants + on/off states, and the editor form has no
  misalignment / horizontal overflow at 1600 / 900 / 375 px (no further CSS fixes needed). Build
  green, E2E 5/5. Uncommitted.
- **2026-07-03 — Phase 3 live company search polish (key from Settings + CTA).** The research
  request now carries the user's **résumé + OpenRouter key + search model** in the body so the
  server works for client-direct Firestore users (résumé isn't in server KV) and uses the user's
  own key. `server/internship-research.js`: `getOpenRouterClient(apiKey)` / `researchModel(model)`
  resolve per-request value → env; the missing-key error preserves `code`
  `OPENROUTER_API_KEY_MISSING`. `server/index.js` research route reads `resume`/`apiKey`/`searchModel`
  from the body (KV/env fallback) and returns `errorCode` on the job. Client
  (`InternshipDashboard.jsx`): `startCompanyResearch` fetches settings fresh (so a just-saved key
  is used) and sends them; `CompanyResearchPanel` shows an **"Add your key in Settings" CTA**
  (deep-links to the Settings view) instead of a raw error when the key is missing. Verified:
  build green, E2E 5/5; direct API returns the preserved errorCode, the CTA renders + navigates to
  Settings, and the request body carries résumé+apiKey+searchModel. NOTE: the local Node server does
  not load `.env.local`, so local live research now depends on a key entered in Settings (prod uses
  the Vercel env key). Uncommitted.
- **2026-07-03 — Phase 2 Settings view + profile menu.** (1) **Profile menu**
  (`components/ProfileSwitcher.jsx`, rewritten): the old nav `<select> + New + X` cluster + the
  standalone Sign-out button are replaced by a single **avatar dropdown** (initials badge + active
  name) with a Profiles switch list, Add user, Settings, Delete user, and Sign out (sign-out only
  when authed). Click-outside/Escape to close. (2) **Settings view** (`components/SettingsPanel.jsx`,
  new `appView === 'settings'`): Profile (name EN/JA, email, phone — written through the résumé
  personal block via `saveProfileImmediately`), AI & API keys (OpenRouter key + search/audit model
  slugs, validated), and Data (export JSON, danger-zone delete profile). The key is write-only in
  the UI — after saving it shows a masked "key saved / Remove key" note. (3) **Settings storage**
  (`data/firestoreData.js` getSettings/saveSettings on `users/{uid}/settings/app`; `api/client.js`
  `settingsApi`): Firestore when signed in, localStorage otherwise — no server round-trip (the key
  is sent with research/chat requests in Phase 3). See ADR-0016. Photo editing stays in the editor
  (not duplicated in Settings). Verified: build green, E2E 5/5, profile menu + settings render and
  the save/mask/remove-key flow works (key persisted to localStorage in the no-auth test). Uncommitted.
- **2026-07-03 — Phase 1 company data consistency + logos.** (1) **Detail panels are now
  truthful/consistent** (`utils/internshipDisplay.js`, `components/InternshipDashboard.jsx`):
  `internshipDetails` no longer fabricates fallbacks — `about` stops falling back to `fitNote`
  (the on-screen duplication where "What it's about" and "Why it's a fit" showed identical text
  for the 144 entries lacking a real `about`), and `techStack` no longer fills with generic
  `[track, Git, APIs, Cloud]`. `DetailPanel` hides the About / Tech-stack / Eligibility sections
  when their data is absent (Fit + Application-procedure always show). (2) **Live research**
  (`server/internship-research.js`): `normalizeResult` now sets a real `about` and a genuine
  (non-duplicate) `fitNote`. (3) **Logos** (`components/CompanyLogo.jsx`): added a DuckDuckGo
  favicon fallback after Google's, and removed the fabricated `https://<company>.com` URL in
  `CompanyResearchPanel` (initials/known-domain until real results arrive). NOTE: seed
  `companyDomain` coverage was already ~100% (earlier "54/173" was a grep artifact). Verified:
  build green, E2E 5/5, validate:catalog passes; rich company (HENNGE) shows all 5 sections,
  sparse company (Atilika) correctly hides About/Tech with no duplication and a real favicon.
  Deferred (tooling, low value): a normalization audit script + validator shape checks, and the
  11 documented generic-apply-url re-audit. Uncommitted.
- **2026-07-03 — Phase 0 quick bug fixes (BUG-007/008/009).** (1) **Saved radar filter**
  (`InternshipDashboard.jsx`): saved roles stay visible past their deadline, `savedCount` is
  derived from the visible set (count ≡ rows), and the status filter no longer offers
  applied-type options that can't match. (2) **Stale `profile:temp`/"fdf" KV row**
  (`server/index.js`): added `RETIRED_PROFILE_IDS`+`purgeRetiredProfiles()` on boot and excluded
  retired ids from `listProfiles`; verified local `profile:temp` purged and `/api/profiles` clean
  (needs a redeploy to clean the prod Blob). (3) **Module-scope clock**: `NOW`/`TODAY` →
  per-call `nowDate()`/`todayIso()` (ApplicationCalendar already per-render). Also removed dead
  module-level `matchLabel`. Build green, E2E 5/5. Uncommitted (on the feature branch working tree).
- **2026-07-03 — Full per-user data migration to Firestore (client-direct) + login redesign.**
  (1) **Login redesign** (2 rounds of user feedback): soft mint→blue ambient gradient behind a
  centered white "app window" (macOS lights + `user`-icon brand pill + EN/日本語 segmented toggle),
  app line-icons (added a `radar` icon to `ui.jsx`) in white icon-chips, white feature cards with
  soft shadow, one-line EN headline ("Land your next internship."). Bilingual, dark-aware,
  responsive. (2) **Firestore migration** (ADR-0015): per-user data now lives in Firestore under
  `users/{uid}/{profiles,trackers,applications}/{profileId}` via a new client-direct data layer
  `src/data/firestoreData.js`; `src/api/client.js` delegates profileApi/trackerApi/applicationApi to
  it when signed in and keeps the `/api/*` HTTP path for the no-auth/E2E case. Server decoupled from
  KV for authed users: POST export variants (`/api/export/{pdf,tex,ai}` take résumé in body),
  client-side JSON export, new stateless `/api/cover-letter`. `ensureSeed` (in AuthGate) seeds owner
  accounts (`VITE_OWNER_EMAILS`, default flashxjapan@gmail.com) from the `mohamed_fuad` sample and
  everyone else a blank `primary` profile; App boot resolves the active profile against the real
  list. Catalog stays server-seeded; custom researched companies stay server-global (documented
  limitation). **Verified end-to-end:** non-owner sign-up → blank profile + dashboard, tracker
  save persisted across reload (Firestore REST-confirmed `profiles/primary`+`trackers/primary`),
  build green, E2E 5/5, test account cleaned up. **Committed** on branch
  `feat/firebase-auth-firestore` (pushed) and **deployed** to production
  (`vercel --prod` → editor-omega-two.vercel.app); live API/catalog/seed-source verified,
  deployed bundle confirmed to carry the auth gate. Owner-seed path proven end-to-end
  (test owner account got the full mohamed_fuad résumé in Firestore). Branch not yet merged to main.
- **2026-07-03 — Firebase Authentication gate + Firestore scaffold (Phase 4, real config).**
  Wired the app (project `resume-841f9` / `501333131661`) to Firebase Auth + Firestore.
  **Project side (via CLI + Identity Toolkit/Service Usage REST using the CLI's cached
  token):** registered web app `1:501333131661:web:15135d8b04c44d1c77fdc4`; enabled the
  Firestore + Identity Toolkit APIs; created Firestore `(default)` in `asia-northeast1`
  (Tokyo); enabled **Email/Password** (Google was already enabled with an OAuth client);
  deployed owner-only Firestore rules. **Client:** `src/auth/firebase.js` (public config
  hardcoded as env-overridable fallbacks; `authAvailable`, disabled by `VITE_AUTH_DISABLED`),
  `src/auth/useAuth.js` (hook + standalone `signOutUser`/`currentUser`), `src/auth/AuthGate.jsx`
  (wraps `<App/>` in `main.jsx` — shows LoginScreen when signed out, spinner while resolving),
  `src/components/LoginScreen.jsx` (bilingual EN/JA, Google + email/password sign-in & open
  sign-up, `.auth-*` CSS appended to `index.css`), `src/data/userProfile.js` (upserts
  `users/{uid}` on login — first real Firestore write). Added a header **Sign out** button.
  **Config files (committed, no secrets):** `firebase.json`, `.firebaserc`, `firestore.rules`,
  `firestore.indexes.json`; `.env.local` gained `VITE_FIREBASE_*`; `.gitignore` covers
  `.firebase/` + debug logs. **Playwright:** `VITE_AUTH_DISABLED=true` in webServer env so the
  gate doesn't block E2E. **Verified end-to-end:** `npm run build` green (~286 KB gzip; SDK
  adds bulk), login screen renders with no console errors, a real email/password sign-up
  transitioned past the gate AND wrote the `users/{uid}` doc under the deployed rules (then the
  test user + doc were deleted, project left clean), and `npm run test:e2e` 5/5 green. **Scope
  left open:** per-user data isolation + moving résumé/tracker/settings into Firestore, and
  server-side ID-token verification (API still trusts the profile query param). **Pre-deploy
  TODO:** add the Vercel prod domain to Firebase Auth authorized domains. See ADR-0014,
  `agent/secrets.md` (Firebase section).
- **2026-07-02 — Official-source internship audit + applied-company ranking + JA editor
  mapping.** Added `catalog-audit-2026-07-02.js`: retired 12 stale IDs (11 seed roles plus
  one persisted Apple live-research row) after checking official company/program/ATS pages;
  reasons include expired deadlines, explicit closure, removed postings, and current pages
  no longer listing an internship. Updated Sakana AI to its current English Tokyo **Member
  of Technical Staff - Research Internship** detail page (4 months). `buildSeedCatalog()`
  applies the audit, and all catalog read/write/legacy merge paths reject retired IDs so
  SQLite cannot resurrect them. Runtime API now returns exactly **173**, research date
  2026-07-02, no retired IDs. Added shared `utils/internshipRanking.js`: for Mohamed's
  already-applied HENNGE/Rakuten companies, roles below 98 are demoted while exceptional
  98+ matches remain; both radar and dashboard Tokyo rail use it. First JA template label/
  test id is now **Jake's Clean 日本語** and an E2E assertion locks the mapping. Verified:
  schema/DB 173/0, link liveness 173/173, all JA templates compile, 5/5 Playwright, build,
  browser runtime/console, and API persistence purge. No deployment or application submit.
- **2026-07-01 — Internship Portal mega-update (Waves 1–3, coordinator ship).** Full
  user-requested overhaul across dashboard, radar, calendar, editor, server, and templates.
  **Branding:** "Resume Studio" → **Internship Portal** (EN/JA nav, index.html, README,
  server status, LLM prompts). **Multi-user:** nav-bar `ProfileSwitcher` (switch/create/delete);
  second sample `aiko_tanaka`; server seeds both profiles; delete removes tracker/applications
  KV; `personal.postalCode` persisted. **Dashboard:** recent-apps applied-only + interview
  modal; tech icons via `techIcons.js` (never null). **Calendar:** Asia/Tokyo applied-date
  fix; coding-test event type; today-circle + form select CSS. **Radar:** hide applied-type +
  JST time-expired; JLPT via `splitLanguageRequirement`; interview modal. **Editor:** ID photo
  replace/remove, EN-only name, DOB/phone/postal validation, month pickers, degree stale-state
  fix, skills multiselect redesign, autosize textareas. **AI:** OpenRouter `openai/gpt-5-mini`
  (+ `:online` for research) replaces broken `codex` CLI; URL verification on research results.
  **JA resumes:** `genJa01` rebuilt as Jake's-clean JA layout; genJa02/03 spacing. **CSS:** dual
  `.application-row select` fix, nav switcher, form chevrons/skills/calendar pills. Verified:
  build green, validate:catalog 184/0 errors. Ship: commit + push + `vercel --prod`.
- **2026-07-01 — Profiles wave 1 (server-side): 2nd sample person, robust seeding,
  configurable delete protection w/ full KV cleanup, `personal.postalCode`, EN branding.**
  Server-only changes (`editor/server/index.js`, `validation.js`, `profiles/*.json`); client
  wiring is a later wave; left uncommitted for the coordinator. (1) **Second sample profile**
  `aiko_tanaka` (Aiko Tanaka / 田中 愛子) — a polished, distinct bilingual CS grad student
  (Univ. of Tokyo M.S. + Waseda B.E., ML/backend focus: PyTorch, Go, recommender systems;
  Mercari + Rakuten internships) matching the EXACT shape of `mohamed_fuad.json`. Replaced the
  scratch `temp.json` (`nameEn:"fdf"`), which was deleted. (2) **Seeding** now force-seeds BOTH
  samples via `SAMPLE_PROFILE_IDS = ['mohamed_fuad','aiko_tanaka']` + a new `ensureSampleProfiles()`
  (idempotent `readProfile` per id — only writes when KV key missing AND `<id>.json` exists),
  wired into `initPersistentStore()` and the empty-store branch of `listProfiles()`. On a fresh
  DB GET `/api/profiles` lists both. (3) **Delete protection** is now configurable:
  `DEFAULT_PROFILE_ID` (env `RESUME_DEFAULT_PROFILE_ID`, default `mohamed_fuad`) + a
  `PROTECTED_PROFILE_IDS` set (env `RESUME_PROTECTED_PROFILE_IDS`, comma-sep, default = the
  primary). `sanitizeProfileId`/`readProfile` now key off `DEFAULT_PROFILE_ID`. `deleteProfile`
  already removed `profile:`/`tracker:`/`applications:` keys — verified no orphans
  (KV dump before delete = 3 keys, after = 0). (4) **Create-user**: confirmed POST
  `/api/resume?profile=<newId>` (and `/api/save`) creates a brand-new profile that then appears
  in `/api/profiles` — no contract change needed. (5) **`personal.postalCode`**: optional string
  added to schema via `validation.js` `normalizePostalCode()` (trim, ≤16 chars, regex
  `^[0-9A-Za-z][0-9A-Za-z\s-]{0,15}$`); normalizes both `personal` and legacy `personalInfo`
  blocks, absent ⇒ untouched (existing profiles unaffected). Bad code ⇒ HTTP 400. (6) **Branding**:
  user-visible/API/log strings in `index.js` "Resume Studio"/"Resume Editor" → "Internship Portal"
  (status messages + 2 boot logs); internal storage keys (`resume-studio.sqlite`, blob key,
  `RESUME_STUDIO_*` envs) deliberately UNCHANGED to preserve persistence. Verified: server boots
  clean on a throwaway data dir, `/api/profiles` lists both, delete cleans all KV keys + keeps
  primary protected (400), postalCode round-trips, `npm run build` green (~340 KB). **NEXT-WAVE
  (App.jsx) wiring needed** — see notes below. See ADR-0012.
- **2026-06-30 — "Validate Catalog" CI fix: Nuro re-verified live + link-checker hardened
  against anti-bot socket resets.** The new `.github/workflows/validate-catalog.yml` was
  failing on `main` (eae7ca8): the link-liveness step found exactly **1 broken** URL —
  `https://nuro.ai/careersitem?gh_jid=7594577` (`global-035`, Nuro Data Scientist Intern)
  with `UND_ERR_SOCKET` — even though it passed 180/180 locally. **Root cause:** a
  transport-level connection reset from GitHub runner IPs (anti-bot/flaky network), NOT a
  dead posting. Verified the posting is **live** via Nuro's Greenhouse board API
  (`boards-api.greenhouse.io/v1/boards/nuro/jobs/7594577` → "Data Scientist Intern", updated
  2026-06-26) and both `nuro.ai`/`www.nuro.ai` return HTTP 200; the canonical Greenhouse URL
  just 302s back to `www.nuro.ai`, so swapping URLs wouldn't help CI. **Fix:** (1) kept the
  verified-live URL, bumped `global-035` `verifiedDate` 2026-06-27→2026-06-30
  (`server/seeds/internships.js`). (2) Hardened `server/validate-catalog.js`: `checkUrl` now
  retries transport-level errors (2 retries, linear backoff, env-tunable
  `VALIDATE_LINK_RETRIES`/`VALIDATE_LINK_RETRY_BACKOFF_MS`), sends fuller browser-like headers
  (UA + Accept + Sec-Fetch/Upgrade-Insecure-Requests via `LIVENESS_HEADERS`), and a new
  `classifyNetworkError` downgrades **persistent** resets/timeouts (`UND_ERR_SOCKET`,
  `ECONNRESET`, `ETIMEDOUT`, undici timeouts, "socket hang up", `EAI_AGAIN`) to a **soft
  warning**, while DNS-not-found (`ENOTFOUND`), non-HTTPS, dead redirects, and HTTP
  4xx/5xx stay **hard** failures. Soft-print now omits a `(0)` status. Exit-code contract
  unchanged (non-zero only on hard failures). Verified: `validate:catalog` 184 entries / 0
  errors / DB ok; `validate:catalog:links` **181/181 ok · 0 broken** (exit 0); `npm run build`
  green (~340 KB). Logic unit-checked via mocked fetch (UND_ERR_SOCKET & "socket hang up" →
  soft; ENOTFOUND & HTTP 404 → hard). See BUG-005, ADR-0011.
- **2026-06-30 — Application-tracker UX fixes + catalog CI + apply-URL audit (2 parallel
  workers + coordinator recovery).** (1) **Recent applications = applied-only**
  (`ProfileDashboard.jsx`): the list now filters to applied-type statuses
  `{applying, applied, interview}`, so "Saved"/untracked items no longer appear; a new
  **"Not applied"** option (`value=""` → `updateStatus(item,'')` untracks) lets the user
  change applied→not-applied and the row drops off immediately (derived from tracker state).
  (2) **Calendar no longer shows only Rakuten** (`ApplicationCalendar.jsx`): it previously
  emitted events only for records with an exact `deadlineDate` (just the 2 Rakuten roles had
  one); applied-type records without a deadline now get a distinct green "applied" pill on
  the day applied (`updatedAt||createdAt`), alongside all deadlines/milestones (no duplicate
  for deadline-dated rows). (3) **Selector gap** (`index.css`): `.application-row select`
  joined the content-sized select rule (`width:auto`), removing the big text↔chevron gap in
  the Saved/Applied dropdowns. (4) **GitHub Actions** (`.github/workflows/validate-catalog.yml`):
  runs `validate:catalog` + `validate:catalog:links` on push/PR to `editor/**`, a daily
  06:00 UTC cron, and manual dispatch (Node 20) — the automated daily gate ADR-0009
  anticipated. (5) **Validator heuristic** (`validate-catalog.js`): new soft (non-failing)
  `generic-apply-url` warning + `[1b]` report flagged **14** likely-generic apply URLs.
  (6) **Apply-URL audit** (`japan-wide-research-2026-06-30.js`): of the 14 flagged, **3** got
  verified specific deep-links (DeNA→snar ATS, Cookpad→Talentio, freee→Wantedly — the official
  careers page is retained as `sourceUrl`), **1** was already specific (HENNGE challenge entry
  link), and **10** are genuine single-program application pages (kept + flagged, not faked;
  common for JP new-grad programs). `[1b]` soft list 14→11; `validate:catalog:links` 180/180
  live. Verified: `npm run build` green, `validate:catalog` 183 entries / 0 errors / DB ok. PROCESS NOTE: a single combined worker hit `resource_exhausted` twice on
  the link audit; recovered by shipping the 5 complete fixes first and re-scoping the URL
  audit to the validator's `[1b]` worklist. See ADR-0010, BUG-004.
- **2026-06-30 — Internship catalog overhaul + automated validation.** (1) **Expiry
  filter:** the radar now auto-hides internships whose `deadlineDate` is before today
  UNLESS the user has applied (tracker status in `{applying, applied, interview}`); no-deadline
  ("Not stated") entries always show. `dynamicStats`/track filter/live-search all derive from
  the visible set (`InternshipDashboard.jsx`). (2) **Catalog expanded 153 → 183** (Japan-based
  53 → **83**, English-first **129**): new verified seed file
  `editor/server/seeds/japan-wide-research-2026-06-30.js` (30 real Tokyo/Japan roles with
  live official URLs + inline JA fields), assembled via the new
  `editor/server/seeds/catalog.js` `buildSeedCatalog()` (shared by server + validator). (3)
  **Automated validator** `editor/server/validate-catalog.js` (npm `validate:catalog` /
  `validate:catalog:links`): checks formatting/shape (aligned with `validation.js`, incl.
  duplicate-id + duplicated-list-item detection), DB round-trip through `storage.js`
  (save→load structural equality), and optional link liveness (GET+redirect, soft vs hard
  fail). Exits non-zero on hard failure — wire into the daily ingestion/CI. (4) **Eligibility
  de-dupe** at render source (`internshipDisplay.js` `internshipDetails` → `dedupeList`,
  case-insensitive; 31 entries collapsed, 0 dups remain). (5) **JA localization** filled in
  (`internshipDisplay.js`): bare `English`/`Japanese` language values (100 entries), ~30
  role/section terms + single-word fallbacks, month/date phrases, missing
  `TRACK_LABELS_JA` (19 tracks), and JP place names. (6) **Data cleanup:** fixed garbled
  scrape artifacts on `global-081` (Geotab) role/compensation/fitNote. Verified:
  `validate:catalog(:links)` → 183 entries, 0 errors, DB ok, **177/177 links live**;
  `npm run build` green. Done by 2 parallel workers (disjoint files) after a first
  single-worker attempt hit a resource limit. NOTE: this Vercel project does NOT auto-deploy
  from GitHub — must `vercel --prod --yes` from `editor/` after pushing.
- **2026-06-30 — Radar UI fixes + Japanese résumé redesign (2 parallel workers).**
  (1) **Internship Radar layout** (`editor/src/index.css`, no JSX changes): the radar
  table's horizontal scroll was caused by a late grid block with `min-width:1180px`
  paired with `.intern-results{overflow-x:auto}`; there were **four** drifted
  `.intern-table-head,.intern-row` grid definitions. Reconciled them all to one
  shrink-safe fluid grid (`32px minmax(0,2fr) 68px minmax(0,1fr) … 106px 66px 32px`,
  `column-gap:12px`), removed the `min-width`/`overflow-x`, added `min-width:0` to
  `.intern-content/.intern-results/.intern-rows`, and dropped the dead 1450/1250px
  language-hide overrides. Verified zero horizontal overflow at 1024/1280/1440 (+ mobile
  860/768/560/390) via headless Chromium. (2) **Selector spacing:** consolidated all
  radar/dashboard `<select>`s (`.intern-filter-row select`, `.intern-sort select`,
  `.intern-row-status`, `.intern-status-control select`, `.application-row select`) to a
  shared `appearance:none` + custom-chevron rule; the row status select now sizes to
  content (`width:auto`) so the "Applying" mid-gap is gone. (3) **Calendar source banner:**
  restyled `.calendar-source-note` into an on-brand info notice (subtle blue tint, soft
  border, radius, aligned brand-blue icon) for both EN/JA. (4) **Japanese résumés
  redesigned** (`editor/server/templates.js`, `genJa01/02/03` only — EN templates and the
  `generateLatex` signature untouched): `genJa01` 履歴書 → clean JIS-style rirekisho
  (side-by-side identity table + bordered 4cm×3cm photo box + 年/月 学歴・職歴 timeline,
  page 2 with 免許・資格 / 学業・ゼミ / 自己PR・ガクチカ / 本人希望記入欄); `genJa02`
  インターン応募シート → polished one-pager with accent section rules; `genJa03` 職務経歴書
  → refined full-bleed dark-sidebar + content layout. Recompiled with Tectonic: clean, 0
  errors/overfull, page counts 2/1/1. Verified: `npm run build` green (bundle ~329 KB).
- **2026-06-29 — HENNGE CV + cover letter revision pass.** Verbatim rewrite of both
  `en/01_jakes_clean.tex` and `en/05_cover_letter_hennge.tex`: removed em-dashes,
  reformatted the phone number to `+81 80-7535-2988` international format, added spacing
  in the Education/Experience headings, reordered Projects (WebDrop 2026 current, Agent
  Swarm 2026, Tutor-System 2026, TokaiHub 2025), strengthened the WebDrop bullets, and
  rewrote the cover letter in a more natural student voice (dropped the "37-tool"
  phrasing). To keep the CV at one page, applied all three spacing fallbacks
  (`\resumeSubheading` `\vspace{-5pt}`, `\resumeItemListStart` `[topsep=1pt]`, Summary
  `\vspace{3pt}`). Recompiled with Tectonic to `output/Mohamed_Fuad_CV.pdf` +
  `en_01_jakes_clean.pdf` and `output/Mohamed_Fuad_Cover_Letter.pdf` +
  `en_05_cover_letter_hennge.pdf`; both verified at exactly 1 page, previews rendered to
  `output/preview/cv.png` and `cl.png`.
- **2026-06-29 — HENNGE cover letter + CV emphasis pass.** Added an English cover letter
  (`en/05_cover_letter_hennge.tex`) for the HENNGE Global Internship Program and applied
  light AI/agent-orchestration emphasis edits to `en/01_jakes_clean.tex` (added a Summary
  section, added the Agent Swarm project, sharpened the Tutor-System bullets, added an
  "AI & Agents" skills line, and removed the Codex Account Switcher project). Compiled both
  with Tectonic to upload-ready PDFs in `output/` (`Mohamed_Fuad_Cover_Letter.pdf`,
  `Mohamed_Fuad_CV.pdf`); to keep the CV to one page the Activities section was removed.
  Both PDFs verified at exactly 1 page.
- **2026-06-29 — Finalize/cleanup pass (session: finalize worker).** (1) **JA-translation
  unified** — moved the comprehensive `jaDisplay`/`displayValue`/`displayRole` chain into
  the single `utils/internshipDisplay.js`; `InternshipDashboard.jsx` now imports it and
  the inline duplicate was deleted (ISSUE-002 resolved, ADR-0006). Also fixed the
  `Not stated; PC and transport benefits listed` ordering so it fully localizes (ISSUE-003)
  and a latent Security-role typo. (2) **Stale E2E spec removed** — measured 57 drift
  failures / 2 real passes, deleted `editor/tests/e2e/editor.spec.ts`, added the green
  `editor/tests/e2e/app-smoke.spec.ts` (4/4) for the real dashboard shell (ISSUE-004,
  ADR-0007). (3) **Diagram re-render verified** clean (ELK, no overlaps/crossings).
  (4) Verified: `npm run build` green, `npm run test:e2e` 4/4 green. Committed + pushed.
- **2026-06-29 — Agent KB bootstrap.** Created the `agent/` knowledge base (router +
  architecture, setup, api, components, data, conventions, tests, errors, secrets,
  decisions, state) and `graph/` (real madge dependency graph in `dependencies.json`/
  `.dot`, `graph.md`, D2 `architecture.d2` rendered to `architecture.svg`). Added thin
  root pointers (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/agent-folder.mdc`). Preserved
  legacy `.agents/`, `.workflow/`, `graphify-out/`, `graphify_root`.
- **2026-06-29 — BUG-001 fix.** Track filter returned no results in Japanese mode
  because the track `<select>` options lacked an explicit `value`, so the JA label was
  stored instead of the raw track. Added `value={option}`
  (`editor/src/components/InternshipDashboard.jsx`). Verified via `npm run build`
  (passes) + lint (clean). See `agent/errors.md` BUG-001 and `agent/decisions.md`
  ADR-0005. Recorded open issues: duplicated JA helpers (ISSUE-002), partial
  `Not stated;` translation (ISSUE-003), Playwright spec drift (ISSUE-004).
- **2026-06-29 — Architecture diagram re-rendered (clean ELK layout).** Rewrote
  `agent/graph/architecture.d2` to the clean-layout authoring rules: prepended the
  `vars.d2-config` ELK header (`layout-engine: elk`, `pad: 40`, `center: true`) with
  `direction: down`, and reordered containers into data-flow order (React client →
  Node/Express server → Data & seeds / SQLite store → Tectonic); the standalone LaTeX
  build pipeline is its own column feeding the shared `tectonic` hub at the bottom.
  Same nodes/edges/labels as before — layout only. Title switched from a clipping `md`
  block to a single-line `text` shape. Re-rendered `architecture.svg`; verified via a
  Quick Look PNG: no connector crosses any box and no containers overlap.

- **2026-07-08 — Company logo chips: job-board favicon + missing-icon fixes.** Fixed the
  "wrong logo" on live-researched internships: `internship-research.js` derived
  `companyDomain` from the posting's `sourceUrl`, so a company found on a job board
  (e.g. enechain on herp.careers) rendered the board's favicon. Server now blanks
  job-board/ATS hosts (greenhouse, lever.co, workday, herp.careers, 01intern, wantedly,
  onecareer, indeed, linkedin, talentio, hrmos, mynavi, rikunabi); `CompanyLogo.jsx`
  applies the same blocklist to `item.companyDomain` at render time (heals already-stored
  items) and prefers the curated `KNOWN_DOMAINS` entry over a derived domain. Added
  `KNOWN_LOGOS` direct icon URLs for companies whose domain 404s on the DuckDuckGo
  favicon service (enechain → its real PNG icon; M3 → m3.com/favicon.ico). Verified in
  the dev app: enechain card + live-search intro both render the true brand mark.
  See ADR-0025. Uncommitted — review before push.

- **2026-07-09 — Daily catalog sweep: dead listings retired + failure visibility.** The
  existing validate-catalog.yml daily cron was failing (every run red) because two
  seed listings are genuinely gone: Verkada global-010 (greenhouse → not-found
  redirect) and Kinaxis global-049 (HTTP 410). Removed both from
  `server/seeds/internships.js` (catalog 173 → 171; validator green locally). Workflow
  now tees the liveness report, writes it to the run Summary, and on failure
  files/updates a single `catalog-liveness` issue listing the broken entries — dead
  listings are visible without opening run logs. See ADR-0026.

