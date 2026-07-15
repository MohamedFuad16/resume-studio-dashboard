import { useEffect, useState, useCallback } from 'react';
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
    live: 'Live',
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
    live: '稼働中',
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

// Official Gmail envelope mark (nominative use, to label the integration).
function GmailLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#4caf50" d="M45 16.2l-5 2.75-5 4.75L35 40h7a3 3 0 0 0 3-3V16.2z" />
      <path fill="#1e88e5" d="M3 16.2l3.614 1.71L13 23.7V40H6a3 3 0 0 1-3-3V16.2z" />
      <polygon fill="#e53935" points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17" />
      <path fill="#c62828" d="M3 12.298V16.2l10 7.5V11.2L9.876 8.859A3.99 3.99 0 0 0 7.298 8 4.3 4.3 0 0 0 3 12.298z" />
      <path fill="#fbc02d" d="M45 12.298V16.2l-10 7.5V11.2l3.124-2.341A3.99 3.99 0 0 1 40.702 8 4.3 4.3 0 0 1 45 12.298z" />
    </svg>
  );
}

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
        <h2><span className="gmail-logo" aria-hidden="true"><GmailLogo size={18} /></span> {t.title}</h2>
        <p>{t.hint}</p>
      </header>

      {notice && <div className="gmail-notice">{typeof notice === 'string' ? notice : ''}</div>}

      {!configured && (
        <p className="settings-note gmail-unconfigured">{t.notConfigured}</p>
      )}

      {configured && !connected && (
        <div className="gmail-actions">
          <button type="button" className="btn gmail-connect-btn" onClick={connect} disabled={busy}>
            <GmailLogo size={16} /> {busy ? t.connecting : t.connect}
          </button>
          <span className="settings-note">{t.readonly}</span>
        </div>
      )}

      {configured && connected && (
        <>
          <div className="gmail-connected">
            <span className="gmail-avatar" aria-hidden="true"><GmailLogo size={22} /></span>
            <div className="gmail-account">
              <b>{status.email || t.connected}</b>
              <small>
                <span className="gmail-status">{t.connected}</span>
                <span className="gmail-sep">·</span>
                {t.lastSync}: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : t.never}
              </small>
            </div>
            <span className="gmail-badge"><span className="gmail-dot" aria-hidden="true" /> {t.live}</span>
            <button type="button" className="btn gmail-disconnect" onClick={disconnect} disabled={busy}>{t.disconnect}</button>
          </div>
          {status.lastError === 'reauth_required' && (
            <div className="gmail-reauth">
              <span>{t.reconnectHint}</span>
              <button type="button" className="btn" onClick={connect} disabled={busy}>{t.reconnect}</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
