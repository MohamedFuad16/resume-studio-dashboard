# Internship Portal — Overhaul Plan (2026-07-03)

Handoff plan for an executing agent. Grounded in code inspection on 2026-07-03.
**Read `agent/agent.md` first and follow its routing table. After each phase: update
`agent/state.md`, append ADRs to `agent/decisions.md`, record bugs in `agent/errors.md`.
Never commit secrets (`agent/secrets.md`).**

Stack recap: React 18 + Vite (`editor/src`), ESM Express (`editor/server/index.js`),
sql.js KV SQLite (local `server/.data/resume-studio.sqlite`, prod Vercel Blob), Tectonic
LaTeX compile, seed catalog in `server/seeds/*`. Deploy is **manual**: `vercel --prod` from
`editor/` after push (no git auto-deploy).

---

## Phase 0 — Confirmed diagnoses (do these first; they're quick wins)

### 0.1 BUG: "Saved (1)" filter shows an empty radar
File: `editor/src/components/InternshipDashboard.jsx`

Two independent root causes, both verified:

1. **Count/filter mismatch.** `savedCount` (line ~521) counts *tracker records* with
   `status === 'saved'`, but the `savedOnly` filter runs over `visibleCatalog`, which
   already removed items whose deadline instant passed (`isVisibleInRadar`, line ~64)
   AND items whose IDs no longer exist in the catalog. The 2026-07-02 audit retired 12
   IDs; tracker records for them survive (tracker is never pruned), so the button says
   "Saved (1)" while the table is empty.
2. **Status filter offers impossible options.** The `statusFilter` select lists
   Applying/Applied/Interview, but `visibleCatalog` excludes applied-type statuses up
   front — those options can never match anything. Same class of bug.

Fix:
- Saved items must stay visible in the radar even when their deadline expired (add
  `status === 'saved'` exemption in `isVisibleInRadar`; render with the existing
  `urgent`/expired styling so the user can see it lapsed).
- Derive `savedCount` from the *visible* saved set so button count === row count.
- Remove Applying/Applied/Interview from the radar's status filter (or route those
  selections to the dashboard); keep Saved.
- Add a stale-tracker sweep: on catalog load, tracker records whose `internshipId` is
  not in the catalog get surfaced (e.g. a dismissible "1 saved role is no longer listed"
  notice with a remove action) — do NOT silently delete user data.

Acceptance: with a saved expired role + a saved retired role, the Saved button count
matches rendered rows; no filter option can produce a guaranteed-empty table.

### 0.2 Stale `fdf` profile still in the database
Verified locally: KV key `profile:temp` (nameEn `"fdf"`) still exists in
`server/.data/resume-studio.sqlite` even though `server/profiles/temp.json` was deleted.
The same stale key almost certainly exists in the prod Blob snapshot.

Fix in `editor/server/index.js`:
- Add a startup migration (like the retired-ID purge): delete KV keys
  `profile:temp`, `tracker:temp`, `applications:temp` (make the removed-ID list a
  constant, e.g. `RETIRED_PROFILE_IDS = ['temp']`).
- Exclude retired profile IDs from `listProfiles()` defensively.
- Redeploy so the Blob snapshot is rewritten.

Acceptance: `/api/profiles` lists only `mohamed_fuad` + `aiko_tanaka` (+ user-created),
KV dump contains no `*:temp` keys locally and in prod.

### 0.3 Module-scope clock (latent bug)
`NOW`/`TODAY` in `InternshipDashboard.jsx` (lines 32–33) are computed once per page
load; a tab left open across midnight JST shows stale expiry/urgency. Recompute per
render (cheap) or via a minutely tick. Same pattern check: `ApplicationCalendar.jsx`.

---

## Phase 1 — Company data consistency, logos, links

User complaint: detail-panel info differs per company; icons aren't real logos; links
inconsistent. All confirmed in code:

### 1.1 Real logos
File: `editor/src/components/CompanyLogo.jsx`
- Today: `logoUrl` (usually empty) → Google favicon (only if a domain is known via
  `KNOWN_DOMAINS` [~50 entries for 173 companies], `item.companyDomain` [live results
  only], or `domainFromUrl(item.url)` which returns '' for ATS-hosted URLs) → initials.
  Most seed companies fall through to initials.
- Fix (favicon-service approach, per user decision):
  1. **Backfill `companyDomain` for every seed entry** at enrichment time
     (`server/seeds/internship-enrichment.js`): derive from `sourceUrl`/`companyUrl`
     (official pages, not ATS), keep `KNOWN_DOMAINS` as overrides.
  2. Fallback chain in `CompanyLogo`: `logoUrl` →
     `https://www.google.com/s2/favicons?domain_url=https://<domain>&sz=128` →
     `https://icons.duckduckgo.com/ip3/<domain>.ico` → initials.
  3. `CompanyResearchPanel` (InternshipDashboard.jsx ~line 445) fabricates
     `https://<company-lowercased>.com` for the logo — wrong for many names. Pass no
     URL and let initials show until real results arrive, or resolve after results
     return their `companyDomain`.
- Acceptance: visually scan all radar pages — no wrong-company icon; entries without a
  resolvable favicon show initials (never a broken image).

### 1.2 Uniform detail-panel data
- Symptom (visible in screenshots): "What the internship is about" and "Why this is a
  strong fit" show identical text for some companies. Cause: `fitNote` falls back to
  `about` — in live research `normalizeResult` sets `fitNote: result.about` outright
  (`internship-research.js` line ~82), and some seed entries duplicate.
- Fix:
  - Define the canonical item shape in `agent/data.md` (already partially specified):
    `about`, `fitNote` (distinct), `techStack[]`, `eligibility[]`, `process[]`,
    `duration`, `compensation`, `deadline(+Date)`, `language`, `source`, `sourceUrl`,
    `url`, `companyDomain`, JA variants.
  - Write a one-off normalization audit script (`server/seeds/`), pattern after
    `catalog-audit-2026-07-02.js`: report entries where `fitNote === about`, missing
    `techStack`/`process`/`eligibility`, non-ISO deadlines, missing JA fields. Patch
    via a new dated audit file, not by hand-editing 173 seeds inline.
  - In `normalizeResult`, stop copying `about` into `fitNote`; generate fit from the
    candidate-profile match reasons instead (the prompt already returns `reasons`-like
    data) or leave empty and let the panel hide the section when absent.
  - DetailPanel: hide sections whose data is absent instead of rendering fallbacks, so
    every company shows a consistent, truthful layout.
- Extend `validate-catalog.js` with these shape checks so drift fails CI.

### 1.3 Links
- Rule (already ADR'd): `url` = deepest official apply/detail link; `sourceUrl` =
  official program/careers page; `companyUrl` = company site. The validator's
  `generic-apply-url` soft list currently has 11 entries — re-audit those 11 only.
- Acceptance: `npm run validate:catalog:links` green; `[1b]` list shrinks or each
  remaining item is annotated as a genuine single-page program.

---

## Phase 2 — Nav bar: Settings + profile menu (remove `+New` / `X`)

Files: `editor/src/App.jsx` (header, lines ~980–1059),
`editor/src/components/ProfileSwitcher.jsx`, `editor/src/index.css`.

- Replace the raw `<select> + New + X` cluster with a single **avatar/profile icon
  button** (right side of nav). Clicking opens a dropdown menu:
  - profile list (switch),
  - "Add user" (opens existing wizard — `openProfileWizard`),
  - "Delete user" (with confirm; server already protects the primary),
  - "Settings",
  - (later, Phase 4) "Sign out".
- Remove the standalone `+New` and `X` buttons from the bar entirely.
- New **Settings view** (`appView === 'settings'`, new component
  `src/components/SettingsPanel.jsx`):
  - **Profile**: name EN/JA, email, phone, photo — edits write through the existing
    `/api/resume` personal block.
  - **AI / API keys**: OpenRouter API key, search model (default `openai/gpt-5-mini`;
    `:online` suffix appended server-side as today), audit model (default a cheap
    nano/flash-class slug, e.g. `openai/gpt-5-nano` — keep it a plain string field).
  - **Data**: export JSON, danger-zone delete profile.
- **Server side** (`server/index.js` + `validation.js`):
  - New KV key `settings:<profileId>` with `GET/POST /api/settings?profile=`.
  - The API key is **write-only from the client**: POST stores it; GET returns
    `{ hasKey: true, keyPreview: 'sk-or-…abcd', models: {...} }` — never the full key.
  - Key resolution order in `internship-research.js` (and the new audit script):
    stored settings key → `process.env.OPENROUTER_API_KEY`. Same for model slugs.
  - Validate: key matches `/^sk-or-[A-Za-z0-9-_]{20,}$/` (trim), models against a
    conservative slug regex. Size-bound everything (existing `validation.js` patterns).
  - Note in `agent/secrets.md`: keys now also live in the KV store; local SQLite file
    must stay gitignored (verify `.gitignore` covers `server/.data/`).
- Acceptance: key entered in Settings → live company search works with no env var set;
  GET never echoes the key; nav shows only brand / views / EN-JA / avatar (+ Save/Export
  in editor view).

## Phase 3 — Live company search via OpenRouter

File: `editor/server/internship-research.js` — the pipeline already exists and is solid
(job queue in `index.js`, schema-constrained completion, URL liveness verification).
Work remaining:
- Read key/model from Settings (Phase 2) with env fallback.
- Client (`CompanyResearchPanel`): when the server reports
  `OPENROUTER_API_KEY_MISSING`, show an inline call-to-action "Add your OpenRouter key
  in Settings" that deep-links to the Settings view (currently the raw error string is
  dumped into the status line).
- Keep research jobs in-memory (documented limitation) but persist *completed* results
  under `customInternships` as today.
- Acceptance: fresh DB + key via Settings → search "google" → results stream in ≤120 s,
  add-to-matches works; without key → friendly CTA, no crash.

## Phase 4 — Landing page + Firebase Google OAuth (scaffold)

Nothing exists today (no firebase dep, no login, no landing). Scope for this phase is a
working scaffold with placeholder config, per user decision.

- `npm i firebase` (client SDK only; no admin SDK needed yet).
- `src/auth/firebase.js`: `initializeApp` from `import.meta.env.VITE_FIREBASE_*` vars
  (apiKey, authDomain, projectId, appId). Missing config ⇒ export `authAvailable=false`.
- `src/auth/useAuth.js`: `onAuthStateChanged` wrapper; `signInWithPopup(GoogleAuthProvider)`,
  `signOut`.
- **Landing page** `src/components/LandingPage.jsx` + CSS: matches existing design
  system (same tokens/vars in `index.css`: brand blue, pill buttons, card grid).
  Content: hero (bilingual tagline), 3 feature cards (Dashboard & tracker / Internship
  Radar with live research / Bilingual resume editor with LaTeX PDF), screenshot strip,
  single CTA "Continue with Google". Footer: language toggle.
- Gate in `App.jsx`: if `authAvailable && !user` → render LandingPage; on sign-in map
  the Firebase user to a profile:
  - **For now** (user decision): map a specific allowlisted Google account (Mohamed's)
    → `mohamed_fuad`; unknown accounts → read-only demo of `aiko_tanaka` or a
    "request access" notice. Allowlist as env `VITE_AUTH_ALLOWLIST` (comma-sep emails)
    so it works before any backend claims exist.
  - If `authAvailable` is false (no config yet) → current no-auth behavior, unchanged.
    This keeps local dev and the current deployment working.
- Explicitly out of scope this phase: server-side token verification, per-user data
  isolation, multi-tenant storage. Record as ADR + TODO (needed before real users).
- Acceptance: `npm run build` green with and without `VITE_FIREBASE_*` set; with config
  present, Google popup signs in and lands on the dashboard with the right profile.

## Phase 5 — Editor fixes

Files: `src/components/ui.jsx` (MonthInput, lines ~188–232), `src/components/sections.jsx`,
`src/index.css` (~6255–6285).

- **"Present" control**: currently a bare native checkbox + text label
  (`.month-ongoing`). Restyle as a toggle **pill button** consistent with the app's
  segmented controls (like the EN/JA switch): selected state = brand-blue fill; keep
  the checkbox semantics via `aria-pressed` button or visually-hidden checkbox.
  Applies to both `ongoingMode="present"` (experience) and `"expected"` (education).
- **Spacing/formatting audit of the form**: walk every section in `sections.jsx` at
  1280/1024/mobile widths; known suspects: `row2/row3` grids collapsing unevenly,
  `.month-field-row` alignment with adjacent SuggestInputs, photo-actions wrap, textarea
  autosize jump on first focus. Fix in CSS only where possible; log each fix.
- Acceptance: screenshot pass of all editor sections EN+JA with no misaligned control;
  Present/Expected pill matches design.

## Phase 6 — Jake's Clean Japanese template (first JA option)

File: `editor/server/templates.js` (`genJa01`).
State: 2026-07-02 already labeled the first JA option "Jake's Clean 日本語" and rebuilt
genJa01 as a Jake's-clean JA layout; user still finds the design lacking.
- Redesign genJa01 to mirror `en/01_jakes_clean.tex` typography more faithfully:
  small-caps section heads with rule, tight single-page rhythm, Mincho body / Gothic
  headings, photo box only if photo present, monotone (no color), consistent spacing
  between 学歴/職歴/プロジェクト/スキル blocks.
- Keep JIS rirekisho as the **second** option (school-format 履歴書 is still needed for
  JP applications) — verify the template order in `App.jsx` `JA` template list matches:
  1 Jake's Clean JA, 2 学校指定履歴書, 3 職務経歴書.
- Constraints: compile clean under Tectonic (0 errors, no overfull hboxes), respect the
  existing E2E assertions (`tests/` PyMuPDF suite: fonts, no italic CJK, page counts) —
  update assertions deliberately if layout legitimately changes page count.
- Acceptance: `bash build_all.sh` + Python test suite green; visual check of page 1.

## Phase 7 — Daily validity automation (cheap LLM) 

Goal: every day, check radar entries are still valid; searching stays an on-demand API
call (Phase 3), auditing is batch.

- New script `editor/server/audit-catalog-llm.js` (npm `audit:catalog:llm`):
  1. Reuse `validate-catalog.js` plumbing for the mechanical pass (liveness, shape).
  2. For entries that are mechanically alive but stale-risk (deadline within N days,
     `verifiedDate` older than 14 days, or flagged generic URL), batch-fetch page text
     and ask the **audit model** (cheap slug from Settings/env, default nano-class) with
     a fixed instruction set: "Given this page text and this catalog record, answer
     JSON: {stillOpen: bool|unknown, deadlineChanged: string|null, note}".
  3. Output a dated report `server/seeds/llm-audit-<date>.json` + console summary;
     optionally emit a patch skeleton in the `catalog-audit-*.js` format for a human/
     agent to review. **Never auto-retire from the LLM verdict alone** — mechanical
     404/410 may auto-retire, LLM "closed" verdicts go to the report for confirmation.
- Scheduling: extend `.github/workflows/validate-catalog.yml` (daily 06:00 UTC cron
  already exists) with the LLM step, keyed by `OPENROUTER_API_KEY` repo secret; skip
  gracefully when the secret is absent. (A Cowork scheduled task can additionally ping
  the report, but CI is the durable home.)
- Acceptance: dry run over current 173 entries completes < 10 min, cost logged, report
  written; workflow green with and without the secret.

## Phase 8 — Full UI/code audit + codebase organization

Findings already confirmed during recon (include in the audit report, fix as listed):
1. Saved filter (Phase 0.1) — count/filter mismatch + impossible filter options.
2. Stale `profile:temp`/fdf KV rows (Phase 0.2).
3. Module-scope `NOW`/`TODAY` staleness (Phase 0.3).
4. Dead code: module-level `matchLabel` (InternshipDashboard lines ~219–224) shadowed
   by `copy.*.matchLabel` — remove.
5. `splitRole`/list `key={part}` uses can collide on duplicate strings → React key
   warnings; use `part-index` keys (some places already do).
6. `CompanyResearchPanel` fabricated logo URL (Phase 1.1.3).
7. `fitNote === about` duplication (Phase 1.2).
8. `ProfileSwitcher` ships inline styles as a stopgap (its own comment says the CSS
   class "lands later") — superseded by Phase 2 anyway.
9. Delete-profile `X` in the navbar is a one-click destructive action next to the
   switcher — removed by Phase 2.
10. `App.jsx` is ~2,300 lines; the profile wizard (~lines 1350–2260) is a monolith —
    extract `ProfileWizard.jsx`; extract the AI chat sidebar; target App.jsx < 800.
11. `index.css` is 6,342 lines with a history of drifted duplicate rules (see BUG-002)
    — split into `styles/{base,nav,dashboard,radar,editor,calendar,landing}.css` with
    a tokens file; no visual change intended (verify by screenshot diff).
12. Radar status-select on each row stops propagation on click but the row is
    `tabIndex=0` with Enter/Space handlers — keyboard interaction opens the drawer
    while the select has focus; verify and fix focus handling.
13. `useInternshipCatalog` module cache never invalidates across profile switches —
    confirm catalog is profile-independent (it is) and document.
14. Confirm `.gitignore` covers `server/.data/` (secrets will live there after Phase 2).

Executing agent: also run `npm run lint`, a `madge --circular` pass, and re-render the
dependency graph (`agent/graph/`) after refactors.

---

## Sequencing & verification

Order: 0 → 1 → 2 → 3 → 5 → 6 → 8 (refactors) → 4 → 7. Rationale: quick fixes first;
Settings before search wiring; auth last among features since it gates everything else;
automation once catalog shape is final.

Per-phase gates: `npm run build`, `npm run test:e2e` (5 specs), `npm run
validate:catalog` (+`:links` when seeds touched), JA/EN toggle smoke, and for template
work `build_all.sh` + `tests/`. Deploy only when the user asks: `vercel --prod` from
`editor/`, then verify the live URL (Blob persistence!).

KB upkeep (mandatory, per CLAUDE.md): `agent/state.md` entry per phase; ADRs for:
saved-visibility rule change, settings/keys-in-KV, auth scaffold + allowlist, LLM audit
policy (no auto-retire), CSS split. New bugs → `agent/errors.md` (continue BUG-00x
numbering; Saved bug = BUG-007, fdf KV = BUG-008, stale clock = BUG-009).
