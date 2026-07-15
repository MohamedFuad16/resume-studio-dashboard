// Inp is a labelled text field. Unauthored it rendered an empty, unlabelled
// input (no label/value/placeholder), which read as blank.
import { Inp } from 'resume-editor';

const noop = () => {};
const stack: React.CSSProperties = { display: 'grid', gap: 14, maxWidth: 380 };

export const WithValue = () => (
  <div style={stack}>
    <Inp label="Name (English)" value="Mohamed Fuad" onChange={noop} />
  </div>
);

export const Placeholder = () => (
  <div style={stack}>
    <Inp label="Email" value="" onChange={noop} placeholder="you@example.com" />
  </div>
);

export const Types = () => (
  <div style={stack}>
    <Inp label="Phone" value="080-7535-2988" onChange={noop} type="tel" />
    <Inp label="Password" value="hunter2000" onChange={noop} type="password" />
  </div>
);

// The label is optional — omitting it is how the field is used inside denser rows.
export const Unlabelled = () => (
  <div style={stack}>
    <Inp value="" onChange={noop} placeholder="Search company, role, or keyword" />
  </div>
);
