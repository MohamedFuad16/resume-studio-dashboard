# design-sync notes — resume-editor

## Repo shape (important)
- **This repo is an app, not a design-system package.** `package.json` `main` points at
  `server/index.js` (Express) and `build` is `vite build`, which emits an app — there is no
  library `dist/`. The converter therefore runs in **synth-entry mode** against a barrel:
  `editor/src/ds-entry.jsx` (committed). Pass `--entry ./editor/src/ds-entry.jsx` so PKG_DIR
  resolves to `editor/`; without `--entry` the converter looks for
  `node_modules/resume-editor` and crashes (a repo never self-installs).
- **No TypeScript anywhere** (no tsconfig, JSX only). `[DTS] parsed 0 .d.ts files`, so
  component discovery finds nothing on its own → `[ZERO_MATCH]`. Every component is pinned
  explicitly in `cfg.componentSrcMap`. **Consequence: the emitted `<Name>.d.ts` props are
  weak** — the design agent gets a thin API contract. Fixing that means adding types to the
  source, not config.
- Scope is deliberate: primitives + form sections only. The page-level views
  (ProfileDashboard, InternshipDashboard, ApplicationsView, ProfileView, SettingsPanel,
  LoginScreen, LegalPage, ApplicationCalendar, ProfileSwitcher) are excluded via
  `componentSrcMap: null` — they are whole screens wired to Firestore/auth/hooks, cannot
  render standalone, and a design agent should not compose designs from them.

## Known render warns
- `[FONT_REMOTE] "Inter", "Instrument Serif"` — expected. `src/index.css` `@import`s Google
  Fonts; the families load at runtime. No action.
- `tokens: 44 defined, 43 referenced (1 missing, below threshold)` — expected, non-blocking.

## Floor-card components (deliberate, not failures)
- **Toasts** and **InterviewDateModal** — both are `position: fixed` overlays (the toast tray
  and the modal backdrop). In a preview card they render against the white card background
  and read as blank smudges / a collapsed date input. Authored previews were written and then
  **withdrawn** — a floor card is honest; a card I know renders wrong is not. `cardMode:
  single` + a viewport override did NOT fix the modal. Fixing these properly needs a preview
  harness that gives the overlay a non-white surface to sit on; revisit on a later re-sync.
- The other 17 components are authored and graded good.

## Re-sync risks
- `.design-sync/previews/*.tsx` inline data copied from `editor/server/profiles/mohamed_fuad.json`
  (names, education, experience, projects). If that seed changes materially the previews still
  render — they just stop matching the app's sample data. Low risk, cosmetic.
- `CompanyLogo` previews resolve **remote** logo images by `companyDomain`. Offline or if a
  domain changes, those cells fall back to lettermarks — a changed card is not necessarily a
  regression.
- The barrel `editor/src/ds-entry.jsx` is hand-maintained: **a new primitive is NOT synced
  until it is exported there**. It is not referenced by the app itself, so nothing else will
  catch an omission.
- `.ds-sync/` installs its own `playwright@1.61.1` to match the already-cached chromium-1228
  (`~/Library/Caches/ms-playwright`). If the cache is cleared, re-check which playwright
  release pins the newly downloaded build.
