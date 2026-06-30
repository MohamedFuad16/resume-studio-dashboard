import React from 'react';
import { I } from './ui.jsx';

// Nav-bar user/profile switcher. Lives in the top header so the active user can be
// changed from any view (dashboard, radar, editor). Reuses the existing
// `.profile-select-input` / `.btn-new-profile` / `.btn-delete-profile` styles and
// adds a small `.nav-profile-switcher` wrapper (see CSS SPEC). Inline flex styles
// keep it laid out even before the CSS class lands so it is self-contained.
export function ProfileSwitcher({
  profiles = [],
  activeId,
  isJa = false,
  onSwitch,
  onNew,
  onDelete,
}) {
  // Delete protection is enforced by the server (HTTP 400 for protected profiles);
  // we only hide the button when there is nothing else to fall back to.
  const canDelete = profiles.length > 1;

  return (
    <div
      className="nav-profile-switcher"
      data-testid="nav-profile-switcher"
      role="group"
      aria-label={isJa ? 'ユーザーの切り替え' : 'Switch user'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}
    >
      <span className="nav-profile-icon" aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--t3)' }}>
        <I n="user" s={13} />
      </span>
      <select
        className="profile-select-input nav-profile-select"
        data-testid="nav-profile-select"
        value={activeId || ''}
        onChange={e => onSwitch?.(e.target.value)}
        aria-label={isJa ? 'ユーザーを選択' : 'Select user'}
        title={isJa ? 'ユーザーを切り替え' : 'Switch user'}
        style={{ maxWidth: 180 }}
      >
        {profiles.length === 0 && (
          <option value="">{isJa ? '読み込み中…' : 'Loading…'}</option>
        )}
        {profiles.map(p => (
          <option key={p.id} value={p.id}>
            {p.name || p.id}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-new-profile nav-profile-new"
        data-testid="nav-profile-new"
        onClick={() => onNew?.()}
        title={isJa ? '新しいユーザーを作成' : 'Create new user'}
      >
        <I n="plus" s={11} />
        <span className="nav-profile-btn-label">{isJa ? '新規' : 'New'}</span>
      </button>
      {canDelete && (
        <button
          type="button"
          className="btn btn-delete-profile nav-profile-delete"
          data-testid="nav-profile-delete"
          onClick={e => onDelete?.(activeId, e)}
          title={isJa ? 'このユーザーを削除' : 'Delete current user'}
          aria-label={isJa ? 'このユーザーを削除' : 'Delete current user'}
        >
          <I n="x" s={11} />
        </button>
      )}
    </div>
  );
}

export default ProfileSwitcher;
