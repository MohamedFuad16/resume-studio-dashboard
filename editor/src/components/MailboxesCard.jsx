// Gmail accounts (rebuild U5): several inboxes linked to one account, because
// the owner applied from more than one address. Each row shows its status, last
// check and how many applications it produced; the settings below decide how far
// back to look, how often the server checks, and which job types to pull.
//
// Talks to mailboxesApi only. In sample mode an added address is a labelled
// sample row; in phase 2 "Add" goes through Google's consent screen.
import { useCallback, useEffect, useState } from 'react';
import { Inbox, LoaderCircle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import GmailMark from './GmailMark.jsx';
import { mailboxesApi, isSampleData } from '../api/v2/index.js';

const COPY = {
  en: {
    title: 'Gmail accounts',
    hint: 'Link every inbox you applied from. Application emails, replies and interview invites from all of them land in Applications and the Calendar.',
    add: 'Add Gmail account',
    addPlaceholder: 'name@gmail.com',
    link: 'Link',
    cancel: 'Cancel',
    empty: 'No inbox linked yet.',
    unavailable: 'Gmail sync is paused while we rebuild it. Applications you already have stay as they are.',
    connected: 'Connected',
    reauth: 'Needs reconnecting',
    syncing: 'Checking…',
    lastSync: 'Last checked',
    never: 'not yet',
    found: n => `${n} ${n === 1 ? 'application' : 'applications'} found`,
    checkNow: 'Check now',
    remove: 'Remove',
    confirmRemove: 'Remove this inbox? Applications already found stay.',
    yesRemove: 'Remove',
    window: 'Look back',
    every: 'Check every',
    include: 'Include',
    pause: 'Pause automatic checks',
    paused: 'Paused: nothing runs until you press Check now.',
    running: hours => `The server checks every ${hours} ${hours === 1 ? 'hour' : 'hours'} and only reads new mail.`,
    readonly: 'Read-only access. The app never sends email or sees your password.',
    sample: 'Sample data',
    windows: { 30: '1 month', 90: '3 months', 180: '6 months', 365: '1 year' },
    hours: { 1: '1 hour', 3: '3 hours', 6: '6 hours', 12: '12 hours', 24: 'Once a day' },
    types: { internship: 'Internship', new_grad: 'New grad', full_time: 'Full time' },
    saved: 'Saved',
  },
  ja: {
    title: 'Gmailアカウント',
    hint: '応募に使ったすべての受信トレイを連携してください。応募メール・返信・面接案内が「応募一覧」とカレンダーに反映されます。',
    add: 'Gmailアカウントを追加',
    addPlaceholder: 'name@gmail.com',
    link: '連携',
    cancel: 'キャンセル',
    empty: 'まだ受信トレイが連携されていません。',
    unavailable: 'Gmail連携は作り直しのため一時停止しています。登録済みの応募はそのまま残ります。',
    connected: '連携済み',
    reauth: '再連携が必要',
    syncing: '確認中…',
    lastSync: '最終確認',
    never: 'まだありません',
    found: n => `${n}件の応募を検出`,
    checkNow: '今すぐ確認',
    remove: '削除',
    confirmRemove: 'この受信トレイを削除しますか？検出済みの応募は残ります。',
    yesRemove: '削除する',
    window: '確認する期間',
    every: '確認の間隔',
    include: '対象',
    pause: '自動確認を一時停止',
    paused: '一時停止中: 「今すぐ確認」を押すまで実行されません。',
    running: hours => `サーバーが${hours}時間ごとに新着メールのみを確認します。`,
    readonly: '読み取り専用です。メールの送信やパスワードの閲覧は行いません。',
    sample: 'サンプルデータ',
    windows: { 30: '1か月', 90: '3か月', 180: '6か月', 365: '1年' },
    hours: { 1: '1時間', 3: '3時間', 6: '6時間', 12: '12時間', 24: '1日1回' },
    types: { internship: 'インターン', new_grad: '新卒', full_time: '中途・正社員' },
    saved: '保存しました',
  },
};

const formatWhen = (value, isJa, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString(isJa ? 'ja-JP' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function MailboxesCard({ isJa = false }) {
  const t = COPY[isJa ? 'ja' : 'en'];
  const [boxes, setBoxes] = useState([]);
  const [settings, setSettings] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | unavailable
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [savedNote, setSavedNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, prefs] = await Promise.all([mailboxesApi.list(), mailboxesApi.getSettings()]);
      setBoxes(Array.isArray(list) ? list : []);
      setSettings(prefs);
      setState('ready');
    } catch {
      setState('unavailable');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async event => {
    event?.preventDefault();
    setError('');
    setBusy('add');
    try {
      const result = await mailboxesApi.add(email);
      // Phase 2 answers with Google's consent URL; the browser goes there.
      if (result?.url) { window.location.assign(result.url); return; }
      setBoxes(current => [...current, result]);
      setEmail('');
      setAdding(false);
    } catch (err) {
      setError(err?.message || 'Could not link that inbox.');
    } finally {
      setBusy('');
    }
  };
  const remove = async id => {
    setBusy(id);
    try {
      await mailboxesApi.remove(id);
      setBoxes(current => current.filter(box => box.id !== id));
      setConfirmId('');
    } catch (err) {
      setError(err?.message || 'Could not remove that inbox.');
    } finally {
      setBusy('');
    }
  };
  const checkNow = async id => {
    setBusy(id || 'all');
    try {
      const list = await mailboxesApi.syncNow(id);
      if (Array.isArray(list)) setBoxes(list);
    } catch (err) {
      setError(err?.message || 'Could not check that inbox.');
    } finally {
      setBusy('');
    }
  };
  const save = async patch => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      setSettings(await mailboxesApi.saveSettings(patch));
      setSavedNote(t.saved);
      setTimeout(() => setSavedNote(''), 1600);
    } catch (err) {
      setError(err?.message || 'Could not save.');
    }
  };
  const toggleType = type => {
    const types = settings.types.includes(type) ? settings.types.filter(value => value !== type) : [...settings.types, type];
    if (types.length) save({ types });
  };

  return (
    <section className="settings-card mailboxes-card">
      <header className="mailboxes-head">
        <div>
          <h2>{t.title}</h2>
          <p>{t.hint}</p>
        </div>
        {isSampleData ? <span className="sample-pill">{t.sample}</span> : null}
      </header>

      {state === 'loading' ? <p className="settings-note"><LoaderCircle size={13} className="spin" /></p> : null}
      {state === 'unavailable' ? <p className="settings-note">{t.unavailable}</p> : null}

      {state === 'ready' ? (
        <>
          <div className="mailbox-list">
            {!boxes.length ? <p className="mailbox-empty"><Inbox size={16} /> {t.empty}</p> : null}
            {boxes.map(box => (
              <div className="mailbox-row" key={box.id}>
                <span className="gmail-avatar" aria-hidden="true"><GmailMark size={20} />{box.status === 'connected' ? <span className="gmail-avatar-dot" /> : null}</span>
                <div className="mailbox-info">
                  <b>{box.email}</b>
                  <small>
                    <span className={`mailbox-status ${box.status}`}>{busy === box.id ? t.syncing : box.status === 'reauth' ? t.reauth : t.connected}</span>
                    <span>{t.lastSync}: {formatWhen(box.lastSyncAt, isJa, t.never)}</span>
                    <span>{t.found(box.applicationsFound || 0)}</span>
                  </small>
                </div>
                {confirmId === box.id ? (
                  <div className="mailbox-confirm">
                    <span>{t.confirmRemove}</span>
                    <button type="button" className="btn" onClick={() => setConfirmId('')}>{t.cancel}</button>
                    <button type="button" className="btn settings-delete" onClick={() => remove(box.id)} disabled={busy === box.id}>{t.yesRemove}</button>
                  </div>
                ) : (
                  <div className="mailbox-actions">
                    <button type="button" className="btn" onClick={() => checkNow(box.id)} disabled={Boolean(busy)}>
                      {busy === box.id ? <LoaderCircle size={13} className="spin" /> : <RefreshCw size={13} />} {t.checkNow}
                    </button>
                    <button type="button" className="btn mailbox-remove" onClick={() => setConfirmId(box.id)} aria-label={`${t.remove} ${box.email}`}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {adding ? (
            <form className="mailbox-add" onSubmit={add}>
              <input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder={t.addPlaceholder} aria-label={t.add} autoComplete="email" />
              <button type="submit" className="btn primary settings-save" disabled={busy === 'add'}>{busy === 'add' ? <LoaderCircle size={13} className="spin" /> : null} {t.link}</button>
              <button type="button" className="btn" onClick={() => { setAdding(false); setError(''); }}>{t.cancel}</button>
            </form>
          ) : (
            <button type="button" className="btn mailbox-add-btn" onClick={() => setAdding(true)}><Plus size={14} /> {t.add}</button>
          )}

          {settings ? (
            <div className="mailbox-settings">
              <label className="settings-field">
                <span>{t.window}</span>
                <select value={settings.windowDays} onChange={event => save({ windowDays: Number(event.target.value) })}>
                  {Object.entries(t.windows).map(([days, label]) => <option key={days} value={days}>{label}</option>)}
                </select>
              </label>
              <label className="settings-field">
                <span>{t.every}</span>
                <select value={settings.everyHours} onChange={event => save({ everyHours: Number(event.target.value) })} disabled={settings.paused}>
                  {Object.entries(t.hours).map(([hours, label]) => <option key={hours} value={hours}>{label}</option>)}
                </select>
              </label>
              <fieldset className="mailbox-types">
                <legend>{t.include}</legend>
                {Object.entries(t.types).map(([type, label]) => (
                  <label key={type} className={`mailbox-type ${settings.types.includes(type) ? 'on' : ''}`}>
                    <input type="checkbox" checked={settings.types.includes(type)} onChange={() => toggleType(type)} />
                    {label}
                  </label>
                ))}
              </fieldset>
              <label className="mailbox-pause">
                <input type="checkbox" checked={settings.paused} onChange={event => save({ paused: event.target.checked })} />
                <span>{t.pause}</span>
              </label>
              <p className="settings-note mailbox-note">{settings.paused ? t.paused : t.running(settings.everyHours)} {t.readonly} <b>{savedNote}</b></p>
            </div>
          ) : null}
          {error ? <div className="settings-error" role="alert">{error}</div> : null}
        </>
      ) : null}
    </section>
  );
}
