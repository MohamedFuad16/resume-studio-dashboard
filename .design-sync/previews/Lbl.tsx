// Lbl is the field label used by Inp/Txta (`<span className="fl">`). With no `t`
// prop it renders an empty span — hence the blank unauthored card.
import { Lbl } from 'resume-editor';

const stack: React.CSSProperties = { display: 'grid', gap: 10 };

export const Label = () => (
  <div style={stack}>
    <Lbl t="Name (English)" />
  </div>
);

// The labels this design system actually uses, shown together so the type
// treatment is legible at a glance.
export const InFormContext = () => (
  <div style={stack}>
    <Lbl t="Email" />
    <Lbl t="Phone" />
    <Lbl t="Professional summary" />
    <Lbl t="OpenRouter API key" />
  </div>
);
