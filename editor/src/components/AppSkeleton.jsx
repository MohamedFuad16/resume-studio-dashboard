// Loading state shaped like the app (rebuild U7): sidebar, hero, counters and
// cards as grey placeholders, so sign-in lands on the app's outline instead of
// a blank spinner while Firebase and the first data load finish.
const NAV = ['dashboard', 'radar', 'applications', 'calendar', 'profile', 'settings'];
const STATS = ['saved', 'applying', 'applied', 'interview', 'rejected'];

export default function AppSkeleton({ label = 'Loading…' }) {
  return (
    <div className="shell" aria-busy="true">
      <div className="app-body">
        <aside className="app-sidebar skeleton-sidebar" aria-hidden="true">
          <div className="skeleton-brand"><span className="sk sk-logo" /><span className="sk sk-line sk-w60" /></div>
          <div className="skeleton-nav">{NAV.map(id => <span key={id} className="sk sk-nav" />)}</div>
        </aside>
        <div className="app-main">
          <div className="skeleton-card">
            <div className="skeleton-hero" aria-hidden="true">
              <span className="sk sk-avatar" />
              <div><span className="sk sk-line sk-w40" /><span className="sk sk-line sk-w25" /></div>
            </div>
            <div className="skeleton-stats" aria-hidden="true">{STATS.map(id => <span key={id} className="sk sk-stat" />)}</div>
            <div className="skeleton-grid" aria-hidden="true"><span className="sk sk-block" /><span className="sk sk-block" /></div>
            <span className="skeleton-label" role="status">{label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
