// ExperienceSec is a repeatable list editor for work history. Entry below is
// from the seed profile (server/profiles/mohamed_fuad.json).
import { ExperienceSec } from 'resume-editor';

const noop = () => {};
const box: React.CSSProperties = { maxWidth: 660 };

const data = [{
  company: 'Japan Airlines',
  companyJa: '日本航空株式会社',
  role: 'IT Support intern',
  roleJa: '出入国業務アシスタント',
  location: 'Tokyo, Japan',
  startDate: 'Feb 2023',
  endDate: 'Mar 2023',
  bullets: [
    'Supported immigration desk operations during peak travel periods.',
    'Assisted passengers with documentation and system entry.',
  ],
}];

export const Filled = () => (
  <div style={box}><ExperienceSec data={data} onChange={noop} isJa={false} /></div>
);

export const Japanese = () => (
  <div style={box}><ExperienceSec data={data} onChange={noop} isJa /></div>
);

export const Empty = () => (
  <div style={box}><ExperienceSec data={[]} onChange={noop} isJa={false} /></div>
);
