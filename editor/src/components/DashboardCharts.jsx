import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { statusLabel } from '../hooks/useApplicationTracker.js';

// Dashboard analytics: a monthly application-trend bar chart and a status
// breakdown donut. Plain SVG, no chart library; GSAP drives the entrance
// animations. Colors are validated against the white card surface (dataviz
// six-checks); the legend carries the counts, so identity never rides on
// color alone.
const STATUS_COLORS = { applying: '#1baf7a', applied: '#2a78d6', interview: '#eda100', rejected: '#e34948' };
const DONUT_ORDER = ['applying', 'applied', 'interview', 'rejected'];
const APPLICATION_STATUSES_SET = new Set(DONUT_ORDER);

// "Applications sent per month" buckets by WHEN THE APPLICATION WAS MADE, so
// prefer the per-status `appliedAt` (the application email's date) over the
// last-touched email (`sourceMeta.receivedAt` could be a later rejection) and
// over `createdAt` (the drain time).
const recordInstant = record => {
  const raw = record.appliedAt || record.createdAt || record.sourceMeta?.receivedAt || record.updatedAt;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

// Smooth path through the points (Catmull-Rom → cubic Bézier), so the trend
// reads as one flowing line rather than a jagged polyline.
const smoothPath = points => {
  if (points.length < 2) return points.length ? `M${points[0].x} ${points[0].y}` : '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
};

export function ApplicationTrendChart({ records, isJa }) {
  const svgRef = useRef(null);
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

  const W = 640; const H = 224; const PAD_L = 30; const PAD_B = 28; const PAD_T = 34;
  const plotW = W - PAD_L - 14; const plotH = H - PAD_T - PAD_B;
  const step = plotW / (months.length - 1);
  const x = i => PAD_L + step * i;
  const y = v => PAD_T + plotH - (v / yMax) * plotH;
  const points = months.map((m, i) => ({ x: x(i), y: y(m.count), count: m.count }));
  const linePath = smoothPath(points);
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x} ${y(0)} L${points[0].x} ${y(0)} Z`
    : '';

  // GSAP entrance: the area fades up, the line draws left→right via
  // stroke-dashoffset, then the dots pop and month labels fade in. Cleanup
  // clears inline props so an interrupted re-render can't freeze it invisible.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const line = svg.querySelector('.trend-line');
    const area = svg.querySelector('.trend-area');
    const dots = svg.querySelectorAll('.trend-dot');
    const labels = svg.querySelectorAll('.trend-month');
    const len = line ? line.getTotalLength() : 0;
    const tweens = [];
    if (line) {
      gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
      tweens.push(gsap.to(line, { strokeDashoffset: 0, duration: 1, ease: 'power2.out', overwrite: 'auto' }));
    }
    if (area) tweens.push(gsap.fromTo(area, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out', overwrite: 'auto' }));
    tweens.push(gsap.fromTo(dots, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: 'back.out(2)', stagger: 0.08, delay: 0.5, overwrite: 'auto' }));
    tweens.push(gsap.fromTo(labels, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out', stagger: 0.06, delay: 0.2, overwrite: 'auto' }));
    // rAF can be throttled/paused in a background/embedded tab, freezing tweens
    // at their invisible start — force-finish after the runtime.
    const settle = window.setTimeout(() => tweens.forEach(t => t.progress(1)), 1800);
    return () => {
      window.clearTimeout(settle);
      tweens.forEach(t => t.kill());
      if (line) gsap.set(line, { clearProps: 'all' });
      if (area) gsap.set(area, { clearProps: 'all' });
      gsap.set(dots, { clearProps: 'all' });
      gsap.set(labels, { clearProps: 'all' });
    };
  }, [months]);

  return (
    <svg ref={svgRef} className="trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={isJa ? '月別の応募数' : 'Applications per month'}>
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--halo-bg, #1a56f0)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--halo-bg, #1a56f0)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map(tick => (
        <g key={tick}>
          <line x1={PAD_L} x2={W - 14} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#cdd5e1' : '#eceff5'} strokeWidth="1" />
          <text x={PAD_L - 8} y={y(tick) + 3} textAnchor="end" className="trend-tick">{tick}</text>
        </g>
      ))}
      {areaPath ? <path className="trend-area" d={areaPath} fill="url(#trend-fill)" /> : null}
      {linePath ? <path className="trend-line" d={linePath} fill="none" stroke="var(--halo-bg, #1a56f0)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {points.map((p, index) => {
        const highlighted = index === peakIndex && p.count > 0;
        return (
          <g key={months[index].key} className={`trend-point ${highlighted ? 'peak' : ''}`}>
            <circle className="trend-dot" cx={p.x} cy={p.y} r={highlighted ? 5 : 3.5} fill="#fff" stroke="var(--halo-bg, #1a56f0)" strokeWidth="2.5" />
            {highlighted ? (
              <g className="trend-chip" transform={`translate(${p.x}, ${p.y - 14})`}>
                <rect x="-15" y="-13" width="30" height="19" rx="9.5" className="trend-chip-bg" />
                <text y="1" textAnchor="middle" className="trend-chip-text">{p.count}</text>
              </g>
            ) : null}
            <text x={p.x} y={H - 8} textAnchor="middle" className="trend-month">{months[index].label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function StatusBreakdownDonut({ counts, isJa }) {
  const wrapRef = useRef(null);
  const slices = DONUT_ORDER
    .map(status => ({ status, count: counts[status] || 0, color: STATUS_COLORS[status] }))
    .filter(slice => slice.count > 0);
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  const R = 52; const STROKE = 16; const C = 2 * Math.PI * R;
  const GAP = slices.length > 1 ? 2.5 : 0; // surface gap between segments
  let offset = 0;

  // GSAP entrance: segments sweep clockwise in sequence, the total counts up,
  // and legend rows slide in. Cleanup clears inline props so an interrupted
  // run falls back to the attribute-defined (final) state.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const slicesEls = wrap.querySelectorAll('.donut-slice');
    const legendEls = wrap.querySelectorAll('.donut-legend li');
    const totalEl = wrap.querySelector('.donut-total');
    const tweens = [];
    slicesEls.forEach((el, i) => {
      const dash = Number(el.dataset.dash) || 0;
      tweens.push(gsap.fromTo(el,
        { strokeDasharray: `0 ${C}` },
        { strokeDasharray: `${dash} ${C - dash}`, duration: 0.8, ease: 'power2.inOut', delay: i * 0.12, overwrite: 'auto' }));
    });
    if (totalEl && total > 0) {
      const counter = { value: 0 };
      tweens.push(gsap.to(counter, {
        value: total, duration: 0.8, ease: 'power2.out',
        onUpdate: () => { totalEl.textContent = String(Math.round(counter.value)); },
      }));
    }
    tweens.push(gsap.fromTo(legendEls,
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out', stagger: 0.08, delay: 0.25, overwrite: 'auto' }));
    // Same fail-safe as the trend chart: never leave the donut invisible if
    // rAF is throttled and the tweens can't run.
    const settle = window.setTimeout(() => tweens.forEach(tween => tween.progress(1)), 2000);
    return () => {
      window.clearTimeout(settle);
      tweens.forEach(tween => tween.kill());
      gsap.set(slicesEls, { clearProps: 'all' });
      gsap.set(legendEls, { clearProps: 'all' });
      if (totalEl) totalEl.textContent = String(total);
    };
  }, [total, C, slices.length]);

  return (
    <div className="donut-wrap" ref={wrapRef}>
      <svg viewBox="0 0 140 140" role="img" aria-label={isJa ? '応募状況の内訳' : 'Application status breakdown'}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eef1f6" strokeWidth={STROKE} />
        {slices.map(slice => {
          const length = total ? (slice.count / total) * C : 0;
          const dash = Math.max(0, length - GAP);
          const el = (
            <circle
              key={slice.status}
              className="donut-slice"
              data-dash={dash}
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
