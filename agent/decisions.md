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
