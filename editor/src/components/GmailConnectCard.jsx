import { useEffect, useState, useCallback } from 'react';
import { I } from './ui.jsx';
import { requestJson } from '../api/client.js';

const copy = {
  en: {
    title: 'Gmail',
    hint: 'Connect your inbox (read-only) so new application emails, replies, and interview invites flow into Applications and the Calendar automatically.',
    notConfigured: 'Not available yet — the server needs Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI) and GMAIL_TOKEN_ENC_KEY. See the setup guide.',
    connect: 'Connect Gmail',
    connecting: 'Opening Google…',
    disconnect: 'Disconnect',
    connected: 'Connected',
    reconnect: 'Reconnect Gmail',
    reconnectHint: 'Gmail access needs to be re-granted.',
    lastSync: 'Last sync',
    never: 'never',
    readonly: 'Read-only access — the app never sends email or sees your password.',
    okConnected: '✓ Gmail connected.',
    errConnect: 'Could not connect Gmail. Please try again.',
    denied: 'Gmail connection was cancelled.',
    norefresh: 'Google did not return offline access — try again and keep "stay signed in".',
  },
  ja: {
    title: 'Gmail',
    hint: '受信トレイを（読み取り専用で）連携すると、新しい応募メール・返信・面接案内が自動で「応募一覧」とカレンダーに反映されます。',
    notConfigured: 'まだ利用できません。サーバーに Google OAuth 認証情報（GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI）と GMAIL_TOKEN_ENC_KEY が必要です。',
    connect: 'Gmailを連携',
    connecting: 'Googleを開いています…',
    disconnect: '連携解除',
    connected: '連携済み',
    reconnect: 'Gmailを再連携',
    reconnectHint: 'Gmailへのアクセスを再度許可してください。',
    lastSync: '最終同期',
    never: 'なし',
    readonly: '読み取り専用 — メール送信やパスワードの閲覧は行いません。',
    okConnected: '✓ Gmailを連携しました。',
    errConnect: 'Gmailを連携できませんでした。もう一度お試しください。',
    denied: 'Gmail連携がキャンセルされました。',
    norefresh: 'オフラインアクセスが取得できませんでした。もう一度お試しください。',
  },
};

const qp = key => new URLSearchParams(window.location.search).get(key);

export default function GmailConnectCard({ profile, isJa }) {
  const t = isJa ? copy.ja : copy.en;
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      setStatus(await requestJson(`/api/integrations/gmail/status?profile=${encodeURIComponent(profile)}`));
    } catch {
      setStatus({ configured: false, connected: false });
    }
  }, [profile]);

  useEffect(() => { refresh(); }, [refresh]);

  // Surface the ?gmail= result of the OAuth round-trip, then clean the URL.
  useEffect(() => {
    const result = qp('gmail');
    if (!result) return;
    setNotice({ connected: t.okConnected, denied: t.denied, norefresh: t.norefresh }[result] || t.errConnect);
    const url = new URL(window.location.href);
    url.searchParams.delete('gmail');
    window.history.replaceState(null, '', url.toString());
    refresh();
  }, [refresh, t]);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await requestJson(`/api/integrations/gmail/auth-url?profile=${encodeURIComponent(profile)}`);
      window.location.assign(url);
    } catch {
      setNotice(t.errConnect);
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await requestJson(`/api/integrations/gmail/disconnect?profile=${encodeURIComponent(profile)}`, { method: 'POST' });
      setNotice('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const configured = status?.configured;
  const connected = status?.connected;

  return (
    <section className="settings-card gmail-card">
      <header>
        <h2><span className="gmail-mark" aria-hidden="true"><I n="mail" s={15} /></span> {t.title}</h2>
        <p>{t.hint}</p>
      </header>

      {notice && <div className="gmail-notice">{typeof notice === 'string' ? notice : ''}</div>}

      {!configured && (
        <p className="settings-note gmail-unconfigured">{t.notConfigured}</p>
      )}

      {configured && !connected && (
        <div className="gmail-actions">
          <button type="button" className="btn btn-primary" onClick={connect} disabled={busy}>
            <I n="mail" s={13} /> {busy ? t.connecting : t.connect}
          </button>
          <span className="settings-note">{t.readonly}</span>
        </div>
      )}

      {configured && connected && (
        <div className="gmail-connected">
          <div className="gmail-account">
            <span className="gmail-dot" aria-hidden="true" />
            <div>
              <b>{status.email || t.connected}</b>
              <small>{t.lastSync}: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : t.never}</small>
            </div>
          </div>
          {status.lastError === 'reauth_required' && (
            <div className="gmail-reauth">
              <span>{t.reconnectHint}</span>
              <button type="button" className="btn" onClick={connect} disabled={busy}>{t.reconnect}</button>
            </div>
          )}
          <button type="button" className="btn gmail-disconnect" onClick={disconnect} disabled={busy}>{t.disconnect}</button>
        </div>
      )}
    </section>
  );
}
