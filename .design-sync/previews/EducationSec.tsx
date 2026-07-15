// EducationSec is a repeatable list editor — `data` is an array of entries.
// Unauthored it got no data and rendered an empty list. Entry below is from the
// seed profile (server/profiles/mohamed_fuad.json).
import { EducationSec } from 'resume-editor';

const noop = () => {};
const box: React.CSSProperties = { maxWidth: 660 };

const data = [{
  institution: 'Tokai University',
  institutionJa: '東海大学',
  degree: 'Bachelor of Science — Information Communication',
  degreeJa: '情報通信学部 情報通信学科（学士課程・3年次在学中）',
  location: 'Tokyo, Japan',
  startDate: 'Apr 2024',
  endDate: 'Mar 2028',
}];

export const Filled = () => (
  <div style={box}><EducationSec data={data} onChange={noop} isJa={false} /></div>
);

export const Japanese = () => (
  <div style={box}><EducationSec data={data} onChange={noop} isJa /></div>
);

export const Empty = () => (
  <div style={box}><EducationSec data={[]} onChange={noop} isJa={false} /></div>
);
