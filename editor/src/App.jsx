import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './index.css';
import { profileApi } from './api/client.js';
import { debounce, newItemId } from './utils/helpers.js';
import { mergeParsedResume } from './utils/resumePdf.js';
import { I, Toasts } from './components/ui.jsx';
import ResumeUpload from './components/ResumeUpload.jsx';
import { InternshipDashboard } from './components/InternshipDashboard.jsx';
import { ProfileDashboard } from './components/ProfileDashboard.jsx';
import { ProfileSwitcher } from './components/ProfileSwitcher.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import { ApplicationCalendar } from './components/ApplicationCalendar.jsx';
import ApplicationsView from './components/ApplicationsView.jsx';
import ProfileView from './components/ProfileView.jsx';
import { useApplicationTracker } from './hooks/useApplicationTracker.js';
import { useGmailInbox } from './hooks/useGmailInbox.js';
import { filterRecordsByPeriod, useActivityPeriod } from './hooks/useActivityPeriod.js';
import {
  LayoutDashboard, Telescope, CalendarDays, Settings2, PanelLeftClose,
  BriefcaseBusiness, UserRound,
} from 'lucide-react';
import { authAvailable, auth } from './auth/firebase.js';
import { signOutUser, deleteAccount } from './auth/useAuth.js';

let _tid = 0;

// URL ↔ active-profile helpers (pure window access — no component state).
const getUrlProfile = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('profile') || 'mohamed_fuad';
};
const syncUrlWithProfile = (id) => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('profile') !== id) {
    params.set('profile', id);
    window.history.pushState(null, '', `?${params.toString()}`);
  }
};


// Sidebar navigation. `id` must match the values `appView` accepts, since these
// buttons drive it directly. Settings is included here because it is a real view
// that was previously only reachable through the profile menu. Icons come from
// lucide-react (already used by the dashboard/radar/calendar) rather than the
// hand-drawn `I` set, so the nav matches the rest of the app's iconography.
const NAV_ITEMS = [
  { id: 'dashboard',    Icon: LayoutDashboard,   en: 'Dashboard',        ja: 'ダッシュボード' },
  { id: 'radar',        Icon: Telescope,         en: 'Internship Radar', ja: 'インターン検索' },
  { id: 'applications', Icon: BriefcaseBusiness, en: 'Applications',     ja: '応募一覧' },
  { id: 'calendar',     Icon: CalendarDays,      en: 'Calendar',         ja: 'カレンダー' },
  { id: 'profile',      Icon: UserRound,         en: 'Profile',          ja: 'プロフィール' },
  { id: 'settings',     Icon: Settings2,         en: 'Settings',         ja: '設定' },
];

// A résumé is "blank" (fresh account) when it has no name and no section content.
function isResumeBlank(r) {
  if (!r) return true;
  const p = r.personal || {};
  const hasName = Boolean((p.nameEn || '').trim() || (p.nameJa || '').trim());
  const hasSections = ['education', 'experience', 'projects', 'activities']
    .some(k => Array.isArray(r[k]) && r[k].length > 0);
  const hasSummary = Boolean((r.summary || r.summaryEn || r.summaryJa || '').trim());
  return !hasName && !hasSections && !hasSummary;
}


function normalizeResume(data) {
  if (!data) return null;
  const r = { ...data };

  let p = r.personal || {};
  let pi = r.personalInfo || {};
  
  const nameEn = p.nameEn || pi.fullName || '';
  const nameJa = p.nameJa || pi.fullNameJa || pi.fullName || '';
  const furigana = p.furigana || pi.furigana || '';
  const dob = p.dob || pi.dob || '';
  const address = p.address || pi.address || '';
  const postalCode = p.postalCode || pi.postalCode || '';
  const phone = p.phone || pi.phone || '';
  const email = p.email || pi.email || '';
  const linkedin = p.linkedin || pi.linkedin || '';
  const github = p.github || pi.github || '';
  const photoDataUrl = p.photoDataUrl || pi.photoDataUrl || '';

  r.personal = {
    nameEn,
    nameJa,
    furigana,
    dob,
    address,
    postalCode,
    phone,
    email,
    linkedin,
    github,
    photoDataUrl
  };

  r.personalInfo = {
    fullName: nameEn,
    fullNameJa: nameJa,
    furigana,
    dob,
    address,
    postalCode,
    phone,
    email,
    linkedin,
    github,
    photoDataUrl
  };

  if (Array.isArray(r.education)) {
    r.education = r.education.map(e => {
      const inst = e.institution || e.school || '';
      const instJa = e.institutionJa || e.schoolJa || e.school || e.institution || '';
      const deg = e.degree || '';
      // Keep degree (EN) and degreeJa independent. Backfilling degreeJa from degree
      // let a stale degreeJa mask an updated degree (the "Bachelor of Engineering ->
      // Bachelor of Science" bug). Empty stays empty.
      const degJa = e.degreeJa || '';
      const loc = e.location || '';
      const start = e.startDate || '';
      const end = e.endDate || '';
      const bullets = e.bullets || [];

      return {
        ...e,
        institution: inst,
        institutionJa: instJa,
        school: inst,
        schoolJa: instJa,
        degree: deg,
        degreeJa: degJa,
        location: loc,
        startDate: start,
        endDate: end,
        bullets: bullets
      };
    });
  } else {
    r.education = [];
  }

  if (Array.isArray(r.experience)) {
    r.experience = r.experience.map(e => {
      const comp = e.company || '';
      const compJa = e.companyJa || e.company || '';
      const role = e.role || '';
      const roleJa = e.roleJa || e.role || '';
      const loc = e.location || '';
      const start = e.startDate || '';
      const end = e.endDate || '';
      const bullets = e.bullets || (e.description ? [e.description] : []);
      const desc = e.description || (e.bullets ? e.bullets.join(' ') : '');

      return {
        ...e,
        company: comp,
        companyJa: compJa,
        role: role,
        roleJa: roleJa,
        location: loc,
        startDate: start,
        endDate: end,
        bullets: bullets,
        description: desc
      };
    });
  } else {
    r.experience = [];
  }

  if (Array.isArray(r.projects)) {
    r.projects = r.projects.map(p => {
      const title = p.title || p.name || '';
      const tech = p.tech || p.role || '';
      const yr = p.year || p.startDate || '';
      const bullets = p.bullets || (p.description ? [p.description] : []);
      const desc = p.description || (p.bullets ? p.bullets.join(' ') : '');
      const link = p.link || '';

      return {
        ...p,
        title: title,
        name: title,
        tech: tech,
        role: tech,
        year: yr,
        bullets: bullets,
        description: desc,
        link: link
      };
    });
  } else {
    r.projects = [];
  }

  if (!r.skills) {
    r.skills = { languages: '', frameworks: '', tools: '', concepts: '', spoken: '' };
  }

  if (!Array.isArray(r.activities)) {
    r.activities = [];
  }

  // Every section item carries a stable id (list keys must track the ITEM, not
  // its slot — reorder/delete otherwise leaves focus and textarea state behind).
  // Backfills legacy data; the id persists with the résumé and is ignored by
  // the LaTeX templates.
  for (const section of ['education', 'experience', 'projects', 'activities']) {
    r[section] = r[section].map(item => (item && !item.id ? { ...item, id: newItemId() } : item));
  }

  return r;
}

export default function App() {
   const [resume,    setResume]    = useState(null);
  const [lang,      setLang]      = useState(() => localStorage.getItem('resume-studio-language') || 'en');
  const [, setSave]      = useState('saved'); // saved | saving | error
  const [toasts,    setToasts]    = useState([]);
  const [theme]                   = useState(() => localStorage.getItem('theme') || 'light');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const [appView, setAppView] = useState('dashboard');

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('resume-studio-language', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // ── Toasts ───────────────────────────────────────────────
  const toast = useCallback((msg, type = 'info') => {
    const id = ++_tid;
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  const dismiss = id => setToasts(p => p.filter(t => t.id !== id));



  // ── Profile management states & helpers ──────────────────
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(getUrlProfile);
  // Same source and the same activity period as the dashboard's "N roles
  // tracked", so the sidebar badge can never disagree with the page.
  const {
    records: trackedRecords, addMilestone: addTrackerMilestone, removeMilestone: removeTrackerMilestone,
  } = useApplicationTracker(activeProfile);
  const { period } = useActivityPeriod();
  const periodRecordCount = useMemo(() => filterRecordsByPeriod(trackedRecords, period).length, [trackedRecords, period]);
  // Gmail ingest: drains inbox-derived actions into the tracker/calendar (full-auto).
  const { justApplied, clearJustApplied } = useGmailInbox(activeProfile);
  // Sidebar collapse — persisted so it survives reloads.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  // First sign-in on a blank profile: offer the PDF upload once.
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);
  const isJa = lang === 'ja';
  useEffect(() => {
    if (!justApplied.length) return;
    const n = justApplied.length;
    toast(isJa ? `Gmailから${n}件の応募を追加しました` : `Added ${n} application${n === 1 ? '' : 's'} from Gmail`, 'success');
    clearJustApplied();
  }, [justApplied, clearJustApplied, isJa, toast]);

  const fetchProfiles = useCallback(async () => {
    try {
      setProfiles(await profileApi.list());
    } catch {
      toast('Could not fetch profiles', 'error');
    }
  }, [toast]);

  // ── Auto-save ────────────────────────────────────────────
  const saveData = useMemo(() => debounce(async (data, profileId) => {
    setSave('saving');
    try {
      await profileApi.save(profileId, data);
      setSave('saved');
      fetchProfiles();
    } catch {
      setSave('error');
    }
  }, 1200), [fetchProfiles]);

  const saveProfileImmediately = useCallback(async (data, profileId, { refreshFromServer = true } = {}) => {
    const normalized = normalizeResume(data);
    setSave('saving');
    await profileApi.save(profileId, normalized);

    let serverResume = normalized;
    if (refreshFromServer) {
      serverResume = normalizeResume(await profileApi.get(profileId));
    }

    setResume(serverResume);
    setSave('saved');
    fetchProfiles();
    return serverResume;
  }, [fetchProfiles]);

  const handleSwitchProfile = async (id, skipUrl = false) => {
    try {
      const data = await profileApi.get(id);
      setActiveProfile(id);
      const normalized = normalizeResume(data);
      setResume(normalized);
      if (!skipUrl) {
        syncUrlWithProfile(id);
      }
      toast(isJa ? `履歴書を切り替えました: ${id}` : `Switched to resume: ${id}`, 'success');
    } catch {
      toast(isJa ? `履歴書を読み込めませんでした: ${id}` : `Failed to switch resume: ${id}`, 'error');
    }
  };

  // Callers own the confirmation. Settings shows a typed-confirm dialog; this used
  // to fire a window.confirm() here, which meant an irreversible delete sat behind
  // a single OK on a browser alert.
  const handleDeleteProfile = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await profileApi.remove(id);
      toast(isJa ? `ユーザーを削除しました: ${id}` : `Deleted user: ${id}`, 'success');
      const remaining = await profileApi.list().catch(() => profiles.filter(p => p.id !== id));
      setProfiles(remaining);
      if (activeProfile === id && remaining[0]?.id) {
        handleSwitchProfile(remaining[0].id);
      }
    } catch (err) {
      // The server is the source of truth for delete protection: it returns HTTP 400
      // (e.g. "Cannot delete the default profile.") for protected profiles. Surface
      // that message instead of hard-blocking specific ids on the client.
      const fallback = isJa ? `ユーザーを削除できませんでした: ${id}` : `Failed to delete user: ${id}`;
      toast(err?.message || fallback, 'error');
    }
  };

  // ── Boot ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Resolve the active profile against the real list. With Firestore each
      // user has their own profiles, so the URL default ('mohamed_fuad') may not
      // exist — fall back to the first available profile.
      let list = [];
      try { list = await profileApi.list(); } catch { /* surfaced below */ }
      setProfiles(list);
      const urlProfile = getUrlProfile();
      const initProfile = list.some(p => p.id === urlProfile)
        ? urlProfile
        : (list[0]?.id || urlProfile);
      if (initProfile !== activeProfile) setActiveProfile(initProfile);
      syncUrlWithProfile(initProfile);
      try {
        const loaded = normalizeResume(await profileApi.get(initProfile));
        setResume(loaded);
        // New account: ensureSeed created a blank profile. Offer the PDF upload.
        if (authAvailable && auth?.currentUser && isResumeBlank(loaded)) {
          setShowUploadPrompt(true);
        }
      } catch {
        toast('Could not load resume data', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe once; the handler reads the CURRENT profile/switcher through a
  // ref so back/forward always acts on fresh state without re-subscribing.
  const popStateRef = useRef(() => {});
  useEffect(() => {
    popStateRef.current = () => {
      const id = getUrlProfile();
      if (id !== activeProfile) handleSwitchProfile(id, true);
    };
  });
  useEffect(() => {
    const handlePopState = () => popStateRef.current();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── Change handler ───────────────────────────────────────
  const change = useCallback((next, options = {}) => {
    const normalized = normalizeResume(next);
    setResume(normalized);
    setSave('saving');
    if (options.immediate) {
      saveData.cancel?.();
      saveProfileImmediately(normalized, activeProfile, { refreshFromServer: options.refreshFromServer !== false })
        .catch(error => {
          setSave('error');
          toast(error.message || (isJa ? '保存できませんでした' : 'Could not save resume'), 'error');
        });
      return;
    }
    saveData(normalized, activeProfile);
  }, [saveData, saveProfileImmediately, activeProfile, toast, isJa]);

  // ── Résumé PDF upload ────────────────────────────────────
  // The parsed fields merge into the stored résumé; the PDF itself is dropped.
  const handleResumeParsed = async (parsed, fileName) => {
    try {
      await saveProfileImmediately(mergeParsedResume(resume, parsed), activeProfile, { refreshFromServer: false });
      setShowUploadPrompt(false);
      toast(isJa ? `${fileName} から履歴書を読み込みました` : `Filled in your résumé from ${fileName}`, 'success');
    } catch (error) {
      setSave('error');
      toast(error.message || (isJa ? '保存できませんでした' : 'Could not save resume'), 'error');
    }
  };
  const onUploadError = message => toast(message, 'error');

  // ── Exports ──────────────────────────────────────────────
  const isResumeEmpty = () => {
    if (!resume) return true;
    const p = resume.personal || {};
    const name = p.nameEn || p.nameJa || '';
    const email = p.email || '';
    const phone = p.phone || '';
    const address = p.address || '';
    const edu = resume.education || [];
    const exp = resume.experience || [];
    const proj = resume.projects || [];
    const acts = resume.activities || [];
    return !name && !email && !phone && !address && edu.length === 0 && exp.length === 0 && proj.length === 0 && acts.length === 0;
  };

  const onJson = () => {
    if (isResumeEmpty()) { setShowEmptyWarning(true); return; }
    const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'resume.json';
    a.click();
    window.URL.revokeObjectURL(blobUrl);
  };

  // ── Loading ──────────────────────────────────────────────
  if (!resume) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }


  return (
    <div className="shell">
      {isOffline && (
        <div data-testid="offline-banner" className="offline-banner" style={{ background: 'var(--err)', color: 'white', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', zIndex: 1000 }}>
          {isJa ? '現在オフラインです。再接続後に変更を保存します。' : 'You are currently offline. Changes will be saved once you reconnect.'}
        </div>
      )}

      <div className="app-body">
        {/* ── Sidebar: brand + primary navigation ─────────────── */}
        <aside className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="side-brand">
            {/* The brand is the way home — clicking a product's logo is the one
                navigation people assume exists. It was inert. */}
            <button
              type="button"
              className="side-brand-home"
              onClick={() => setAppView('dashboard')}
              title={isJa ? 'ダッシュボードへ' : 'Go to dashboard'}
            >
              <span className="side-logo" aria-hidden="true"><Telescope size={15} /></span>
              <span className="side-brandname">{isJa ? 'インターンポータル' : 'Internship Portal'}</span>
            </button>
            <button
              type="button"
              className="side-collapse"
              aria-expanded={!sidebarCollapsed}
              aria-label={
                sidebarCollapsed
                  ? (isJa ? 'サイドバーを開く' : 'Expand sidebar')
                  : (isJa ? 'サイドバーを閉じる' : 'Collapse sidebar')
              }
              onClick={() => {
                const next = !sidebarCollapsed;
                setSidebarCollapsed(next);
                localStorage.setItem('sidebar-collapsed', String(next));
              }}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <div className="side-label">{isJa ? 'ビュー' : 'Views'}</div>
          <nav className="side-nav" aria-label={isJa ? 'メインナビゲーション' : 'Primary navigation'}>
            {NAV_ITEMS.map(({ id, Icon, en, ja }) => {
              // Badges show a real count only; no count → no badge (never a zero).
              const badge = id === 'dashboard' ? periodRecordCount : 0;
              const active = appView === id;
              const label = isJa ? ja : en;
              return (
                <button
                  key={id}
                  type="button"
                  className={`side-nav-btn ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  // Collapsed rows show only an icon, so the name has to come
                  // from somewhere for both screen readers and hover.
                  title={sidebarCollapsed ? label : undefined}
                  aria-label={sidebarCollapsed ? label : undefined}
                  onClick={() => setAppView(id)}
                >
                  <Icon size={16} />
                  <span className="side-nav-label">{label}</span>
                  {badge > 0 && <span className="side-badge">{badge}</span>}
                </button>
              );
            })}
          </nav>

          {/* Footer: language + profile live in the sidebar, not the header. */}
          <div className="side-foot">
        <div className="app-lang-switcher" aria-label={isJa ? '表示言語' : 'Application language'}>
          <button
            type="button"
            data-testid="language-toggle-en"
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => setLang('en')}
          >
            EN
          </button>
          <button
            type="button"
            data-testid="language-toggle-ja"
            className={`lang-btn ${lang === 'ja' ? 'active' : ''}`}
            onClick={() => setLang('ja')}
          >
            JA
          </button>
          <span data-testid="current-language-indicator" style={{ display: 'none' }}>
            {lang.toUpperCase()}
          </span>
        </div>

        {/* User/profile menu — switch / add / settings / delete / sign out */}
        <ProfileSwitcher
          profiles={profiles}
          activeId={activeProfile}
          isJa={isJa}
          onSwitch={handleSwitchProfile}
          onSignOut={authAvailable && auth?.currentUser ? () => {
            // Clear the ?profile= query so the login screen sits on the clean root URL.
            window.history.replaceState(null, '', window.location.pathname);
            signOutUser().catch(() => {});
          } : undefined}
          userEmail={auth?.currentUser?.email || ''}
        />
          </div>
        </aside>

        <div className="app-main">
          {/* No title bar: the sidebar already names the current view. */}

      {appView === 'dashboard' ? (
        <ProfileDashboard
          resume={resume}
          activeProfile={activeProfile}
          isJa={isJa}
          onOpenRadar={() => setAppView('radar')}
          onOpenProfile={() => setAppView('profile')}
          onResumeChange={change}
        />
      ) : appView === 'radar' ? (
        <InternshipDashboard isJa={isJa} activeProfile={activeProfile} resume={resume} onOpenProfile={() => setAppView('profile')} onOpenSettings={() => setAppView('settings')} />
      ) : appView === 'applications' ? (
        <ApplicationsView isJa={isJa} activeProfile={activeProfile} onOpenRadar={() => setAppView('radar')} onOpenProfile={() => setAppView('profile')} />
      ) : appView === 'profile' ? (
        <ProfileView
          resume={resume}
          isJa={isJa}
          onResumeParsed={handleResumeParsed}
          onUploadError={onUploadError}
          onSavePersonal={async personal => { await saveProfileImmediately({ ...resume, personal }, activeProfile, { refreshFromServer: false }); }}
        />
      ) : appView === 'calendar' ? (
        // Application timeline — its own view now, rather than a block appended
        // to the bottom of the dashboard.
        <main className="calendar-view">
          <ApplicationCalendar
            records={trackedRecords}
            addMilestone={addTrackerMilestone}
            removeMilestone={removeTrackerMilestone}
            isJa={isJa}
          />
        </main>
      ) : appView === 'settings' ? (
        <SettingsPanel
          isJa={isJa}
          activeProfile={activeProfile}
          canDelete={profiles.length > 1}
          onExportJson={onJson}
          onDeleteProfile={id => { handleDeleteProfile(id); setAppView('dashboard'); }}
          // Only offered when there is a real signed-in account. On the no-auth
          // path there is nothing to delete, so Settings hides the whole section.
          onDeleteAccount={authAvailable && auth?.currentUser ? deleteAccount : undefined}
          needsPassword={(auth?.currentUser?.providerData || []).some(p => p.providerId === 'password')}
        />
      ) : null}
        </div>{/* /.app-main */}
      </div>{/* /.app-body */}

      {showUploadPrompt && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowUploadPrompt(false)}>
          <div className="modal-card resume-upload-prompt" role="dialog" aria-modal="true" aria-labelledby="resume-upload-title" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 id="resume-upload-title">{isJa ? '履歴書PDFを読み込む' : 'Add your résumé'}</h3>
              <button type="button" className="modal-close" aria-label={isJa ? '閉じる' : 'Close'} onClick={() => setShowUploadPrompt(false)}>
                <I n="x" s={14} />
              </button>
            </div>
            <div className="modal-bd">
              <p>{isJa
                ? '履歴書PDFをアップロードすると、氏名・連絡先・学歴・スキルが自動で入力され、インターンのマッチングに使われます。ファイル自体は保存しません。'
                : 'Upload your résumé PDF and the app fills in your name, contact details, education and skills for internship matching. The file itself is not kept.'}</p>
              <div className="settings-actions">
                <ResumeUpload isJa={isJa} onParsed={handleResumeParsed} onError={onUploadError} className="settings-save" />
                <button type="button" className="btn" onClick={() => setShowUploadPrompt(false)}>{isJa ? 'あとで' : 'Skip for now'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmptyWarning && (
        <div data-testid="empty-export-warning" className="modal-overlay" onClick={() => setShowEmptyWarning(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Empty Resume Warning</h3>
              <button type="button" className="modal-close" onClick={() => setShowEmptyWarning(false)}>
                <I n="x" s={14} />
              </button>
            </div>
            <div className="modal-bd">
              <p>Your resume data is empty. Please enter some details before exporting.</p>
              <button type="button" className="btn" onClick={() => setShowEmptyWarning(false)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <Toasts list={toasts} dismiss={dismiss} />
    </div>
  );
}
