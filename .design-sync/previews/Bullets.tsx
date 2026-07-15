// Bullets is the repeatable bullet-list editor used by the résumé sections.
// Unauthored it got an empty `items` array and rendered nothing.
import { Bullets } from 'resume-editor';

const noop = () => {};
const box: React.CSSProperties = { maxWidth: 520 };

// Real bullets from the Tutor-System project in the seed résumé.
export const WithItems = () => (
  <div style={box}>
    <Bullets
      items={[
        'Built an AI learning interface in React 19 and TypeScript.',
        'Wired OpenRouter for model-agnostic tutoring responses.',
        'Shipped to production for a cohort of 40 students.',
      ]}
      onChange={noop}
    />
  </div>
);

export const SingleItem = () => (
  <div style={box}>
    <Bullets items={['Maintained the department’s internal tooling.']} onChange={noop} />
  </div>
);

// The empty state is how the editor first appears on a new entry.
export const Empty = () => (
  <div style={box}>
    <Bullets items={[]} onChange={noop} />
  </div>
);
