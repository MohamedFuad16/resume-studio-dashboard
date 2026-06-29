# Dependency & impact graph (editor/)

Deterministic, file-based import graph (madge). Machine-readable:
`dependencies.json` / `dependencies.dot`. Diagram: `architecture.svg` (`architecture.d2`).
The client and server are separate module graphs connected only over HTTP via
`src/api/client.js → /api/*`.

## Client (`editor/src`) — who imports whom
- `main.jsx` → `App.jsx`
- `App.jsx` → `api/client`, `components/InternshipDashboard`, `components/ProfileDashboard`,
  `components/sections`, `components/ui`, `utils/helpers`, `index.css`
- `components/ProfileDashboard` → `ApplicationCalendar`, `CompanyLogo`,
  `hooks/useApplicationTracker`, `hooks/useInternshipCatalog`, `utils/imageUpload`,
  `utils/internshipDisplay`
- `components/InternshipDashboard` → `api/client`, `CompanyLogo`,
  `hooks/useApplicationTracker`, `hooks/useInternshipCatalog`, `utils/internshipDisplay`
- `components/ApplicationCalendar` → `CompanyLogo`, `hooks/useApplicationTracker`,
  `utils/internshipDisplay`
- `components/sections` → `ui`, `utils/imageUpload`
- `hooks/useApplicationTracker` → `api/client`; `hooks/useInternshipCatalog` → `api/client`
- Leaves (no local imports): `CompanyLogo`, `ui`, `utils/internshipDisplay`,
  `utils/imageUpload`, `utils/helpers`, `api/client`, `index.css`

## Server (`editor/server`) — who imports whom
- `index.js` → `templates`, `storage`, `validation`, `resume-chat`,
  `internship-research`, `seeds/internships`, `seeds/japan-wide-research-2026-06-29`,
  `seeds/internship-enrichment`
- `test-ja-compilation.js` → `templates`
- All others are leaves (`storage`, `templates`, `validation`, the seeds, MCP files).

## Impact analysis ("change X → re-check Y")
- **`api/client.js`** → `App`, both dashboards, `ApplicationCalendar`, and both hooks.
  Route/shape changes here ripple through the entire client. Mirror with `server/index.js`.
- **`utils/internshipDisplay.js`** → `ProfileDashboard`, `InternshipDashboard`,
  `ApplicationCalendar`. This is now the **single source** for JA/EN display helpers
  (`jaDisplay`/`displayValue`/`displayRole` + company/track maps); the former inline copy
  in `InternshipDashboard` was removed (ADR-0006). Editing a phrase here affects all three.
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
- **`server/seeds/*`** → `readInternshipCatalog` (catalog content, merge, meta).

## Regenerate
```bash
cd editor
npx madge src --extensions js,jsx --json
npx madge server --json
# diagram:
d2 ../agent/graph/architecture.d2 ../agent/graph/architecture.svg
```
