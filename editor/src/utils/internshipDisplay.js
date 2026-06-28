const COMPANY_DISPLAY = {
  HENNGE: { ja: 'HENNGE株式会社', brand: 'hennge', mark: 'HENNGE' },
  'Rakuten Group': { ja: '楽天グループ株式会社', brand: 'rakuten', mark: 'Rakuten' },
  'Mercari Group': { ja: '株式会社メルカリ', brand: 'mercari', mark: 'Mercari' },
  'Sony Group Corporation': { ja: 'ソニーグループ株式会社', brand: 'sony', mark: 'SONY' },
  'Preferred Networks': { ja: '株式会社Preferred Networks', brand: 'pfn', mark: 'PFN' },
  'Woven by Toyota': { ja: 'ウーブン・バイ・トヨタ', brand: 'woven', mark: 'Woven' },
  'LINE Yahoo': { ja: 'LINEヤフー株式会社', brand: 'line-yahoo', mark: 'LY' },
  Google: { ja: 'Google', brand: 'google', mark: 'Google' },
  Microsoft: { ja: 'Microsoft', brand: 'microsoft', mark: 'Microsoft' },
  Amazon: { ja: 'Amazon', brand: 'amazon', mark: 'Amazon' },
  Apple: { ja: 'Apple', brand: 'apple', mark: 'Apple' },
  NVIDIA: { ja: 'NVIDIA', brand: 'nvidia', mark: 'NVIDIA' },
  Stripe: { ja: 'Stripe', brand: 'stripe', mark: 'Stripe' },
  Salesforce: { ja: 'Salesforce', brand: 'salesforce', mark: 'Salesforce' },
  IBM: { ja: '日本IBM', brand: 'ibm', mark: 'IBM' },
};

const DETAIL_OVERRIDES = {
  'hennge-gip-frontend-2026': {
    about: 'Frontend pathway for building TypeScript applications with React or Vue, then applying DevOps practices in a Tokyo engineering environment.',
    aboutJa: 'TypeScriptとReactまたはVueでフロントエンドアプリを開発し、DevOps実務まで体験する東京開催の技術インターンです。',
    techStack: ['TypeScript', 'React or Vue', 'Unix-like OS', 'Git', 'DevOps', 'Cloud basics'],
    eligibility: [
      'Third-year undergraduate or higher',
      'React or Vue with TypeScript',
      'Unix-like development environment knowledge',
      'At least three listed cloud/full-stack/testing/UI skills',
    ],
    eligibilityJa: [
      '学部3年生以上が目安',
      'ReactまたはVueとTypeScriptの経験',
      'Unix系開発環境の知識',
      'クラウド、フルスタック、テスト、UI系スキルのうち複数を提示できること',
    ],
    process: ['Coding challenge', 'Upload CV and cover letter', 'HR / online interview', 'Program participation decision'],
    processJa: ['コーディング課題', '履歴書・カバーレター提出', 'HR / オンライン面接', '参加可否の連絡'],
  },
  'hennge-gip-fullstack-2026': {
    about: 'Full-stack pathway focused on cloud application engineering, backend services, AWS and DevOps practice with HENNGE engineers.',
    aboutJa: 'クラウドアプリケーション、バックエンド、AWS、DevOpsをHENNGEのエンジニアと実践するフルスタック系インターンです。',
    techStack: ['TypeScript', 'Python or Go', 'AWS', 'Docker', 'Unix-like OS', 'Backend APIs'],
    eligibility: ['Third-year undergraduate or higher', 'CS or related degree', 'Python, Go, or TypeScript proficiency', 'Unix-like environment knowledge'],
    eligibilityJa: ['学部3年生以上が目安', '情報系または関連分野', 'Python、Go、TypeScriptのいずれか', 'Unix系環境の基礎知識'],
    process: ['Coding challenge', 'Upload CV and cover letter', 'HR / online interview', 'Program participation decision'],
    processJa: ['コーディング課題', '履歴書・カバーレター提出', 'HR / オンライン面接', '参加可否の連絡'],
  },
  'mercari-software-engineer-2028': {
    about: 'Production engineering internship across Mercari, Merpay, or Mercoin teams with feature work, operations exposure, and final review.',
    aboutJa: 'Mercari、Merpay、Mercoinなどのプロダクトチームで、本番機能開発や運用、最終成果発表まで経験するエンジニアインターンです。',
    techStack: ['Go / Kotlin / Swift / TypeScript', 'Backend APIs', 'Mobile / Web', 'RDBMS', 'SQL', 'Cloud operations'],
    eligibility: ['Graduating in March 2028 / joinable in 2027-2028 cycle', '20+ hours per week', 'Product development and operations experience', 'RDBMS and SQL basics'],
    eligibilityJa: ['2027〜2028年入社サイクル対象', '週20時間以上の参加が目安', 'プロダクト開発・運用経験', 'RDBMSとSQLの基礎'],
    process: ['Document screening', 'Technical assessment / interview', 'Team matching', 'Offer / start-date coordination'],
    processJa: ['書類選考', '技術課題または技術面接', '配属チーム調整', 'オファー・開始時期調整'],
  },
};

const RAKUTEN_PROCESS = {
  process: ['Application', 'Document screening', 'Coding test', 'Second screening', 'Interview', 'Result notification'],
  processJa: ['応募', '書類選考', 'コーディングテスト', '二次選考', '面接', '結果連絡'],
};

const RAKUTEN_TECH_STACKS = {
  'Full-stack / AI Applications': ['Python', 'Java', 'TypeScript', 'React', 'REST APIs', 'SQL', 'Cloud services'],
  'Backend / Cloud': ['Python', 'Java/Kotlin', 'JavaScript/TypeScript', 'Microservices', 'Git', 'Backend APIs'],
  'AI/ML Engineering': ['Python', 'TypeScript', 'Statistics', 'Cloud APIs', 'React / Tailwind', 'Data pipelines'],
  'Backend / Payments': ['Backend APIs', 'Mobile apps', 'Linux', 'AWS', 'Docker', 'Fintech systems'],
};

const TRACK_LABELS_JA = {
  Frontend: 'フロントエンド開発',
  'Full-stack / Cloud': 'フルスタック・クラウド開発',
  'Full-stack / AI Applications': 'フルスタック・AIアプリ開発',
  'Backend / Cloud': 'バックエンド・クラウド開発',
  'AI/ML Engineering': 'AI・機械学習エンジニアリング',
  'Software Engineering': 'ソフトウェア開発',
  'Infrastructure / Cloud': 'インフラ・クラウド開発',
  'Backend / Payments': '決済バックエンド開発',
  'Cloud Infrastructure': 'クラウドインフラ開発',
  'Data Engineering / Data Science': 'データエンジニアリング・データサイエンス',
  'Network / Infrastructure Automation': 'ネットワーク・インフラ自動化',
  'Security Engineering': 'セキュリティエンジニアリング',
  'Product Design / UI Engineering': 'プロダクトデザイン・UI開発',
  Data: 'データ分野',
  'Sales / Business': 'セールス・ビジネス分野',
};

function genericAboutJa(item) {
  const field = TRACK_LABELS_JA[item.track] || '専門分野';
  return `${field}の実務を通じて、企業のプロダクトや業務に関わるインターンです。具体的な担当内容は公式募集ページで確認してください。`;
}

function translateEligibilityJa(value) {
  const text = String(value || '').trim();
  if (!text || /^Not stated$/i.test(text)) return '応募条件の詳細は公式募集ページで確認してください';
  const translated = text
    .replace(/Third-year undergraduate or higher/gi, '学部3年生以上が目安')
    .replace(/CS or related degree/gi, '情報系または関連分野を専攻')
    .replace(/Japan resident with work authorization/gi, '日本在住で就労資格があること')
    .replace(/Re-check eligibility on the official page/gi, '応募条件は公式募集ページで再確認してください')
    .replace(/English/gi, '英語')
    .replace(/Japanese/gi, '日本語')
    .replace(/required/gi, '必須')
    .replace(/preferred/gi, '歓迎');
  return /[A-Za-z]{4,}/.test(translated) ? '応募条件の詳細は公式募集ページで確認してください' : translated;
}

function processStepJa(value) {
  const text = String(value || '').trim();
  const rules = [
    [/apply|application/i, 'オンライン応募'],
    [/document|resume|cv/i, '書類選考'],
    [/coding|technical assessment/i, '技術課題'],
    [/interview/i, '面接'],
    [/team match/i, '配属チーム調整'],
    [/offer|result|decision/i, '結果連絡'],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] || '選考ステップ（公式ページで詳細確認）';
}

export function displayCompany(item, isJa = false) {
  const info = COMPANY_DISPLAY[item.company] || {};
  return isJa ? (item.companyJa || info.ja || item.company) : item.company;
}

export function brandInfo(item) {
  return COMPANY_DISPLAY[item.company] || { brand: 'default', mark: item.company };
}

export function internshipDetails(item) {
  const override = DETAIL_OVERRIDES[item.id] || {};
  const isRakuten = item.company === 'Rakuten Group';
  const stack = override.techStack || RAKUTEN_TECH_STACKS[item.track] || [item.track, 'Git', 'APIs', 'Cloud / product engineering'].filter(Boolean);
  const eligibility = override.eligibility || String(item.workAuth || '').split(';').map(v => v.trim()).filter(Boolean);
  const eligibilityJa = override.eligibilityJa || eligibility.map(translateEligibilityJa);
  const liveProcess = Array.isArray(item.applicationProcess) && item.applicationProcess.length ? item.applicationProcess : null;
  const process = override.process || liveProcess || (isRakuten ? RAKUTEN_PROCESS.process : ['Apply online', 'Document screening', 'Technical / team interview', 'Result notification']);
  const processJa = override.processJa || (liveProcess ? liveProcess.map(processStepJa) : null) || (isRakuten ? RAKUTEN_PROCESS.processJa : ['オンライン応募', '書類選考', '技術またはチーム面接', '結果連絡']);

  return {
    about: override.about || item.fitNote,
    aboutJa: override.aboutJa || item.fitNoteJa || genericAboutJa(item),
    techStack: stack,
    eligibility,
    eligibilityJa,
    process,
    processJa,
  };
}
