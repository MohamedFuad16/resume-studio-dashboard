// SummarySec edits the résumé's professional summary and can generate one from
// the rest of the résumé, so it takes `resume` alongside its own `data`.
import { SummarySec } from 'resume-editor';

const noop = () => {};
const box: React.CSSProperties = { maxWidth: 640 };

const resume = {
  personal: { nameEn: 'Mohamed Fuad' },
  education: [{ institution: 'Tokai University', degree: 'Bachelor of Science — Information Communication' }],
  skills: { languages: 'TypeScript, JavaScript, Python' },
  projects: [{ title: 'Tutor-System' }],
};

export const Filled = () => (
  <div style={box}>
    <SummarySec
      data="Frontend-leaning full-stack engineer in Tokyo. React 19 and TypeScript day to day, with AWS and Node on the back end."
      onChange={noop}
      isJa={false}
      resume={resume}
    />
  </div>
);

export const Japanese = () => (
  <div style={box}>
    <SummarySec
      data="東京在住のフルスタックエンジニア。React 19 と TypeScript を中心に、AWS と Node でバックエンドも担当。"
      onChange={noop}
      isJa
      resume={resume}
    />
  </div>
);

export const Empty = () => (
  <div style={box}>
    <SummarySec data="" onChange={noop} isJa={false} resume={resume} />
  </div>
);
