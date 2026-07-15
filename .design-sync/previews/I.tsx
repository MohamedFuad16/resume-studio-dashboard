// I renders an inline SVG from a fixed name map — with no `n` prop it emits an
// empty <svg>, which is why the unauthored card was blank. Names below are the
// real keys from src/components/ui.jsx.
import { I } from 'resume-editor';

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  color: '#101113',
  flexWrap: 'wrap',
};

export const Navigation = () => (
  <div style={row}>
    <I n="menu" s={20} />
    <I n="panel" s={20} />
    <I n="radar" s={20} />
    <I n="collapse" s={20} />
    <I n="chev" s={20} />
  </div>
);

export const Content = () => (
  <div style={row}>
    <I n="user" s={20} />
    <I n="file" s={20} />
    <I n="txt" s={20} />
    <I n="edu" s={20} />
    <I n="work" s={20} />
    <I n="code" s={20} />
  </div>
);

export const Actions = () => (
  <div style={row}>
    <I n="plus" s={20} />
    <I n="check" s={20} />
    <I n="x" s={20} />
    <I n="dl" s={20} />
    <I n="sync" s={20} />
  </div>
);

export const Sizes = () => (
  <div style={row}>
    <I n="star" s={12} />
    <I n="star" s={16} />
    <I n="star" s={22} />
    <I n="star" s={32} />
  </div>
);
