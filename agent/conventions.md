# Conventions

## Code style
- **ESM everywhere** (`"type": "module"`). React 18 function components + hooks only.
- 2-space indent, semicolons, single quotes. Prefer small pure helpers.
- Client↔server JSON over `fetch`; never call the DB from the client.
- All server input is validated in `server/validation.js` (size, shape, HTTPS URLs,
  data-URL images, prototype-pollution guards). Add new fields there too.
- Bilingual UI: thread an `isJa` flag; put EN/JA copy in a local `copy = { en, ja }`
  object; route display strings through `utils/internshipDisplay.js` helpers.
- `<select>` options that show localized labels MUST set an explicit, language-stable
  `value` (filter state stores raw values). See `agent/errors.md`.

## File / folder placement (match the real layout)
- React components → `editor/src/components/` (`*.jsx`).
- Hooks → `editor/src/hooks/` (`use*.js`). Utils → `editor/src/utils/` (`*.js`).
- API client wrappers → `editor/src/api/client.js`. Global styles → `editor/src/index.css`.
- Express server → `editor/server/`; one concern per file (`storage`, `templates`,
  `validation`, `resume-chat`, `internship-research`).
- Internship seed datasets → `editor/server/seeds/` (date-stamp new research files,
  e.g. `japan-wide-research-2026-06-29.js`). Profile seeds → `editor/server/profiles/`.
- Web E2E tests → `editor/tests/e2e/*.spec.ts` (Playwright).
- LaTeX sources → `en/` and `ja/` (`NN_name.tex`); compiled PDFs → `output/`.
- LaTeX tests → `tests/` (Python). Build script → `build_all.sh` (root).
- Knowledge base → `agent/` (this folder). Do not edit legacy `.agents/`, `.workflow/`,
  `graphify-out/`, `graphify_root`.

## Git / safety
- Never commit secrets (`.env.local`, Blob tokens) — see `agent/secrets.md`.
- After changes: update `agent/state.md` + `agent/decisions.md`, refresh
  `agent/graph/` when module structure changes.
