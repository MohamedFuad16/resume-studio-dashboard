// Design-system entry point — the component surface published to Claude Design
// (claude.ai/design) by `/design-sync`. See .design-sync/config.json.
//
// This is a barrel, NOT a second implementation: every symbol below is the same
// component the app itself renders. It exists because this repo is an app, not a
// component-library package — `package.json` `main` points at the Express server
// and `vite build` emits an app, so there is no library entry for the converter
// to bundle. Adding one here keeps the synced bundle the app's real code.
//
// Deliberately excluded: the page-level views (ProfileDashboard, InternshipDashboard,
// ApplicationsView, ProfileView, SettingsPanel, LoginScreen, LegalPage,
// ApplicationCalendar, ProfileSwitcher). They are whole screens wired to Firestore,
// auth and hooks — they cannot render standalone, and a design agent should not be
// composing designs out of them.
//
// The design tokens travel separately, via cfg.cssEntry → src/index.css.

// Primitives — depend on React only.
export {
  I,
  Toasts,
  ExportMenu,
  Sec,
  Lbl,
  Inp,
  Txta,
  MonthInput,
  Bullets,
  TagInput,
  SuggestInput,
} from './components/ui.jsx';

export { CompanyLogo } from './components/CompanyLogo.jsx';
export { default as InterviewDateModal } from './components/InterviewDateModal.jsx';

// Résumé form sections — composed from the primitives above.
export {
  PersonalSec,
  SummarySec,
  EducationSec,
  ExperienceSec,
  ProjectsSec,
  ActivitiesSec,
} from './components/sections.jsx';
