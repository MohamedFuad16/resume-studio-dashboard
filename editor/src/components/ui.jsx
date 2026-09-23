import React from 'react';

/* ── Micro icon set ─────────────────────────────────────── */
const ICON_PATHS = {
    menu:   <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    user:   <><circle cx="12" cy="8" r="3.5"/><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6"/></>,
    edu:    <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>,
    work:   <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></>,
    code:   <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    zap:    <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    star:   <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    txt:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    file:   <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    dl:     <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    mail:   <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>,
    ai:     <><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M8 12h8"/></>,
    json:   <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    sync:   <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    plus:   <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x:      <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check:  <><polyline points="20 6 9 17 4 12"/></>,
    chev:   <><polyline points="6 9 12 15 18 9"/></>,
    radar:  <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/><line x1="12" y1="12" x2="19" y2="7"/></>,
    panel:  <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></>,
    // Sidebar collapse/expand: panel + a chevron showing which way it will move.
    collapse: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="15.5 9.5 13 12 15.5 14.5"/></>,
    brain:  <><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></>,
    sun:    <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>,
    moon:   <><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></>,
};

export const I = ({ n, s = 14, style }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>
    {ICON_PATHS[n]}
  </svg>
);

/* ── Toast ──────────────────────────────────────────────── */
export function Toasts({ list, dismiss }) {
  return (
    <div className="toast-tray">
      {list.map(t => (
        <button
          key={t.id}
          type="button"
          className={`toast ${t.type}`}
          aria-label={`${t.message} — dismiss`}
          onClick={() => dismiss(t.id)}
          data-testid={t.testId || (t.type === 'error' ? 'download-error-toast' : undefined)}
        >
          <I n={t.type === 'success' ? 'check' : t.type === 'error' ? 'x' : 'file'} s={12}
            style={{ color: t.type === 'success' ? 'var(--green)' : t.type === 'error' ? 'var(--err)' : 'var(--blue)', flexShrink: 0 }} />
          {t.message}
        </button>
      ))}
    </div>
  );
}
