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
