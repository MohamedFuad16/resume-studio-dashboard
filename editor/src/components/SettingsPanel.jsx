// SettingsPanel — the `appView === 'settings'` view.
//
// Two sections: AI / API keys (OpenRouter key + search/audit model slugs, stored
// per-user via settingsApi) and Data (export JSON, delete profile). The OpenRouter
// key is treated write-only in the UI: once saved we show a masked preview and only
// overwrite when the user types a new value. Personal details (name/email/phone)
// moved to the Profile view, which edits the résumé's personal block directly.
import { useEffect, useState } from 'react';
import { I } from './ui.jsx';
import { settingsApi } from '../api/client.js';
import GmailConnectCard from './GmailConnectCard.jsx';

const DEFAULT_SEARCH_MODEL = 'perplexity/sonar';
const DEFAULT_AUDIT_MODEL = 'openai/gpt-5-nano';

// Only the slugs this app actually runs against OpenRouter. Deliberately not a
// longer menu: an unverified slug would fail at request time, and the user
// cannot tell a bad model from a broken feature. `value` is the language-stable
// slug (see agent/conventions.md); the label carries a short human hint.
const SELECTABLE_MODELS = [
  { value: 'perplexity/sonar', label: 'perplexity/sonar — web search, fast (default)' },
  { value: 'perplexity/sonar-pro', label: 'perplexity/sonar-pro — deeper web search' },
  { value: 'openai/gpt-5-mini', label: 'openai/gpt-5-mini — accuracy-first (slow)' },
  { value: 'google/gemini-2.5-flash-lite', label: 'google/gemini-2.5-flash-lite — cheapest' },
  { value: 'openai/gpt-5-nano', label: 'openai/gpt-5-nano — cheap triage (audit default)' },
  { value: 'deepseek/deepseek-chat', label: 'deepseek/deepseek-chat — cheap' },
];

// Mirror of server researchModel(): shows which slug actually hits the API so
// "which model is running" is never a mystery. Perplexity is natively online;
// everything else gets OpenRouter's :online web-search shortcut.
function effectiveSearchSlug(slug) {
  const s = String(slug || '').trim();
  if (!s || s.includes(':') || /^perplexity\//i.test(s)) return s;
  return `${s}:online`;
}
const KEY_RE = /^sk-or-[A-Za-z0-9\-_]{20,}$/;
const MODEL_RE = /^[a-z0-9][a-z0-9._/:-]{1,60}$/i;

const COPY = {
  en: {
    title: 'Settings',
    subtitle: 'Manage your AI keys and data.',
    ai: 'AI & API keys',
    aiHint: 'Used for live company research and résumé drafting. Your key is stored to your account and never shown again after saving.',
    keyLabel: 'OpenRouter API key', keyPh: 'sk-or-...', keySaved: 'A key is saved. Enter a new one to replace it.',
    searchModel: 'Search model', auditModel: 'Audit model',
    addModelSoon: 'Add another model — coming soon',
    effectiveModel: slug => `Runs as ${slug} (web search enabled)`,
    data: 'Data',
    exportJson: 'Export résumé (JSON)',
    dangerZone: 'Danger zone',
    deleteProfile: 'Delete this profile',
    deleteHint: 'Permanently removes this profile and its tracker/applications. Cannot be undone.',
    deleteProfileWarning: id => `This permanently deletes the profile “${id}” along with its résumé, tracked internships and applications. It cannot be undone.`,
    deleteProfileConfirm: 'Delete this profile',
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
    subtitle: 'AIキーとデータを管理します。',
    ai: 'AI・APIキー',
    aiHint: 'ライブ企業リサーチと履歴書作成に使用します。キーはアカウントに保存され、保存後は再表示されません。',
    keyLabel: 'OpenRouter APIキー', keyPh: 'sk-or-...', keySaved: 'キーは保存済みです。変更する場合は新しいキーを入力してください。',
    searchModel: '検索モデル', auditModel: '監査モデル',
    addModelSoon: '他のモデルを追加 — 近日対応',
    effectiveModel: slug => `実行時: ${slug}（Web検索有効）`,
    data: 'データ',
    exportJson: '履歴書をエクスポート (JSON)',
    dangerZone: '危険な操作',
    deleteProfile: 'このプロフィールを削除',
    deleteHint: 'このプロフィールと関連データを完全に削除します。元に戻せません。',
    deleteProfileWarning: id => `プロフィール「${id}」と、そのレジュメ・管理中のインターン・応募情報を完全に削除します。元に戻すことはできません。`,
    deleteProfileConfirm: 'このプロフィールを削除',
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
  onExportJson, onDeleteProfile, onDeleteAccount,
  needsPassword = false, activeProfile, canDelete, isJa = false,
}) {
  const t = COPY[isJa ? 'ja' : 'en'];

  // One dialog for both irreversible deletes: null | 'profile' | 'account'.
  const [confirmMode, setConfirmMode] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const closeConfirm = () => {
    if (deleting) return;
    setConfirmMode(null);
    setConfirmText('');
    setDeletePassword('');
    setDeleteError('');
  };

  const runConfirmedDelete = async () => {
    if (deleting) return;
    setDeleteError('');
    setDeleting(true);
    try {
      if (confirmMode === 'account') {
        await onDeleteAccount({ password: deletePassword });
        // On success the auth listener unmounts this screen; nothing to do here.
      } else {
        await onDeleteProfile(activeProfile);
        closeConfirm();
      }
    } catch (err) {
      setDeleteError(err.message || 'Could not delete.');
      setDeleting(false);
    }
  };

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

  return (
    // Two elements on purpose: the outer one owns the scrolling so the scrollbar
    // sits at the true right edge of the view, while the inner one caps the
    // reading width. When one element did both, the bar floated at the content's
    // edge instead of the window's.
    <div className="settings-scroll">
    <div className="settings-view">
      <div className="settings-head">
        <div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
      </div>

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
            <select value={searchModel} onChange={e => setSearchModel(e.target.value)}>
              {/* A saved value that predates this list still has to render, or the
                  select would silently show the wrong model. */}
              {!SELECTABLE_MODELS.some(m => m.value === searchModel) && (
                <option value={searchModel}>{searchModel}</option>
              )}
              {SELECTABLE_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
              <option value="" disabled>{t.addModelSoon}</option>
            </select>
            {effectiveSearchSlug(searchModel) !== searchModel && (
              <small className="settings-note">{t.effectiveModel(effectiveSearchSlug(searchModel))}</small>
            )}
          </label>
          <label className="settings-field">
            <span>{t.auditModel}</span>
            <select value={auditModel} onChange={e => setAuditModel(e.target.value)}>
              {!SELECTABLE_MODELS.some(m => m.value === auditModel) && (
                <option value={auditModel}>{auditModel}</option>
              )}
              {SELECTABLE_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
              <option value="" disabled>{t.addModelSoon}</option>
            </select>
          </label>
        </div>
      </section>

      <GmailConnectCard profile={activeProfile} isJa={isJa} />

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
            onClick={() => setConfirmMode('profile')}
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
              onClick={() => setConfirmMode('account')}
            >
              <I n="x" s={13} /> {t.deleteAccount}
            </button>
          </div>
        )}
      </section>

      {confirmMode && (
        <div className="modal-overlay" role="presentation" onClick={closeConfirm}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>{confirmMode === 'account' ? t.deleteAccount : t.deleteProfile}</h3>
              <button type="button" className="modal-close" onClick={closeConfirm}>
                <I n="x" s={14} />
              </button>
            </div>
            <div className="modal-bd">
              <p>{confirmMode === 'account' ? t.deleteAccountWarning : t.deleteProfileWarning(activeProfile)}</p>
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
              {confirmMode === 'account' && needsPassword && (
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
                <button type="button" className="btn" disabled={deleting} onClick={closeConfirm}>
                  {t.cancel}
                </button>
                <button
                  type="button"
                  className="btn settings-delete"
                  disabled={deleting || confirmText.trim() !== DELETE_CONFIRM_WORD}
                  onClick={runConfirmedDelete}
                >
                  {deleting
                    ? t.deletingAccount
                    : (confirmMode === 'account' ? t.deleteAccountConfirm : t.deleteProfileConfirm)}
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
