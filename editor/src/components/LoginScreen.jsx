// LoginScreen — the auth gate shown when no user is signed in.
//
// Design language (per user reference): a split card floating on warm light gray —
// a white form pane on the left (serif display headline, small muted sans copy,
// fully-rounded pill controls, black primary button, generous whitespace) beside an
// ambient sunset art pane holding a floating product mock. Bilingual (EN/JA).
// Supports Google sign-in and email/password sign-in + open sign-up.
import { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { I } from './ui.jsx';

const COPY = {
  en: {
    signInTitle: 'Welcome back',
    signUpTitle: 'Welcome to Internship Portal',
    signInSub: 'Sign in to track internships, research companies, and build bilingual résumés.',
    signUpSub: 'Track internships, research companies, and build bilingual résumés — all in one workspace.',
    google: 'Continue with Google',
    or: 'or',
    namePh: 'Enter your name',
    emailPh: 'Enter email address',
    passwordPh: 'Enter password',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    signIn: 'Continue',
    signUp: 'Continue',
    working: 'Please wait…',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    switchToSignUp: 'Sign up',
    switchToSignIn: 'Sign in',
    legal: ['By continuing, you agree to the ', 'Terms of Service', ' and ', 'Privacy Policy', '.'],
  },
  ja: {
    signInTitle: 'おかえりなさい',
    signUpTitle: 'インターンポータルへようこそ',
    signInSub: 'サインインして、インターンの管理・企業リサーチ・日英レジュメ作成を続けましょう。',
    signUpSub: 'インターンの管理、企業リサーチ、日英レジュメ作成を、ひとつのワークスペースで。',
    google: 'Google で続行',
    or: 'または',
    namePh: 'お名前を入力',
    emailPh: 'メールアドレスを入力',
    passwordPh: 'パスワードを入力',
    name: '名前',
    email: 'メール',
    password: 'パスワード',
    signIn: '続行',
    signUp: '続行',
    working: 'お待ちください…',
    noAccount: 'アカウントをお持ちでないですか？',
    haveAccount: 'すでにアカウントをお持ちですか？',
    switchToSignUp: '登録',
    switchToSignIn: 'サインイン',
    legal: ['続行すると、', '利用規約', 'および', 'プライバシーポリシー', 'に同意したものとみなされます。'],
  },
};

// Decorative sidebar for the art-pane mock. Rows mirror the app's real surfaces
// (nav tabs + tracker/calendar/assistant) so the preview isn't inventing screens.
const MOCK_NAV = {
  en: {
    search: 'New application',
    tabs: ['All', 'Saved', 'Applied'],
    paneTitle: 'Dashboard',
    paneMeta: '24 tracked · 3 interviews',
    rows: [
      ['panel', 'Dashboard'],
      ['radar', 'Internship Radar'],
      ['work', 'Applications'],
      ['edu', 'Calendar'],
      ['file', 'Editor'],
      ['ai', 'AI assistant'],
      ['user', 'Profile'],
    ],
  },
  ja: {
    search: '新規応募',
    tabs: ['すべて', '保存済み', '応募済み'],
    paneTitle: 'ダッシュボード',
    paneMeta: '24件 · 面接3件',
    rows: [
      ['panel', 'ダッシュボード'],
      ['radar', 'インターン検索'],
      ['work', '応募管理'],
      ['edu', 'カレンダー'],
      ['file', 'エディタ'],
      ['ai', 'AIアシスタント'],
      ['user', 'プロフィール'],
    ],
  },
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
  const mock = MOCK_NAV[lang];
  const isSignUp = mode === 'signup';
  // The reference keeps the primary button inert until there's something to submit.
  const ready = email.trim() !== '' && password !== '' && (!isSignUp || name.trim() !== '');

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
      <div className="auth-shell">
        <section className="auth-pane">
          <span className="auth-brandmark" aria-hidden="true"><I n="radar" s={22} /></span>

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

          <div className="auth-stack">
            <h1 className="auth-headline">{isSignUp ? t.signUpTitle : t.signInTitle}</h1>
            <p className="auth-lede">{isSignUp ? t.signUpSub : t.signInSub}</p>

            <button type="button" className="auth-google" onClick={google} disabled={busy}>
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              {t.google}
            </button>

            <div className="auth-divider"><span>{t.or}</span></div>

            <form onSubmit={submit}>
              {isSignUp && (
                <label className="auth-field">
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder={t.namePh} aria-label={t.name} autoComplete="name"
                  />
                </label>
              )}
              <label className="auth-field">
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t.emailPh} aria-label={t.email} autoComplete="email"
                />
              </label>
              <label className="auth-field">
                <input
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={t.passwordPh} aria-label={t.password}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={6}
                />
              </label>

              {error && <div className="auth-error" role="alert">{error}</div>}

              <button type="submit" className="auth-submit" disabled={busy || !ready}>
                {busy ? t.working : (isSignUp ? t.signUp : t.signIn)}
              </button>
            </form>

            <p className="auth-switch">
              {isSignUp ? t.haveAccount : t.noAccount}{' '}
              <button
                type="button" className="auth-link"
                onClick={() => { setError(''); setMode(isSignUp ? 'signin' : 'signup'); }}
              >
                {isSignUp ? t.switchToSignIn : t.switchToSignUp}
              </button>
            </p>

            <p className="auth-legal">
              {t.legal[0]}
              <a href="#terms">{t.legal[1]}</a>
              {t.legal[2]}
              <a href="#privacy">{t.legal[3]}</a>
              {t.legal[4]}
            </p>
          </div>
        </section>

        <aside className="auth-art" aria-hidden="true">
          <div className="auth-mock">
            {/* No icon rail: it repeated the same icon that each row already
                carries. One icon per destination, in the row itself. */}
            <div className="auth-mock-main">
              <div className="auth-mock-search">{mock.search}</div>
              <div className="auth-mock-tabs">
                {mock.tabs.map((tab, i) => (
                  <span key={tab} className={i === 0 ? 'on' : ''}>{tab}</span>
                ))}
              </div>
              {mock.rows.map(([icon, label], i) => (
                <div key={label} className={`auth-mock-row${i === 0 ? ' active' : ''}`}>
                  <I n={icon} s={14} />
                  <span className="auth-mock-label">{label}</span>
                </div>
              ))}
            </div>
            {/* Main pane — bleeds off the right edge, per reference */}
            <div className="auth-mock-pane">
              <div className="auth-mock-pane-title">{mock.paneTitle}</div>
              <div className="auth-mock-pane-meta">{mock.paneMeta}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
