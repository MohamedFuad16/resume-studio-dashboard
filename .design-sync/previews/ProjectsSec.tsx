// ProjectsSec is a repeatable list editor for portfolio projects. Entry below is
// from the seed profile (server/profiles/mohamed_fuad.json).
import { ProjectsSec } from 'resume-editor';

const noop = () => {};
const box: React.CSSProperties = { maxWidth: 660 };

const data = [{
  title: 'Tutor-System',
  tech: 'TypeScript, React 19, OpenRouter',
  year: '2025',
  url: 'https://github.com/MohamedFuad16',
  bullets: [
    'Built an AI learning interface in React 19 and TypeScript.',
    'Wired OpenRouter for model-agnostic tutoring responses.',
  ],
}];

export const Filled = () => (
  <div style={box}><ProjectsSec data={data} onChange={noop} isJa={false} /></div>
);

export const Japanese = () => (
  <div style={box}><ProjectsSec data={data} onChange={noop} isJa /></div>
);

export const Empty = () => (
  <div style={box}><ProjectsSec data={[]} onChange={noop} isJa={false} /></div>
);
