// LoginScreen — the auth gate shown when no user is signed in.
//
// Design language (per user reference): a soft mint→blue ambient gradient behind a
// centered white "app window" (macOS lights + Home-style brand pill + segmented
// language toggle), clean muted-gray typography, light-fill rounded feature rows,
// and the app's brand-blue primary button. Bilingual (EN/JA). Supports Google
// sign-in and email/password sign-in + open sign-up.
import { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { I } from './ui.jsx';

const COPY = {
  en: {
    brand: 'Internship Portal',
    headline: 'Land your next internship.',
    lede: 'Track internships, research companies, and build bilingual résumés — without the spreadsheet chaos.',
    signInTitle: 'Welcome back',
    signUpTitle: 'Create your account',
    signInSub: 'Sign in to continue.',
    signUpSub: 'Sign up to get started — it’s free.',
    google: 'Continue with Google',
    or: 'or',
    name: 'Name',
    namePh: 'Your name',
    email: 'Email',
    emailPh: 'you@example.com',
    password: 'Password',
    passwordPh: '••••••••',
    signIn: 'Sign in',
    signUp: 'Sign up',
    working: 'Please wait…',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    switchToSignUp: 'Sign up',
    switchToSignIn: 'Sign in',
  },
  ja: {
    brand: 'インターンポータル',
    headline: 'インターン探しを、ひとつに。',
    lede: 'インターンの管理、企業リサーチ、日英レジュメ作成を、スプレッドシートの混乱なしで。',
    signInTitle: 'おかえりなさい',
    signUpTitle: 'アカウントを作成',
    signInSub: 'サインインして続行してください。',
    signUpSub: '無料で始めましょう。',
    google: 'Google で続行',
    or: 'または',
    name: '名前',
    namePh: 'お名前',
    email: 'メール',
    emailPh: 'you@example.com',
    password: 'パスワード',
    passwordPh: '••••••••',
    signIn: 'サインイン',
    signUp: '登録',
    working: 'お待ちください…',
    noAccount: 'アカウントをお持ちでないですか？',
    haveAccount: 'すでにアカウントをお持ちですか？',
    switchToSignUp: '登録',
    switchToSignIn: 'サインイン',
  },
};

const FEATURES = {
  en: [
    ['panel', 'Dashboard & tracker', 'Every application, deadline, and interview in one view.'],
    ['radar', 'Internship Radar', 'Live company research matched to your profile.'],
    ['file', 'Bilingual résumés', 'EN/JA résumés compiled to polished PDFs.'],
  ],
  ja: [
    ['panel', 'ダッシュボード＆管理', '応募・締切・面接をひとつの画面で。'],
    ['radar', 'インターンレーダー', 'プロフィールに合わせた企業リサーチ。'],
    ['file', '日英レジュメ', '日英のレジュメを美しいPDFに。'],
  ],
};

export default function LoginScreen() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [lang, setLang] = useState(() => localStorage.getItem('resume-studio-language') || 'en');
  const [mode, setMode] = useState('signin'); // signin | signup
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const t = COPY[lang];
  const isSignUp = mode === 'signup';

  const pickLang = next => {
    setLang(next);
    localStorage.setItem('resume-studio-language', next);
  };

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (isSignUp) await signUpEmail(email, password, name);
      else await signInEmail(email, password);
      // On success, onAuthStateChanged swaps this screen out for the app.
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const google = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await signInGoogle();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-page" lang={lang}>
      <div className="auth-window">
        <div className="auth-winbar">
          <div className="window-lights" aria-hidden="true">
            <span className="light red" />
            <span className="light amber" />
            <span className="light green" />
          </div>
          <span className="auth-winpill">
            <I n="user" s={13} />
            {t.brand}
          </span>
          <div className="auth-langseg" role="group" aria-label="Language">
            <button
              type="button"
              className={lang === 'en' ? 'active' : ''}
              onClick={() => pickLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={lang === 'ja' ? 'active' : ''}
              onClick={() => pickLang('ja')}
            >
              日本語
            </button>
          </div>
        </div>

        <div className="auth-body">
          <div className="auth-intro">
            <h1 className="auth-headline">{t.headline}</h1>
            <p className="auth-lede">{t.lede}</p>
            <ul className="auth-features">
              {FEATURES[lang].map(([icon, title, body]) => (
                <li key={title} className="auth-feature">
                  <span className="auth-feature-icon" aria-hidden="true"><I n={icon} s={17} /></span>
                  <div className="auth-feature-text">
                    <div className="auth-feature-title">{title}</div>
                    <div className="auth-feature-body">{body}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="auth-formcol">
            <form className="auth-form" onSubmit={submit}>
              <h2 className="auth-title">{isSignUp ? t.signUpTitle : t.signInTitle}</h2>
              <p className="auth-sub">{isSignUp ? t.signUpSub : t.signInSub}</p>

              <button type="button" className="auth-google" onClick={google} disabled={busy}>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                </svg>
                {t.google}
              </button>

              <div className="auth-divider"><span>{t.or}</span></div>

              {isSignUp && (
                <label className="auth-field">
                  <span>{t.name}</span>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder={t.namePh} autoComplete="name"
                  />
                </label>
              )}
              <label className="auth-field">
                <span>{t.email}</span>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t.emailPh} autoComplete="email"
                />
              </label>
              <label className="auth-field">
                <span>{t.password}</span>
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={t.passwordPh} autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={6}
                />
              </label>

              {error && <div className="auth-error" role="alert">{error}</div>}

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? t.working : (isSignUp ? t.signUp : t.signIn)}
              </button>

              <p className="auth-switch">
                {isSignUp ? t.haveAccount : t.noAccount}{' '}
                <button
                  type="button" className="auth-link"
                  onClick={() => { setError(''); setMode(isSignUp ? 'signin' : 'signup'); }}
                >
                  {isSignUp ? t.switchToSignIn : t.switchToSignUp}
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
