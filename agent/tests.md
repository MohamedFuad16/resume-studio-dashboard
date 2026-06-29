# Tests

Two suites for the two tracks.

## A. Web app — Playwright E2E (`editor/tests/e2e/app-smoke.spec.ts`)
- Runner: `@playwright/test`, project `chromium` (`editor/playwright.config.ts`).
- `webServer` auto-starts `npm run dev` at `http://127.0.0.1:5173`
  (`reuseExistingServer` locally). `baseURL` = same.
- Run:
  ```bash
  cd editor
  npx playwright install chromium   # one-time; downloads the browser
  npm run test:e2e                  # or: npx playwright test
  npm run test:e2e:ui               # interactive
  ```
- Coverage (4 cases, all green): the **current dashboard-first shell** — shell renders
  (language toggles + primary nav), language switcher updates the indicator (JA/EN),
  rapid language toggling stays consistent, and primary navigation switches between
  dashboard ↔ internship radar ↔ editor (asserting the radar search field and the
  editor template picker appear). Uses stable selectors (`data-testid`, nav text,
  `[data-testid^="template-"]`); no `/api/*` stubbing needed.

### History (spec drift — resolved 2026-06-29)
The original `editor.spec.ts` (~59 cases) was written against an **idealized form UI**
from `PROJECT.md` (`input[name="fullName"]`, a `/api/resume` → `personalInfo` payload)
that the shipped **dashboard-first** app (`personal`/`nameEn` shape, `/api/profile` +
`/api/internships`) never implemented. With the browser installed, a full run measured
**57 failed on drift, 2 passed** (the two language-toggle checks). The stale file was
deleted and replaced by the green `app-smoke.spec.ts` above (the 2 surviving behaviours
plus navigation). Treat `npm run build` as the primary client gate; keep the smoke spec
aligned to the real DOM. See `agent/errors.md` ISSUE-004 and `agent/decisions.md` ADR-0007.

## B. LaTeX résumés — Python opaque-box suite (`tests/`)
- Runner: `python3 tests/run_tests.py` (compiles via tectonic, then `unittest`).
- Extractor: PyMuPDF (`fitz`) reads text/fonts/drawings from `output/*.pdf`.
- Validates (see `TEST_INFRA.md` / `TEST_READY.md`): successful compilation,
  exact page counts (ja_01 = 2 pages; ja_02/03/04 = 1), Mincho vs Gothic font
  families, no slanted/italic CJK, no parenthetical English translations, and
  personal-info accuracy (name, phone, DOB, email, experiences, projects).
- Exit code `0` = all pass, `1` = any fail (CI-friendly).

## Gaps / recommendations
- No unit tests for `validation.js`, `storage.js`, `templates.js`, or the JA display
  helpers despite their complexity — add focused unit tests (e.g. Vitest). The JA
  helpers are now a single source (`utils/internshipDisplay.js`), so unit-testing them
  is straightforward (a quick `node --input-type=module` import check verified the
  `Not stated; …` ordering fix and the role map).
- ✅ The JA-translation duplication is resolved — `InternshipDashboard.jsx` imports the
  shared `utils/internshipDisplay.js` helpers (no more local copy). See ADR-0006.
- The e2e suite is intentionally a thin shell smoke (`app-smoke.spec.ts`). Grow it with
  data-flow cases (radar filter/sort, tracker status changes) as the UI stabilizes.
- Add a smoke test that boots the server and asserts `/api/internships` returns a
  valid, dedup'd catalog (caught a real class of merge bugs).
