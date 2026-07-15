// PersonalSec is the résumé's contact block. Unauthored it got no `data`, so
// every field rendered empty. Values below come from the seed profile
// (server/profiles/mohamed_fuad.json).
import { PersonalSec } from 'resume-editor';

const noop = () => {};
const box: React.CSSProperties = { maxWidth: 640 };

const data = {
  nameEn: 'Mohamed Fuad',
  nameJa: 'モハメド フアド',
  furigana: 'もはめど ふあど',
  email: 'mohamed.fuad.jp@gmail.com',
  phone: '080-7535-2988',
  address: '東京都世田谷区',
  github: 'https://github.com/MohamedFuad16',
  linkedin: 'https://linkedin.com/in/mohamed-fuad-6b848327b',
};

export const Filled = () => (
  <div style={box}>
    <PersonalSec data={data} onChange={noop} isJa={false} />
  </div>
);

export const Japanese = () => (
  <div style={box}>
    <PersonalSec data={data} onChange={noop} isJa />
  </div>
);

// How the section looks on a brand-new profile.
export const Empty = () => (
  <div style={box}>
    <PersonalSec data={{}} onChange={noop} isJa={false} />
  </div>
);
