// ActivitiesSec is a repeatable list editor for extracurriculars. Entry below is
// from the seed profile (server/profiles/mohamed_fuad.json).
import { ActivitiesSec } from 'resume-editor';

const noop = () => {};
const box: React.CSSProperties = { maxWidth: 660 };

const data = [{
  title: 'IEEE Student Member',
  org: 'Tokai University Student Branch',
  location: 'Tokyo, Japan',
  startDate: '2024',
  endDate: 'Present',
  bullets: ['Participated in technical seminars and student branch events.'],
}];

export const Filled = () => (
  <div style={box}><ActivitiesSec data={data} onChange={noop} isJa={false} /></div>
);

export const Japanese = () => (
  <div style={box}><ActivitiesSec data={data} onChange={noop} isJa /></div>
);

export const Empty = () => (
  <div style={box}><ActivitiesSec data={[]} onChange={noop} isJa={false} /></div>
);
