import React, { useEffect, useRef, useState } from 'react';
import { I } from './ui.jsx';

// Nav-bar profile menu. A single avatar button opens a dropdown with: profile switch
// list, Add user, Settings, Delete user, and Sign out. Replaces the old raw
// <select> + New + X cluster (Phase 2). Export name kept as ProfileSwitcher so App
// wiring is unchanged.
export function ProfileSwitcher({
  profiles = [],
  activeId,
  isJa = false,
  onSwitch,
  onNew,
  onDelete,
  onSettings,
  onSignOut,
  userEmail = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const canDelete = profiles.length > 1;
  const active = profiles.find(p => p.id === activeId);
  const activeName = active?.name || activeId || (isJa ? 'ユーザー' : 'User');

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const initials = String(activeName).split(/\s+/).map(w => w[0]).join('').replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || '?';

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
        title={activeName}
      >
        <span className="nav-avatar-badge" aria-hidden="true">{initials}</span>
        <span className="nav-avatar-name">{activeName}</span>
        <I n="chev" s={13} />
      </button>

      {open && (
        <div className="nav-profile-dropdown" role="menu">
          {userEmail && <div className="nav-menu-email">{userEmail}</div>}

          <div className="nav-menu-group" role="group" aria-label={isJa ? 'プロフィール' : 'Profiles'}>
            <div className="nav-menu-label">{isJa ? 'プロフィール' : 'Profiles'}</div>
            {profiles.map(p => (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={p.id === activeId}
                className={`nav-menu-item ${p.id === activeId ? 'active' : ''}`}
                onClick={run(() => p.id !== activeId && onSwitch?.(p.id))}
              >
                <span className="nav-menu-item-icon"><I n="user" s={13} /></span>
                <span className="nav-menu-item-label">{p.name || p.id}</span>
                {p.id === activeId && <I n="check" s={13} />}
              </button>
            ))}
          </div>

          <div className="nav-menu-sep" />

          <button type="button" role="menuitem" className="nav-menu-item" onClick={run(onNew)}>
            <span className="nav-menu-item-icon"><I n="plus" s={13} /></span>
            <span className="nav-menu-item-label">{isJa ? 'ユーザーを追加' : 'Add user'}</span>
          </button>
          <button type="button" role="menuitem" className="nav-menu-item" data-testid="nav-settings" onClick={run(onSettings)}>
            <span className="nav-menu-item-icon"><I n="panel" s={13} /></span>
            <span className="nav-menu-item-label">{isJa ? '設定' : 'Settings'}</span>
          </button>
          {canDelete && (
            <button type="button" role="menuitem" className="nav-menu-item danger" data-testid="nav-profile-delete" onClick={run(() => onDelete?.(activeId))}>
              <span className="nav-menu-item-icon"><I n="x" s={13} /></span>
              <span className="nav-menu-item-label">{isJa ? 'このユーザーを削除' : 'Delete user'}</span>
            </button>
          )}

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
