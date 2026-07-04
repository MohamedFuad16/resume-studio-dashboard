import React, { useEffect, useRef, useState } from 'react';
import { I } from './ui.jsx';

// Nav-bar account menu. With Firebase auth one account == one user, so there is no
// profile switching and no "+ New": the avatar just opens Settings / Sign out (and
// shows the signed-in email). `onNew` (the create-profile wizard) is kept as an
// optional prop for the no-auth/local path but is NOT surfaced here. (Export name
// kept as ProfileSwitcher so App wiring is unchanged.)
export function ProfileSwitcher({
  profiles = [],
  activeId,
  isJa = false,
  onSettings,
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

  return (
    <div className="nav-profile-menu" data-testid="nav-profile-switcher" ref={ref}>
      <button
        type="button"
        className="nav-profile-avatar"
        data-testid="nav-profile-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        title={displayName}
      >
        <span className="nav-avatar-badge" aria-hidden="true">{initials}</span>
        <span className="nav-avatar-name">{active?.name || (isJa ? 'アカウント' : 'Account')}</span>
        <I n="chev" s={13} />
      </button>

      {open && (
        <div className="nav-profile-dropdown" role="menu">
          {userEmail && <div className="nav-menu-email">{userEmail}</div>}

          <button type="button" role="menuitem" className="nav-menu-item" data-testid="nav-settings" onClick={run(onSettings)}>
            <span className="nav-menu-item-icon"><I n="panel" s={13} /></span>
            <span className="nav-menu-item-label">{isJa ? '設定' : 'Settings'}</span>
          </button>

          {onSignOut && (
            <>
              <div className="nav-menu-sep" />
              <button type="button" role="menuitem" className="nav-menu-item" data-testid="sign-out" onClick={run(onSignOut)}>
                <span className="nav-menu-item-icon"><I n="dl" s={13} style={{ transform: 'rotate(90deg)' }} /></span>
                <span className="nav-menu-item-label">{isJa ? 'ログアウト' : 'Sign out'}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileSwitcher;
