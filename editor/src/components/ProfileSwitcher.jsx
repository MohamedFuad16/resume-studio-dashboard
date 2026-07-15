import React, { useEffect, useRef, useState } from 'react';
import { I } from './ui.jsx';
import { LogOut } from 'lucide-react';

// Sidebar-footer account menu. With Firebase auth one account == one user, so there
// is no profile switching and no "+ New": the avatar shows the signed-in email and
// signs you out. Settings used to live here too, but it is a sidebar view now.
// `onNew` (the create-profile wizard) is kept as an optional prop for the
// no-auth/local path but is NOT surfaced here. (Export name kept as
// ProfileSwitcher so App wiring is unchanged.)
export function ProfileSwitcher({
  profiles = [],
  activeId,
  isJa = false,
  onSignOut,
  userEmail = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = profiles.find(p => p.id === activeId);
  const displayName = active?.name || userEmail || activeId || (isJa ? 'アカウント' : 'Account');

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const initials = String(displayName).split(/[\s@.]+/).map(w => w[0]).join('').replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || '?';
  const run = fn => () => { setOpen(false); fn?.(); };
  // Sign out is the only action left (Settings is a sidebar view now). Without it
  // and without an email there is nothing to show, so don't open an empty popup —
  // this is the no-auth/E2E path, where the avatar is just a label.
  const hasMenu = Boolean(userEmail || onSignOut);

  return (
    <div className="nav-profile-menu" data-testid="nav-profile-switcher" ref={ref}>
      <button
        type="button"
        className="nav-profile-avatar"
        data-testid="nav-profile-button"
        aria-haspopup={hasMenu ? 'menu' : undefined}
        aria-expanded={hasMenu ? open : undefined}
        disabled={!hasMenu}
        onClick={() => hasMenu && setOpen(o => !o)}
        title={displayName}
      >
        <span className="nav-avatar-badge" aria-hidden="true">{initials}</span>
        <span className="nav-avatar-name">{active?.name || (isJa ? 'アカウント' : 'Account')}</span>
        {hasMenu && <I n="chev" s={13} />}
      </button>

      {open && hasMenu && (
        <div className="nav-profile-dropdown" role="menu">
          {userEmail && <div className="nav-menu-email">{userEmail}</div>}

          {/* No Settings item — it is a sidebar view now, so repeating it here
              was redundant. This menu is the account: who you are, and sign out. */}
          {onSignOut && (
            <button type="button" role="menuitem" className="nav-menu-item danger" data-testid="sign-out" onClick={run(onSignOut)}>
              <span className="nav-menu-item-icon"><LogOut size={14} /></span>
              <span className="nav-menu-item-label">{isJa ? 'ログアウト' : 'Sign out'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileSwitcher;
