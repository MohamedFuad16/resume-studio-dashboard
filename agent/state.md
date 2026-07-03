# Project state

## Current state summary
Two-track résumé project. **Track A — Internship Portal** (`editor/`): React 18 + Vite
client and an ESM Node/Express server with sql.js (SQLite) KV storage (Vercel Blob in
prod), Tectonic-based LaTeX compile, an internship radar/tracker, an application
calendar, and an AI application assistant (OpenRouter `gpt-5-mini`). **Track B**: static
LaTeX résumés (`en/`, `ja/`) compiled by `build_all.sh` to `output/`. Latest refresh
(2026-07-03): **Firebase Auth gate + full per-user Firestore migration** (project
`resume-841f9`) — Email/Password + Google sign-in wall (redesigned bilingual login window),
open sign-up; per-user data (profiles/résumé, tracker, applications) now lives in Firestore
under `users/{uid}/...` via a client-direct data layer with owner-only rules; the `/api/*`
KV/Blob path is kept only for the no-auth/E2E case; the internship catalog stays server-seeded. Prior (2026-07-02): official-source catalog audit
with runtime retirements, 173 live seed roles, profile-aware HENNGE/Rakuten ranking, and the
first JA editor option mapped to Jake's Clean Japanese. `validate:catalog:links` 173/173 live;
build and 5 E2E tests green.

## Recent changes
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
