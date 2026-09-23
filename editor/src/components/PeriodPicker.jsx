// "Last [2] [weeks]" — the activity-period control shown on the Dashboard and
// Applications headers. Both selects write the same shared period.
import { PERIOD_UNITS, normalizePeriod, periodMaxAmount, useActivityPeriod } from '../hooks/useActivityPeriod.js';

const COPY = {
  en: { label: 'Last', amount: 'Number', unit: 'Unit', units: { weeks: 'weeks', months: 'months', years: 'years' } },
  ja: { label: '直近', amount: '数', unit: '単位', units: { weeks: '週間', months: 'か月', years: '年' } },
};

export default function PeriodPicker({ isJa = false }) {
  const t = COPY[isJa ? 'ja' : 'en'];
  const { period, setPeriod } = useActivityPeriod();
  const amounts = Array.from({ length: periodMaxAmount(period.unit) }, (_, i) => i + 1);

  return (
    <div className="period-picker" role="group" aria-label={t.label}>
      <span className="period-picker-label">{t.label}</span>
      <select aria-label={t.amount} value={period.amount} onChange={e => setPeriod({ ...period, amount: Number(e.target.value) })}>
        {amounts.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <select aria-label={t.unit} value={period.unit} onChange={e => setPeriod(normalizePeriod({ amount: period.amount, unit: e.target.value }))}>
        {PERIOD_UNITS.map(unit => <option key={unit} value={unit}>{t.units[unit]}</option>)}
      </select>
    </div>
  );
}
