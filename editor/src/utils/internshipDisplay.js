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
  Mirrativ: { ja: '株式会社ミラティブ', brand: 'mirrativ', mark: 'Mirrativ' },
  ABEJA: { ja: '株式会社ABEJA', brand: 'abeja', mark: 'ABEJA' },
  IVRy: { ja: '株式会社IVRy', brand: 'ivry', mark: 'IVRy' },
  GEOTRA: { ja: 'GEOTRA株式会社', brand: 'geotra', mark: 'GEOTRA' },
  AICE: { ja: '株式会社AICE', brand: 'aice', mark: 'AICE' },
  enechain: { ja: '株式会社enechain', brand: 'enechain', mark: 'enechain' },
  unerry: { ja: '株式会社unerry', brand: 'unerry', mark: 'unerry' },
  Canary: { ja: '株式会社カナリー', brand: 'canary', mark: 'Canary' },
  KIYONO: { ja: '株式会社KIYONO', brand: 'kiyono', mark: 'KIYONO' },
  Meltly: { ja: '株式会社Meltly', brand: 'meltly', mark: 'Meltly' },
  InsightX: { ja: '株式会社InsightX', brand: 'insightx', mark: 'InsightX' },
  franky: { ja: 'franky株式会社', brand: 'franky', mark: 'franky' },
  Nehan: { ja: '株式会社Nehan', brand: 'nehan', mark: 'Nehan' },
  pluszero: { ja: '株式会社pluszero', brand: 'pluszero', mark: 'pluszero' },
  Comici: { ja: 'コミチ株式会社', brand: 'comici', mark: 'Comici' },
  'Digital Grid': { ja: 'デジタルグリッド株式会社', brand: 'digitalgrid', mark: 'Digital Grid' },
  find: { ja: 'find株式会社', brand: 'find', mark: 'find' },
  'Prossell Holdings': { ja: '株式会社プロッセル', brand: 'prossell', mark: 'Prossell' },
  T2: { ja: '株式会社T2', brand: 't2', mark: 'T2' },
  Atilika: { ja: 'アティリカ株式会社', brand: 'atilika', mark: 'Atilika' },
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
  'Mobile Engineering': 'モバイルエンジニアリング',
  'Product Engineering': 'プロダクトエンジニアリング',
  Data: 'データ分野',
  Sales: 'セールス分野',
  'Sales / Business': 'セールス・ビジネス分野',
  'AI / Machine Learning': 'AI・機械学習',
  'AI Product / Business Operations': 'AIプロダクト・事業運営',
  'Cloud / Networking / Security': 'クラウド・ネットワーク・セキュリティ',
  'Data Engineering': 'データエンジニアリング',
  'Embedded Software': '組込みソフトウェア',
  'Enterprise Applications': 'エンタープライズアプリケーション',
  'Enterprise Architecture / Cloud': 'エンタープライズアーキテクチャ・クラウド',
  'Frontend / Full-stack': 'フロントエンド・フルスタック',
  'Full-stack / Ad Technology': 'フルスタック・広告技術',
  'Machine Learning': '機械学習',
  'Machine Learning / Platform': '機械学習・プラットフォーム',
  'Platform Engineering': 'プラットフォームエンジニアリング',
  'Product / Technical Operations': 'プロダクト・技術運用',
  'Python / Mission Operations': 'Python・ミッション運用',
  'Python / Test Infrastructure': 'Python・テスト基盤',
  'Quality Engineering': '品質エンジニアリング',
  'Systems / AI Hardware': 'システム・AIハードウェア',
  'Systems / Graphics': 'システム・グラフィックス',
  'Technical Product Management': 'テクニカルプロダクトマネジメント',
};

// Month-name → number map for translating residual "Month YYYY" / "Month-Month
// YYYY" date phrases in jaDisplay. Used via RegExp callbacks so the conversion
// is guarded by an adjacent 4-digit year (the word "May" in prose is untouched).
const MONTH_NUM = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const MONTH_NAMES = 'January|February|March|April|May|June|July|August|September|October|November|December';

// Single source of truth for EN→JA string localization shared by every dashboard
// (ProfileDashboard, InternshipDashboard, ApplicationCalendar). Previously this
// regex chain was duplicated inline inside InternshipDashboard.jsx and drifted.
//
// NOTE on ordering: specific anchored "Not stated; …" phrases MUST run before the
// generic `Not stated;\s*` prefix replace below — otherwise the generic rule
// rewrites the prefix and the specific (anchored ^…$) rule can never match,
// leaving a half-translated string.
function jaDisplay(value) {
  if (!value) return value;
  return String(value)
    .replace(/^Not stated; PC and transport benefits listed$/i, '記載なし・PC/交通費支給あり')
    .replace(/Not stated;\s*/gi, '記載なし・')
    .replace(/Listed under Students: Internships\. Detailed eligibility 記載なし・\.?/gi, 'Students: Internshipsに掲載。詳細な応募条件は記載なし。')
    .replace(/;\s*$/g, '')
    .replace(/(\d+)\s+weekly hours listed/gi, '週$1時間と記載')
    .replace(/(\d+)\s+hours listed/gi, '$1時間と記載')
    .replace(/Listed under Students: Internships\. Detailed eligibility not stated\.?/gi, 'Students: Internshipsに掲載。詳細な応募条件は記載なし。')
    .replace(/Re-check eligibility on the official page/gi, '公式ページで応募条件を再確認')
    .replace(/Apply online/gi, 'オンライン応募')
    .replace(/Document screening/gi, '書類選考')
    .replace(/Technical \/ team interview/gi, '技術・チーム面接')
    .replace(/Result notification/gi, '結果連絡')
    .replace(/Cloud \/ product engineering/gi, 'クラウド・プロダクト開発')
    .replace(/Japan-based official opening/gi, '日本勤務地の公式募集')
    .replace(/No coding test stated on the official page/gi, '公式ページにコーディングテストの記載なし')
    .replace(/^Not stated$/i, '記載なし')
    .replace(/^Official company\/program page$/i, '企業・プログラム公式ページ')
    .replace(/^Official company careers page$/i, '企業公式採用ページ')
    .replace(/^Official careers page$/i, '公式採用ページ')
    .replace(/^English \(fluent\); Japanese not required$/i, '英語（流暢）必須・日本語不問')
    .replace(/^English business level; Japanese not required$/i, '英語ビジネスレベル必須・日本語不問')
    .replace(/^English business; Japanese conversational$/i, '英語ビジネスレベル・日本語会話レベル')
    .replace(/^Japanese business; English conversational$/i, '日本語ビジネスレベル・英語会話レベル')
    .replace(/^English business level; Japanese not required for Rakuten Pay System track$/i, '英語ビジネスレベル必須・Rakuten Pay System職種は日本語不問')
    .replace(/^English and Japanese business level$/i, '英語・日本語ビジネスレベル')
    .replace(/^English or Japanese CEFR B2$/i, '英語または日本語CEFR B2以上')
    .replace(/^Strong English required$/i, '高い英語力必須')
    .replace(/^English or Japanese CEFR B2; some teams require Japanese B2$/i, '英語または日本語CEFR B2以上（一部チームは日本語B2必須）')
    .replace(/^English CEFR B2 or higher; Japanese CEFR B2 or higher for some teams$/i, '英語CEFR B2以上・一部チームは日本語CEFR B2以上')
    .replace(/^Marketplace: Japanese and English CEFR B1; Fintech requires Japanese C1$/i, 'マーケットプレイス: 日本語・英語CEFR B1・Fintechは日本語C1必須')
    .replace(/^Japanese and English used; exact level not stated$/i, '日本語・英語使用・レベル記載なし')
    .replace(/^Japanese used; exact level not stated$/i, '日本語使用・レベル記載なし')
    .replace(/^English technical communication required$/i, '技術コミュニケーション英語必須')
    .replace(/^Advanced communication skills in both Japanese and English$/i, '日本語・英語の高度なコミュニケーション力必須')
    .replace(/^English-first; Japanese helpful$/i, '英語中心・日本語があると尚可')
    .replace(/^English required; Japanese helpful$/i, '英語必須・日本語があると尚可')
    .replace(/^English careers page; Japanese is a plus for Tokyo$/i, '英語の採用ページ・東京勤務では日本語力があると尚可')
    .replace(/^Many tracks require business Japanese$/i, '多くの職種でビジネス日本語必須')
    .replace(/^Bilingual$/i, 'バイリンガル')
    .replace(/^English-first$/i, '英語中心')
    .replace(/^Software Engineering$/i, 'ソフトウェア開発')
    .replace(/^Remote$/i, 'リモート')
    .replace(/^Hybrid$/i, 'ハイブリッド')
    .replace(/mostly remote within Japan/gi, '日本国内リモート中心')
    .replace(/remote within Japan/gi, '日本国内リモート')
    .replace(/remote possible/gi, 'リモート可')
    .replace(/remote negotiable/gi, 'リモート応相談')
    .replace(/remote allowed/gi, 'リモート可')
    .replace(/partial remote/gi, '一部リモート')
    .replace(/many full-remote projects/gi, 'フルリモート案件多数')
    .replace(/full-remote projects/gi, 'フルリモート案件')
    .replace(/mostly remote/gi, 'リモート中心')
    .replace(/Rakuten Crimson House/gi, '楽天クリムゾンハウス')
    .replace(/Rakuten Pay System/gi, '楽天ペイシステム')
    .replace(/Rakuten Pay/gi, '楽天ペイ')
    .replace(/Futako[- ]?Tamagawa/gi, '二子玉川')
    .replace(/\bNihonbashi\b/gi, '日本橋')
    .replace(/\bShibuya\b/gi, '渋谷')
    .replace(/\bOtemachi\b/gi, '大手町')
    .replace(/\bAkasaka\b/gi, '赤坂')
    .replace(/\bSetagaya\b/gi, '世田谷')
    .replace(/\bNishi[- ]?Shimbashi\b/gi, '西新橋')
    .replace(/\bNishishimbashi\b/gi, '西新橋')
    .replace(/\bShimbashi\b/gi, '新橋')
    .replace(/\bTamachi\b/gi, '田町')
    .replace(/\bEbisu\b/gi, '恵比寿')
    .replace(/\bGotanda\b/gi, '五反田')
    .replace(/\bToranomon\b/gi, '虎ノ門')
    .replace(/\bRoppongi\b/gi, '六本木')
    .replace(/\bBunkyo\b/gi, '文京区')
    .replace(/\bShinagawa\b/gi, '品川')
    .replace(/\bShinjuku\b/gi, '新宿')
    .replace(/\bChiyoda\b/gi, '千代田区')
    .replace(/\bChuo\b/gi, '中央区')
    .replace(/\bYokohama\b/gi, '横浜')
    .replace(/\bOsaka\b/gi, '大阪')
    .replace(/\bKyoto\b/gi, '京都')
    .replace(/\bFukuoka\b/gi, '福岡')
    .replace(/\bNagoya\b/gi, '名古屋')
    .replace(/\bKanda\b/gi, '神田')
    .replace(/\bNiigata\b/gi, '新潟')
    .replace(/\bWakayama\b/gi, '和歌山')
    .replace(/\bMie\b/gi, '三重')
    .replace(/\bOslo\b/gi, 'オスロ')
    .replace(/\bNorway\b/gi, 'ノルウェー')
    .replace(/\bMinato-ku\b/gi, '港区')
    .replace(/\bMinato\b/gi, '港区')
    .replace(/\bTokyo\b/gi, '東京')
    .replace(/\bJapan\b/gi, '日本')
    .replace(/\bOn-site\b/gi, '出社')
    .replace(/\bFull Time\b/gi, 'フルタイム')
    .replace(/\bPart Time\b/gi, 'パートタイム')
    .replace(/^5 weeks$/i, '5週間')
    .replace(/^4-6 weeks$/i, '4〜6週間')
    .replace(/^2-3 months encouraged; 20\+ hours\/week$/i, '2〜3か月推奨・週20時間以上')
    .replace(/^6 months required; 1 year preferred, starting August 2026$/i, '6か月必須・1年推奨、2026年8月開始')
    .replace(/^6 months required; 1 year preferred, starting Fall\/Winter 2026$/i, '6か月必須・1年推奨、2026年秋冬開始')
    .replace(/^6 months to 1 year$/i, '6か月〜1年')
    .replace(/^1-4 months \(20\+ business days\), July-October 2026$/i, '1〜4か月（20営業日以上）、2026年7〜10月')
    .replace(/^1 month, extendable; 15\+ hours\/week$/i, '1か月、延長可・週15時間以上')
    .replace(/^Flexible; examples from 2 weeks to 6\+ months$/i, '柔軟（2週間〜6か月以上の例あり）')
    .replace(/^Long-term; 80-120 hours\/month$/i, '長期・月80〜120時間')
    .replace(/^Long-term; 20\+ hours\/week$/i, '長期・週20時間以上')
    .replace(/^4\+ hours\/day, 3\+ days\/week, 20\+ hours\/week$/i, '1日4時間以上・週3日以上・週20時間以上')
    .replace(/^Weekday shifts 10:00-19:00$/i, '平日10:00〜19:00のシフト')
    .replace(/^Intern hours coordinated around 9:30-18:30$/i, '9:30〜18:30を目安に勤務時間を調整')
    .replace(/^Long-term; 15\+ hours\/week$/i, '長期・週15時間以上')
    .replace(/^3\+ days\/week, 3\+ months$/i, '週3日以上・3か月以上')
    .replace(/^Project-dependent; up to 5 days\/week, 8 hours\/day$/i, 'プロジェクトにより変動・最大週5日/1日8時間')
    .replace(/^3\+ months; 2\+ days\/week, 12\+ hours\/week$/i, '3か月以上・週2日以上・週12時間以上')
    .replace(/^Early August-late September 2026; negotiable$/i, '2026年8月上旬〜9月下旬・相談可')
    .replace(/^Flexible; 2-12 months; part-time or full-time$/i, '柔軟・2〜12か月・パートタイムまたはフルタイム')
    .replace(/^6 months to 1 year, starting July 2026$/i, '6か月〜1年、2026年7月開始')
    .replace(/(\d+)\s*-\s*(\d+)\s*months?/gi, '$1〜$2か月')
    .replace(/(\d+)\s*months?/gi, '$1か月')
    .replace(/(\d+)\s*years?/gi, '$1年')
    .replace(/\brequired\b/gi, '必須')
    .replace(/\bpreferred\b/gi, '推奨')
    .replace(/\brecommended\b/gi, '推奨')
    .replace(/\bstarting\b/gi, '開始')
    .replace(/\bFall\/Winter\b/gi, '秋冬')
    .replace(/\bSummer\b/gi, '夏')
    .replace(/\bSpring\b/gi, '春')
    .replace(/\bweekly hours\b/gi, '週あたり時間')
    .replace(/\bhours\/week\b/gi, '時間/週')
    .replace(/^Unpaid; monthly subsidy, airfare and other support provided$/i, '無給・月額補助、航空券などの支援あり')
    .replace(/^Paid$/i, '有給')
    .replace(/^Paid; amount based on skills and experience$/i, '有給・スキルと経験により決定')
    .replace(/^Hourly pay listed; exact amount not stated$/i, '時給あり・金額記載なし')
    .replace(/^Negotiable by skill$/i, 'スキルにより応相談')
    .replace(/^Negotiable$/i, '応相談')
    .replace(/^Hourly pay based on skill; exact amount not stated$/i, 'スキルに応じた時給・金額記載なし')
    .replace(/^Trial JPY ([\d,]+)\/hour; then JPY ([\d,]+)-([\d,]+)\/hour$/i, '試用時給$1円、その後時給$2〜$3円')
    .replace(/^JPY ([\d,]+)-([\d,]+)\/hour$/i, '時給$1〜$2円')
    .replace(/^JPY ([\d,]+)\/hour or higher$/i, '時給$1円以上')
    .replace(/^Generally JPY ([\d,]+)\/hour$/i, '通常 時給$1円')
    .replace(/^JPY ([\d,]+)\/hour$/i, '時給$1円')
    .replace(/^JPY ([\d,]+)\/hour; commuting expenses covered$/i, '時給$1円・通勤交通費支給')
    .replace(/^Competitive pay$/i, '高水準の報酬')
    .replace(/^Official Workable posting$/i, 'Workable公式掲載')
    .replace(/^Official Workday posting$/i, 'Workday公式掲載')
    .replace(/^Official Lever\/ATS posting$/i, 'Lever/ATS公式掲載')
    .replace(/^Official Greenhouse\/ATS posting$/i, 'Greenhouse/ATS公式掲載')
    .replace(/^Official Ashby\/ATS posting$/i, 'Ashby/ATS公式掲載')
    .replace(/^Official HRMOS posting$/i, 'HRMOS公式掲載')
    .replace(/^Official HERP posting$/i, 'HERP公式掲載')
    .replace(/^Official Wantedly posting$/i, 'Wantedly公式掲載')
    .replace(/^Official Greenhouse posting$/i, 'Greenhouse公式掲載')
    .replace(/^Official Lever posting$/i, 'Lever公式掲載')
    .replace(/^Official company careers page \(student internships\)$/i, '企業公式採用ページ（学生インターン）')
    .replace(/US Salary Range/gi, '米国給与範囲')
    .replace(/salary range/gi, '給与範囲')
    .replace(/Compensation & Flexibility/gi, '報酬・柔軟性')
    .replace(/Compensation range/gi, '報酬範囲')
    .replace(/Additional Information Compensation/gi, '追加情報・報酬')
    .replace(/Hourly Rate/gi, '時給')
    .replace(/hourly rate/gi, '時給')
    .replace(/weekly pay range/gi, '週給範囲')
    .replace(/fully remote \(within the U\.S\.\)/gi, '米国内フルリモート')
    .replace(/^Frontend application training in TypeScript and React or Vue, followed by a DevOps project\.$/i, 'TypeScriptとReactまたはVueによるフロントエンド研修の後、DevOpsプロジェクトに取り組みます。')
    .replace(/^Exact React 19 and TypeScript fit$/i, 'React・TypeScript経験と高い親和性')
    .replace(/^Strong mobile-first UI portfolio$/i, 'モバイルファーストUIの実装実績を示せる')
    .replace(/^AWS and full-stack breadth$/i, 'AWSとフルスタック開発の幅を活かせる')
    .replace(/^English-first Tokyo program$/i, '東京開催の英語中心プログラム')
    .replace(/^Third-year undergraduate or higher; React or Vue with TypeScript; Unix-like environment knowledge; At least three listed cloud\/full-stack\/testing\/UI skills$/i, '学部3年生以上、ReactまたはVueとTypeScript、Unix系環境の知識、クラウド・フルスタック・テスト・UI系スキルのうち3つ以上が目安')
    // Residual "Month YYYY" / "Month-Month YYYY" / "Month to Month YYYY" dates left
    // in English on newer global roles (e.g. "July-December 2026", "July 2026").
    // Placed AFTER the anchored ^…$ duration rules above so a full-string match is
    // never pre-empted; the 4-digit-year guard keeps prose words like "May" intact.
    .replace(new RegExp(`\\b(${MONTH_NAMES})\\s+to\\s+(${MONTH_NAMES})\\s+(\\d{4})`, 'gi'), (_, a, b, y) => `${y}年${MONTH_NUM[a.toLowerCase()]}〜${MONTH_NUM[b.toLowerCase()]}月`)
    .replace(new RegExp(`\\b(${MONTH_NAMES})\\s*[-–]\\s*(${MONTH_NAMES})\\s+(\\d{4})`, 'gi'), (_, a, b, y) => `${y}年${MONTH_NUM[a.toLowerCase()]}〜${MONTH_NUM[b.toLowerCase()]}月`)
    .replace(new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{4})`, 'gi'), (_, a, y) => `${y}年${MONTH_NUM[a.toLowerCase()]}月`)
    // Bare language names that are not part of an anchored phrase above (e.g. a
    // language value of just "English" on most global roles). Case-sensitive so
    // only the capitalized proper-noun form is touched.
    .replace(/\bEnglish\b/g, '英語')
    .replace(/\bJapanese\b/g, '日本語');
}

export function displayValue(value, isJa = false) {
  if (!isJa) return value;
  return jaDisplay(value);
}

export function displayRole(role, isJa = false) {
  if (!isJa || !role) return role;
  return jaDisplay(role)
    .replace(/Intern Software Engineer/gi, 'ソフトウェアエンジニアインターン')
    .replace(/Student Engineer Long-Term Internship/gi, '長期学生エンジニアインターン')
    .replace(/Student Engineer Long-Term Intern/gi, '長期学生エンジニアインターン')
    .replace(/Applications Engineer/gi, 'アプリケーションエンジニア')
    .replace(/AI & Data Division/gi, 'AI・データ部門')
    .replace(/Cloud Management/gi, 'クラウド管理')
    .replace(/Class of 2028 Software Engineer Internship/gi, '2028年卒 ソフトウェアエンジニアインターン')
    .replace(/Class of 2028 Security Engineer Internship/gi, '2028年卒 セキュリティエンジニアインターン')
    .replace(/Class of 2028 UI\/UX Designer Internship/gi, '2028年卒 UI/UXデザイナーインターン')
    .replace(/Ground Systems \/ Testing Infrastructure Intern/gi, '地上システム・テスト基盤インターン')
    .replace(/Mission Operations Intern \(Full Time\)/gi, 'ミッション運用インターン（フルタイム）')
    .replace(/Graphics Engineer Intern, Tegra System Software/gi, 'グラフィックスエンジニアインターン、Tegraシステムソフトウェア')
    .replace(/Business Internship/gi, 'ビジネスインターン')
    .replace(/AI Manga Translation/gi, 'AIマンガ翻訳')
    .replace(/Front-End Pathway/gi, 'フロントエンドコース')
    .replace(/Front End Pathway/gi, 'フロントエンドコース')
    .replace(/Frontend Pathway/gi, 'フロントエンドコース')
    .replace(/Full-Stack Pathway/gi, 'フルスタックコース')
    .replace(/Full Stack Pathway/gi, 'フルスタックコース')
    .replace(/Global Internship Program/gi, 'グローバルインターンシッププログラム')
    .replace(/METI Internship Program/gi, 'METIインターンシッププログラム')
    .replace(/RISC V Course/gi, 'RISC-Vコース')
    .replace(/Software Engineer Internship/gi, 'ソフトウェアエンジニアインターン')
    .replace(/Software Engineering Internship/gi, 'ソフトウェアエンジニアリングインターン')
    .replace(/Frontend Engineer Internship/gi, 'フロントエンドエンジニアインターン')
    .replace(/Backend Engineer Internship/gi, 'バックエンドエンジニアインターン')
    .replace(/Student Engineer Internship/gi, '学生エンジニアインターン')
    .replace(/Application Engineer Internship/gi, 'アプリケーションエンジニアインターン')
    .replace(/Engineer Internship/gi, 'エンジニアインターン')
    .replace(/Software Developer Intern(?:ship)?/gi, 'ソフトウェア開発インターン')
    .replace(/Frontend Developer Intern(?:ship)?/gi, 'フロントエンド開発インターン')
    .replace(/Full-Stack Developer Intern(?:ship)?/gi, 'フルスタック開発インターン')
    .replace(/Data Engineer Intern(?:ship)?/gi, 'データエンジニアインターン')
    .replace(/Data Analyst Intern(?:ship)?/gi, 'データアナリストインターン')
    .replace(/Data Science Intern(?:ship)?/gi, 'データサイエンスインターン')
    .replace(/Machine Learning Engineer Intern(?:ship)?/gi, '機械学習エンジニアインターン')
    .replace(/Security Engineer Intern(?:ship)?/gi, 'セキュリティエンジニアインターン')
    .replace(/Technical Support Engineer Intern(?:ship)?/gi, 'テクニカルサポートエンジニアインターン')
    .replace(/Product Manager Intern(?:ship)?/gi, 'プロダクトマネージャーインターン')
    .replace(/UI\/UX Designer Internship/gi, 'UI/UXデザイナーインターン')
    .replace(/\bInternship\b/gi, 'インターン')
    .replace(/\bIntern\b/gi, 'インターン')
    .replace(/\bCo-op\b/gi, 'コープ')
    .replace(/Summer 2026/gi, '2026年夏')
    // Role-type nouns and team/division names left in English by the word-level
    // pass above. Appended last (longest phrases first) so they catch any residue
    // without disturbing the specific role patterns handled earlier.
    .replace(/TECH Camp/gi, 'TECHキャンプ')
    .replace(/Autonomous Driving Engineering Tracks?/gi, '自動運転エンジニアリング職種')
    .replace(/Autonomous Driving/gi, '自動運転')
    .replace(/(\d{4})\s+夏/g, '$1年夏')
    .replace(/Threat Detection and Incident Response/gi, '脅威検知・インシデント対応')
    .replace(/Integration & Enterprise Architecture/gi, '統合・エンタープライズアーキテクチャ')
    .replace(/Enterprise Systems Software Engineer/gi, 'エンタープライズシステムソフトウェアエンジニア')
    .replace(/Hardware Systems Integration/gi, 'ハードウェアシステム統合')
    .replace(/Production Data Analytics/gi, '生産データ分析')
    .replace(/Technical Support Engineering/gi, 'テクニカルサポートエンジニアリング')
    .replace(/Technical Advisor Specialist/gi, 'テクニカルアドバイザー')
    .replace(/Full[- ]Stack Software Engineer/gi, 'フルスタックソフトウェアエンジニア')
    .replace(/Frontend Software Engineering/gi, 'フロントエンドソフトウェアエンジニアリング')
    .replace(/Backend Software Engineering/gi, 'バックエンドソフトウェアエンジニアリング')
    .replace(/Middleware Software Engineer/gi, 'ミドルウェアソフトウェアエンジニア')
    .replace(/Systems Research Engineer/gi, 'システムリサーチエンジニア')
    .replace(/System Infrastructure Engineer/gi, 'システムインフラエンジニア')
    .replace(/Software QA Engineer/gi, 'ソフトウェアQAエンジニア')
    .replace(/Machine Learning Engineer/gi, '機械学習エンジニア')
    .replace(/Embedded C\/C\+\+ Software Developer/gi, '組込みC/C++ソフトウェア開発者')
    .replace(/Avionics Software/gi, 'アビオニクスソフトウェア')
    .replace(/Data Engineer \/ Data Scientist/gi, 'データエンジニア / データサイエンティスト')
    .replace(/Database Analyst/gi, 'データベースアナリスト')
    .replace(/Data Analytics/gi, 'データ分析')
    .replace(/Data Analyst/gi, 'データアナリスト')
    .replace(/AI Data Scientist/gi, 'AIデータサイエンティスト')
    .replace(/Data Scientist/gi, 'データサイエンティスト')
    .replace(/Data Science/gi, 'データサイエンス')
    .replace(/Data Engineering/gi, 'データエンジニアリング')
    .replace(/Data Engineer/gi, 'データエンジニア')
    .replace(/Machine Learning/gi, '機械学習')
    .replace(/Product\/Project Producer/gi, 'プロダクト/プロジェクトプロデューサー')
    .replace(/Product Manager/gi, 'プロダクトマネージャー')
    .replace(/Solutions Engineer/gi, 'ソリューションエンジニア')
    .replace(/AI Engineer/gi, 'AIエンジニア')
    .replace(/Mission Operations/gi, 'ミッション運用')
    .replace(/Network Strategy/gi, 'ネットワーク戦略')
    .replace(/Software Engineering/gi, 'ソフトウェアエンジニアリング')
    .replace(/Software Engineer/gi, 'ソフトウェアエンジニア')
    .replace(/Software Development/gi, 'ソフトウェア開発')
    .replace(/Software Developer/gi, 'ソフトウェア開発者')
    .replace(/Software Designer/gi, 'ソフトウェアデザイナー')
    .replace(/Web Developer/gi, 'ウェブ開発者')
    .replace(/\bDeveloper\b/gi, '開発者')
    .replace(/\bCoordinator\b/gi, 'コーディネーター')
    .replace(/Long[- ]?Term/gi, '長期')
    .replace(/Mobile Engineer/gi, 'モバイルエンジニア')
    .replace(/Server[- ]Side Engineer/gi, 'サーバーサイドエンジニア')
    .replace(/\bMobile\b/gi, 'モバイル')
    // Company / Rakuten division names
    .replace(/Marketing Cloud Platform/gi, 'マーケティングクラウド基盤')
    .replace(/Corporate IT Service/gi, 'コーポレートITサービス')
    .replace(/Corporate IT/gi, 'コーポレートIT')
    .replace(/Cloud Services/gi, 'クラウドサービス')
    .replace(/Infrastructure Services/gi, 'インフラサービス')
    .replace(/Membership Platform/gi, 'メンバーシップ基盤')
    .replace(/Commerce & Marketing/gi, 'コマース・マーケティング')
    .replace(/Rakuten Travel/gi, '楽天トラベル')
    .replace(/Global Ad Division/gi, 'グローバル広告部門')
    // Season / mode qualifiers left over from the word-level pass
    .replace(/夏 & Fall 2026/gi, '2026年夏・秋')
    .replace(/夏 2026/gi, '2026年夏')
    .replace(/Fall 2026/gi, '2026年秋')
    .replace(/Spring 2026/gi, '2026年春')
    .replace(/\bFall\b/gi, '秋')
    .replace(/Full[- ]Stack/gi, 'フルスタック')
    .replace(/Front[- ]End/gi, 'フロントエンド')
    .replace(/Back[- ]End/gi, 'バックエンド')
    .replace(/\bFrontend\b/gi, 'フロントエンド')
    .replace(/\bBackend\b/gi, 'バックエンド')
    .replace(/Part[- ]Time/gi, 'パートタイム')
    .replace(/Full[- ]Time/gi, 'フルタイム')
    // Residual role / section terms left in English on newer (mostly global)
    // entries. displayRole-only, so these never touch about/eligibility/meta text
    // (which flows through jaDisplay). Multi-word phrases run first so the
    // single-word fallbacks below cannot pre-empt them. Tech / proper nouns kept in
    // Latin on purpose (Go, Kotlin, Unity, Android, GPU, MRO, Tegra, DataOps, etc.).
    .replace(/Information and Communication Technology/gi, '情報通信技術')
    .replace(/Mapping Autonomous Vehicles/gi, 'マッピング・自動運転車両')
    .replace(/Big Data Analysis/gi, 'ビッグデータ分析')
    .replace(/Test Automation/gi, 'テスト自動化')
    .replace(/Core Algorithms/gi, 'コアアルゴリズム')
    .replace(/GPU Programming/gi, 'GPUプログラミング')
    .replace(/Connected Systems/gi, 'コネクテッドシステム')
    .replace(/Vehicle Controls/gi, '車両制御')
    .replace(/Client Secrets Management/gi, 'クライアントシークレット管理')
    .replace(/Service Development/gi, 'サービス開発')
    .replace(/Trust Platforms/gi, 'トラストプラットフォーム')
    .replace(/Software Performance at Scale/gi, '大規模ソフトウェアパフォーマンス')
    .replace(/Business Operations/gi, '事業運営')
    .replace(/Systems Engineering/gi, 'システムエンジニアリング')
    .replace(/Android Connectivity/gi, 'Android接続')
    .replace(/Power Control Center/gi, '電力制御センター')
    .replace(/Automatic Camera Enforcement/gi, '自動カメラ取締り')
    .replace(/Emerging Talent/gi, '新卒・若手人材')
    .replace(/Claim Operations Management/gi, '保険金請求オペレーション管理')
    .replace(/Operational Technology/gi, '運用技術')
    .replace(/Digital Ship Analytics/gi, 'デジタル船舶アナリティクス')
    .replace(/Digital Ship/gi, 'デジタル船舶')
    .replace(/Facilities MRO Information Systems/gi, '施設MRO情報システム')
    .replace(/Risk\s*&\s*Fraud/gi, 'リスク・不正対策')
    .replace(/Global Macro and Strategy team/gi, 'グローバルマクロ・戦略チーム')
    .replace(/Defense Software/gi, '防衛ソフトウェア')
    .replace(/Software\/AI Development/gi, 'ソフトウェア・AI開発')
    .replace(/Technology Solutions/gi, 'テクノロジーソリューション')
    .replace(/Commercial Banking/gi, 'コマーシャルバンキング')
    .replace(/Digital Verification/gi, 'デジタル検証')
    .replace(/Clinical Data/gi, '臨床データ')
    .replace(/AI Builder/gi, 'AIビルダー')
    .replace(/\bin Test\b/gi, '（テスト）')
    // Single-word role / section fallbacks.
    .replace(/\bApplications?\b/gi, 'アプリケーション')
    .replace(/\bPlatforms?\b/gi, 'プラットフォーム')
    .replace(/\bDevelopment\b/gi, '開発')
    .replace(/\bNetwork\b/gi, 'ネットワーク')
    .replace(/\bConnectivity\b/gi, '接続')
    .replace(/\bConnected\b/gi, 'コネクテッド')
    .replace(/\bVehicles?\b/gi, '車両')
    .replace(/\bControls?\b/gi, '制御')
    .replace(/\bSecrets\b/gi, 'シークレット')
    .replace(/\bClient\b/gi, 'クライアント')
    .replace(/\bFramework\b/gi, 'フレームワーク')
    .replace(/\bProgramming\b/gi, 'プログラミング')
    .replace(/\bAlgorithms?\b/gi, 'アルゴリズム')
    .replace(/\bPerformance\b/gi, 'パフォーマンス')
    .replace(/\bVerification\b/gi, '検証')
    .replace(/\bFocused\b/gi, '重視')
    .replace(/\bEmbedded\b/gi, '組込み')
    .replace(/\bDigital\b/gi, 'デジタル')
    .replace(/\bClinical\b/gi, '臨床')
    .replace(/\bDefense\b/gi, '防衛')
    .replace(/\bOperational\b/gi, '運用')
    .replace(/\bOperations\b/gi, 'オペレーション')
    .replace(/\bManagement\b/gi, '管理')
    .replace(/\bSpecialist\b/gi, 'スペシャリスト')
    .replace(/\bAnalytics\b/gi, 'アナリティクス')
    .replace(/\bAnalyst\b/gi, 'アナリスト')
    .replace(/\bProducer\b/gi, 'プロデューサー')
    .replace(/\bSolutions?\b/gi, 'ソリューション')
    .replace(/\bTechnology\b/gi, 'テクノロジー')
    .replace(/\bInformation\b/gi, '情報')
    .replace(/\bBusiness\b/gi, 'ビジネス')
    .replace(/\bProduct\b/gi, 'プロダクト')
    .replace(/\bService\b/gi, 'サービス')
    .replace(/\bSales\b/gi, 'セールス')
    .replace(/\bBuilder\b/gi, 'ビルダー')
    .replace(/\bApprentice\b/gi, 'アプレンティス')
    .replace(/\bSystems?\b/gi, 'システム')
    .replace(/\bEngineering\b/gi, 'エンジニアリング')
    .replace(/\bEngineer\b/gi, 'エンジニア')
    .replace(/\bData\b/gi, 'データ')
    .replace(/\bSoftware\b/gi, 'ソフトウェア')
    .replace(/\bWeb\b/gi, 'ウェブ');
}

export function formatDisplayDeadline(value, isJa = false) {
  return String(displayValue(value, isJa) || '').replace(/\s+JST\b/gi, '').trim();
}

function genericAboutJa(item) {
  const field = TRACK_LABELS_JA[item.track] || '専門分野';
  return `${field}の実務を通じて、企業のプロダクトや業務に関わるインターンです。具体的な担当内容は公式募集ページで確認してください。`;
}

function translateEligibilityJa(value) {
  const text = String(value || '').trim();
  if (!text || /^Not stated$/i.test(text)) return '応募条件の詳細は公式募集ページで確認してください';
  const translated = text
    .replace(/Class of 2028/gi, '2028年卒予定')
    .replace(/work must be performed from Japan/gi, '日本国内から勤務できること')
    .replace(/New graduate internship/gi, '新卒向けインターン')
    .replace(/detailed eligibility not stated/gi, '詳細な応募条件は記載なし')
    .replace(/Eligibility not stated on official posting/gi, '応募条件の詳細は公式募集ページで確認してください')
    .replace(/Undergraduate or graduate students accepted/gi, '学部生・大学院生が応募可能')
    .replace(/University or graduate student/gi, '大学生または大学院生')
    .replace(/prior engineer internship experience preferred/gi, 'エンジニアインターン経験があると尚可')
    .replace(/Programming, backend\/frontend, and Git experience listed/gi, 'プログラミング、バックエンドまたはフロントエンド、Gitの経験')
    .replace(/React\/Next\.js experience or Flutter experience; Git/gi, 'React・Next.jsまたはFlutterとGitの経験')
    .replace(/CS or related student\/graduate student; Go\/Python\/TypeScript and Git listed/gi, '情報系または関連分野の学生・大学院生、Go・Python・TypeScriptとGitの経験')
    .replace(/Student intern/gi, '学生インターン')
    .replace(/Relevant bachelor or master degree/gi, '関連分野の学士号または修士号')
    .replace(/Tokyo applicants may need a visa and sponsorship is not guaranteed/gi, '東京勤務ではビザが必要な場合があり、スポンサー提供は保証されません')
    .replace(/International students need permission for activity outside residence status/gi, '留学生は資格外活動許可が必要')
    .replace(/Third-year undergraduate or higher/gi, '学部3年生以上が目安')
    .replace(/CS or related degree/gi, '情報系または関連分野を専攻')
    .replace(/Japan resident with work authorization/gi, '日本在住で就労資格があること')
    .replace(/Re-check eligibility on the official page/gi, '応募条件は公式募集ページで再確認してください')
    .replace(/Join Rakuten full-time in 2028/gi, '2028年に楽天へ新卒入社予定')
    .replace(/Data structures, algorithms and CS fundamentals/gi, 'データ構造・アルゴリズム・CSの基礎')
    .replace(/Product development and operations experience/gi, 'プロダクト開発・運用の経験')
    .replace(/Advanced communication skills in both Japanese and English/gi, '日本語・英語両方の高度なコミュニケーション能力')
    .replace(/advanced Japanese and English communication/gi, '日本語・英語の高度なコミュニケーション能力')
    .replace(/Communicate with Japanese and overseas stakeholders/gi, '日本語と海外の関係者とのコミュニケーション')
    .replace(/English technical communication/gi, '技術コミュニケーションレベルの英語')
    .replace(/technical communication/gi, '技術コミュニケーション')
    .replace(/Strong English( required)?/gi, '高い英語力必須')
    .replace(/export[- ]control eligibility/gi, '輸出管理規制上の適格性')
    .replace(/Portfolio( required)?/gi, 'ポートフォリオ必須')
    .replace(/20\+\s*hours?\s*(?:per week|\/week|a week)/gi, '週20時間以上')
    .replace(/RDBMS and SQL basics/gi, 'RDBMSとSQLの基礎')
    .replace(/Python, Java or TypeScript/gi, 'Python・Java・TypeScript')
    .replace(/English/gi, '英語')
    .replace(/Japanese/gi, '日本語')
    .replace(/required/gi, '必須')
    .replace(/preferred/gi, '歓迎');
  // A run of 3+ consecutive English words means the clause was only partially
  // translated; render the clean generic pointer instead of a half-English bullet.
  const stillEnglishProse = /[A-Za-z]{3,}(?:[\s/&.,()-]+[A-Za-z]{2,}){2,}/.test(translated);
  return (translated === text && /[A-Za-z]{4,}/.test(translated)) || stillEnglishProse
    ? '応募条件の詳細は公式募集ページで確認してください'
    : translated;
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

// De-duplicate a rendered bullet list case-insensitively, preserving the first
// occurrence and order. This prevents repeated eligibility bullets — e.g. several
// distinct English clauses that all translate to the same generic JA fallback
// ("応募条件の詳細は公式募集ページで確認してください") would otherwise render as
// identical repeated lines in Japanese mode.
function dedupeList(list) {
  if (!Array.isArray(list)) return list;
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const key = String(entry ?? '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
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
    techStack: dedupeList(stack),
    eligibility: dedupeList(eligibility),
    eligibilityJa: dedupeList(eligibilityJa),
    process: dedupeList(process),
    processJa: dedupeList(processJa),
  };
}
