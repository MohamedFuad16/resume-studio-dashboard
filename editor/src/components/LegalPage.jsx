// LegalPage — the public Terms of Service and Privacy Policy pages.
//
// Reachable at #terms and #privacy without signing in (wired in main.jsx above
// AuthGate), since the login page links to them. Shares the LoginScreen design
// language: warm-gray page, white card, Instrument Serif headline, small muted
// Inter body copy, pill controls. Bilingual (EN/JA).
//
// IMPORTANT — the copy below is a drafted starting point written to match what
// this app actually does (Firebase Auth + Firestore storage, Vercel hosting,
// résumé content sent to OpenRouter when AI features are used, no analytics). It
// has NOT been reviewed by a lawyer. Fill in the placeholders directly below and
// have it reviewed before relying on it. See ADR-0029.
import { useState } from 'react';
import { I } from './ui.jsx';
import { keyed } from '../utils/keyedList.js';

// TODO(legal): replace these placeholders before this page goes public.
const OPERATOR = 'Internship Portal';
const CONTACT_EMAIL = 'support@example.com';
const JURISDICTION = { en: 'Japan', ja: '日本' };
const LAST_UPDATED = { en: '15 July 2026', ja: '2026年7月15日' };

const UI = {
  en: { back: 'Back to sign in', updated: `Last updated ${LAST_UPDATED.en}` },
  ja: { back: 'サインインに戻る', updated: `最終更新日 ${LAST_UPDATED.ja}` },
};

const TERMS = {
  en: {
    title: 'Terms of Service',
    intro: `These terms are an agreement between you and ${OPERATOR} (“we”, “us”). They cover your use of the ${OPERATOR} website and app (the “Service”). By creating an account or using the Service, you accept these terms. If you do not accept them, please do not use the Service.`,
    sections: [
      ['Your account', [
        'You need an account to use most of the Service. You can create one with an email address and password, or by signing in with Google.',
        'Please give accurate information and keep your password secure. You are responsible for what happens under your account. Tell us promptly if you think someone else has access to it.',
        'Accounts are for one person. Do not share your account or let anyone else use it.',
      ]],
      ['Your content', [
        'You keep ownership of everything you put into the Service — your résumé and profile details, the internships you track, your notes, deadlines, and application history. It is yours, not ours.',
        'You give us permission to store, process, and display that content for the single purpose of operating the Service for you. That includes compiling your résumé into a PDF, and — only when you use an AI feature — sending the relevant content to our AI provider so it can generate a response.',
        'We do not sell your content, and we do not share it with other users.',
        'You are responsible for the content you add, including making sure you have the right to use it and that it is accurate.',
      ]],
      ['AI features', [
        'The Service includes AI features: an assistant that helps edit your résumé, and internship research that searches the web for openings at a company you name.',
        'AI output can be wrong, incomplete, or out of date. Treat it as a draft and check it before you rely on it. In particular, always confirm an internship’s details — deadlines, eligibility, whether it is still open — on the employer’s own official site before applying.',
        'The AI features are not career, legal, immigration, visa, or employment advice.',
      ]],
      ['The internship catalog', [
        'The Service lists internships gathered from public and official sources. We try to keep listings accurate and to retire dead ones, but we do not control the employers and cannot promise a listing is current, complete, or correct.',
        'We are not an employer, a recruiter, or an agent. We are not part of any application you make, and we do not promise any outcome — including that you will receive an interview or an offer.',
      ]],
      ['Acceptable use', [
        'Please do not: break the law; upload someone else’s personal information without their permission; scrape, bulk-download, or resell the catalog; try to break, overload, or gain unauthorized access to the Service; reverse engineer it; or use it to harass anyone.',
        'We may suspend or remove accounts that do these things.',
      ]],
      ['Third-party services', [
        'The Service depends on third parties — Google (sign-in and data storage), our hosting provider, and our AI provider. Your use of the Service also involves their handling of your data, as described in our Privacy Policy.',
        'The Service links out to employer sites and job listings we do not control. We are not responsible for their content or their practices.',
      ]],
      ['Availability and changes', [
        'The Service is provided “as is”, without warranties of any kind, to the extent the law allows. We do not promise it will be uninterrupted, error-free, or that data will never be lost — please keep your own copies of anything important, such as an exported PDF of your résumé.',
        'We may add, change, or remove features, and we may suspend or discontinue the Service.',
      ]],
      ['Limitation of liability', [
        'To the fullest extent the law allows, we are not liable for indirect, incidental, or consequential damages, or for lost data, lost opportunities, or a missed application or deadline arising from your use of the Service.',
        'Nothing here limits liability that cannot be limited by law.',
      ]],
      ['Ending your use', [
        'You can stop using the Service and delete your account at any time. We may suspend or end your access if you breach these terms or if we stop offering the Service.',
      ]],
      ['Changes to these terms', [
        'We may update these terms. When we do, we will change the “last updated” date above. If a change is significant, we will try to give you notice in the app. Continuing to use the Service after a change means you accept the updated terms.',
      ]],
      ['Governing law', [
        `These terms are governed by the laws of ${JURISDICTION.en}.`,
      ]],
      ['Contact', [
        `Questions about these terms: ${CONTACT_EMAIL}.`,
      ]],
    ],
  },
  ja: {
    title: '利用規約',
    intro: `本規約は、お客様と${OPERATOR}（以下「当方」）との間の契約であり、${OPERATOR}のウェブサイトおよびアプリ（以下「本サービス」）のご利用に適用されます。アカウントを作成し、または本サービスを利用された場合、本規約に同意したものとみなされます。同意いただけない場合は、本サービスをご利用にならないでください。`,
    sections: [
      ['アカウント', [
        '本サービスのほとんどの機能のご利用にはアカウントが必要です。メールアドレスとパスワード、またはGoogleアカウントで作成できます。',
        '正確な情報をご登録いただき、パスワードは厳重に管理してください。アカウントで行われた行為についてはお客様が責任を負います。第三者に利用されている可能性がある場合は速やかにご連絡ください。',
        'アカウントはお一人につき1つです。共有や第三者への利用許諾はご遠慮ください。',
      ]],
      ['お客様のコンテンツ', [
        'レジュメ・プロフィール情報、管理中のインターン情報、メモ、締切、応募履歴など、本サービスに入力された内容の権利はすべてお客様に帰属します。',
        '当方は、本サービスをお客様に提供する目的に限り、当該コンテンツを保存・処理・表示します。これにはレジュメのPDF生成、および（AI機能をご利用の場合に限り）応答生成のために関連コンテンツをAI提供事業者へ送信することが含まれます。',
        'お客様のコンテンツを販売することはなく、他の利用者と共有することもありません。',
        '入力内容については、利用する権利を有していること、および内容が正確であることを含め、お客様が責任を負います。',
      ]],
      ['AI機能', [
        '本サービスには、レジュメ編集を支援するAIアシスタント、および指定された企業の募集情報をウェブ検索するインターンリサーチ機能が含まれます。',
        'AIの出力は誤り・不完全・古い情報を含む場合があります。下書きとして扱い、依拠する前に必ずご確認ください。特にインターンの締切・応募資格・募集状況などの詳細は、応募前に必ず採用企業の公式サイトでご確認ください。',
        'AI機能は、キャリア・法務・出入国・ビザ・雇用に関する助言ではありません。',
      ]],
      ['インターン情報カタログ', [
        '本サービスは、公開情報および公式情報源から収集したインターン情報を掲載しています。正確性の維持と募集終了分の削除に努めていますが、当方は採用企業を管理する立場になく、掲載情報が最新・完全・正確であることを保証できません。',
        '当方は雇用主・人材紹介事業者・代理人ではありません。お客様の応募の当事者ではなく、面接や内定を含むいかなる結果も保証しません。',
      ]],
      ['禁止事項', [
        '法令違反、第三者の個人情報の無断アップロード、カタログのスクレイピング・一括ダウンロード・転売、本サービスの妨害・過負荷・不正アクセス、リバースエンジニアリング、嫌がらせ目的の利用はご遠慮ください。',
        'これらの行為が確認された場合、アカウントを停止または削除することがあります。',
      ]],
      ['第三者サービス', [
        '本サービスはGoogle（サインインおよびデータ保存）、ホスティング事業者、AI提供事業者などの第三者サービスを利用しています。本サービスのご利用には、プライバシーポリシーに記載のとおり、これらの事業者によるデータの取扱いが伴います。',
        '本サービスには、当方が管理しない採用企業のサイトや募集ページへのリンクが含まれます。それらの内容や取扱いについて当方は責任を負いません。',
      ]],
      ['提供および変更', [
        '本サービスは、法令が許す範囲において、現状有姿で提供され、いかなる保証も行いません。中断やエラーがないこと、データが失われないことを保証するものではありません。レジュメのPDFなど重要なものはお客様ご自身でも控えを保管してください。',
        '当方は、機能の追加・変更・削除、本サービスの停止または終了を行うことがあります。',
      ]],
      ['責任の制限', [
        '法令が許す最大限の範囲において、当方は、間接損害・付随的損害・結果的損害、データの喪失、機会の逸失、本サービスの利用に起因する応募や締切の失念について責任を負いません。',
        '法令上制限できない責任を制限するものではありません。',
      ]],
      ['利用の終了', [
        'お客様はいつでも本サービスの利用を停止し、アカウントを削除できます。本規約に違反した場合、または当方が本サービスの提供を終了する場合、利用を停止・終了することがあります。',
      ]],
      ['本規約の変更', [
        '本規約を変更する場合があります。変更時は上部の最終更新日を更新します。重要な変更の場合はアプリ内での通知に努めます。変更後も利用を継続された場合、変更後の規約に同意したものとみなされます。',
      ]],
      ['準拠法', [
        `本規約は${JURISDICTION.ja}法に準拠します。`,
      ]],
      ['お問い合わせ', [
        `本規約に関するお問い合わせ：${CONTACT_EMAIL}`,
      ]],
    ],
  },
};

const PRIVACY = {
  en: {
    title: 'Privacy Policy',
    intro: `This policy explains what ${OPERATOR} collects, why, and what you can do about it. We have tried to write it plainly rather than defensively.`,
    sections: [
      ['What we collect', [
        '**Account details.** Your email address, and a display name if you give one. If you sign in with Google, we receive your name, email address, and profile picture from Google.',
        '**What you create in the app.** Your résumé and profile content, the internships you save or track, application status, deadlines, interviews, and notes.',
        '**Settings.** If you choose to save your own OpenRouter API key to use the AI features, we store it with your account data.',
        '**On your device.** We store your language and theme preferences in your browser’s local storage. That is all — we do not currently run analytics, advertising, or third-party tracking.',
      ]],
      ['Why we use it', [
        'To give you an account and keep it secure; to store and show your résumé, tracker, and applications; to compile your résumé into a PDF; to power the AI assistant and internship research when you use them; and to fix problems with the Service.',
      ]],
      ['Who processes your data', [
        '**Google (Firebase).** Handles sign-in and stores your account and app data (Firestore). Access rules are set so that only your signed-in account can read or write your data.',
        '**Our hosting provider (Vercel).** Runs the site and its server functions, and stores generated files.',
        '**OpenRouter (AI features only).** When you use the AI assistant, the relevant content — which can include your résumé — is sent to OpenRouter to generate a response. When you use internship research, the company name you enter is used to search the web. If you do not use these features, nothing is sent. OpenRouter routes requests to upstream model providers under its own terms and privacy policy; please read those if this matters to you.',
      ]],
      ['What we do not do', [
        'We do not sell your personal information or your résumé. We do not share it with other users, and we do not share it with employers — applying to an internship is something you do yourself, on the employer’s own site.',
        'We may disclose data if the law genuinely requires it.',
      ]],
      ['Keeping and deleting your data', [
        'We keep your data while your account exists. You can edit or delete your content in the app at any time.',
        `If you want your account and its data deleted, contact us at ${CONTACT_EMAIL} and we will remove it. Note that deleting your account removes your résumé and tracker data — export any PDF you want to keep first.`,
        'Backups and logs may persist for a short period after deletion before they age out.',
      ]],
      ['Your rights', [
        'You can ask us for a copy of your data, ask us to correct it, or ask us to delete it. Depending on where you live, you may have additional rights under local data protection law.',
        `To make a request, email ${CONTACT_EMAIL}.`,
      ]],
      ['Security', [
        'Your data is stored with owner-only access rules, so another signed-in user cannot read it. Connections use HTTPS.',
        'No service can promise perfect security. Please use a strong, unique password, and do not put information in your résumé that you would not want stored online.',
      ]],
      ['Children', [
        'The Service is not intended for children under 16, and we do not knowingly collect their data.',
      ]],
      ['Changes to this policy', [
        'If we change this policy we will update the “last updated” date above, and give notice in the app if the change is significant.',
      ]],
      ['Contact', [
        `Questions, requests, or concerns about privacy: ${CONTACT_EMAIL}.`,
      ]],
    ],
  },
  ja: {
    title: 'プライバシーポリシー',
    intro: `本ポリシーは、${OPERATOR}が取得する情報、その理由、およびお客様が取りうる対応について説明するものです。できるだけ平易な記載を心がけています。`,
    sections: [
      ['取得する情報', [
        '**アカウント情報。** メールアドレス、および任意でご登録の表示名。Googleでサインインされた場合、Googleから氏名・メールアドレス・プロフィール画像を受け取ります。',
        '**アプリ内で作成された情報。** レジュメおよびプロフィールの内容、保存・管理中のインターン情報、応募状況、締切、面接、メモ。',
        '**設定。** AI機能のためにお客様ご自身のOpenRouter APIキーを保存された場合、アカウントデータとあわせて保存します。',
        '**お客様の端末上。** 言語およびテーマの設定をブラウザのローカルストレージに保存します。保存するのはこれのみで、現在アクセス解析・広告・第三者トラッキングは使用していません。',
      ]],
      ['利用目的', [
        'アカウントの提供と安全な維持、レジュメ・トラッカー・応募情報の保存および表示、レジュメのPDF生成、ご利用時のAIアシスタントおよびインターンリサーチの提供、ならびに不具合の修正のために利用します。',
      ]],
      ['データを取り扱う事業者', [
        '**Google（Firebase）。** サインインの処理、ならびにアカウントおよびアプリデータの保存（Firestore）。アクセスルールにより、サインイン中のご本人のアカウントのみが読み書きできます。',
        '**ホスティング事業者（Vercel）。** サイトおよびサーバー機能の稼働、生成ファイルの保存。',
        '**OpenRouter（AI機能利用時のみ）。** AIアシスタントのご利用時、レジュメを含みうる関連コンテンツが応答生成のためOpenRouterへ送信されます。インターンリサーチのご利用時は、入力された企業名がウェブ検索に使用されます。これらの機能を利用されない場合、送信は行われません。OpenRouterは自社の規約およびプライバシーポリシーに基づき上流のモデル提供事業者へリクエストを中継します。ご懸念がある場合はそれらもご確認ください。',
      ]],
      ['行わないこと', [
        'お客様の個人情報およびレジュメを販売することはありません。他の利用者と共有することはなく、採用企業へ提供することもありません。インターンへの応募は、採用企業の公式サイト上でお客様ご自身が行うものです。',
        '法令上真に必要とされる場合には、データを開示することがあります。',
      ]],
      ['保存と削除', [
        'アカウントが存続する間、データを保存します。アプリ内でいつでもコンテンツの編集・削除が可能です。',
        `アカウントおよびデータの削除をご希望の場合は${CONTACT_EMAIL}までご連絡ください。アカウントを削除するとレジュメおよびトラッカーのデータは失われますので、必要なPDFは事前にエクスポートしてください。`,
        '削除後、バックアップやログに短期間データが残存する場合があります。',
      ]],
      ['お客様の権利', [
        'データの写しのご請求、訂正のご依頼、削除のご依頼が可能です。お住まいの地域によっては、現地のデータ保護法に基づく追加の権利が認められる場合があります。',
        `ご請求は${CONTACT_EMAIL}までメールでご連絡ください。`,
      ]],
      ['セキュリティ', [
        'データは所有者のみアクセス可能なルールのもとで保存され、他のサインイン利用者が読み取ることはできません。通信にはHTTPSを使用しています。',
        '完全な安全性を保証できるサービスは存在しません。強固で使い回しのないパスワードをご使用いただき、オンライン保存を望まれない情報はレジュメに含めないでください。',
      ]],
      ['お子様について', [
        '本サービスは16歳未満の方を対象としておらず、その情報を意図的に取得することはありません。',
      ]],
      ['本ポリシーの変更', [
        '本ポリシーを変更する場合、上部の最終更新日を更新し、重要な変更の場合はアプリ内で通知します。',
      ]],
      ['お問い合わせ', [
        `プライバシーに関するご質問・ご請求・ご懸念：${CONTACT_EMAIL}`,
      ]],
    ],
  },
};

const DOCS = { terms: TERMS, privacy: PRIVACY };

// Renders **bold** spans in a paragraph — used for the lead-in on list-like items.
function renderBold(text) {
  return keyed(text.split(/(\*\*[^*]+\*\*)/g)).map(entry =>
    entry.value.startsWith('**') && entry.value.endsWith('**')
      ? <strong key={entry.key}>{entry.value.slice(2, -2)}</strong>
      : entry.value
  );
}

export default function LegalPage({ doc }) {
  const [lang, setLang] = useState(() => localStorage.getItem('resume-studio-language') || 'en');

  const pickLang = next => {
    setLang(next);
    localStorage.setItem('resume-studio-language', next);
  };

  const content = DOCS[doc][lang];
  const ui = UI[lang];

  return (
    <div className="legal-page" lang={lang}>
      <div className="legal-shell">
        <header className="legal-top">
          <a className="legal-back" href="#">
            <I n="chev" s={14} />
            {ui.back}
          </a>
          <div className="auth-langseg legal-langseg" role="group" aria-label="Language">
            <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => pickLang('en')}>
              EN
            </button>
            <button type="button" className={lang === 'ja' ? 'active' : ''} onClick={() => pickLang('ja')}>
              日本語
            </button>
          </div>
        </header>

        <article className="legal-doc">
          <h1 className="legal-title">{content.title}</h1>
          <p className="legal-updated">{ui.updated}</p>
          <p className="legal-intro">{content.intro}</p>

          {content.sections.map(([heading, paras]) => (
            <section key={heading} className="legal-section">
              <h2 className="legal-h2">{heading}</h2>
              {keyed(paras).map(entry => (
                <p key={entry.key} className="legal-p">{renderBold(entry.value)}</p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
