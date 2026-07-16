import React, { useMemo } from 'react';
import { statusLabel } from '../hooks/useApplicationTracker.js';

// Dashboard analytics: a monthly application-trend bar chart and a status
// breakdown donut. Plain SVG, no chart library. Colors are validated against
// the white card surface (dataviz six-checks); the legend carries the counts,
// so identity never rides on color alone.
const STATUS_COLORS = { applying: '#1baf7a', applied: '#2a78d6', interview: '#eda100', rejected: '#e34948' };
const DONUT_ORDER = ['applying', 'applied', 'interview', 'rejected'];
const APPLICATION_STATUSES_SET = new Set(DONUT_ORDER);

// The month an application belongs to. Gmail-imported records carry the email's
// real receipt date in sourceMeta — createdAt is only when the drain ran.
const recordInstant = record => {
  const raw = record.sourceMeta?.receivedAt || record.appliedAt || record.createdAt || record.updatedAt;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export function ApplicationTrendChart({ records, isJa }) {
  const locale = isJa ? 'ja-JP' : 'en-US';
  const months = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short' });
    const now = new Date();
    const list = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: fmt.format(d), count: 0 };
    });
    const byKey = new Map(list.map(m => [m.key, m]));
    for (const record of records) {
      if (!APPLICATION_STATUSES_SET.has(record.status)) continue;
      const date = recordInstant(record);
      if (!date) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = byKey.get(key);
      if (bucket) bucket.count += 1;
    }
    return list;
  }, [records, locale]);

  const max = Math.max(1, ...months.map(m => m.count));
  const peakIndex = months.reduce((best, m, i) => (m.count > months[best].count ? i : best), 0);
  // Clean integer y-ticks: 0 → yMax in at most 4 steps.
  const yMax = Math.max(2, Math.ceil(max / 2) * 2);
  const ticks = [0, yMax / 2, yMax];

  const W = 560; const H = 210; const PAD_L = 26; const PAD_B = 26; const PAD_T = 30;
  const plotW = W - PAD_L - 8; const plotH = H - PAD_T - PAD_B;
  const band = plotW / months.length;
  const barW = Math.min(38, band * 0.52);
  const y = v => PAD_T + plotH - (v / yMax) * plotH;

  return (
    <svg className="trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={isJa ? '月別の応募数' : 'Applications per month'}>
      <defs>
        <pattern id="trend-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#eef1f6" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#d7dde8" strokeWidth="1.6" />
        </pattern>
      </defs>
      {ticks.map(tick => (
        <g key={tick}>
          <line x1={PAD_L} x2={W - 8} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#cdd5e1' : '#eceff5'} strokeWidth="1" />
          <text x={PAD_L - 7} y={y(tick) + 3} textAnchor="end" className="trend-tick">{tick}</text>
        </g>
      ))}
      {months.map((month, index) => {
        const x = PAD_L + band * index + (band - barW) / 2;
        const h = month.count === 0 ? 3 : (month.count / yMax) * plotH;
        const top = PAD_T + plotH - h;
        const highlighted = index === peakIndex && month.count > 0;
        return (
          <g key={month.key} className={`trend-bar ${highlighted ? 'peak' : ''}`}>
            <rect className="trend-bar-hit" x={PAD_L + band * index} y={PAD_T - 16} width={band} height={plotH + 16} fill="transparent" />
            <rect
              className="trend-bar-mark"
              x={x} y={top} width={barW} height={h} rx="7" ry="7"
              fill={highlighted ? 'var(--halo-bg, #1a56f0)' : 'url(#trend-hatch)'}
              stroke={highlighted ? 'none' : '#dde3ee'} strokeWidth={highlighted ? 0 : 1}
            />
            <g className="trend-chip" transform={`translate(${x + barW / 2}, ${top - 12})`}>
              <rect x="-24" y="-13" width="48" height="20" rx="10" className="trend-chip-bg" />
              <text y="1" textAnchor="middle" className="trend-chip-text">{month.count}</text>
            </g>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="trend-month">{month.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function StatusBreakdownDonut({ counts, isJa }) {
  const slices = DONUT_ORDER
    .map(status => ({ status, count: counts[status] || 0, color: STATUS_COLORS[status] }))
    .filter(slice => slice.count > 0);
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  const R = 52; const STROKE = 16; const C = 2 * Math.PI * R;
  const GAP = slices.length > 1 ? 2.5 : 0; // surface gap between segments
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" role="img" aria-label={isJa ? '応募状況の内訳' : 'Application status breakdown'}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eef1f6" strokeWidth={STROKE} />
        {slices.map(slice => {
          const length = total ? (slice.count / total) * C : 0;
          const dash = Math.max(0, length - GAP);
          const el = (
            <circle
              key={slice.status}
              cx="70" cy="70" r={R} fill="none"
              stroke={slice.color} strokeWidth={STROKE} strokeLinecap={slices.length > 1 ? 'butt' : 'round'}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += length;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-total">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-total-label">{isJa ? '合計' : 'Total'}</text>
      </svg>
      <ul className="donut-legend">
        {slices.map(slice => (
          <li key={slice.status}>
            <i style={{ background: slice.color }} aria-hidden="true" />
            <span>{statusLabel(slice.status, isJa)}</span>
            <b>{slice.count}</b>
          </li>
        ))}
        {!total ? <li className="donut-legend-empty">{isJa ? 'まだ応募がありません' : 'No applications yet'}</li> : null}
      </ul>
    </div>
  );
}
