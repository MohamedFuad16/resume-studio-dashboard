// SettingsPanel — the `appView === 'settings'` view.
//
// Three sections: Profile (name EN/JA, email, phone — written through the résumé's
// personal block), AI / API keys (OpenRouter key + search/audit model slugs, stored
// per-user via settingsApi), and Data (export JSON, delete profile). The OpenRouter
// key is treated write-only in the UI: once saved we show a masked preview and only
// overwrite when the user types a new value.
import { useEffect, useState } from 'react';
import { I } from './ui.jsx';
import { settingsApi } from '../api/client.js';

const DEFAULT_SEARCH_MODEL = 'openai/gpt-5-mini';
const DEFAULT_AUDIT_MODEL = 'openai/gpt-5-nano';
const KEY_RE = /^sk-or-[A-Za-z0-9\-_]{20,}$/;
const MODEL_RE = /^[a-z0-9][a-z0-9._/:-]{1,60}$/i;

const COPY = {
  en: {
    title: 'Settings',
    subtitle: 'Manage your profile, AI keys, and data.',
    back: 'Back',
    profile: 'Profile',
    profileHint: 'These write to the active résumé’s personal details.',
    nameEn: 'Name (English)', nameJa: 'Name (Japanese)', email: 'Email', phone: 'Phone',
    ai: 'AI & API keys',
    aiHint: 'Used for live company research and résumé drafting. Your key is stored to your account and never shown again after saving.',
    keyLabel: 'OpenRouter API key', keyPh: 'sk-or-...', keySaved: 'A key is saved. Enter a new one to replace it.',
    searchModel: 'Search model', auditModel: 'Audit model',
    data: 'Data',
    exportJson: 'Export résumé (JSON)',
    dangerZone: 'Danger zone',
    deleteProfile: 'Delete this profile',
    deleteHint: 'Permanently removes this profile and its tracker/applications. Cannot be undone.',
    deleteAccount: 'Delete account',
    deleteAccountHint: 'Permanently deletes your account and every profile, résumé, tracker and application in it.',
    deleteAccountWarning: 'This deletes your account and all of its data — every profile, résumé, tracked internship and application. It cannot be undone, and you will be signed out immediately. Export anything you want to keep first.',
    deleteAccountConfirmLabel: 'Type DELETE to confirm',
    deleteAccountPassword: 'Confirm your password',
    deleteAccountConfirm: 'Delete my account',
    deletingAccount: 'Deleting…',
    cancel: 'Cancel',
    save: 'Save changes', saving: 'Saving…', saved: 'Saved', clear: 'Remove key',
    badKey: 'Key must look like sk-or-… (20+ chars).',
    badModel: 'Enter a valid model slug (e.g. openai/gpt-5-mini).',
  },
  ja: {
    title: '設定',
    subtitle: 'プロフィール、AIキー、データを管理します。',
    back: '戻る',
    profile: 'プロフィール',
    profileHint: 'アクティブな履歴書の個人情報に反映されます。',
    nameEn: '氏名（英語）', nameJa: '氏名（日本語）', email: 'メール', phone: '電話',
    ai: 'AI・APIキー',
    aiHint: 'ライブ企業リサーチと履歴書作成に使用します。キーはアカウントに保存され、保存後は再表示されません。',
    keyLabel: 'OpenRouter APIキー', keyPh: 'sk-or-...', keySaved: 'キーは保存済みです。変更する場合は新しいキーを入力してください。',
    searchModel: '検索モデル', auditModel: '監査モデル',
    data: 'データ',
    exportJson: '履歴書をエクスポート (JSON)',
    dangerZone: '危険な操作',
    deleteProfile: 'このプロフィールを削除',
    deleteHint: 'このプロフィールと関連データを完全に削除します。元に戻せません。',
    deleteAccount: 'アカウントを削除',
    deleteAccountHint: 'アカウントと、含まれるすべてのプロフィール・レジュメ・管理中のインターン・応募情報を完全に削除します。',
    deleteAccountWarning: 'アカウントとすべてのデータ（プロフィール、レジュメ、管理中のインターン、応募情報）を削除します。元に戻すことはできず、直ちにサインアウトされます。必要なデータは事前にエクスポートしてください。',
    deleteAccountConfirmLabel: '確認のため DELETE と入力してください',
    deleteAccountPassword: 'パスワードを再入力してください',
    deleteAccountConfirm: 'アカウントを削除する',
    deletingAccount: '削除中…',
    cancel: 'キャンセル',
    save: '変更を保存', saving: '保存中…', saved: '保存しました', clear: 'キーを削除',
    badKey: 'キーは sk-or-… の形式（20文字以上）で入力してください。',
    badModel: '有効なモデルスラッグを入力してください（例: openai/gpt-5-mini）。',
  },
};

// Typed to confirm irreversible account deletion. Deliberately not localised — a
// fixed token is easier to match exactly than a translated sentence.
const DELETE_CONFIRM_WORD = 'DELETE';

export default function SettingsPanel({
  resume, onSaveProfile, onExportJson, onDeleteProfile, onDeleteAccount,
  needsPassword = false, activeProfile, canDelete, onBack, isJa = false,
}) {
  const t = COPY[isJa ? 'ja' : 'en'];
  const personal = resume?.personal || {};

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const runDeleteAccount = async () => {
    if (deleting) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await onDeleteAccount({ password: deletePassword });
      // On success the auth listener unmounts this screen; nothing to do here.
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  const [form, setForm] = useState({
    nameEn: personal.nameEn || '',
    nameJa: personal.nameJa || '',
    email: personal.email || '',
    phone: personal.phone || '',
  });
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [searchModel, setSearchModel] = useState(DEFAULT_SEARCH_MODEL);
  const [auditModel, setAuditModel] = useState(DEFAULT_AUDIT_MODEL);
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    settingsApi.get().then(s => {
      if (cancelled || !s) return;
      setHasKey(Boolean(s.openrouterKey));
      if (s.searchModel) setSearchModel(s.searchModel);
      if (s.auditModel) setAuditModel(s.auditModel);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setError('');
    const trimmedKey = keyInput.trim();
    if (trimmedKey && !KEY_RE.test(trimmedKey)) { setError(t.badKey); return; }
    if (!MODEL_RE.test(searchModel.trim()) || !MODEL_RE.test(auditModel.trim())) { setError(t.badModel); return; }

    setStatus('saving');
    try {
      // Profile → résumé personal block.
      await onSaveProfile({
        ...personal,
        nameEn: form.nameEn.trim(),
        nameJa: form.nameJa.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      // Settings → per-user store. Only write the key when a new one was entered.
      const patch = { searchModel: searchModel.trim(), auditModel: auditModel.trim() };
      if (trimmedKey) patch.openrouterKey = trimmedKey;
      await settingsApi.save(patch);
      if (trimmedKey) { setHasKey(true); setKeyInput(''); }
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      setError(e.message || 'Could not save settings.');
      setStatus('idle');
    }
  };

  const removeKey = async () => {
    setStatus('saving');
    try {
      await settingsApi.save({ openrouterKey: '' });
      setHasKey(false); setKeyInput('');
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      setError(e.message || 'Could not remove key.');
      setStatus('idle');
    }
  };

  const field = (key, label, type = 'text') => (
    <label className="settings-field">
      <span>{label}</span>
      <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </label>
  );

  return (
    // Two elements on purpose: the outer one owns the scrolling so the scrollbar
    // sits at the true right edge of the view, while the inner one caps the
    // reading width. When one element did both, the bar floated at the content's
    // edge instead of the window's.
    <div className="settings-scroll">
    <div className="settings-view">
      <div className="settings-head">
        <button type="button" className="btn settings-back" onClick={onBack}><I n="chev" s={13} /> {t.back}</button>
        <div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
      </div>

      <section className="settings-card">
        <header><h2>{t.profile}</h2><p>{t.profileHint}</p></header>
        <div className="settings-grid">
          {field('nameEn', t.nameEn)}
          {field('nameJa', t.nameJa)}
          {field('email', t.email, 'email')}
          {field('phone', t.phone, 'tel')}
        </div>
      </section>

      <section className="settings-card">
        <header><h2>{t.ai}</h2><p>{t.aiHint}</p></header>
        <label className="settings-field">
          <span>{t.keyLabel}</span>
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder={hasKey ? '••••••••••••' : t.keyPh}
            autoComplete="off"
          />
          {hasKey && (
            <small className="settings-note">
              {t.keySaved}{' '}
              <button type="button" className="settings-inline-link" onClick={removeKey}>{t.clear}</button>
            </small>
          )}
        </label>
        <div className="settings-grid">
          <label className="settings-field">
            <span>{t.searchModel}</span>
            <input type="text" value={searchModel} onChange={e => setSearchModel(e.target.value)} spellCheck={false} />
          </label>
          <label className="settings-field">
            <span>{t.auditModel}</span>
            <input type="text" value={auditModel} onChange={e => setAuditModel(e.target.value)} spellCheck={false} />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <header><h2>{t.data}</h2></header>
        <div className="settings-actions">
          <button type="button" className="btn" onClick={onExportJson}><I n="dl" s={13} /> {t.exportJson}</button>
        </div>
        <div className="settings-danger">
          <div>
            <strong>{t.dangerZone}</strong>
            <p>{t.deleteHint}</p>
          </div>
          <button
            type="button"
            className="btn settings-delete"
            disabled={!canDelete}
            onClick={() => onDeleteProfile(activeProfile)}
          >
            <I n="x" s={13} /> {t.deleteProfile}
          </button>
        </div>

        {/* Account deletion — separate from profile deletion, and irreversible.
            Only offered when there is a real account to delete (not the no-auth path). */}
        {onDeleteAccount && (
          <div className="settings-danger">
            <div>
              <strong>{t.deleteAccount}</strong>
              <p>{t.deleteAccountHint}</p>
            </div>
            <button
              type="button"
              className="btn settings-delete"
              onClick={() => setConfirmingDelete(true)}
            >
              <I n="x" s={13} /> {t.deleteAccount}
            </button>
          </div>
        )}
      </section>

      {confirmingDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmingDelete(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>{t.deleteAccount}</h3>
              <button className="modal-close" onClick={() => !deleting && setConfirmingDelete(false)}>
                <I n="x" s={14} />
              </button>
            </div>
            <div className="modal-bd">
              <p>{t.deleteAccountWarning}</p>
              {/* Typed confirmation: this cannot be undone, so it should not be
                  reachable by a stray click. */}
              <label className="settings-field">
                <span>{t.deleteAccountConfirmLabel}</span>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={DELETE_CONFIRM_WORD}
                  autoComplete="off"
                />
              </label>
              {needsPassword && (
                <label className="settings-field">
                  <span>{t.deleteAccountPassword}</span>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
              )}
              {deleteError && <div className="settings-error" role="alert">{deleteError}</div>}
              <div className="settings-actions">
                <button type="button" className="btn" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
                  {t.cancel}
                </button>
                <button
                  type="button"
                  className="btn settings-delete"
                  disabled={deleting || confirmText.trim() !== DELETE_CONFIRM_WORD}
                  onClick={runDeleteAccount}
                >
                  {deleting ? t.deletingAccount : t.deleteAccountConfirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="settings-error" role="alert">{error}</div>}

      <div className="settings-footer">
        <button type="button" className="btn primary settings-save" onClick={save} disabled={status === 'saving'}>
          {status === 'saving' ? t.saving : status === 'saved' ? t.saved : t.save}
        </button>
      </div>
    </div>
    </div>
  );
}
