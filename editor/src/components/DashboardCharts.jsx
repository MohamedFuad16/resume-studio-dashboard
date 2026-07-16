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

// The month an application belongs to. Gmail-imported records carry the email's
// real receipt date in sourceMeta — createdAt is only when the drain ran.
const recordInstant = record => {
  const raw = record.sourceMeta?.receivedAt || record.appliedAt || record.createdAt || record.updatedAt;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

// A bar that sits flush on the axis: square bottom corners, rounded top only.
// (A plain <rect rx> rounds all four corners, so bars looked detached from
// the baseline.)
const barPath = (x, top, width, height) => {
  const r = Math.min(9, width / 2, height);
  const bottom = top + height;
  return [
    `M${x} ${bottom}`,
    `V${top + r}`,
    `Q${x} ${top} ${x + r} ${top}`,
    `H${x + width - r}`,
    `Q${x + width} ${top} ${x + width} ${top + r}`,
    `V${bottom}`,
    'Z',
  ].join(' ');
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

  const W = 640; const H = 224; const PAD_L = 30; const PAD_B = 28; const PAD_T = 38;
  const plotW = W - PAD_L - 10; const plotH = H - PAD_T - PAD_B;
  const band = plotW / months.length;
  const barW = Math.min(34, band * 0.42);
  const y = v => PAD_T + plotH - (v / yMax) * plotH;

  // GSAP entrance: bars grow up from the baseline with a stagger while month
  // labels fade in. Cleanup clears the inline props so an interrupted run
  // (re-render mid-tween) can never leave the chart half-drawn or invisible.
  // NOTE: don't tween .trend-chip — GSAP would overwrite its SVG
  // `transform="translate(...)"` positioning; CSS handles its fade.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const bars = svg.querySelectorAll('.trend-bar-mark');
    const labels = svg.querySelectorAll('.trend-month');
    const tweens = [
      gsap.fromTo(bars,
        { scaleY: 0, transformOrigin: '50% 100%' },
        { scaleY: 1, duration: 0.85, ease: 'power3.out', stagger: 0.07, overwrite: 'auto' }),
      gsap.fromTo(labels,
        { opacity: 0 },
        { opacity: 1, duration: 0.45, ease: 'power2.out', stagger: 0.07, delay: 0.15, overwrite: 'auto' }),
    ];
    // rAF can be throttled/paused in background or embedded tabs, freezing the
    // tweens at their (invisible) start state — force-finish after the runtime.
    const settle = window.setTimeout(() => tweens.forEach(tween => tween.progress(1)), 1800);
    return () => {
      window.clearTimeout(settle);
      tweens.forEach(tween => tween.kill());
      gsap.set(bars, { clearProps: 'all' });
      gsap.set(labels, { clearProps: 'all' });
    };
  }, [months]);

  return (
    <svg ref={svgRef} className="trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={isJa ? '月別の応募数' : 'Applications per month'}>
      <defs>
        <pattern id="trend-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#eef1f6" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#d7dde8" strokeWidth="1.6" />
        </pattern>
      </defs>
      {ticks.map(tick => (
        <g key={tick}>
          <line x1={PAD_L} x2={W - 10} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#cdd5e1' : '#eceff5'} strokeWidth="1" />
          <text x={PAD_L - 8} y={y(tick) + 3} textAnchor="end" className="trend-tick">{tick}</text>
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
            <path
              className="trend-bar-mark"
              d={barPath(x, top, barW, h)}
              fill={highlighted ? 'var(--halo-bg, #1a56f0)' : 'url(#trend-hatch)'}
              stroke={highlighted ? 'none' : '#dde3ee'} strokeWidth={highlighted ? 0 : 1}
            />
            <g className="trend-chip" transform={`translate(${x + barW / 2}, ${top - 11})`}>
              <rect x="-19" y="-12" width="38" height="19" rx="9.5" className="trend-chip-bg" />
              <text y="2" textAnchor="middle" className="trend-chip-text">{month.count}</text>
            </g>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="trend-month">{month.label}</text>
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
