# Dependency & impact graph (editor/)

Deterministic, file-based import graph (madge). Machine-readable:
`dependencies.json` / `dependencies.dot`. Diagram: `architecture.svg` (`architecture.d2`).
The client and server are separate module graphs connected only over HTTP via
`src/api/client.js → /api/*`.

## Client (`editor/src`) — who imports whom
- `main.jsx` → `App.jsx`, `auth/AuthGate` (auth gate wraps `<App/>`)
- `App.jsx` → `api/client`, `components/InternshipDashboard`, `components/ProfileDashboard`,
  `components/ProfileSwitcher`, `components/sections`, `components/ui`, `utils/helpers`,
  `auth/firebase`, `auth/useAuth` (header Sign-out button), `index.css`
- **Auth subsystem (Firebase, added 2026-07-03):**
  - `auth/AuthGate` → `auth/useAuth`, `components/LoginScreen` (renders LoginScreen when
    signed out; passes through to `<App/>` when signed in or auth disabled)
  - `auth/useAuth` → `auth/firebase`, `data/userProfile`
  - `components/LoginScreen` → `auth/useAuth`
  - `data/userProfile` → `auth/firebase` (Firestore `users/{uid}` identity doc)
  - `data/firestoreData` → `auth/firebase` (client-direct per-user data: profiles/trackers/
    applications under `users/{uid}/...`; also `ensureSeed`, called by `auth/AuthGate`)
  - `api/client` → `data/firestoreData` (profileApi/trackerApi/applicationApi delegate to
    Firestore when signed in; else the legacy `/api/*` HTTP backend)
  - `auth/firebase` → `firebase/app`, `firebase/auth`, `firebase/firestore` (leaf; public
    config + `authAvailable`, off when `VITE_AUTH_DISABLED=true`)
- `components/ProfileDashboard` → `ApplicationCalendar`, `CompanyLogo`,
  `hooks/useApplicationTracker`, `hooks/useInternshipCatalog`, `utils/imageUpload`,
  `InterviewDateModal`, `utils/internshipDisplay`, `utils/internshipRanking`, `utils/techIcons`
- `components/InternshipDashboard` → `api/client`, `CompanyLogo`,
  `InterviewDateModal`, `hooks/useApplicationTracker`, `hooks/useInternshipCatalog`,
  `utils/internshipDisplay`, `utils/internshipRanking`
- `components/ApplicationCalendar` → `CompanyLogo`, `hooks/useApplicationTracker`,
  `utils/internshipDisplay`
- `components/sections` → `ui`, `utils/imageUpload`
- `hooks/useApplicationTracker` → `api/client`; `hooks/useInternshipCatalog` → `api/client`
- Leaves (no local imports): `CompanyLogo`, `InterviewDateModal`, `ui`,
  `utils/internshipDisplay`, `utils/internshipRanking`, `utils/imageUpload`,
  `utils/techIcons`, `utils/helpers`, `api/client`, `index.css`

## Server (`editor/server`) — who imports whom
- `index.js` → `templates`, `storage`, `validation`, `resume-chat`,
  `internship-research`, `seeds/internships`, `seeds/catalog`,
  `seeds/catalog-audit-2026-07-02`
- `seeds/catalog` → dated research seeds, `internship-enrichment`, and the July 2 audit
- `validate-catalog.js` → `seeds/catalog`, `storage`, `validation`
- `test-ja-compilation.js` → `templates`
- All others are leaves (`storage`, `templates`, `validation`, the seeds, MCP files).

## Impact analysis ("change X → re-check Y")
- **`api/client.js`** → `App`, both dashboards, `ApplicationCalendar`, and both hooks.
  Route/shape changes here ripple through the entire client. Mirror with `server/index.js`.
- **`utils/internshipDisplay.js`** → `ProfileDashboard`, `InternshipDashboard`,
  `ApplicationCalendar`. This is now the **single source** for JA/EN display helpers
  (`jaDisplay`/`displayValue`/`displayRole` + company/track maps); the former inline copy
  in `InternshipDashboard` was removed (ADR-0006). Editing a phrase here affects all three.
- **`utils/internshipRanking.js`** → both dashboards. Applied-company normalization,
  exceptional-fit threshold, or profile defaults affect the radar and Tokyo match rail.
- **`hooks/useApplicationTracker.js`** → both dashboards + `ApplicationCalendar`
  (tracker shape, statuses, events).
- **`hooks/useInternshipCatalog.js`** → both dashboards (catalog shape/dedup).
- **`components/CompanyLogo.jsx`** → both dashboards + `ApplicationCalendar`
  (logo/domain maps). Low-risk, leaf component.
- **`components/ui.jsx`** → `App` (via sections) + `sections`. Visual primitives.
- **`server/validation.js`** → every write route in `index.js`. Adding a data field
  means updating validation here too.
- **`server/storage.js`** → all persistence (profiles, tracker, catalog, applications).
- **`server/templates.js`** → `/api/compile`, `/api/export/{tex,pdf}` and the
  `ja/`+`en/` design parity. Used by `test-ja-compilation.js`.
- **`server/seeds/catalog.js` + dated audit** → `readInternshipCatalog` and validator
  (catalog content, patches, retirements, merge, meta).

## Regenerate
```bash
cd editor
npx madge src --extensions js,jsx --json
npx madge server --json
# diagram:
d2 ../agent/graph/architecture.d2 ../agent/graph/architecture.svg
```
