// Txta is the multi-line counterpart to Inp. Unauthored it rendered an empty
// 3-row textarea with no label, which read as blank.
import { Txta } from 'resume-editor';

const noop = () => {};
const stack: React.CSSProperties = { display: 'grid', gap: 14, maxWidth: 480 };

export const WithValue = () => (
  <div style={stack}>
    <Txta
      label="Professional summary"
      value="Frontend-leaning full-stack engineer in Tokyo. React 19 and TypeScript day to day, with AWS and Node on the back end. Built and shipped four production apps while studying at Tokai University."
      onChange={noop}
    />
  </div>
);

export const Placeholder = () => (
  <div style={stack}>
    <Txta
      label="Professional summary"
      value=""
      onChange={noop}
      placeholder="Summarize your background, strengths, and target role…"
    />
  </div>
);

// `rows` sets the initial height — 6 is what the longer résumé fields use.
export const Rows = () => (
  <div style={stack}>
    <Txta
      label="Project description"
      value="A mobile-first file transfer app using WebRTC for peer-to-peer delivery, with a Node signalling server and proximity-based pairing."
      onChange={noop}
      rows={6}
    />
  </div>
);
