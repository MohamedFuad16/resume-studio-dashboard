# Components, hooks & utils (`editor/src`)

Entry: `main.jsx` → `App.jsx`. See `agent/graph/graph.md` for the import graph.

## Top-level
- **`App.jsx`** (root, ~2.3k lines). Owns global state: `resume`, `template`, `lang`
  (persisted to `localStorage` `resume-studio-language`), `autoCompile`, `theme`,
  `pdfSrc`/`compiling`, sidebar tab (`editor` | `chat`), and `appView`
  (`dashboard` | editor | `radar`). Handles profile load, debounced autosave +
  autocompile, exports, the AI application-assistant chat, and offline banner.
  Imports: `api/client`, `ProfileDashboard`, `InternshipDashboard`, `sections`,
  `ui`, `utils/helpers`, `index.css`.

## Views
- **`ProfileDashboard.jsx`** — landing dashboard: profile hero (photo upload via
  `utils/imageUpload`), completion ring, application pipeline, recent applications,
  Tokyo matches, projects, and the `ApplicationCalendar`. Reads `useInternshipCatalog`
  + `useApplicationTracker`. Uses `displayCompany/displayRole/displayValue/
  formatDisplayDeadline` for JA localization and `utils/internshipRanking` for the
  company-aware Tokyo match rail.
- **`InternshipDashboard.jsx`** ("Internship Radar") — searchable/filterable internship
  table with region/track/language/deadline/status filters, sorting (Tokyo-priority,
  match, deadline, company), pagination, a detail drawer (`DetailPanel`), live
  company research (`CompanyResearchPanel`), and save/track actions. Imports the shared
  JA translation helpers from `utils/internshipDisplay.js` (the former inline `jaDisplay`/
  `displayValue`/`displayRole` were removed — ADR-0006); keeps only radar-specific
  presentation helpers (`splitRole`, `splitLanguage`, `trackLabel`, `JA_TRACK_LABELS`).
  Default and match sorts use `utils/internshipRanking` so already-applied companies
  are demoted unless a role meets the exceptional-fit threshold.
- **`ApplicationCalendar.jsx`** — month calendar of application milestones (interviews,
  submissions, follow-ups); add/remove milestones via `useApplicationTracker`.

## Shared components
- **`sections.jsx`** — the résumé **form** sections (personal, education, experience,
  projects, skills, etc.); collapsible, list add/delete/reorder. Imports `ui` +
  `utils/imageUpload`.
- **`ui.jsx`** — presentational primitives (inputs, buttons, collapsibles, etc.).
- **`CompanyLogo.jsx`** — resilient company logo with domain/favicon fallbacks and an
  initials placeholder; `KNOWN_DOMAINS` + `FILLED_BRAND_LOGOS` maps.

## Hooks (`src/hooks`)
- **`useApplicationTracker.js`** — loads/saves the per-profile tracker via
  `trackerApi`; exposes `records`, `counts`, `statusFor`, `updateStatus`,
  `addMilestone`, `removeMilestone`; syncs across components with a `window`
  `CustomEvent`. Exports `APPLICATION_STATUSES`, `statusLabel`.
- **`useInternshipCatalog.js`** — module-cached catalog fetch via `internshipApi`;
  dedups by `id`; `notifyCatalogChange()` broadcasts refreshes.

## Utils (`src/utils`)
- **`internshipDisplay.js`** — **single source** for JA/EN display helpers:
  `displayCompany`, `displayRole`, `displayValue`, `formatDisplayDeadline`,
  `internshipDetails`, `brandInfo`, plus `COMPANY_DISPLAY` / `TRACK_LABELS_JA` maps and
  the internal `jaDisplay` chain. Imported by `ProfileDashboard`, `InternshipDashboard`,
  and `ApplicationCalendar` (the old inline copy was removed — ADR-0006).
- **`imageUpload.js`** — `prepareProfilePhoto` (resize/encode to a size-bounded
  data URL accepted by `validation.js`).
- **`helpers.js`** — small shared helpers (formatting, debounce-style utilities).
- **`internshipRanking.js`** — profile-aware applied-company normalization and shared
  comparators. Mohamed's explicit HENNGE/Rakuten history is combined with tracker
  statuses; scores of 98+ remain eligible for their natural rank.

## Dependency hot-spots (change impact)
- `CompanyLogo`, `internshipDisplay`, `internshipRanking`, `useApplicationTracker`, `useInternshipCatalog`
  are shared by both dashboards — edits ripple widely (see `agent/graph/graph.md`).
- `api/client.js` is imported by both hooks and `App` — any route/shape change there
  affects the whole app.
