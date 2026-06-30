import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Info,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { statusLabel } from '../hooks/useApplicationTracker.js';
import { CompanyLogo } from './CompanyLogo.jsx';
import { displayCompany, displayRole, formatDisplayDeadline } from '../utils/internshipDisplay.js';

const pad = value => String(value).padStart(2, '0');
const toDateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDateKey = key => {
  const [year, month, day] = String(key || '').split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const startOfWeek = date => addDays(date, -((date.getDay() + 6) % 7));

const APPLIED_STATUSES = new Set(['applying', 'applied', 'interview']);
const appliedDateKey = record => {
  const stamp = record.updatedAt || record.createdAt;
  if (!stamp) return null;
  const date = new Date(stamp);
  return Number.isNaN(date.getTime()) ? null : toDateKey(date);
};

const copy = {
  en: {
    title: 'Application timeline',
    subtitle: 'Exact deadlines, your active applications, and the interviews or follow-ups you schedule.',
    month: 'Month',
    week: 'Week',
    today: 'Today',
    add: 'Add event',
    addTitle: 'Schedule an application event',
    role: 'Application',
    event: 'Event',
    date: 'Date',
    time: 'Time (optional)',
    note: 'Short note (optional)',
    save: 'Add to calendar',
    cancel: 'Cancel',
    empty: 'No application events in this view.',
    emptySub: 'Track an internship with an exact deadline, mark one as applied, or schedule an interview or follow-up.',
    deadline: 'Application deadline',
    applied: 'Application',
    interview: 'Interview',
    submitted: 'Application submitted',
    followUp: 'Follow-up',
    other: 'Other',
    currentStatus: 'Current status',
    open: 'Open application',
    remove: 'Remove event',
    sourceNote: 'Deadline dates come from tracked employer records. Applications without an exact deadline appear on the day you applied. Interviews and follow-ups are only shown when you add an exact date.',
    noTracked: 'Track an internship first, then add its interview or follow-up here.',
  },
  ja: {
    title: '応募タイムライン',
    subtitle: '正確な締切・進行中の応募・登録した面接やフォローアップを表示します。',
    month: '月',
    week: '週',
    today: '今日',
    add: '予定を追加',
    addTitle: '応募予定を追加',
    role: '応募先',
    event: '予定',
    date: '日付',
    time: '時刻（任意）',
    note: 'メモ（任意）',
    save: 'カレンダーに追加',
    cancel: 'キャンセル',
    empty: 'この期間に応募予定はありません。',
    emptySub: '締切日のある募集を管理するか、応募済みにするか、面接・フォローアップを追加してください。',
    deadline: '応募締切',
    applied: '応募',
    interview: '面接',
    submitted: '応募完了',
    followUp: 'フォローアップ',
    other: 'その他',
    currentStatus: '現在の状況',
    open: '応募ページを開く',
    remove: '予定を削除',
    sourceNote: '締切は管理中の企業情報から表示します。締切のない応募は、応募した日に表示します。面接・フォローアップは正確な日付を追加した場合のみ表示します。',
    noTracked: '先にインターンを管理対象に追加すると、面接やフォローアップを登録できます。',
  },
};

function eventLabel(kind, t) {
  if (kind === 'deadline') return t.deadline;
  if (kind === 'applied') return t.applied;
  if (kind === 'interview') return t.interview;
  if (kind === 'application-submitted') return t.submitted;
  if (kind === 'follow-up') return t.followUp;
  return t.other;
}

function calendarEvents(records, t) {
  return records.flatMap(record => {
    const shared = {
      internshipId: record.internshipId,
      company: record.company,
      role: record.role,
      status: record.status,
      applyUrl: record.applyUrl,
      companyDomain: record.companyDomain,
      logoUrl: record.logoUrl,
    };
    const events = [];
    const hasDeadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(record.deadlineDate || '');
    if (hasDeadlineDate) {
      events.push({
        ...shared,
        id: `${record.internshipId}-deadline`,
        kind: 'deadline',
        date: record.deadlineDate,
        time: String(record.deadline || '').match(/\b\d{2}:\d{2}\b/)?.[0] || null,
        title: t.deadline,
        deadlineText: record.deadline,
        removable: false,
      });
    }
    if (!hasDeadlineDate && APPLIED_STATUSES.has(record.status)) {
      const appliedDate = appliedDateKey(record);
      if (appliedDate) {
        events.push({
          ...shared,
          id: `${record.internshipId}-applied`,
          kind: 'applied',
          date: appliedDate,
          time: null,
          title: t.applied,
          removable: false,
        });
      }
    }
    for (const milestone of Array.isArray(record.milestones) ? record.milestones : []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(milestone.date || '')) continue;
      events.push({
        ...shared,
        ...milestone,
        title: milestone.title || eventLabel(milestone.kind, t),
        removable: true,
      });
    }
    return events;
  }).sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
}

export function ApplicationCalendar({ records, addMilestone, removeMilestone, isJa }) {
  const t = isJa ? copy.ja : copy.en;
  const locale = isJa ? 'ja-JP' : 'en-US';
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ recordId: '', kind: 'interview', date: '', time: '', title: '' });
  const events = useMemo(() => calendarEvents(records, t), [records, t]);
  const eventMap = useMemo(() => {
    const map = new Map();
    for (const event of events) map.set(event.date, [...(map.get(event.date) || []), event]);
    return map;
  }, [events]);

  const dates = useMemo(() => {
    if (view === 'week') {
      const first = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, index) => addDays(first, index));
    }
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => new Date(anchor.getFullYear(), anchor.getMonth(), index + 1, 12));
  }, [anchor, view]);

  const todayKey = toDateKey(new Date());
  const title = view === 'month'
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(anchor)
    : `${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(dates[0])} – ${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(dates[6])}`;
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(addDays(startOfWeek(new Date(2026, 0, 5, 12)), index)));
  const shift = direction => setAnchor(current => view === 'month'
    ? new Date(current.getFullYear(), current.getMonth() + direction, 1, 12)
    : addDays(current, direction * 7));

  const openForm = () => {
    setDraft(current => ({ ...current, recordId: current.recordId || records[0]?.internshipId || '', date: current.date || todayKey }));
    setShowForm(true);
  };

  const submitEvent = event => {
    event.preventDefault();
    if (!draft.recordId || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return;
    addMilestone(draft.recordId, {
      kind: draft.kind,
      date: draft.date,
      time: draft.time || null,
      title: draft.title.trim(),
    });
    setAnchor(parseDateKey(draft.date));
    setShowForm(false);
    setDraft(current => ({ ...current, date: '', time: '', title: '' }));
  };

  return (
    <section className="application-calendar" aria-label={t.title}>
      <header className="calendar-head">
        <div><h2><CalendarDays size={19} />{t.title}</h2><p>{t.subtitle}</p></div>
        <div className="calendar-head-actions">
          <div className="calendar-view-switch" aria-label={isJa ? '表示切替' : 'Calendar view'}>
            <button type="button" className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>{t.week}</button>
            <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>{t.month}</button>
          </div>
          <button type="button" className="calendar-add" onClick={openForm}><Plus size={15} />{t.add}</button>
        </div>
      </header>

      {showForm ? (
        <form className="calendar-form" onSubmit={submitEvent}>
          <div className="calendar-form-title"><strong>{t.addTitle}</strong><button type="button" onClick={() => setShowForm(false)} aria-label={t.cancel}><X size={16} /></button></div>
          {records.length ? <>
            <label><span>{t.role}</span><select value={draft.recordId} onChange={event => setDraft(current => ({ ...current, recordId: event.target.value }))}>{records.map(record => <option key={record.internshipId} value={record.internshipId}>{displayCompany(record, isJa)} — {displayRole(record.role, isJa)}</option>)}</select></label>
            <label><span>{t.event}</span><select value={draft.kind} onChange={event => setDraft(current => ({ ...current, kind: event.target.value }))}><option value="interview">{t.interview}</option><option value="application-submitted">{t.submitted}</option><option value="follow-up">{t.followUp}</option><option value="other">{t.other}</option></select></label>
            <label><span>{t.date}</span><input type="date" required value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value }))} /></label>
            <label><span>{t.time}</span><input type="time" value={draft.time} onChange={event => setDraft(current => ({ ...current, time: event.target.value }))} /></label>
            <label className="calendar-form-note"><span>{t.note}</span><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder={isJa ? '例：技術面接' : 'Example: Technical interview'} /></label>
            <button type="submit" className="calendar-form-submit">{t.save}</button>
          </> : <p className="calendar-form-empty">{t.noTracked}</p>}
        </form>
      ) : null}

      <div className="calendar-nav">
        <button type="button" onClick={() => shift(-1)} aria-label={isJa ? '前へ' : 'Previous period'}><ChevronLeft size={16} /></button>
        <strong>{title}</strong>
        <button type="button" className="calendar-today" onClick={() => setAnchor(new Date())}>{t.today}</button>
        <button type="button" onClick={() => shift(1)} aria-label={isJa ? '次へ' : 'Next period'}><ChevronRight size={16} /></button>
      </div>

      <div className={`calendar-grid ${view}`}>
        <div className="calendar-weekdays">{weekdayLabels.map(label => <span key={label}>{label}</span>)}</div>
        <div className="calendar-days">
          {dates.map(date => {
            const key = toDateKey(date);
            const dayEvents = eventMap.get(key) || [];
            const limit = view === 'month' ? 3 : 6;
            const gridColumnStart = view === 'month' && date.getDate() === 1 ? ((date.getDay() + 6) % 7) + 1 : undefined;
            return (
              <div className={`calendar-day ${key === todayKey ? 'today' : ''}`} key={key} style={gridColumnStart ? { gridColumnStart } : undefined}>
                <span className="calendar-day-number">{view === 'week' ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date) : date.getDate()}</span>
                <div className="calendar-day-events">
                  {dayEvents.slice(0, limit).map(event => {
                    const item = { id: event.internshipId, company: event.company, role: event.role, url: event.applyUrl, companyDomain: event.companyDomain, logoUrl: event.logoUrl };
                    const companyLabel = displayCompany(item, isJa);
                    const roleLabel = displayRole(event.role, isJa);
                    const label = `${companyLabel} — ${event.title || eventLabel(event.kind, t)}`;
                    return (
                      <button type="button" className={`calendar-event kind-${event.kind}`} key={event.id} onClick={() => setSelected(event)} aria-label={label} title={label}>
                        <CompanyLogo item={item} size="sm" />
                        <span className="calendar-event-company">{companyLabel}</span>
                        <span className="calendar-event-tooltip"><b>{companyLabel}</b><span>{roleLabel}</span><em>{event.time ? `${event.time} · ` : ''}{event.title || eventLabel(event.kind, t)}</em><small>{t.currentStatus}: {statusLabel(event.status, isJa)}</small></span>
                      </button>
                    );
                  })}
                  {dayEvents.length > limit ? <span className="calendar-more">+{dayEvents.length - limit}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!events.length ? <div className="calendar-empty"><CalendarDays size={22} /><strong>{t.empty}</strong><span>{t.emptySub}</span></div> : null}

      {selected ? (
        <div className="calendar-selected" role="status">
          <CompanyLogo item={{ id: selected.internshipId, company: selected.company, role: selected.role, url: selected.applyUrl, companyDomain: selected.companyDomain, logoUrl: selected.logoUrl }} size="lg" />
          <div><strong>{displayCompany(selected, isJa)}</strong><span>{displayRole(selected.role, isJa)}</span><small><CalendarDays size={13} />{formatDisplayDeadline(selected.date, isJa)}{selected.time ? ` · ${selected.time}` : ''}<Clock3 size={13} />{selected.title || eventLabel(selected.kind, t)} · {statusLabel(selected.status, isJa)}</small></div>
          <div className="calendar-selected-actions">
            {selected.applyUrl ? <a href={selected.applyUrl} target="_blank" rel="noreferrer">{t.open}<ExternalLink size={13} /></a> : null}
            {selected.removable ? <button type="button" onClick={() => { removeMilestone(selected.internshipId, selected.id); setSelected(null); }}><Trash2 size={13} />{t.remove}</button> : null}
            <button type="button" className="calendar-close" onClick={() => setSelected(null)} aria-label={t.cancel}><X size={15} /></button>
          </div>
        </div>
      ) : null}

      <p className="calendar-source-note"><Info size={15} /><span>{t.sourceNote}</span></p>
    </section>
  );
}
