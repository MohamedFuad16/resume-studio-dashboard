const DETAIL_OVERRIDES = {
  'hennge-gip-frontend-2026': {
    about: 'Frontend pathway for building TypeScript applications with React or Vue, then applying DevOps practices in a Tokyo engineering environment.',
    aboutJa: 'TypeScriptとReactまたはVueでフロントエンドアプリを開発し、DevOps実務まで体験する東京開催の技術インターンです。',
    techStack: ['TypeScript', 'React or Vue', 'Unix-like OS', 'Git', 'DevOps', 'Cloud basics'],
    eligibility: ['Third-year undergraduate or higher', 'React or Vue with TypeScript', 'Unix-like development environment knowledge', 'At least three listed cloud/full-stack/testing/UI skills'],
    eligibilityJa: ['学部3年生以上が目安', 'ReactまたはVueとTypeScriptの経験', 'Unix系開発環境の知識', 'クラウド、フルスタック、テスト、UI系スキルのうち複数を提示できること'],
    applicationProcess: ['Coding challenge', 'Upload CV and cover letter', 'HR / online interview', 'Program participation decision'],
    applicationProcessJa: ['コーディング課題', '履歴書・カバーレター提出', 'HR / オンライン面接', '参加可否の連絡'],
  },
  'hennge-gip-fullstack-2026': {
    about: 'Full-stack pathway focused on cloud application engineering, backend services, AWS and DevOps practice with HENNGE engineers.',
    aboutJa: 'クラウドアプリケーション、バックエンド、AWS、DevOpsをHENNGEのエンジニアと実践するフルスタック系インターンです。',
    techStack: ['TypeScript', 'Python or Go', 'AWS', 'Docker', 'Unix-like OS', 'Backend APIs'],
    eligibility: ['Third-year undergraduate or higher', 'CS or related degree', 'Python, Go, or TypeScript proficiency', 'Unix-like environment knowledge'],
    eligibilityJa: ['学部3年生以上が目安', '情報系または関連分野', 'Python、Go、TypeScriptのいずれか', 'Unix系環境の基礎知識'],
    applicationProcess: ['Coding challenge', 'Upload CV and cover letter', 'HR / online interview', 'Program participation decision'],
    applicationProcessJa: ['コーディング課題', '履歴書・カバーレター提出', 'HR / オンライン面接', '参加可否の連絡'],
  },
  'mercari-software-engineer-2028': {
    about: 'Production engineering internship across Mercari, Merpay, or Mercoin teams with feature work, operations exposure, and final review.',
    aboutJa: 'Mercari、Merpay、Mercoinなどのプロダクトチームで、本番機能開発や運用、最終成果発表まで経験するエンジニアインターンです。',
    techStack: ['Go / Kotlin / Swift / TypeScript', 'Backend APIs', 'Mobile / Web', 'RDBMS', 'SQL', 'Cloud operations'],
    eligibility: ['Graduating in March 2028 / joinable in 2027-2028 cycle', '20+ hours per week', 'Product development and operations experience', 'RDBMS and SQL basics'],
    eligibilityJa: ['2027〜2028年入社サイクル対象', '週20時間以上の参加が目安', 'プロダクト開発・運用経験', 'RDBMSとSQLの基礎'],
    applicationProcess: ['Document screening', 'Technical assessment / interview', 'Team matching', 'Offer / start-date coordination'],
    applicationProcessJa: ['書類選考', '技術課題または技術面接', '配属チーム調整', 'オファー・開始時期調整'],
  },
};

const RAKUTEN_PROCESS = ['Application', 'Document screening', 'Coding test', 'Second screening', 'Interview', 'Result notification'];
const RAKUTEN_PROCESS_JA = ['応募', '書類選考', 'コーディングテスト', '二次選考', '面接', '結果連絡'];
const RAKUTEN_TECH_STACKS = {
  'Full-stack / AI Applications': ['Python', 'Java', 'TypeScript', 'React', 'REST APIs', 'SQL', 'Cloud services'],
  'Backend / Cloud': ['Python', 'Java/Kotlin', 'JavaScript/TypeScript', 'Microservices', 'Git', 'Backend APIs'],
  'AI/ML Engineering': ['Python', 'TypeScript', 'Statistics', 'Cloud APIs', 'React / Tailwind', 'Data pipelines'],
  'Backend / Payments': ['Backend APIs', 'Mobile apps', 'Linux', 'AWS', 'Docker', 'Fintech systems'],
};

export function enrichSeedInternships(items) {
  return items.map(item => {
    const override = DETAIL_OVERRIDES[item.id] || {};
    const rakuten = item.company === 'Rakuten Group';
    return {
      ...item,
      ...override,
      techStack: override.techStack || item.techStack || (rakuten ? RAKUTEN_TECH_STACKS[item.track] : undefined),
      applicationProcess: override.applicationProcess || item.applicationProcess || (rakuten ? RAKUTEN_PROCESS : undefined),
      applicationProcessJa: override.applicationProcessJa || item.applicationProcessJa || (rakuten ? RAKUTEN_PROCESS_JA : undefined),
    };
  });
}
