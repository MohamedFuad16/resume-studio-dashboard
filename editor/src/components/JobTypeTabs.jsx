// "All · Internship · New grad · Full time" segmented control with counts.
// The Unsorted tab only appears when some record has no role to read a type from.
import { GraduationCap, BriefcaseBusiness, Layers, Sprout, CircleHelp } from 'lucide-react';
import { jobTypeLabel } from '../utils/jobType.js';

const ICONS = { all: Layers, internship: Sprout, new_grad: GraduationCap, full_time: BriefcaseBusiness, unknown: CircleHelp };

export default function JobTypeTabs({ value, onChange, counts, isJa = false, label }) {
  const tabs = ['all', 'internship', 'new_grad', 'full_time'];
  if (counts?.unknown || value === 'unknown') tabs.push('unknown');
  return (
    <div className="jobtype-tabs" role="tablist" aria-label={label || (isJa ? '雇用形態' : 'Job type')}>
      {tabs.map(type => {
        const Icon = ICONS[type];
        const text = type === 'all' ? (isJa ? 'すべて' : 'All') : jobTypeLabel(type, isJa);
        return (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={value === type}
            className={`jobtype-tab ${value === type ? 'active' : ''}`}
            onClick={() => onChange(type)}
          >
            <Icon size={13} aria-hidden="true" />
            <span>{text}</span>
            {counts ? <b>{counts[type] || 0}</b> : null}
          </button>
        );
      })}
    </div>
  );
}
