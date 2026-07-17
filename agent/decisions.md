# Architecture Decision Records (append-only)

Reverse-engineered from the codebase on 2026-06-29. Newest at the bottom.

---
## ADR-0001 — Resume Studio: React client + Node/Express seed server
- **Date:** 2026-06-29
- **Status:** Accepted (reverse-engineered)
- **Context:** Need a local-first, form-based bilingual résumé editor with live
  PDF preview and an internship tracker, deployable to Vercel.
- **Decision:** Vite + React 18 SPA (`editor/src`) talking over `/api/*` to an ESM
  Express server (`editor/server`). `npm run dev` runs both via `concurrently`; Vite
  proxies `/api` to `:5005`. Production exposes the same app through a single Vercel
  function `editor/api/[...path].js`.
- **Consequences:** One mental model for local + prod; the Vite proxy must match the
  server port. The server is the only writer of persistence and the only LaTeX caller.

---
## ADR-0002 — Persistence via sql.js (SQLite) KV + Vercel Blob snapshots
- **Date:** 2026-06-29
- **Status:** Accepted (reverse-engineered)
- **Context:** Want SQLite semantics without a native binary, and durable writes on
  Vercel's ephemeral filesystem.
- **Decision:** `server/storage.js` runs sql.js (WASM) with a single `kv(key,value,
  updated_at)` table. Locally it persists to `server/.data/resume-studio.sqlite`; in
  prod it loads/saves versioned snapshots to Vercel Blob (`BLOB_READ_WRITE_TOKEN`,
  keeping the last 8). All domain data is JSON under namespaced keys.
- **Consequences:** Portable, no native deps; but the whole DB is serialized on every
  write and prod durability requires a Blob token (else ephemeral per cold start).

---
## ADR-0003 — LaTeX résumés compiled with Tectonic (EN/JA pipeline + in-app reuse)
- **Date:** 2026-06-29
- **Status:** Accepted (reverse-engineered)
- **Context:** High-fidelity, reproducible PDF résumés in English and Japanese.
- **Decision:** Static `.tex` sources in `en/` and `ja/` are compiled by `build_all.sh`
  to `output/` using Tectonic (XeLaTeX). The web app's `server/templates.js` mirrors
  these designs and shells out to the **same** `tectonic` binary for `/api/compile`.
  An opaque-box Python/PyMuPDF suite (`tests/`) validates the PDFs.
- **Consequences:** App and static résumés stay visually consistent; Tectonic is a
  hard runtime dependency for compile/export (graceful fallback to last saved PDF).

---
## ADR-0004 — Static internship seed catalog, enriched + merged at read time
- **Date:** 2026-06-29
- **Status:** Accepted (reverse-engineered)
- **Context:** The internship radar needs a curated, verifiable dataset plus room for
  live/custom additions, without unverified filler.
- **Decision:** Seed datasets live in `server/seeds/` (`internships.js` +
  date-stamped research files like `japan-wide-research-2026-06-29.js`). At read,
  `internship-enrichment.js` adds detail, entries are validated, and merged (dedup by
  **id**) with stored live-research/custom items. The client (`useInternshipCatalog`)
  re-dedups by id.
- **Consequences:** Easy to extend by dropping a new dated seed file; id is the single
  identity key (URL-based dedup was removed so multiple roles per company/URL coexist).

---
## ADR-0005 — Localized `<select>` options must carry language-stable values
- **Date:** 2026-06-29
- **Status:** Accepted
- **Context:** The internship radar stores filter state as raw (English) values but
  renders localized (JA) option labels. An option without an explicit `value` uses its
  text as the value, so in JA mode the stored value became the Japanese label and
  `item.track === track` never matched (track filter returned no results). The `region`
  filter had been fixed this way; `track` had not (see `agent/errors.md`).
- **Decision:** Every `<select>` whose options display localized text must set an
  explicit, language-stable `value={rawValue}`. Applied to the track filter.
- **Consequences:** Filters work identically in EN/JA. New localized dropdowns must
  follow this (codified in `agent/conventions.md`).

---
## ADR-0006 — Single source of truth for JA/EN display localization
- **Date:** 2026-06-29
- **Status:** Accepted
- **Context:** EN→JA localization was implemented twice: the exported helpers in
  `utils/internshipDisplay.js` (used by `ProfileDashboard`/`ApplicationCalendar`) and a
  near-identical inline `jaDisplay`/`displayValue`/`displayRole` in
  `InternshipDashboard.jsx`. The two regex chains had drifted (the inline copy was the
  more complete, user-tuned one; the util copy also carried a typo mapping
  `Class of 2028 Security Engineer Internship` → ソフトウェア…), so every new phrase had to
  be edited in both places (see `agent/errors.md` ISSUE-002/003).
- **Decision:** Consolidate into the single `utils/internshipDisplay.js` module. The
  comprehensive radar chain becomes the canonical `jaDisplay` there, exported via
  `displayValue`/`displayRole`; `InternshipDashboard.jsx` imports them and the inline
  copies are deleted. The two utils-only rules (bare `Minato`, bare
  `UI/UX Designer Internship`) were folded in so no consumer regresses, and the
  `Not stated; PC and transport benefits listed` rule was hoisted above the generic
  `Not stated;` prefix replace (ISSUE-003 fix). Radar-specific *presentation* helpers
  (`splitRole`, `splitLanguage`, `trackLabel`, `JA_TRACK_LABELS`, …) stay local — they
  are layout, not translation.
- **Consequences:** One place to add/maintain JA phrases; behaviour preserved for the
  radar and improved (more complete) for the profile/calendar views; the Security-role
  typo is fixed. JS bundle shrank ~7 KB. A future Vitest unit could lock the chain.

---
## ADR-0007 — Replace drifted form-first E2E spec with a dashboard-shell smoke suite
- **Date:** 2026-06-29
- **Status:** Accepted (supersedes the test approach implied by `editor.spec.ts`)
- **Context:** `editor/tests/e2e/editor.spec.ts` (~59 cases) was authored from
  `PROJECT.md`'s idealized **form-first** UI (`input[name="fullName"]`, `/api/resume` →
  `personalInfo`). The shipped app is **dashboard-first** (`personal`/`nameEn` shape,
  `/api/profile` + `/api/internships`). With chromium installed, a full run measured
  **57 failed (pure spec drift), 2 passed** (language-toggle checks). Keeping the file
  produced a permanently-red suite that hid nothing real.
- **Decision:** Delete the stale spec and add `editor/tests/e2e/app-smoke.spec.ts`: a
  small, green smoke suite for the real shell (4 cases — shell render, language indicator,
  rapid-toggle stability, dashboard↔radar↔editor navigation), preserving the two
  behaviours that genuinely passed. `npm run build` remains the primary client gate.
- **Consequences:** The E2E suite is now coherent and green against the real app, but
  thin — it asserts shell/navigation, not deep data flows. Grow it as the UI stabilizes
  (radar filtering/sorting, tracker status). Avoids the trap of re-asserting a UI contract
  that was never shipped.

---
## ADR-0008 — One shrink-safe radar grid + shared select styling; JA résumé redesign
- **Date:** 2026-06-30
- **Status:** Accepted
- **Context:** The Internship Radar table forced a horizontal scrollbar and several
  `<select>`s rendered with uneven internal spacing (the per-row status select showed a
  large mid-gap). The deadline/source banner in the calendar looked off-brand. Separately,
  the three Japanese résumé templates (`genJa01/02/03` in `server/templates.js`) looked
  unpolished. Investigation found **four** drifted `.intern-table-head,.intern-row` grid
  definitions in `index.css`; the winning one set `min-width:1180px` with
  `.intern-results{overflow-x:auto}` — the true cause of the overflow.
- **Decision:** (a) Collapse the radar grid to a single fluid `minmax(0,…)`/`fr` template
  (no `min-width`, no `overflow-x`), with `min-width:0` on the flex/grid ancestors so it
  always fits ≥~1024px and degrades through the existing mobile breakpoints. (b) Normalize
  every radar/dashboard `<select>` via one rule: `appearance:none` + a shared SVG chevron,
  consistent padding, and content-sized width for status selects. (c) Restyle
  `.calendar-source-note` as an on-brand info notice. (d) Redesign the three JA résumés to
  top-Japanese-company standards (proper rirekisho conventions for `genJa01`; conservative
  modern one-pagers for `genJa02`/`genJa03`), keeping page counts 2/1/1 and routing all
  Japanese text through `escJa`; EN templates and `generateLatex` left untouched.
- **Consequences:** The radar fits the viewport (verified 1024–1440 + mobile via headless
  Chromium); selects look uniform; the banner matches the design system; the JA résumés are
  recruiter-presentable. CSS is the single source for radar layout (avoid re-adding
  per-breakpoint grid overrides — extend the one template). Future JA résumé tweaks must
  recompile with Tectonic and re-check page counts.

---
## ADR-0009 — Internship catalog: shared seed builder + automated validator + expiry filter
- **Date:** 2026-06-30
- **Status:** Accepted
- **Context:** The catalog grew (now 183 entries, 83 Japan-based) and the user needs daily
  ingestion to be trustworthy: properly-formatted entries, working apply links, and correct
  DB persistence — plus the radar should stop showing dead (past-deadline) opportunities the
  user never applied to, and JA mode had untranslated strings and duplicated eligibility
  bullets.
- **Decision:** (a) Centralize seed assembly in `editor/server/seeds/catalog.js`
  (`buildSeedCatalog()`), imported by BOTH the server (`index.js` `readInternshipCatalog`)
  and the validator, so they can't drift. (b) Add `editor/server/validate-catalog.js` (npm
  `validate:catalog` / `validate:catalog:links`) as the automated daily/CI gate: schema/format
  (reuses `validation.js`, flags duplicate ids + duplicated list items), DB round-trip via
  `storage.js` (forced local sqlite, save→load equality), and optional link liveness (8-way
  concurrency, soft-fail for 401/403/405/429 bot-walls, hard-fail for 404/410/5xx/DNS/timeout/
  non-HTTPS/dead-redirect). Non-zero exit on hard failure. (c) Radar expiry: hide
  `deadlineDate < today` unless tracker status ∈ {applying, applied, interview}; "Not stated"
  always shows; stat cards derive from the visible set. (d) De-dupe eligibility at the
  render source (`internshipDetails`), not per-seed. (e) New verified internships go in a
  date-stamped seed file with INLINE JA fields (self-localizing) so `internshipDisplay.js`
  maps don't have to grow per entry.
- **Consequences:** One command verifies the whole catalog before/after ingestion; new daily
  data should be appended as a dated seed + must pass `validate:catalog:links`. Expiry
  filtering means the visible count < total seed count by design. The Vercel project is
  CLI-deploy-only (no GitHub auto-deploy) — ship with `vercel --prod --yes` from `editor/`.

---
## ADR-0010 — Recent-applications = applied-only; calendar surfaces applied apps; catalog CI gate
- **Date:** 2026-06-30
- **Status:** Accepted
- **Context:** "Recent applications" listed every tracked record (including "Saved"), with no
  way to set an item back to not-applied; the application calendar appeared to show only
  "Rakuten Group" because it rendered events solely for records carrying an exact
  `deadlineDate` (only the 2 Rakuten roles had one); the Saved/Applied status `<select>`s had
  a large text↔chevron gap; the daily catalog validator (ADR-0009) was still a manual command;
  and some apply `url`s pointed at generic careers/program landings rather than the specific
  posting for that role.
- **Decision:** (a) "Recent applications" filters to applied-type statuses
  `{applying, applied, interview}`; a "Not applied" option (`value=""`) untracks via the
  existing `updateStatus(internship, '')` path, so the row leaves the list reactively. (b)
  Applied-type records lacking an exact deadline render a distinct **green "applied" pill** on
  the applied date (`updatedAt`→`createdAt`) in addition to all deadline/milestone events;
  deadline-dated records are unchanged (no duplicate pill) — gated on "no deadline date". (c)
  `.application-row select` joins the shared content-sized select rule (`width:auto`) so the
  chevron sits beside the label. (d) Add `.github/workflows/validate-catalog.yml` (push/PR on
  `editor/**`, daily 06:00 UTC cron, manual dispatch; Node 20) running both validate scripts
  as the automated gate. (e) `validate-catalog.js` gains a **soft** `generic-apply-url`
  heuristic (`[1b]` report) that flags likely-landing-page URLs without failing CI; apply URLs
  are then audited toward the specific posting, flagging companies whose only real application
  page is a single program page (common for JP new-grad/intern programs) rather than inventing
  deep links.
- **Consequences:** The dashboard's application surfaces are now genuinely application-centric
  and self-cleaning, and the calendar reflects real activity (not just dated deadlines). CI
  blocks broken catalog data on every editor change and sweeps dead links daily. The
  generic-URL check is advisory only. Calendar form `<select>`s deliberately keep native
  appearance (they must line up with sibling date/time inputs) — only the `appearance:none`
  content selects were content-sized.

---
## ADR-0011 — Link-liveness checker tolerates transient/anti-bot transport errors (retry + soft-classify)
- **Date:** 2026-06-30
- **Status:** Accepted
- **Context:** The ADR-0010 "Validate Catalog" Action failed on `main` because the
  link-liveness step flagged Nuro's `…/careersitem?gh_jid=7594577` as `✗ BROKEN
  UND_ERR_SOCKET`, while the posting was demonstrably **live** (Greenhouse board API + HTTP
  200 in a browser; passed 180/180 locally). The reset only happened from GitHub runner IPs
  (anti-bot / flaky network). The original `checkUrl` did **no retries** and treated **every**
  pre-HTTP network error as a HARD failure, so one transport-level reset failed the whole
  daily sweep — a false positive that would recur and erode trust in the gate.
- **Decision:** Keep CI strict on genuinely dead links but resilient to transport flakiness.
  `checkUrl` retries transport-level errors (env-tunable `VALIDATE_LINK_RETRIES`=2, linear
  `VALIDATE_LINK_RETRY_BACKOFF_MS`=600ms) and sends fuller browser-like headers
  (`LIVENESS_HEADERS`). `classifyNetworkError` splits errors: **transient** (retry, then
  SOFT-warn if persistent) = `UND_ERR_SOCKET`, `ECONNRESET`, `ETIMEDOUT`, undici
  connect/headers/body timeouts, `AbortError` timeout, `EAI_AGAIN`, and "socket hang up"/
  "other side closed" messages; **hard** = DNS-not-found (`ENOTFOUND`), non-HTTPS/malformed,
  dead redirects, and any HTTP 4xx/5xx (HTTP responses are definitive → never retried,
  returned immediately). Existing soft/hard semantics for HTTP statuses are untouched, and the
  exit-code contract is unchanged (non-zero only on hard failures).
- **Consequences:** The daily sweep no longer flaky-fails on anti-bot connection resets, yet
  still hard-fails on truly dead postings (404/410/5xx/DNS-not-found/non-HTTPS/dead-redirect).
  A host that persistently resets the runner shows as one informational `⚠ network reset after
  N tries (CODE)` soft warning. Trade-off: a posting that goes dead **only** via socket reset
  (rare) would soft-warn instead of hard-fail; the conservative default keeps unknown/ambiguous
  network errors HARD. Retries add a little wall-clock time only when errors occur.

---
## ADR-0012 — Multi-profile support: configurable default/protection, robust sample seeding, `personal.postalCode`, EN branding
- **Date:** 2026-07-01
- **Status:** Accepted
- **Context:** The store only force-seeded `mohamed_fuad`, so a fresh/partial DB showed a
  single sample (the only other profile file was a scratch `temp.json` with `nameEn:"fdf"`).
  The delete route hardcoded the `mohamed_fuad` guard, and several paths hardcoded that id as
  the fallback. The app is being rebranded from "Resume Studio"/"Resume Editor" to "Internship
  Portal", and an upcoming form wave needs a `personal.postalCode` field that the server must
  accept/normalize without stripping it from existing profiles. This is Wave 1 (server only);
  client wiring (`App.jsx`) follows in a later wave.
- **Decision:** (a) **Sample seeding** — introduce `SAMPLE_PROFILE_IDS`
  (`['mohamed_fuad','aiko_tanaka']`) and `ensureSampleProfiles()` which calls the idempotent
  `readProfile(id)` per sample (writes to KV only when the `profile:<id>` key is missing AND
  `server/profiles/<id>.json` exists). Wired into `initPersistentStore()` and the empty-store
  branch of `listProfiles()`, so both demo people appear on a fresh DB and a missing second
  sample is back-filled on boot even if the primary already exists. (b) **Second sample**
  `aiko_tanaka` is a polished, distinct bilingual CS grad student, matching the exact JSON
  shape of `mohamed_fuad.json`; the scratch `temp.json` is deleted (no leftover "fdf"). (c)
  **Configurable identity/protection** — `DEFAULT_PROFILE_ID` (env `RESUME_DEFAULT_PROFILE_ID`)
  replaces hardcoded fallbacks in `sanitizeProfileId`/`readProfile`; `PROTECTED_PROFILE_IDS`
  (env `RESUME_PROTECTED_PROFILE_IDS`, comma-separated; default = the primary) gates DELETE.
  `deleteProfile` continues to remove `profile:`/`tracker:`/`applications:` keys together (no
  orphans). (d) **`personal.postalCode`** — optional string normalized in `validation.js`
  (`normalizePostalCode`: trim, ≤16 chars, `^[0-9A-Za-z][0-9A-Za-z\s-]{0,15}$`) on both the
  canonical `personal` and legacy `personalInfo` blocks; absent ⇒ untouched (back-compat),
  invalid ⇒ 400. (e) **Branding** — only user-visible/API/log strings in `index.js` change to
  "Internship Portal"; internal storage identifiers (`resume-studio.sqlite`, the Blob key,
  `RESUME_STUDIO_*` env names) are intentionally left as-is to avoid breaking persistence.
- **Consequences:** The app ships with two distinct sample people and self-heals seeding on
  boot; the "undeletable" profile and default are now config-driven rather than hardcoded.
  Creating a new profile is just a POST to `/api/resume?profile=<newId>` (existing contract,
  no new route). `postalCode` is stored under `personal` and survives read/normalize. Branding
  is split: user-facing copy renamed, durable keys frozen — renaming those keys later would
  require a data migration. NEXT WAVE (`App.jsx`): add a `postalCode` input to the personal
  section + wizard `personal` defaults; the in-UI delete guard (`if (id === 'mohamed_fuad')`)
  and the `'mohamed_fuad'` URL/default fallbacks should track `DEFAULT_PROFILE_ID`; a "create
  profile" UI can POST any new id.

---
## ADR-0013 — Dated catalog retirements and shared applied-company ranking
- **Date:** 2026-07-02
- **Status:** Accepted
- **Context:** Official-source review found expired, explicitly closed, removed, and
  misrepresented internship records. Deleting a seed alone was insufficient because its
  persisted copy could be reclassified as non-seed data and merged back. The user also
  identified HENNGE and Rakuten as already applied, but wanted genuinely exceptional fits
  to retain their rank across both the radar and dashboard rail.
- **Decision:** (a) Keep historical research immutable and add a date-stamped audit module
  with exact retired IDs plus narrow current-record patches. Apply it from the shared seed
  builder and enforce retirement on every stored/live/legacy catalog read and write path.
  (b) Centralize company normalization, profile/tracker applied-company aggregation, and
  comparison logic in `src/utils/internshipRanking.js`. For `mohamed_fuad`, HENNGE and
  Rakuten Group are treated as applied; tracker statuses add future companies dynamically.
  Roles scoring 98+ are exceptional and retain natural score rank; lower matches from those
  companies sort behind fresh companies without changing their underlying fit scores.
- **Consequences:** A retirement is auditable and survives SQLite/Vercel persistence, while
  re-opening a role requires explicitly removing its ID or adding a new current ID. Ranking
  behavior is consistent in both surfaces and remains additive to tracker state. The
  profile-specific seed is intentionally local product data; if profiles become user-created
  at scale, applied-company preferences should move into persisted profile/tracker data.

## ADR-0014 — Firebase Authentication gate + Firestore scaffold (auth first, data migration deferred)
- **Date:** 2026-07-03
- **Status:** Accepted
- **Context:** The user wants Firebase (project `resume-841f9` / `501333131661`) as the
  backend with Email/Password + Google auth and Firestore. The app today stores all
  résumé/tracker/application data in a sql.js + Vercel Blob KV backend with named profile
  ids (`mohamed_fuad`, `aiko_tanaka`). A full migration to per-user Firestore collections is
  large and risky and touches every server route. This realizes Phase 4 of
  `PLAN-2026-07-03-portal-overhaul.md` but with real config instead of a placeholder scaffold.
- **Decision:** Ship the **auth gate + Firestore scaffold** with **open sign-up** (chosen by
  the user) and keep existing data storage on the KV/Blob backend for now.
  - Registered a Firebase web app via CLI; enabled Email/Password (Identity Toolkit Admin
    API) — Google was already enabled. Created Firestore `(default)` in `asia-northeast1`.
  - Client: `src/auth/firebase.js` (init + `authAvailable`), `src/auth/useAuth.js` (hook +
    standalone `signOutUser`), `src/auth/AuthGate.jsx` (wraps `<App/>` in `main.jsx`),
    `src/components/LoginScreen.jsx` (bilingual, Google + email/password), and
    `src/data/userProfile.js` (upserts `users/{uid}` on login — the first real Firestore
    write). A "Sign out" button was added to the header.
  - Firebase web config is treated as public and hardcoded as fallbacks (env-overridable);
    `authAvailable` is false when `VITE_AUTH_DISABLED=true`, which Playwright sets so the E2E
    suite is not blocked by the login wall.
  - Firestore rules restrict each user to their own `users/{uid}` tree; deployed via CLI.
- **Consequences:** Login now gates the whole app when auth is available; per-user data
  isolation and moving résumé/tracker/settings into Firestore remain **out of scope** and are
  the next step if multi-tenant storage is wanted (new collections should hang off
  `users/{uid}`). Server-side ID-token verification is not yet implemented — the current API
  still trusts the profile query param, so this is an auth gate, not a security boundary on
  the data API. Before a Vercel deploy, the production domain must be added to Firebase Auth
  authorized domains (see `agent/secrets.md`). Bundle grew ~340 KB → ~1.05 MB (286 KB gzip)
  from the Firebase SDK; code-splitting/lazy auth import is a possible later optimization.

## ADR-0015 — Full per-user data migration to Firestore (client-direct)
- **Date:** 2026-07-03
- **Status:** Accepted
- **Context:** Following ADR-0014's auth gate, the user asked to move all per-user data off the
  sql.js + Vercel Blob KV backend into Firestore with per-user isolation. Chosen architecture
  (user decision): **client-direct** (React SDK reads/writes Firestore, no Firebase Admin SDK),
  with the **global internship catalog kept server-seeded**.
- **Decision:**
  - **Data model** (owner-only rules already deployed): `users/{uid}/profiles/{profileId}`
    `{ name, resume, createdAt, updatedAt }`; `users/{uid}/trackers/{profileId}` `{ data, updatedAt }`;
    `users/{uid}/applications/{profileId}` `{ items, updatedAt }`.
  - **`src/data/firestoreData.js`** implements the same surface as the HTTP API
    (listProfiles/getProfile/saveProfile/removeProfile, getTracker/saveTracker,
    listApplications/createApplication) plus `ensureSeed`. **`src/api/client.js`** delegates
    profileApi/trackerApi/applicationApi to it when `firestoreEnabled()` (signed-in), and keeps
    the legacy `/api/*` HTTP path for the no-auth / E2E (`VITE_AUTH_DISABLED`) case. `internshipApi`
    (catalog + research) is always HTTP.
  - **Server decoupled from KV for authed users:** the LaTeX **export** endpoints gained POST
    variants that take the résumé in the body (`/api/export/{pdf,tex,ai}`), JSON export is now
    client-side, and a stateless **`/api/cover-letter`** builds the letter so the client can store
    the application record in Firestore. `/api/compile` and `/api/chat/edit` already took the résumé
    in the body. The GET export routes + KV read/write endpoints remain for the no-auth path.
  - **Seeding:** `ensureSeed` (run once in AuthGate before App mounts) gives owner accounts
    (`VITE_OWNER_EMAILS`, default `flashxjapan@gmail.com`) a copy of the `mohamed_fuad` sample
    (profile + tracker, keeping id `mohamed_fuad` so the ranking map + defaults align); everyone
    else gets a blank `primary` profile. App's boot now resolves the active profile against the real
    list (falls back off the hard-coded `mohamed_fuad` default), and delete falls back to the first
    remaining profile.
- **Consequences:** Signed-in users get real-time, per-user isolated data with offline support and
  no server data secret. The KV/Blob backend is now only exercised by the no-auth/E2E path. **Known
  limitations:** custom researched companies (`/api/internships/custom`) are still server-global
  (one user's researched role can appear for others) — acceptable for the current single-real-user
  scope, migrate later; base64 ID photos live inside the profile doc (Firestore 1 MiB doc limit —
  move to Firebase Storage if it ever overflows); and the API still trusts the `profile`/body input
  (no server-side ID-token verification) so this remains an app boundary, not a data-API security
  boundary. Verified end-to-end: owner+non-owner seeding, profile/tracker write+read across reload
  (Firestore REST-confirmed), build green, E2E 5/5 (HTTP fallback), test account cleaned up.

## ADR-0016 — Per-user AI settings in Firestore; key sent per-request (Phase 2/3)
- **Date:** 2026-07-03
- **Status:** Accepted
- **Context:** The Settings view needs to store an OpenRouter API key + model slugs per user.
  The key is consumed **server-side** (internship-research.js / resume-chat.js), but the
  client-direct architecture (ADR-0015) has no Firebase Admin SDK, so the server cannot read
  Firestore. The original plan (Phase 2) assumed a server KV `settings:<profileId>` with a
  masked-key GET.
- **Decision:** Store settings at `users/{uid}/settings/app` in Firestore (owner-only rules),
  read/written directly by the client via `settingsApi` (`data/firestoreData.js`); fall back to
  `localStorage` for the no-auth/E2E path. No server settings endpoint. The key is treated
  write-only in the UI (masked "key saved" note + Remove). The server continues to read
  `OPENROUTER_API_KEY` from env; **Phase 3 will send the user's key + model slugs in the
  research/chat request body**, resolving stored-key → env fallback server-side.
- **Consequences:** Simplest path that keeps the key per-user and isolated without an Admin SDK
  or a service-account secret. Trade-off: the key travels in request bodies to our own API over
  HTTPS (acceptable; it is the user's own key). If server-side-only key custody is ever required,
  revisit with the Admin SDK + ID-token verification (also needed for a real data-API boundary).

## ADR-0017 — LLM catalog audit is advisory-only (never auto-retire)
- **Date:** 2026-07-03
- **Status:** Accepted
- **Context:** Phase 7 adds a cheap-LLM daily validity pass (`audit-catalog-llm.js`) on top of
  the mechanical validator. An LLM reading a live page can be wrong (JS-only pages, bot walls,
  ambiguous copy), so acting on its verdict automatically risks removing a still-open role.
- **Decision:** The LLM audit **never mutates the catalog**. It selects stale-risk entries
  (deadline within N days, `verifiedDate` older than N days, or a generic apply URL), asks the
  audit model `{stillOpen, deadlineChanged, note}`, and writes a dated advisory report
  (`server/seeds/llm-audit-<date>.json`, git-ignored; CI artifact). Only the MECHANICAL validator
  may auto-fail/retire (404/410). The script exits 0 on any error and skips gracefully without
  `OPENROUTER_API_KEY`, so CI stays green with or without the secret. Model is env-configurable
  (`LLM_AUDIT_MODEL`, default a cheap nano-class slug); token usage is logged per run.
- **Consequences:** Zero risk of an LLM hallucination silently dropping a valid role; a human/agent
  confirms "closed" verdicts before editing seeds. Cost is bounded (only stale-risk entries, with
  `--limit`), and the daily CI step is best-effort.

## ADR-0018 — Live PDF preview via a containerized compile backend
- **Date:** 2026-07-04
- **Status:** Accepted
- **Context:** Vercel's serverless runtime can't run Tectonic (LaTeX), so the deployed
  PDF preview served a stale prebaked fallback instead of the user's live edits. The JA
  templates also used macOS-only fonts (Hiragino / Avenir Next).
- **Decision (user-chosen):** Run the existing Node/Express server in a Docker container
  with Tectonic + Noto CJK fonts; the Vercel frontend calls it via `VITE_API_BASE_URL`
  (the client already routes all `/api/*` through that base). Root `Dockerfile`
  (node:22-trixie — glibc ≥2.38 for the Tectonic prebuilt; amd64) + `render.yaml`
  Blueprint + `docs/compile-backend.md`. Templates gained an env-driven font profile:
  `RESUME_FONT_PROFILE=linux` swaps the JA fonts Hiragino→Noto Serif CJK (Mincho) /
  Noto Sans CJK (Gothic); macOS (unset) keeps Hiragino; EN templates unchanged (no
  fontspec). The compile endpoint already takes the résumé in the body, so it compiles
  live data; per-user data stays in Firestore.
- **Consequences:** Verified locally by building the image and compiling all EN/JA
  templates (JA renders Noto Mincho body + Gothic headings, bold auto-detected, 1 page,
  visually ~identical to Hiragino). The user deploys the container (Render free tier)
  and sets `VITE_API_BASE_URL` + redeploys the frontend. Free hosts cold-start (~30–60s)
  after idle. The Vercel serverless API becomes a fallback (still serves prebaked PDFs
  if `VITE_API_BASE_URL` is unset).

## ADR-0019 — Compile/research backend on Azure Container Apps (always-on)
- **Date:** 2026-07-05
- **Status:** Accepted (supersedes the Render hosting choice in ADR-0018; the Dockerfile
  and font-profile decisions there still stand)
- **Context:** Render's free tier sleeps after ~15 min idle, so the first live company
  search or PDF compile after a break cold-started (~30–60s) and sometimes failed outright
  ("company research failed", observed for Goldman Sachs). The user has Azure credits and
  asked to move the backend somewhere always-on.
- **Decision:** Deploy the same root `Dockerfile` to **Azure Container Apps** with
  **`--min-replicas 1`** (never scales to zero → no cold starts), 1 vCPU / 2 GiB (enough
  for Tectonic). Resources: RG `internship-portal`, env `portal-compile-env`, ACR
  `ca7959c48768acr`, app `portal-compile` (region westus2 — where the env landed;
  latency is dominated by the outbound LLM call, so cross-region RTT is negligible).
  **Build method matters:** `az containerapp up --source .` ignores the root Dockerfile,
  falls back to Oryx buildpacks, and fails on this monorepo ("Could not detect the
  language from repo"). The working path is two explicit steps — `az acr build --file
  Dockerfile .` (cloud build, no local Docker) then `az containerapp create` from the
  pushed image. The Dockerfile's `FROM` was also un-pinned from `--platform=linux/amd64`
  because ACR's Dockerfile dependency scanner can't parse an inline platform (ACR agents
  are amd64 regardless; local arm64 Macs pass `--platform linux/amd64` on the CLI).
- **Consequences:** Verified on Azure — `/api/status` ok; `POST /api/compile` returns a
  freshly-compiled EN PDF (~6.6s, 31 KB) and JA PDF (~3.8s, 104 KB with embedded Noto CJK
  subsets). Frontend `VITE_API_BASE_URL` repointed Render→Azure FQDN in Vercel and
  redeployed. Always-on carries a small ongoing cost (covered by the user's credits); set
  `--min-replicas 0` to pause. Redeploy after code changes = re-run `az acr build …` then
  `az containerapp update -n portal-compile -g internship-portal --image …:latest`. Guide:
  `docs/azure-deploy.md`.

---

## ADR-0025 · 2026-07-08 · Company logo domains: never trust job-board hosts; curated direct-icon fallback
**Status:** Accepted (in working tree)
**Context:** The internship-card logo chip resolves an icon via DuckDuckGo favicons for a
domain chosen as `item.companyDomain || KNOWN_DOMAINS[company] || domainFromUrl(item.url)`.
Live-researched items (`internship-research.js`) set `companyDomain` from the posting's
`sourceUrl` hostname — which is frequently a job board / ATS (herp.careers, 01intern,
wantedly…), so e.g. an enechain opening surfaced by live search rendered the HERP favicon
("wrong logo"). Separately, some real company domains (enechain.co.jp, m3.com) 404 on the
DDG favicon service, degrading the chip to text initials.
**Decision:** (A) Share one job-board/ATS blocklist regex and apply it in BOTH places:
server-side, `companyDomain` is blanked when the sourceUrl host matches (future items);
client-side, `CompanyLogo.jsx` ignores a stored job-board `companyDomain` (heals existing
items) and prefers the curated `KNOWN_DOMAINS` entry over any derived domain. (B) Add a
small `KNOWN_LOGOS` map of direct icon URLs (case-insensitive, like `KNOWN_DOMAINS`) tried
before the DDG favicon: enechain's real icon PNG (its /favicon.ico is a 78-byte stub) and
m3.com/favicon.ico. The ADR-covered decision to avoid Google s2 favicons (returns a globe
at HTTP 200, so onError never fires) is unchanged.
**Consequences:** Live-search results show the company's own icon or clean initials — never
a job board's logo. Curated map wins over data, so a bad stored domain can't shadow a known
good one. `KNOWN_LOGOS` entries are external URLs that could rot; they fail over to the DDG
favicon → logoUrl → initials chain via the existing onError ladder.

---

## ADR-0026 · 2026-07-09 · Catalog liveness failures must be visible outside run logs
**Status:** Accepted
**Context:** The daily validate-catalog.yml cron (format + DB round-trip + link
liveness) had been failing for days — correctly, over two dead listings — but the only
signal was a red X buried in the Actions tab. Dead postings also have no retirement
field in the schema, so "fixing" a dead listing means removing it from the seeds.
**Decision:** (A) Remove genuinely-dead postings from `seeds/internships.js` (Verkada
global-010, Kinaxis global-049). (B) Teach the workflow to tee the liveness report,
append the BROKEN/summary lines to $GITHUB_STEP_SUMMARY on every run, and on failure
create-or-comment a single open issue labeled `catalog-liveness` with the broken URLs,
the run link, and the fix instruction (job permissions: issues:write).
**Consequences:** A failing sweep now lands in Issues/notifications with the exact
entries to retire. One tracking issue accumulates comments instead of spamming new
issues. Retirement stays manual by design — the validator never auto-deletes data.

---

## ADR-0027 · 2026-07-09 · Server loads editor/.env.local at boot (load-env.js)
**Status:** Accepted
**Context:** Live company research ("Search official sources" for companies not in
the catalog) failed instantly with OPENROUTER_API_KEY_MISSING whenever no key was
saved in Settings. The intended fallback (ADR-0016: per-user key → env) was dead in
BOTH environments: local `npm run dev` never loaded `editor/.env.local` (Vite only
exposes VITE_* to the client; the Node server had no dotenv), and the Azure container
app `portal-compile-jp` was deployed without the OPENROUTER_API_KEY env var
(verified by direct keyless POST → OPENROUTER_API_KEY_MISSING).
**Decision:** Add dependency-free `server/load-env.js` — parses `editor/.env.local`
then `editor/.env` (KEY=VALUE, optional quotes/export, missing files ignored, real
env always wins) — imported as the FIRST import of `server/index.js` so it runs
before any module-scope `process.env` reads. Prod fix stays operational: set
`OPENROUTER_API_KEY` on the Azure container app (az containerapp update
--set-env-vars), or save the key in Settings (already works, verified end-to-end).
**Consequences:** Local dev research works out of the box with the key already in
`.env.local`; the BLOB token / model overrides there also now apply. No behavior
change in containers (file absent → no-op). See BUG-010 in errors.md.

---

## ADR-0028 · 2026-07-15 · LoginScreen restyled to the "split card" reference theme
**Status:** Accepted
**Context:** The user supplied a reference login design (Offloop) and asked for its exact
design theme — UI, font, and styling language — on the portal's login page. The existing
LoginScreen (ADR-era Phase 4) used a different language: a mint→blue ambient gradient
behind a centered white "app window" (macOS lights + brand pill), a two-column
headline/feature-rows + form split, all-sans typography, 10px-radius controls, and the
brand-blue primary button. None of that survives contact with the reference.
**Decision:** Rewrite `components/LoginScreen.jsx` + the auth block of `index.css` to the
reference language: a split card floating on warm light gray (`#f1f0ee`) — white form pane
left, ambient sunset art pane right (pure CSS gradients + a floating product mock built
from the existing FEATURES copy, so no image asset is needed). Typography pairs a serif
display headline (**Instrument Serif**, added to the Google Fonts import, with **Noto Serif
JP** carrying the JA headline since Instrument Serif has no kana) against small muted Inter
body copy. Controls are fully-rounded pills (`border-radius: 999px`); the primary button is
black (`var(--t1)`), and stays visually inert until every field has a value.
Fields are placeholder-only per the reference — visible `<label>` text is dropped, so each
input carries an `aria-label` to keep the accessible name.
**Consequences:** Auth behavior is untouched (Google sign-in, email/password sign-in, open
sign-up, EN/JA toggle + persistence, error surface). The art pane is `display:none` below
900px, where the form pane centers alone. Two adjacent bits of copy changed shape: the
headline is now the mode title ("Welcome back" / "Welcome to Internship Portal") and the
feature rows moved from the left column into the art-pane mock (titles only, bodies
dropped). Adds a Terms/Privacy legal line whose `#terms`/`#privacy` hrefs are placeholders
— they need real targets before this is user-facing.

---

## ADR-0029 · 2026-07-15 · Public Terms + Privacy pages on a hash route
**Status:** Accepted
**Context:** The redesigned login page (ADR-0028) links to Terms of Service and Privacy
Policy, but both hrefs were placeholders pointing nowhere, and the app has no router
(react-router is not a dependency; App.jsx switches views with `appView` state).
Legal pages must be readable BEFORE sign-in, so they cannot live inside AuthGate.
**Decision:** Address them by hash. Added `hooks/useHashRoute.js` (subscribes to
`hashchange`) and `components/LegalPage.jsx`, wired in `main.jsx` via a `Root` component
that renders `<LegalPage>` for `#terms`/`#privacy` and otherwise falls through to
`<AuthGate><App/></AuthGate>` — so the docs are public and the auth path is untouched.
LegalPage reuses the login design language (warm-gray page, white card, Instrument Serif
title, muted Inter body) and the same `resume-studio-language` key, so EN/JA persists
across login ↔ legal.
**Copy is written against what the app verifiably does**, not boilerplate: Firebase Auth +
per-user Firestore storage, Vercel hosting/Blob, and — confirmed at `server/resume-chat.js`
(`JSON.stringify(resume)` in the prompt) — résumé content is sent to OpenRouter when AI
features are used, which the Privacy Policy states plainly. It also states that no analytics
run: `measurementId` exists in the Firebase config but `getAnalytics` is never called, and
localStorage holds only `theme` + `resume-studio-language`.
**Consequences:** **The copy is a drafted starting point and has NOT had legal review.**
`OPERATOR`, `CONTACT_EMAIL` (`support@example.com`), `JURISDICTION`, and `LAST_UPDATED` are
placeholder constants at the top of LegalPage.jsx that MUST be filled before the pages are
public — the contact address is currently fake, so a data-deletion request would reach
nobody. If analytics or another processor is added later, the Privacy Policy's "we do not
currently run analytics" claim becomes false and must be updated with it.

---

## ADR-0030 · 2026-07-15 · App shell: left sidebar, neutral palette, halo primary buttons
**Status:** Accepted
**Context:** Continuing the design overhaul (ADR-0028/0029), the user supplied two more
references (a sidebar nav; a glowing blue "Create event" button) and asked to merge them
with the login base. The app had no sidebar — `App.jsx` rendered a `.top-nav` in the 58px
`.tb` header — and its palette was blue-tinted throughout.
**Decisions:**
1. **Left sidebar** replaces `.top-nav`. `.shell` (already `flex-column`) now wraps
   `.app-body` (flex row) = `.app-sidebar` + `.app-main`. Views are NOT positionally
   coupled to `.shell` (no `.shell > *` selectors), so wrapping them was safe. The 58px
   `.tb` header is KEPT — five views size themselves with `calc(100vh - 58px)` — and now
   carries the current view title. Nav items live in `NAV_ITEMS`, whose `id`s are the
   `appView` values; Settings joins the nav (previously profile-menu only).
2. **Sidebar is monochrome**, per the user choosing the "clean base" over a blue-filled
   Noma-style bar: `#f6f6f5` surface, selected row = white card + hairline + soft shadow.
   No icon rail — it duplicated the icon each row already carries.
3. **Language + profile moved into the sidebar footer.** Both were built for a horizontal
   header (rounded pills, blue avatar), so `.side-foot` restates them as sidebar rows.
4. **Collapse** (`.app-sidebar.collapsed`, 236px→64px, icons only), persisted in
   `localStorage['sidebar-collapsed']`. Collapsed rows carry `title` + `aria-label` since
   the label is hidden; badges become a corner chip.
5. **Halo primary button** (blue gradient + glow) via `--halo-*` tokens, applied to
   `.btn-primary`/`.btn-submit-app` plus one primary CTA per surface (`.rail-action`,
   `.company-research-cta`, `.settings-save`, `.intern-summary > button`). Those four are
   declared later in the file, so they are restated after them rather than merged into the
   `.btn-primary` rule. Login/legal keep black pills (`.auth-*`) — user's explicit choice.
6. **Palette neutralised**: `--career-blue`/`--career-ink`/`--intern-blue` → ink `#101113`,
   `--career-muted` → `#6f7177`, and blue-tinted surfaces (`#f7f9fc`, `#f6f9ff`, `#eaf2ff`,
   `#f0f6ff`) → neutral equivalents. Blue now means "primary action" and nothing else;
   third-party brand colours (LinkedIn) are untouched.
**Consequences:** Sidebar badges read `useApplicationTracker(activeProfile).records.length`
— the same source as the dashboard's "N roles tracked", so the two cannot disagree. (An
earlier draft used App.jsx's `applications` state, which is the *AI assistant's* list, and
showed 1 next to a pipeline reading 6.) A dangling `.btn-new-profile:hover` selector, left
grouped with the old black `.btn-primary` rule, would have inherited the halo — it now has
its own black-hover rule. **Not yet checked: whether the Playwright E2E suite selects the
removed `.top-nav` / `.top-nav-btn`.**

---

## ADR-0031 · 2026-07-15 · Design pass 3: lucide icons, timeline view, flat primary, theme cleanup
**Status:** Accepted
**Context:** Review of the sidebar/halo work (ADR-0030) raised several issues at once.
**Decisions:**
1. **Icons** — the sidebar used the hand-drawn `I` set from `ui.jsx`, which read as
   unprofessional beside the rest of the app. `lucide-react@0.395` was ALREADY a
   dependency (used by ProfileDashboard/InternshipDashboard/ApplicationCalendar), so
   `NAV_ITEMS` now carries lucide components (`Icon`) instead of `I` name strings.
2. **Application timeline is its own view** (`appView === 'calendar'`). `ApplicationCalendar`
   was rendered at the bottom of ProfileDashboard; it is now a sidebar destination with its
   own `.calendar-view` scroll container. ProfileDashboard's now-unused `removeMilestone`
   destructure and `ApplicationCalendar` import were removed (`addMilestone` stays — the
   interview modal uses it).
3. **Halo dropped for a flat blue pill** (`--halo-bg: #1a56f0`, shadows `none`), per the
   "Add event" reference — the gradient + glow read as heavy against flat surfaces. Token
   NAMES kept as `--halo-*` so the ~8 call sites did not churn.
4. **Account menu = account only.** Settings was removed from the dropdown (it is a sidebar
   view now), leaving Sign out; the `onSettings` prop was dropped from ProfileSwitcher and
   App. The menu is suppressed entirely when there is neither an email nor `onSignOut` (the
   no-auth/E2E path) rather than opening an empty popup. Dropdown now sizes to the trigger
   and opens upward.
5. **Theme cleanup** — `--preview-bg` and the `html/body/#root` background were mint→blue
   gradients (`#c9f8e9`/`#c8fae9`…); both are neutral now. `.tb` lost its border-bottom and
   background (only the editor renders it, and the command bar below already separates).
6. **Settings uses the available width** (`max-width: 1100px`). `width: 100%` is REQUIRED:
   `.settings-view` is a flex item with `margin: 0 auto`, and auto margins on a flex item
   absorb free space, so without a definite width it shrank to its content (852px) and
   max-width never applied.
**Consequences:** `tests/e2e/app-smoke.spec.ts` selected `.top-nav-btn`, removed in
ADR-0030 — repointed to `.side-nav-btn`; all 5 tests pass. NOTE: local `npm run dev` now
502s/500s on every `/api/*` route because the `BLOB_READ_WRITE_TOKEN` in `editor/.env.local`
returns **403 Forbidden** from Vercel Blob (`server/storage.js` → `refreshFromBlob`). This is
an environment/credential problem, NOT a code regression. Added a `resume-studio-localdb`
launch config (`BLOB_READ_WRITE_TOKEN=` empty) which falls back to local sql.js — `hasBlob()`
is `Boolean(token)` and `load-env.js:29` only fills vars that are `undefined`, so an empty
value wins. The token needs rotating for blob-backed local dev.

---

## ADR-0032 · 2026-07-15 · Durable storage on Azure Files; catalog delete; account deletion
**Status:** Accepted
**Context:** The Vercel Blob free tier hit 100% of its 2,000 Advanced-Request quota and the
store was paused for 30 days (BUG-011). Investigating the move off Blob turned up a bigger
problem, below.
**Findings (verified against live Azure, not assumed):**
- **Production never used Vercel Blob.** `portal-compile-jp` had exactly three env vars
  (`RESUME_FONT_PROFILE`, `RESUME_STUDIO_APP_ORIGIN`, `INTERNSHIP_RESEARCH_TIMEOUT_MS`),
  `volumes: null`, `mounts: null`. Blob only ever ran from local `.env.local`. The backend
  had been on **ephemeral container disk since launch**, silently discarding every
  live-research result on each restart/deploy. The quota exhaustion did not cause this.
- **`/api/status` misreports durability.** `persistent` is
  `store.backend === 'vercel-blob-sqlite' || 'local-sqlite'` (index.js:374) — a label check
  that never inspects the disk. It reported `persistent: true` the whole time data was being
  destroyed. Left as-is for now; it should assert on the mount. **Still open.**
**Decisions:**
1. **Azure Files mount** — storage account `internshipportaljpdata` (japaneast,
   Standard_LRS) + share `resume-studio-data` (5 GB), linked to env `portal-compile-jp-env`
   as storage `resumedata`, mounted at `/data`, with `RESUME_STUDIO_DATA_DIR=/data`. NO code
   change: the data dir was already env-configurable (index.js:38). Revision
   `portal-compile-jp--0000001` (previous: `--4u2g71t`). **Verified by writing an entry,
   restarting the revision, and reading it back — it survived**; the share shows
   `resume-studio.sqlite`. Only the JP app was touched; `portal-compile` (West US) is
   untouched. Blob left as an optional layer (now non-fatal, BUG-011) rather than ripped out.
2. **`DELETE /api/internships/custom/:id`** — the catalog was add-only, so a wrong live-search
   result could never be removed (these are user-generated, so absent from `server/seeds/`).
   Removes from both the custom list and the shared catalog so the live-research merge in
   `readInternshipCatalog()` cannot resurrect it. New `validateInternshipId` in
   `validation.js` (per conventions: all server input validated there) — the id arrives as a
   URL path segment. Verified: delete 200; unknown id 404; traversal-ish id 400; **seed id
   404** (seeds are not deletable this way).
3. **Account deletion** — did not exist; only per-profile deletion did. Added
   `removeAllUserData()` (firestoreData), `removeUserDoc()` (userProfile), and
   `deleteAccount()` (useAuth), surfaced in Settings behind a typed `DELETE` confirmation.
   **Order is load-bearing: Firestore data is deleted BEFORE the auth user.** The rules key on
   `request.auth.uid`, so deleting the auth user first would orphan every document —
   unreachable and undeletable by anyone, forever. If the data step throws we never touch the
   auth user, so the account can sign in and retry. Handles `auth/requires-recent-login` by
   re-authenticating (popup for Google, password for password accounts). Hidden entirely on
   the no-auth path (verified).
**Consequences:** Azure holds NO per-user data — only the shared catalog + live-research
entries — so account deletion correctly touches Firebase Auth + Firestore only. Costs: one
Standard_LRS account + 5 GB share (cents/month). **The account-deletion flow is built and
builds clean but has NOT been executed end-to-end** — it needs a signed-in account, and
running it would permanently delete a real one. It needs a test account before being trusted.

## ADR-0033 · 2026-07-15 · Inset-card app shell; per-view cards instead of a floating window
**Context:** The reference design shows the sidebar flush to the viewport with each view as a
white rounded card floating in a soft gutter. A first attempt wrapped the whole app (sidebar +
content) in one floating panel over a gradient backdrop — rejected by the user.
**Decision:** Keep `html/body` white and `.shell` full-screen. `.app-main` is a gradient gutter
(`padding: 12px 12px 12px 4px`); every top-level view (`.profile-dashboard`, `.internship-radar`,
`.calendar-view`, `.settings-scroll`, `.applications-view`, `.profile-view`, `.editor-view`)
gets `background:#fff; border-radius:16px; box-shadow` from one shared rule in index.css. The
editor needed a new `.editor-view` wrapper (toolbar + commandbar + split were three siblings, so
no card could clip them; its old fixed split height now flexes). Sidebar: grey→peach vertical
gradient, `border-right: 0` — separation comes from the gutter, never a hard line.
**Consequences:** New views opt in by adding one selector to the shared card rule. The profile
dropdown still escapes the sidebar (opens upward; sidebar keeps `overflow: visible`). Dashboard
type scale reduced (h1 clamp 20–26px, section h2 15px, stat numerals 17px) as the new baseline.

## ADR-0034 · 2026-07-16 · Self-healing catalog via a machine-owned JSON overlay; sonar default
**Context:** The daily "Validate Catalog" action hard-failed every day on 2 naturally-dead
greenhouse listings that nothing retired. The catalog's source of truth is hand-formatted seed
JS arrays across 3 files — unsafe for a bot to edit surgically.
**Decision:** (1) Add `seeds/auto-refresh.json` + `auto-refresh.js` — a machine-owned overlay the
daily job regenerates *wholesale*, never touching seed arrays. It filters retired ids and patches
deadlines; wired as the outermost `buildSeedCatalog()` overlay and unioned into
`isRetiredInternshipId()` so all catalog paths honor it. (2) `server/refresh-catalog.js` reuses the
validator's liveness checker to find HTTP-dead listings, then double-checks each with the search
model — retire ONLY if the model doesn't say "still open" (HTTP-dead + still-open = conflict,
logged, left active for the human reviewing the auto-PR). (3) Workflow split: `validate` (push/PR,
format+round-trip, no flaky link gate) and `refresh` (schedule/manual → heal → re-validate →
open PR via peter-evans/create-pull-request). (4) Search model default → `perplexity/sonar`
(native web search, seconds vs gpt-5-mini:online's 120-245s); `:online` no longer stacked on
perplexity/*.
**Consequences:** No more daily red X — a heal run is green and proposes a reviewable PR (per the
auto-PR decision). Needs the `OPENROUTER_API_KEY` GH secret for LLM verification (degrades to
HTTP-only without it) and repo setting "Allow GitHub Actions to create and approve pull requests".
Naturally-dead links no longer block pushes (caught within 24h by refresh instead). Retirements
are reversible (edit the JSON). Harbinger is the live example of a conflict (company still hiring,
specific URL dead) — kept active for a human to re-URL rather than auto-deleted.

## ADR-0035 · 2026-07-16 · Gmail ingest: server-side read-only OAuth + client-drained queue
**Context:** Auto-add application emails to the tracker/calendar, 24/7, single-user. Tracker data
lives in client-direct Firestore (owner-only rules) — a server can't write it without
firebase-admin + a service account.
**Decision:** (1) Server-side Gmail (raw fetch, node:crypto — no googleapis/firebase-admin/cron
deps). Read-only scope. Refresh token AES-256-GCM-encrypted in the server KV store. (2) OAuth
callback derives the post-auth redirect from the request host (works on any prod domain).
(3) Pipeline: gpt-5-nano triage → sonar enrichment → sync pushes normalized actions to a
per-profile server queue; the CLIENT drains the queue into Firestore (Option C) — it owns the
match against existing records, so no admin SDK and no rule changes. Full-auto (user choice).
(4) 24/7 poll is a setInterval gated by isDirectRun, so it runs on the single-replica Azure
container but never in Vercel serverless.
**Consequences:** Works while the browser is closed (server keeps the queue fresh; client
reconciles on next open). Needs durable server storage + a persistent process = the Azure
container, NOT Vercel serverless (ephemeral). Prod deploy therefore must route the API (or at
least the Gmail routes) to Azure. 7-day testing-mode token expiry is avoided by publishing the
OAuth app to production; the reconnect banner is event-driven (fires only on a real invalid_grant),
not a timer. Gmail brand mark is nominative use to label the integration + tag ingested rows.

---

## ADR-0036 · 2026-07-16 · Native iOS app (ios/), planner-pastel design language
**Status:** Accepted
**Context:** User asked for an iOS version of the Internship Portal in Xcode on the
"iOS 27 liquid glass" design. The machine has Xcode 27.0 beta (27A5209h) with the
iOS 27.0 SDK — but xcode-select points at CommandLineTools and sudo is unavailable,
so every build exports DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer.
Mid-build, the user supplied a reference set (task-planner / wellness pastel UI) and
asked for a complete redesign to match it, starting from the Dashboard.
**Decisions:**
1. **Project layout** — `ios/project.yml` (XcodeGen) is the source of truth; the
   .xcodeproj is generated and gitignored (`cd ios && xcodegen generate`). SwiftUI,
   Swift 6, deployment target iOS 27.0, CODE_SIGNING_ALLOWED=NO (simulator only).
2. **Design language** (Theme.swift) — the planner reference: near-white canvas
   #F5F6F7, white cards (radius 22), near-black ink #16191C, pastel circular icon
   tiles (green/lavender/peach/sky, hash-stable per company), thin outlined chips,
   ONE saturated green accent #2FB56B (actions + match scores), ember orange for
   urgency. Rows are the reference's anatomy one to one: 56pt pastel circle with a
   TRACK glyph (frontend→macwindow, AI→brain, cloud→cloud, …; never a logo or
   lettermark), bold title + gray value chip, muted subtitle, no chevron. System
   Liquid Glass supplies the shell: native TabView (floating glass bar,
   .tabBarMinimizeBehavior) with selection tinted INK like the reference. The
   LOGIN screen alone keeps the web's warm-paper + serif + black pills (ADR-0028).
   This supersedes the first draft's web-token port (ink/blue #1A56F0) — the web
   and iOS apps now deliberately diverge.
3. **IA + data** — four content tabs (Home / Roles / Timeline / Settings) and NO
   search tab or nav-bar search: per user direction, search is a small pill INSIDE
   the Roles list (browsing is the primary mode). No Firebase yet. LoginView is the
   real design with sign-in stubbed; "Browse without an account" uses the PUBLIC
   catalog: PortalAPI fetches /api/internships from portal-compile-jp (Azure).
   Home = greeting header + stat chips + glowing top-match card +
   Tokyo-first/Beyond-Tokyo sections; Roles = sectioned catalog
   (Priority/Tokyo/Worldwide) with the inline search pill; Timeline = upcoming
   deadlineDate roles grouped by day (JST, per BUG-009); Settings = status + web
   links + back-to-sign-in. Editor deliberately deferred (no mobile LaTeX design).
4. **Headless verification hooks** — simulators can't be tapped from simctl, so the
   app accepts `--browse` (skip auth gate) and `--tab <dashboard|timeline|settings|radar>`
   launch arguments; screenshots via `xcrun simctl io <udid> screenshot`. Verified on
   an iPhone 17 Pro simulator (runtime downloaded via `xcodebuild -downloadPlatform iOS`).
**Consequences:** Login/Radar/Timeline/Settings/Detail still carry the first-draft
styling in places (Radar uses a plain List; detail uses glass chips) — the planner
restyle has landed on Dashboard + shared row components only. Firebase auth, the
per-user pipeline (saved/applied/rejected), and real UI tests (XCUITest instead of
launch-arg screenshots) are the known next steps. NavModel (tab selection in the
environment) exists so in-content controls can switch tabs.

## ADR-0037 · 2026-07-16 · Performance + UI bug pass: lazy compile, shared tracker cache, catalog memo, vendor chunks
**Context.** A full audit (browser walk + network trace + JA sweep) found: (1) a LaTeX
compile (`POST /api/compile`) fired on every page load even though the app lands on the
Dashboard; (2) `useApplicationTracker` was mounted 5× with no shared cache → 6
`GET /api/tracker` on one load; (3) `readInternshipCatalog()` rebuilt + re-validated the
seed catalog and double-`JSON.stringify`ed a ~1 MB drift check on every request; (4) the
client shipped as one 1.18 MB JS chunk; (5) `.intern-deadline` was coral for every row
(urgent had no color of its own); (6) JA mode leaked English ("Occasional hiring…",
"Remote in USA/Canada", SpaceX location); (7) at ≤560px the radar rows used the tablet
grid (a 4th `.intern-row` grid later in the file overrode the phone one), crushing the
company column to ~80px and leaving an empty cell where the hidden status select sat.
**Decision.**
- App.jsx compiles lazily: one effect gated on `appView === 'editor'` (deps: resume,
  template, appView) replaced the on-mount + on-template effects; `compile` still
  dedupes via `lastCompiled`. Profile switch just clears the cache key.
- `useApplicationTracker` got the same module-level per-profile snapshot + in-flight
  dedupe as `useInternshipCatalog`; `commit()` refreshes the cache; TRACKER_EVENT still
  syncs mounts; `refresh({force:false})` on mount.
- `readInternshipCatalog` memoizes the resolved catalog in-process for 60 s
  (`rememberCatalog`); all writers refresh the memo. TTL bounds staleness on
  multi-instance hosts (Vercel); Azure is single-replica.
- Vite `manualChunks`: vendor-react / vendor-firebase / vendor-ui (lucide+gsap).
  Firebase stays static (auth gate needs it at startup; `auth`/`db` are sync exports).
- CSS: urgent-only coral; JA mappings added; a phone `.intern-row` grid now lives AFTER
  the final ≤860px block (source order is the winner at equal specificity) — company
  spans the row, match/deadline stack full-width, status+apply share the bottom row.
**Verified.** Build green, E2E 5/5, one tracker GET and zero compiles on a dashboard
load, single compile on first Editor entry, JA + mobile verified in-browser at
375/1366px.

## ADR-0038 · 2026-07-17 · iOS app rebuilt on the AI-Studio reference theme; SwiftUI + Metal + Liquid Glass
**Context.** ADR-0036's planner-pastel iOS scaffold was scrapped at the user's
request. The new source of truth is a React reference app (`zip.zip`, AI Studio
export) that already renders this product's screens — Inter on a `#F4F7F6` ground,
white cards (r20–28) with `shadow-[0_2px_10px_rgb(0,0,0,0.02)]`, 36px pastel icon
tiles, teal-600 as the match accent, slate-900 primaries, and a hand-built floating
pill nav. Requirements: match that styling exactly, use Metal shaders, Liquid Glass
is mandatory, target the iOS 27 beta.
**Decision.**
- **Deleted** `ios/InternshipPortal/**` (ADR-0036 app) and the HTML design mockups.
  `project.yml` survives; the `.xcodeproj` stays generated (xcodegen) + gitignored.
- **Tokens** (`Theme.swift`) are transcribed 1:1 from the reference's Tailwind
  classes as literal hex, so nothing depends on a Tailwind build. **Typeface: SF Pro,
  not Inter** — same grotesque skeleton at these sizes; bundling a webfont buys
  licence surface and launch cost, not fidelity.
- **IA — 4 tabs** (Home · Radar · Applications · Calendar) per the user's spoken
  spec, which differs from the reference's Home/Radar/Calendar/Profile. Profile +
  Settings is a sheet off Home's Profile card. The résumé editor stays on the web.
- **Liquid Glass**: the nav is `GlassEffectContainer` + `.glassEffect(.regular
  .interactive(), in: .capsule)`; content scrolls under it (verified refracting).
- **Metal** (`Shaders.metal`): `auroraCanvas` (drifting teal/blue value-noise +
  grain over the ground), `radarSweep` (rings + rotating wedge behind the Radar stat
  strip), `shimmer` (loading skeletons), `pressWarp` (distortion under the finger).
  All are additive over an already-correct layout — a dead shader costs polish, never
  meaning.
- **Data**: unchanged contract — Azure `portal-compile-jp`, `GET /api/internships`,
  `GET|POST /api/tracker?profile=mohamed_fuad`, optimistic writes with rollback.
**Four Metal/SwiftUI constraints found by building it — all silent failures:**
1. **float32 time.** Passing `timeIntervalSinceReferenceDate` (~8×10⁸, ulp ≈ 64) to a
   shader collapses every `fract()`/hash to a constant → the effect renders flat and
   looks "too subtle" rather than broken. `ShaderClock` now passes seconds-since-launch.
2. **Chained effects.** `.colorEffect(a).colorEffect(b)` runs only the outermost;
   aurora + grain had to merge into one pass.
3. **Raster shaders skip UIKit-backed views.** Wrapping content containing a
   ScrollView in `.colorEffect` blanks the screen — shaders stay on the background layer.
4. **`colorEffect` over `Color.clear` never runs** (no rasterisation of a fully
   transparent layer). Generated content must use the shader as a ShapeStyle
   (`Rectangle().fill(ShaderLibrary.…)`), which takes no `currentColor`.
Also: `.environment()` must sit **above** the `.sheet` modifier or presented sheets
crash with "No Observable object of type CatalogStore found" — the store is now
injected at the App level.
**Verified.** Builds clean against iOS 27.0 SDK (Xcode 27.0, Swift 6); runs on an
iPhone 17 Pro sim against live prod data (173 roles, HENNGE 99%); all four tabs +
the detail sheet screenshotted; aurora confirmed by pixel sampling (11/255 shift at
the top, flat at the bottom). Tracker is empty because the KV path holds no records
for `mohamed_fuad` — signed-in web data lives in Firestore (see ADR-0036 scope note).

## ADR-0039 · 2026-07-17 · iOS signs in with Firebase and reads the real Firestore tracker; SwiftUI previews
**Context.** The iOS app read the server KV path (`?profile=mohamed_fuad`), which is
empty — signed-in web data lives in Firestore under `users/{uid}/…` (ADR-0015). So the
phone showed 0 applications while the web showed 24. The Swift files also had no
`#Preview`s, so the Xcode canvas was unusable for design review.
**Decision.**
- **Registered an iOS Firebase app** (`firebase apps:create ios`) → app id
  `1:501333131661:ios:e3d159530820c85377fdc4`. The web app id CANNOT be reused: the iOS
  SDK validates the `:ios:` platform segment of GOOGLE_APP_ID. `GoogleService-Info.plist`
  is committed (public config — see secrets.md).
- **SPM via project.yml**: firebase-ios-sdk (FirebaseAuth + FirebaseFirestore ONLY — no
  Analytics/Messaging/Crashlytics; each extra product is launch time for a feature we
  don't have) and GoogleSignIn-iOS.
- **AuthService** — email/password + Google, matching the web's two providers. Firebase's
  error codes are translated to sentences a person can act on.
- **FirestoreData** mirrors firestoreData.js exactly: reads
  `users/{uid}/trackers/{profileId}.data`, resolves the profile id from the real
  `profiles` collection (owner seed `mohamed_fuad` → `primary` → first) rather than
  assuming. Records decode one-by-one so a single malformed row can't blank the tracker.
- **CatalogStore routes by session**: signed in → Firestore (the same documents the web
  writes); signed out → KV path (kept so E2E/screenshots run without an account).
  `setUser` clears the previous account's records before loading — never show account A's
  data to account B, even for a frame. The catalog stays server-global either way.
- **Previews**: `PreviewData.swift` (`#if DEBUG`) builds stores with real production-shaped
  rows and NO network, plus loading/empty/failed variants; every view file has `#Preview`s
  and Kit.swift has a full component gallery.
**Three traps, all silent:**
1. **Keychain -34018 → infinite launch spinner.** `CODE_SIGNING_ALLOWED=NO` strips all
   entitlements; Firebase Auth persists the session in the keychain, so its state listener
   never fired its first callback and the app hung on the spinner with no way out. Fixed with
   ad-hoc signing + an explicit entitlements file (`application-identifier` +
   `keychain-access-groups`). AuthService also has a 5s failsafe that falls back to the
   login form — an unreachable app is worse than an unnecessary sign-in.
2. **`Field` name collision** — the `@FocusState` enum shadowed the field view; renamed AuthField.
3. **Swift 6 `deinit` is nonisolated** and cannot touch @MainActor state; the listener handle
   is `nonisolated(unsafe)` (written once in init, read once in deinit).
**Cost.** Firebase adds real launch time: ~30s cold first launch (dyld over ~200MB of
frameworks) and ~5.7s warm to first paint, in a DEBUG simulator build. Worth watching on a
release device build before shipping.
**Verified.** Builds clean (iOS 27 SDK, Swift 6); login screen renders; config plist and the
Google callback URL scheme are both in the bundle; previews compile. **End-to-end sign-in is
unverified** — entering the account password is the user's to do, not mine.

## ADR-0040 · 2026-07-17 · Shaders earn their place: SDF bubble field in, radar sweep + press-warp out
**Context.** User review of ADR-0038's shader work: the radar sweep read as "a weird
radar in the background", the press-warp distortion fought every tap, and the nav's
selection was a solid capsule rather than glass. Separately: build the Companies view
the way Wabi's splash is built (SwiftUI + Metal, warping loupe over signed distance
fields), and show companies as bubbles sized by how big they are.
**Decision.**
- **Removed `radarSweep` and `pressWarp`.** Both were decoration that cost
  comprehension: the sweep put moving rings behind a stat strip that has nothing to do
  with a radar sweep, and warping the card under your finger reads as the UI
  malfunctioning rather than as feedback. Press feedback is now only the reference's
  own `active:scale-[0.98]`. Kept: `auroraCanvas` (the ground) and `shimmer` (loading),
  which both do a job.
- **Nav is real Liquid Glass in both layers** — the bar, and a second glass capsule
  marking the selection that shares one `glassEffectID` inside the
  `GlassEffectContainer`, so the material flows between tabs instead of cross-fading.
- **`bubbleField`: ONE SDF over the canvas, not N circle views.** Every bubble is
  evaluated into a single field and combined with a polynomial smooth-minimum, so
  neighbours grow a meniscus and merge. This is unreachable with per-view shaders,
  which can only overlap — the merge IS the effect. Normals come from the field's
  gradient (4 taps), the field is lifted into a dome, and the view ray is bent through
  it with real refraction (Snell via Metal's `refract`), plus rim-only chromatic
  aberration, Fresnel and one specular hotspot. Cost is bounded by canvas size, not
  company count. `glassOrb` is the single-bubble variant for the entry button.
- **Companies view = three tier clusters, top 8 each.** All 103 fit on screen and it
  was mush: 70 companies list exactly one role, so as identical minimum-size dots they
  carried no information. Clustering by tier gives the shader's merge meaning — a
  bubble fuses with its own tier. Hidden counts are always labelled ("+44 more");
  a silently truncated field would lie about the data.
- **`Internship.tier`** reads BOTH `prestigeTier` shapes, because history left two: a
  bare "1"/"2"/"3" on the global seed rows and sentences like "Japan AI startup /
  verified ATS" elsewhere. Verified against live data: "1" is NVIDIA/Nokia/Cloudflare/
  Blue Origin, "2" is Hitachi/Formlabs/Geotab, "3" is smaller firms. Picking one shape
  would drop half the catalog into an unknown bucket.
- **Bubble radius ∝ √(role count)** so four roles reads as four times the *area* of
  one — area is what the eye compares. Role count is the only "how big" signal the
  catalog actually has; headcount is not in the data, and deriving it from prestige
  tiers would be a guess dressed as a fact. Packing is a deterministic golden-angle
  spiral that shrinks-and-retries until every bubble fits (an early version dumped
  unplaceable bubbles at the centre, stacking them invisibly).
- **`-previewMode YES`** launch arg skips the auth wall for screenshots. `#if DEBUG`
  only, so it cannot exist in a release build. Mirrors the web's `VITE_AUTH_DISABLED`.
**Verified.** Builds clean (iOS 27 SDK); the field renders 3 clusters against live prod
data with real logos refracting inside the glass; nav glass verified in-simulator.

## ADR-0041 · 2026-07-17 · Two glass bugs: glass-on-glass greys out, and a fixed dome shoulder makes a "border"
**Context.** User review: the nav "is grayed out, not proper liquid glass — it has to
be so liquid", and the Companies bubbles "have a weird border on the edges" instead of
reading as a 3D globe like Wabi's.
**Bug 1 — glass cannot sample other glass.** The nav had `.glassEffect` on the bar AND
a second `.glassEffect` capsule for the selection nested inside it. Apple's rule (and
the community reference) is explicit: *glass cannot sample other glass; the container
provides the shared sampling region*. Nested glass has nothing to refract but its
parent, so it resolves to flat grey — precisely the reported symptom. **Fix:** exactly
one glass layer (the bar, `.regular.interactive()`), with the selection a plain capsule
riding `matchedGeometryEffect` + `.bouncy`, so it flows between tabs. The liquidity is
the material's own (press-scale, shimmer, touch-point illumination) plus content
lensing underneath — not a second sheet of glass.
Related tuning rules from the same source, worth keeping: tint is for *semantic*
meaning only and must stay subtle (heavy tint kills the lensing); `.clear` is the
variant for high-transparency contexts over colourful media, `.regular` over quiet
ground. Note glass over this app's near-white canvas will always read light — it can
only lens what is behind it.
**Bug 2 — the "border" was two mistakes, neither of them the geometry.**
1. The rim was being *painted*: the shader forced `color.a` up at the edge and mixed
   the rim toward white, tracing a bright ring around every bubble. Removed entirely.
   Solid glass just shows its contents compressed; the edge is *darker* because you
   look through more glass.
2. The dome used a fixed 26pt shoulder (`sqrt(-d / 26)`), so every bubble was a FLAT
   disc with a constant-width refracting ring at its edge — a border by construction,
   and worse the bigger the bubble. **Fix:** the SDF now carries the local radius
   alongside the distance (blended through the smooth-min by the same weight), so the
   dome is a true hemisphere: `height = sqrt(-d(2R + d)) / R`, with the lateral term
   `(R + d)/R`. That is the exact sphere normal, it scales per bubble, and the
   refraction is now continuous from centre to rim.
**Verified.** Builds clean (iOS 27 SDK). Visual sign-off left to the user by request.

## ADR-0042 · 2026-07-17 · Native TabView; bubble shading rebuilt to the Wabi model; splash + icon
**Context.** User review round 2: the nav "still weird — remove any double ring,
redo it from what you find online"; the orbs "don't look like Wabi's" (their
reference: bright luminous spheres, contents legible); and the app needed splash
screens.
**Nav — stop imitating the system bar; use it.** Third iteration. Glass-in-glass
went grey (ADR-0041); a plain white indicator inside the glass pill read as two
rings fighting. The conclusion is that the fluid part of Liquid Glass — the droplet
that slides/stretches between items, lensing while it moves, minimize-on-scroll —
lives in the SYSTEM TabView and is not reachable from public API. Custom bars can
only ever be a worse copy, so the app now uses native `TabView` +
`.tabBarMinimizeBehavior(.onScrollDown)` + `.tint(ink)`. Our `Tab` enum is renamed
`AppTab` because the iOS 18 TabView syntax has its own `SwiftUI.Tab` type, and
shadowing it breaks every `Tab("…")` line. TabScroll's 132pt bottom inset dropped
to 28 (the system bar contributes to the safe area).
**Bubbles — a bubble, not a marble.** Research (lensball photography, soap-film
shaders) + the Wabi hero image agree on the recipe, and it is the OPPOSITE of solid
glass on two axes: (1) the rim is BRIGHT — light wraps the silhouette in two lobes
(key + opposite caustic); darkness at the rim is what read as a border; (2) the
contents get MILD centre magnification (`offset = -outward · r · mag · (1-height)`,
mag 0.34) so the picture stays legible, laminated inside — hard Snell bending
crushed it into the rim. Plus: whisper of thin-film iridescence riding the rim (two
hue cycles per revolution), one broad sheen + one tight hotspot, 6% white haze,
rim-glow feeding alpha so meniscus bridges glow like one skin of glass. Both
shaders share one `shadeBubble()` so the field and single orbs cannot drift apart.
Contents richer too: logo 42%→56% of diameter, painted white pole removed (it
doubled the shader's highlight and looked plastic).
**Splash + launch.** `SplashView`: a merged cluster of app-glyph bubbles (same
`bubbleField` shader — the splash is made of the app's own material) over the
wordmark; fades after ~1.8s (0.6s + no motion under Reduce Motion; `-holdSplash
YES` DEBUG hook for screenshots). It also covers Firebase's session-restore beat,
so returning users never see a spinner. Static `UILaunchScreen` uses a new
`LaunchBackground` color asset (#F4F7F6) → cold start is canvas → bubbles → app
with no white flash. App icon: a CoreGraphics-rendered glass orb (1024pt; NOTE:
`NSImage.lockFocus` renders at 2x on Retina — actool rejects a 2048px file that
claims 1024, "did not have any applicable content"; `sips -z 1024 1024` fixes it).
**Verified.** Build clean; simulator screenshots of all three: native glass bar
(content lensing under it), bubble clusters with bright rims and merged glow, and
the splash. On-device feel (droplet slide between tabs, minimize-on-scroll) left to
the user.

## ADR-0043 · 2026-07-17 · Settings tab, Home as pipeline, serif display voice, real logos
**Context.** User review round 3: company logos missing or "elongated" in the
bubbles; wants a Settings tab (profile inside it), an avatar top-left on Home, the
greeting in the serif from the web's "Welcome back" wall, the 2×2 launcher replaced
with application stats (accepted/rejected/graph-ish), Recent applications above
Tokyo opportunities, and an iOS 27 deprecation sweep.
**Decisions.**
- **Logos, two layers of fix.** (1) Most catalog rows carry `companyDomain` but no
  `logoUrl` — the web falls back to the DuckDuckGo favicon service; iOS now does
  the same (`Internship.resolvedLogoURL` / `TrackerRecord.resolvedLogoURL`).
  (2) Square favicons drawn bare inside the lens read as stretched stickers →
  every bubble mark now rides a white circular chip (54% of diameter, clipped to a
  circle). (3) DDG **never 404s**: unknown domains get a constant grey placeholder
  icon with HTTP 200, which AsyncImage happily shows (the grey "›" bubbles). It is
  byte-identical every time (1478 B, sha256 e5db88ea2322863c…), so `LogoLoader`
  fetches Data, rejects that hash, and falls back to the tint monogram. Shared
  `LogoImage` view replaced AsyncImage in CompanyMark and BubbleContents; NSCache +
  missing-set memoise per-URL (main-actor confined — Swift 6 rejects bare mutable
  statics).
- **Five tabs**: Home / Radar / Applications / Calendar / **Settings** (gearshape).
  `SettingsView` is the former ProfileSheet promoted to a tab (identity card on
  top, then Gmail/keys/refresh/sign-out); `Route.profile` deleted. Home's avatar
  (top-LEFT of the greeting, per request) jumps to the Settings tab.
- **Home is the pipeline now.** The 2×2 launcher duplicated tabs, so it's gone.
  `PipelineCard`: one stacked status bar (width = count, legend carries numbers so
  colour is never the only signal) + Applied / Interviews / Rejected / **Heard
  back %** ((interview+rejected)/sent — there is no "offer" status; an interview is
  the strongest positive signal the data has). Section order: pipeline → Recent
  applications → Tokyo opportunities (swapped per request).
- **Serif display voice.** The web's "Welcome back" wall is serif; the iOS
  greeting, login title, and splash wordmark now use `.design(.serif)` (New York) —
  the platform serif, no bundled font.
- **Warning sweep to zero**: `isolated deinit` (SE-0371) on AuthService replaces
  `nonisolated(unsafe)`; ShimmerBox captures `progress` by value in its Sendable
  visualEffect closure.
**Gotcha:** a NEW Swift file does nothing until `xcodegen generate` — the target's
file list is baked into the .xcodeproj, so "cannot find X in scope" after adding a
file means regenerate, not a code problem.
**Status.** Builds clean through the LogoImage work except the final `.insert` fix,
which is applied but NOT rebuilt/verified — the user chose to verify themselves.
Uncommitted at time of writing.

## ADR-0044 · 2026-07-17 · Home to the Solace grid; Companies is a page; the market cloud packs like Wabi
**Context.** User review of round 4: the serif greeting read as "weird" against the
rest of the app; the top-left avatar promised a profile photo the app can't set;
the PipelineCard bar was not what they wanted (they pointed at the Solace
reference: greeting + streak flame + a 2×2 grid of soft cards, one carrying a
small pie); the sheet StatusPicker hid "Rejected" off the right edge; Radar had
filters but no sort; the Companies field floated as sparse dots with dead space
(they pointed at the Wabi cloud: bubbles kiss and overlap) and its rim ring on
tracked companies smeared into a colour arc; Companies opened as a sheet.
**Decisions.**
1. **Greeting is the app sans, not serif** (`Font2.title(26)`), and the avatar
   button is gone — a control that shows an identity you cannot set is a lie;
   Settings is already a tab. The flame counts THIS WEEK's applications
   (records past `saved` with `createdAt` in the last 7 days), not an all-time sum.
2. **InsightGrid replaces PipelineCard**: 2×2 cards — a pipeline donut
   (trimmed-circle strokes per status, count centred) plus Applied / Interviews /
   Heard-back% figures. Solace's shape, this app's numbers.
3. **StatusPicker is a Menu** (Picker inside), a labelled row with the current
   status as a tinted pill. All five stages visible at once; `allowsClear: false`
   for RecordSheet (tracked records move stages, they don't vanish).
4. **Radar sorts**: menu pill first in the chip row — Best match (catalog order),
   Deadline (YYYY-MM-DD string order, absent sinks), Company A–Z.
5. **Companies is PUSHED** from Applications (NavigationStack + navigationDestination,
   root keeps its custom header via toolbar(.hidden)); a company's roles stay a sheet.
   A market overview is a place; one company is a card you lift.
6. **Wabi packing**: coverage 0.34→0.52, neighbours may overlap up to 40% of the
   smaller radius (SDF smooth-min turns the intersection into a shared meniscus),
   band insets 10/6→4/3, blend 9→12. Refraction dialled down (mag 0.34→0.22,
   chroma 0.05→0.035) everywhere (field, orb, splash) — the old values smeared the
   rim into "a weird refracting portion".
7. **Status ring moved off the rim onto the logo chip** — at the rim the loupe +
   rim glow dragged it into a detached arc that read as a glitch.
8. **Calendar**: the negative-padding ink ring on selected-today removed; it
   spilled outside the cell into the event dots below.
9. **Onboarding** (`Views/OnboardingView.swift`): four pages after the splash on
   first launch only (`@AppStorage("hasOnboarded")`, launch-arg overridable for
   screenshots), paged TabView with custom dots (system page control is
   white-on-white here), each feature introduced by a glassOrb-shaded orb.
**Status.** Built clean; Home, onboarding p1, Companies page (both clusters),
Radar sort pill, and the sheet status menu screenshot-verified on the sim
(previewMode against live prod). Calendar + onboarding p2–4 verified by code
only. Uncommitted.

## ADR-0045 · 2026-07-17 · Web donut on Home; bubbles are their logos; Radar menus; device signing unblocked
**Context.** Round-6 feedback on ADR-0044: the pipeline card should be the WEB's
status-breakdown donut (centre total + legend counts), not a mini donut in a
square; bubbles still had "a lot of gap inside" (logo chip 54%); Radar's chips
should become Location and Language selectors (Saved dropped); building to the
user's iPhone failed with "signing issue"; and confirm the app really talks to
the production APIs.
**Decisions.**
1. **StatusBreakdownCard** (full-width, above the 2×2 grid): 96pt donut, total +
   "tracked" in the hole, legend rows `● label … count` — the web panel's shape.
   The grid gains a Rejected card; pipeline mini-donut card removed.
2. **BubbleContents chip 0.54 → 0.97** of the sphere — the picture IS the bubble
   (Wabi). Tradeoff accepted: DuckDuckGo favicons are low-res, so big bubbles
   magnify softness. Status became a presence BADGE (max(12, 0.18d), white rim,
   offset 0.27d): with a 97% chip a status ring would hug the refracting rim —
   the exact smear ADR-0044 removed.
3. **Radar controls are three menu pills** (FilterMenuPill: chip skin + chevron,
   ink fill when narrowing): Sort (unchanged), Location (All/Tokyo/Remote/
   Elsewhere — remote = workMode/location contains "remote"), Language
   (All/English-first/Japanese = !isEnglishFirst). FilterChip row + Saved filter
   dropped from Radar (Saved lives in Applications).
4. **Device signing**: the ad-hoc `CODE_SIGN_IDENTITY: "-"` was simulator-only —
   THAT was the iPhone build failure. Now `CODE_SIGN_STYLE: Automatic` +
   `DEVELOPMENT_TEAM: 74G5KQR6DG` (the personal team — NB: the "(R38YYZHMHK)" in
   the cert CN is a user id, not the team; the team is the OU). Entitlements no
   longer hardcode application-identifier (profile injects it) and the keychain
   group carries `$(AppIdentifierPrefix)`. Xcode-beta has NO Apple-ID account, so
   `-allowProvisioningUpdates` fails ("No Account for Team") — but a valid team
   profile from the user's own Xcode attempt (expires +7 days, embeds the
   keychain cert, includes device 00008130-001210600A01001C) resolves WITHOUT the
   flag. Installed via `devicectl device install app`. **Launch blocked on the
   one-time manual trust** (Settings → General → VPN & Device Management).
   Profile lives in `~/Library/Developer/Xcode/UserData/Provisioning Profiles/`;
   when it expires, re-run a device build from Xcode once (account signed in) to
   mint a fresh one.
5. **Connectivity audited live**: Azure catalog API 200/31ms (`/api/status`,
   `/api/internships` serving HENNGE first), DuckDuckGo favicons 200, Firebase
   `resume-841f9` config in the bundle; Firestore path `users/{uid}/trackers/…`
   reads the same docs the web writes. End-to-end sign-in still needs the user's
   own password — everything up to the wall is verified.
**Status.** Sim-verified by screenshot (Home donut card, Companies 97% chips +
badge, Radar menus). Device build signed+installed; awaiting user trust + login.
Uncommitted.

## ADR-0046 · 2026-07-17 · Splash logos, scroll-lag root cause, profile editing, JA localization
**Context.** Round-7 feedback (app now runs on the user's iPhone): splash icons
"don't match" — wanted real top-tier company logos; Applications tab's cards
blended into the background; bubble logos didn't fit; the phone felt laggy and
scrolling stuttered ("make sure it runs at 120fps"); wanted an editable profile
(photo upload) and an app-language option (default = locale, Japanese optional).
**Decisions.**
1. **Splash orbs = real companies** (Rakuten/NVIDIA/Mercari/Cloudflare/HENNGE/
   1Password/Sakana via DDG favicons), rendered by the same `BubbleContents` as
   the Companies field — one material everywhere; monogram until the favicon
   lands, cached after first launch.
2. **Applications ground fixed**: the round-6 NavigationStack painted its opaque
   ground OVER the tab's AmbientCanvas. The canvas now lives INSIDE the stack
   (RootView no longer wraps that tab).
3. **Logos inscribed, not clipped**: chip padding 0.145·d (side ≈ d/√2) so a
   square favicon's corners never cut; overlap capped at 12% of the smaller
   radius (40% ate neighbours' logos), coverage 0.52→0.46.
4. **Scroll lag root cause**: PressableCard's `DragGesture(minimumDistance: 0)`
   claimed every touch-down and fought the ScrollView pan — replaced with a real
   Button + ButtonStyle (`configuration.isPressed` scale). Also
   `CADisableMinimumFrameDurationOnPhone: true` (custom/TimelineView animation
   was 60Hz-capped on iPhone without it), and the phone now runs a **Release**
   build — the debug build (unoptimized Swift + Firebase debug) was the bulk of
   the perceived lag.
5. **Profile editing in Settings**: avatar = PhotosPicker with camera badge,
   stored device-local via `AvatarStore` (Application Support, downscaled to
   256px — Firebase Storage isn't wired and the web keeps photos in the résumé
   doc); name = pencil → alert TextField → `AuthService.updateDisplayName`
   (Firebase profile change + reload).
6. **Japanese localization**: `ja.lproj/Localizable.strings` (~150 keys),
   `CFBundleLocalizations [en, ja]`; enum labels + computed strings converted to
   `String(localized:)`, literal Texts localize by key. Settings "App language"
   row (System default / English / 日本語) writes the `AppleLanguages` override
   (+`appLanguageOverride` marker) — applies on relaunch; default follows the
   device locale, per the user.
7. **Release-build gotcha**: `#Preview` bodies compile in Release but
   PreviewData's fixtures are `#if DEBUG` — every preview section is now
   DEBUG-gated (script pass across Views/).
**Status.** Debug sim + Release device builds green; splash logos, Applications
ground, bubble fit, Settings (avatar/name/language) screenshot-verified on sim;
Release build installed on the iPhone. Uncommitted.

## ADR-0047 · 2026-07-17 · Logo candidate chains, profile edit page, non-wrapping language pill
**Context.** Round-8 feedback: bubble logos "too enlarged / low quality"; the
Settings pencil+camera icons looked bad — wanted the profile card to OPEN an
edit page instead; "System default" wrapped in the language pill; the
Applications list showed monograms where every other surface showed logos.
**Decisions.**
1. **Logo candidate chain** (`logoCandidateURLs` in Models.swift): Google s2
   `?sz=128` first (REAL resolutions, 96–128px — DDG favicons are 16–32px, which
   was the blur), DDG second (coverage), catalog `logoUrl` last (white
   wordmarks). `LogoLoader.load(candidates:)` walks the chain, requires HTTP 200
   (s2 404s for unknown domains now — the old "globe at 200" behaviour is gone;
   DDG's constant-hash placeholder check stays) and prefers the first image
   ≥48px, settling for smaller only if nothing crisp exists. `resolvedLogoURL`
   is gone; `CompanyBubble.logoURL` → `logoCandidates`.
2. **"Too enlarged"**: logo inside the chip 0.71·d → 0.59·d (padding 0.19), and
   lens magnification 0.22 → 0.16 everywhere — the bulge was reading as
   distortion on square marks.
3. **Applications logos**: `CatalogStore.logoCandidates(for record:)` falls
   through record → catalog-by-id → catalog-by-company-name (prefix-tolerant:
   Gmail says "micro1.ai"/"Rakuten Group", the catalog says "micro1"/"Rakuten").
   ApplicationCard/RecordSheet use it.
4. **Settings**: identity card is a NavigationLink (chevron only — no pencil, no
   camera badge) to a new `EditProfileView` page: tappable 112pt avatar +
   Change/Remove photo + name field + Save (Firebase displayName). Language
   pill: label "System", subtitle "Applies after relaunch", `.fixedSize()` +
   `lineLimit(1)` so it never wraps.
**Status.** Sim-verified (sharp bubble logos incl. Rakuten's real R and KDDI,
clean Settings card, one-line pill, HENNGE logo in Applications); Release build
installed on the iPhone. Uncommitted.

## ADR-0044 · 2026-07-17 · Floating orbs (metaballs out), in-app Gmail + AI keys, web red calendar, real Gmail mark
**Context.** User review round 5 with two new references (the Wabi hero cluster and
black lensball photography): bubbles still wrong — "each has to be its own bubble,
completely floating"; logos still not fitting; JA greeting broke mid-line; legacy
non-internship rows (5CA, micro1) showing; Gmail tag used a generic envelope; the
calendar's selection should match the web's red; "+N more" was a dead label; and
Settings still punted AI keys and Gmail to the web. Merged origin/main first (12
commits: reapply-cooldown, isInternship filtering, editor overhaul) plus the local
parallel session (logo candidate chains, insight-grid Home, ja.lproj).
**The bubble verdict: metaballs OUT, floating orbs IN.** The SDF field was the
technically interesting answer and the visually wrong one — merged skins read as
smeared borders, never as bubbles. The Wabi hero is plainly independent spheres
overlapping in DEPTH: large behind, small in front, each with its own shading and
shadow. New rendering: per-bubble `GlassOrb` views painted large→small, ~18%
shallow overlap so small ones tuck in front, per-orb drop shadow, out-of-step bob
seeded from the company id. `glassOrb` rewritten to the lensball recipe: key
CRESCENT hugging the upper rim + fainter warm counter-crescent below + one hard
hotspot + belly shade for weight + gentle centre magnification — and deliberately
NO uniform rim ring (a ring traced around the silhouette is precisely what kept
reading as a border). `bubbleField`/`smin`/`fieldSDF` deleted; the splash now uses
the same floating orbs, so it stays the same material as Companies.
**Other decisions.**
- "+N more" is a button → `TierListSheet`: every company in the tier as a list
  (mark, name, role count, status) feeding the same roles sheet as the bubbles.
- Legacy non-internships: the server filters only NEW mail (sync.js drops
  `!verdict.isInternship` since the July audit), so 5CA/micro1 must leave by hand —
  RecordSheet gained "Remove from tracker" (confirm dialog → `store.removeRecord`).
- Real Gmail mark: `GmailMark` ports the web's GmailMark.jsx SVG paths to a Canvas
  (five fills, 48×48 space) — used in ApplicationCard, RecordSheet, Gmail settings.
- Calendar matches the web: SELECTED day = red disc/white text; today unselected =
  soft red wash + red numeral. (Previously today owned the red and selection was ink.)
- JA greeting: `\n` before the name in all three ja.lproj greetings — 「こんにちは、」
  then 「Mohamedさん」 on its own line.
- **In-app instead of web:** `AIKeysView` reads/writes the SAME Firestore doc as
  the web (`users/{uid}/settings/app`: openrouterKey/searchModel/auditModel,
  merge-write, key never echoed back); `GmailSettingsView` drives the server's
  OAuth endpoints (status/auth-url/disconnect) with browser-based consent and a
  short status poll after connect. The ONLY remaining web handoff is the résumé
  editor (a LaTeX+PDF pipeline is a desktop tool); "Open the web portal" row is gone.
**Verified.** Builds clean, zero project warnings. Visual sign-off left to the user
by request. NOT yet ported: the Gmail→Firestore drain loop (web/Azure still does
ingestion; iOS manages the connection only).

## ADR-0045 · 2026-07-17 · The drain moves into the app; a deterministic gig guard; brand-field bubbles
**Context.** Device testing found: rejected showed 1 when the inbox has 9; micro1
(a gig platform) was tracked despite the isInternship rule; logos looked low-quality
and "pasted on"; bubbles wanted drag-with-snap-back; the status donut wanted an RGB
palette; splash should play every launch while under review.
**Two data bugs, one root each — found by reading prod, not by guessing.**
1. **The 41-action queue.** `pending` held 41 classified actions (9 rejected, 13
   applied, 19 interview) that nothing had applied. The server only QUEUES; the web's
   `useGmailInbox` was the ONLY drain, so a phone-only user's tracker froze at
   whatever the web last ingested. Fixed by porting the drain: `GmailDrain.swift`
   mirrors useGmailInbox.js rule-for-rule (one record per company, monotonic status,
   `gmail-<msgId>` milestone ids, ack-even-when-skipped so the queue can't wedge),
   runs detached after every `load()`, and is exposed in Settings as "Sync now" /
   "Rescan last 90 days". One tracker write per drain, not one per action.
   NOTE: prod backfill exceeds Azure ingress's 240s cap and returns 504 while the
   server keeps working — so sync-now is fire-and-forget and the drain reads the
   queue afterwards rather than trusting the response.
2. **micro1/5CA/Turing.** Not a code bug: the prompt states the rule correctly and
   gpt-5-nano answers `isInternship: true` anyway. A rule we can state exactly should
   not be delegated to a cheap model's judgement, so `looksLikeGig()` (classify.js)
   and `GigFilter` (iOS) now override the model — role regex (language expert, LLM
   trainer, annotation, customer support, quality analyst…) + gig-platform names
   (micro1, 5CA, remotasks, appen, outlier). Every entry corresponds to a wrong
   record observed in the real inbox. Unit-checked against the live queue: blocks
   micro1/5CA/Turing, keeps HENNGE/Rakuten/ABEJA/ispace. The model proposes, the
   guard disposes. Both sides carry it because both write the same records; iOS's
   copy is what's live today (the server's ships on the next Azure deploy).
**Design.**
- **RGB pipeline**: rejected=red-500, interview=green-600, applied=blue-600; the
  pre-send stages (saved=slate, applying=amber) stay OFF the primary axis so the
  three outcomes that matter own it. Home's insight tiles speak the same language.
- **Brand-field bubbles**: `LogoLoader` samples each logo's own background from its
  EDGE ring (the average of a logo is the mark mixed with its field — Cloudflare
  came back muddy brown; the edge IS the field) and rejects a busy/transparent ring
  rather than guessing. That colour fills the sphere edge-to-edge; marks that bring
  a field are no longer inset. The white-chip-inside-a-pastel-ball look is gone.
- **Drag + snap**: rubber-banded pull (resistance grows with distance), lift (scale
  + longer shadow), bob pauses while held, bouncy spring home — the cluster is where
  the bubble belongs and the snap says so.
- **Splash**: 2.6s on EVERY launch during the debugging phase; comment marks the
  line to revert before shipping.
**Verified.** Builds clean; signed with the personal team and INSTALLED on the
paired iPhone 15 Pro. Runtime behaviour is the user's to check.
