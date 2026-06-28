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
  const stack = Array.isArray(item.techStack) && item.techStack.length
    ? item.techStack
    : [item.track, 'Git', 'APIs', 'Cloud / product engineering'].filter(Boolean);
  const eligibility = Array.isArray(item.eligibility) && item.eligibility.length
    ? item.eligibility
    : String(item.workAuth || '').split(';').map(v => v.trim()).filter(Boolean);
  const eligibilityJa = Array.isArray(item.eligibilityJa) && item.eligibilityJa.length
    ? item.eligibilityJa
    : eligibility.map(translateEligibilityJa);
  const process = Array.isArray(item.applicationProcess) && item.applicationProcess.length
    ? item.applicationProcess
    : ['Apply online', 'Document screening', 'Technical / team interview', 'Result notification'];
  const processJa = Array.isArray(item.applicationProcessJa) && item.applicationProcessJa.length
    ? item.applicationProcessJa
    : process.map(processStepJa);

  return {
    about: item.about || item.fitNote,
    aboutJa: item.aboutJa || item.fitNoteJa || genericAboutJa(item),
    techStack: stack,
    eligibility,
    eligibilityJa,
    process,
    processJa,
  };
}
