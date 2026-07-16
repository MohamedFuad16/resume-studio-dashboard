import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import { apiUrl, applicationApi, profileApi, requestJson } from './api/client.js';
import { debounce, TEMPLATES } from './utils/helpers.js';
import { I, Toasts, ExportMenu, TagInput, SuggestInput } from './components/ui.jsx';
import { InternshipDashboard } from './components/InternshipDashboard.jsx';
import { ProfileDashboard } from './components/ProfileDashboard.jsx';
import { ProfileSwitcher } from './components/ProfileSwitcher.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import { ApplicationCalendar } from './components/ApplicationCalendar.jsx';
import ApplicationsView from './components/ApplicationsView.jsx';
import ProfileView from './components/ProfileView.jsx';
import { useApplicationTracker } from './hooks/useApplicationTracker.js';
import { useGmailInbox } from './hooks/useGmailInbox.js';
import {
  LayoutDashboard, Telescope, CalendarDays, FileText, Settings2, PanelLeftClose,
  BriefcaseBusiness, UserRound,
} from 'lucide-react';
import { authAvailable, auth } from './auth/firebase.js';
import { signOutUser, deleteAccount } from './auth/useAuth.js';
import {
  PersonalSec, SummarySec, EducationSec,
  ExperienceSec, ProjectsSec, SkillsSec, ActivitiesSec,
  LANGS, FRAMEWORKS, TOOLS, CONCEPTS, SPOKEN,
  INSTITUTIONS_EN, INSTITUTIONS_JA, DEGREES_EN, DEGREES_JA,
  COMPANIES_EN, COMPANIES_JA, ROLES_EN, ROLES_JA,
  LOCATIONS, YEARS, TECH_SUGGESTIONS,
} from './components/sections.jsx';

const EN = TEMPLATES.filter(t => t.lang === 'en');
const JA = TEMPLATES.filter(t => t.lang === 'ja');
let _tid = 0;

const chatWelcome = isJa => (
  isJa
    ? 'こんにちは。履歴書について相談したり、応募先に合わせた文章修正を依頼できます。変更する場合は、現在の履歴書を確認してから反映します。'
    : 'Hi — ask me anything about your resume, or request a direct edit for a target role. I read the current resume before applying changes.'
);

// ── PDF.js Dynamic Loader and Text Extractor ────────────────────────
const loadPdfJs = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib = window['pdfjs-dist/build/pdf'];
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
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
  { id: 'editor',       Icon: FileText,          en: 'Editor',           ja: 'エディタ' },
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

async function extractTextFromPdfFile(file) {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    text += textContent.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

function parseResumeTextHeuristically(text) {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}|\+?\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{4})/);
  const githubMatch = text.match(/(github\.com\/[a-zA-Z0-9_-]+)/i);
  const linkedinMatch = text.match(/(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i);

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let guessedName = '';
  if (lines.length > 0) {
    let lineIdx = 0;
    while (lineIdx < lines.length) {
      const line = lines[lineIdx];
      if (!line.includes('@') && !line.includes('http') && !line.includes('/') && !line.match(/\d{4}/) && line.length < 40) {
        guessedName = line;
        break;
      }
      lineIdx++;
    }
  }

  // Segment sections
  const headings = [
    { key: 'education', patterns: [/education/i, /academic/i, /study/i] },
    { key: 'experience', patterns: [/experience/i, /employment/i, /history/i, /work/i] },
    { key: 'projects', patterns: [/projects/i, /personal projects/i] },
    { key: 'skills', patterns: [/skills/i, /technologies/i, /expertise/i] },
    { key: 'activities', patterns: [/activities/i, /certifications/i, /awards/i, /honors/i] }
  ];

  const sectionIndexes = [];
  lines.forEach((line, index) => {
    if (line.split(/\s+/).length <= 4) {
      for (const h of headings) {
        if (h.patterns.some(p => p.test(line))) {
          sectionIndexes.push({ key: h.key, index, line });
          break;
        }
      }
    }
  });

  sectionIndexes.sort((a, b) => a.index - b.index);

  const sections = {
    personal: [],
    education: [],
    experience: [],
    projects: [],
    skills: [],
    activities: [],
    summary: []
  };

  let currentSection = 'personal';
  lines.forEach((line, index) => {
    const headingMatch = sectionIndexes.find(si => si.index === index);
    if (headingMatch) {
      currentSection = headingMatch.key;
    } else {
      sections[currentSection].push(line);
    }
  });

  const parseListSection = (sectionLines, isEdu) => {
    const entries = [];
    let currentEntry = null;

    sectionLines.forEach(line => {
      if (!line) return;
      const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || line.includes('\\resumeItem');
      if (isBullet) {
        const bulletVal = line.replace(/^[•\-\*\s]+/, '').replace(/^\\resumeItem\{/, '').replace(/\}$/, '').trim();
        if (currentEntry) {
          currentEntry.bullets.push(bulletVal);
        }
      } else {
        const dateMatch = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan\.|Feb\.|Mar\.|Apr\.|May\.|Jun\.|Jul\.|Aug\.|Sep\.|Oct\.|Nov\.|Dec\.|Spring|Summer|Fall|Winter)?\s*\d{4}\s*(--|-|–|to)?\s*(Present|\d{4})?/i);
        const hasDate = !!dateMatch;
        
        if (hasDate || line.includes('University') || line.includes('College') || line.includes('School') || line.includes('Inc.') || line.includes('Corp') || line.includes('Ltd')) {
          if (currentEntry) entries.push(currentEntry);
          
          const parts = line.split(/[|·•\t,]/).map(p => p.trim());
          const name = parts[0] || '';
          const dateStr = dateMatch ? dateMatch[0] : '';
          
          if (isEdu) {
            currentEntry = {
              institution: name,
              institutionJa: '',
              location: parts[1] || 'Tokyo, Japan',
              degree: parts[2] || 'Bachelor\'s Degree',
              degreeJa: '',
              startDate: dateStr.split(/[-–to]+/)[0]?.trim() || 'Apr 2024',
              endDate: dateStr.split(/[-–to]+/)[1]?.trim() || 'Present',
              bullets: []
            };
          } else {
            currentEntry = {
              company: name,
              companyJa: '',
              role: parts[2] || 'Specialist',
              roleJa: '',
              location: parts[1] || 'Tokyo, Japan',
              startDate: dateStr.split(/[-–to]+/)[0]?.trim() || 'Jun 2023',
              endDate: dateStr.split(/[-–to]+/)[1]?.trim() || 'Present',
              bullets: []
            };
          }
        } else if (currentEntry) {
          if (currentEntry.bullets.length === 0) {
            if (isEdu) currentEntry.degree = (currentEntry.degree + ' ' + line).trim();
            else currentEntry.role = (currentEntry.role + ' ' + line).trim();
          } else {
            currentEntry.bullets.push(line);
          }
        }
      }
    });

    if (currentEntry) entries.push(currentEntry);
    return entries;
  };

  const parseProjects = (sectionLines) => {
    const projs = [];
    let currentEntry = null;

    sectionLines.forEach(line => {
      if (!line) return;
      const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || line.includes('\\resumeItem');
      if (isBullet) {
        const bulletVal = line.replace(/^[•\-\*\s]+/, '').replace(/^\\resumeItem\{/, '').replace(/\}$/, '').trim();
        if (currentEntry) currentEntry.bullets.push(bulletVal);
      } else {
        const dateMatch = line.match(/\d{4}/);
        if (dateMatch || (line.length > 2 && line.length < 50 && !line.includes('@'))) {
          if (currentEntry) projs.push(currentEntry);
          const parts = line.split(/[|·•\t()]/).map(p => p.trim());
          currentEntry = {
            title: parts[0] || '',
            tech: parts[1] || '',
            year: dateMatch ? dateMatch[0] : '2025',
            bullets: []
          };
        } else if (currentEntry) {
          currentEntry.bullets.push(line);
        }
      }
    });

    if (currentEntry) projs.push(currentEntry);
    return projs;
  };

  const parsedSkills = { languages: '', frameworks: '', tools: '', concepts: '', spoken: '' };
  const langsList = [];
  const fwksList = [];
  const toolsList = [];
  const conceptsList = [];
  const spokenList = [];

  sections.skills.forEach(line => {
    if (line.includes(':')) {
      const parts = line.split(':');
      const key = parts[0].toLowerCase();
      const val = parts[1].trim();
      if (key.includes('lang') && !key.includes('spoken')) langsList.push(val);
      else if (key.includes('frame') || key.includes('lib')) fwksList.push(val);
      else if (key.includes('tool') || key.includes('db') || key.includes('util')) toolsList.push(val);
      else if (key.includes('concept') || key.includes('method')) conceptsList.push(val);
      else if (key.includes('spoken') || key.includes('speak') || key.includes('language')) spokenList.push(val);
    } else {
      const words = line.split(/[,\s|]+/).map(w => w.replace(/[:]/g, '').trim()).filter(Boolean);
      const langs = ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'rust', 'go', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'bash', 'shell'];
      const fwks = ['react', 'node', 'express', 'next', 'vue', 'angular', 'svelte', 'django', 'flask', 'spring', 'laravel', 'tailwind', 'bootstrap'];
      const tls = ['git', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'sqlite', 'mysql', 'postgresql', 'mongodb', 'redis', 'firebase', 'vite', 'webpack', 'npm', 'yarn'];
      
      words.forEach(w => {
        const wl = w.toLowerCase();
        if (langs.includes(wl)) langsList.push(w);
        else if (fwks.includes(wl)) fwksList.push(w);
        else if (tls.includes(wl)) toolsList.push(w);
        else if (wl.includes('english') || wl.includes('japanese') || wl.includes('jlpt')) spokenList.push(w);
        else if (w.length > 3) conceptsList.push(w);
      });
    }
  });

  parsedSkills.languages = Array.from(new Set(langsList)).join(', ');
  parsedSkills.frameworks = Array.from(new Set(fwksList)).join(', ');
  parsedSkills.tools = Array.from(new Set(toolsList)).join(', ');
  parsedSkills.concepts = Array.from(new Set(conceptsList)).join(', ');
  parsedSkills.spoken = Array.from(new Set(spokenList)).join(', ');

  const summaryText = sections.summary.length ? sections.summary.join(' ') : (sections.personal.slice(2).join(' ').substring(0, 300));

  return {
    personal: {
      nameEn: guessedName || '',
      nameJa: '',
      furigana: '',
      dob: '',
      address: '',
      phone: phoneMatch ? phoneMatch[0] : '',
      email: emailMatch ? emailMatch[0] : '',
      linkedin: linkedinMatch ? `https://${linkedinMatch[0]}` : '',
      github: githubMatch ? `https://${githubMatch[0]}` : '',
    },
    education: parseListSection(sections.education, true),
    experience: parseListSection(sections.experience, false),
    projects: parseProjects(sections.projects),
    skills: parsedSkills,
    activities: parseListSection(sections.activities, false),
    summary: summaryText || '',
  };
}


const testIdMap = {
  en_01: 'jakes-clean',
  en_02: 'classic-en',
  en_03: 'minimalist-en',
  en_04: 'modern-en',
  ja_01: 'jakes-clean-ja',
  ja_02: 'rirekisho-grid',
  ja_03: 'deedy-jp',
};

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

  return r;
}

export default function App() {
   const [resume,    setResume]    = useState(null);
  const [template,  setTemplate]  = useState('en_01');
  const [lang,      setLang]      = useState(() => localStorage.getItem('resume-studio-language') || 'en');
  const [autoCompile, setAutoCompile] = useState(true);
  const [pdfSrc,    setPdfSrc]    = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [errMsg,    setErrMsg]    = useState(null);
  const [save,      setSave]      = useState('saved'); // saved | saving | error
  const [toasts,    setToasts]    = useState([]);
  const [sidebar,   setSidebar]   = useState(true); // toggleable
  const [theme,     setTheme]     = useState(() => localStorage.getItem('theme') || 'light');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(true);
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
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

  // AI Application Assistant states
  const [sidebarTab, setSidebarTab] = useState('editor'); // editor | chat
  const [applications, setApplications] = useState([]);
  const [activeApp, setActiveApp] = useState(null);
  const [asstCompany, setAsstCompany] = useState('');
  const [asstRole, setAsstRole] = useState('');
  const [asstDesc, setAsstDesc] = useState('');
  const [asstNotes, setAsstNotes] = useState('');
  const [asstLetter, setAsstLetter] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);
  const [zoom, setZoom] = useState('Fit');
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: chatWelcome(false)
    }
  ]);

  const cmpTimer = useRef(null);
  const loaded   = useRef(false);
  const lastCompiled = useRef('');
  const chatAbortRef = useRef(null);

  // ── Toasts ───────────────────────────────────────────────
  const toast = useCallback((msg, type = 'info') => {
    const id = ++_tid;
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  const dismiss = id => setToasts(p => p.filter(t => t.id !== id));

  // ── Applications List loader ─────────────────────────────
  const fetchApps = useCallback(profileId => {
    const profile = profileId || new URLSearchParams(window.location.search).get('profile') || 'mohamed_fuad';
    applicationApi.list(profile).then(setApplications).catch(() => setApplications([]));
  }, []);

  // Log job application via web UI
  const handleLogApp = async (e) => {
    if (e) e.preventDefault();
    if (!asstCompany.trim() || !asstRole.trim() || !asstDesc.trim()) {
      toast('Please fill in Company, Job Title, and Description', 'error');
      return;
    }
    setSubmittingApp(true);
    try {
      const data = await applicationApi.create(activeProfile, {
        company: asstCompany,
        jobTitle: asstRole,
        jobDescription: asstDesc,
        notes: asstNotes,
      });
      toast(`Logged application for ${asstRole} at ${asstCompany}!`, 'success');
      setAsstLetter(data.coverLetter);
      fetchApps(activeProfile);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmittingApp(false);
    }
  };

  // ── Profile management states & helpers ──────────────────
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

  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(getUrlProfile());
  // Same source the dashboard's "N roles tracked" pipeline reads, so the sidebar
  // badge can never disagree with the number shown on the page.
  const {
    records: trackedRecords, addMilestone: addTrackerMilestone, removeMilestone: removeTrackerMilestone,
  } = useApplicationTracker(activeProfile);
  // Gmail ingest: drains inbox-derived actions into the tracker/calendar (full-auto).
  const { justApplied, clearJustApplied } = useGmailInbox(activeProfile);
  // Sidebar collapse — persisted so it survives reloads.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState('start'); // start | pdf-upload | 1..8
  const [wizardData, setWizardData] = useState(null);
  const [wizardOnboarding, setWizardOnboarding] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
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
  const saveData = useCallback(debounce(async (data, profileId) => {
    setSave('saving');
    try {
      await profileApi.save(profileId, data);
      setSave('saved');
      fetchProfiles();
    } catch {
      setSave('error');
    }
  }, 1200), [fetchProfiles]);

  const saveNow = useCallback(async () => {
    if (!resume) return;
    setSave('saving');
    try {
      await profileApi.save(activeProfile, resume);
      setSave('saved');
      fetchProfiles();
      toast(isJa ? '保存しました' : 'Resume saved', 'success');
    } catch {
      setSave('error');
      toast(isJa ? '保存できませんでした' : 'Could not save resume', 'error');
    }
  }, [resume, activeProfile, fetchProfiles, toast, isJa]);

  // ── Compile ──────────────────────────────────────────────
  const compile = useCallback(async (data, tmpl, { force = false } = {}) => {
    if (!data) return;
    const cacheKey = `${tmpl}_${JSON.stringify(data)}`;
    if (!force && lastCompiled.current === cacheKey && pdfSrc) return;

    setCompiling(true);
    setErrMsg(null);
    try {
      const result = await requestJson('/api/compile', { method: 'POST', body: { template: tmpl, resume: data } });
      if (!result.success) {
        throw new Error(result.error || 'Compilation failed');
      }

      const url = apiUrl(result.pdfUrl);

      // Verify PDF content to support corrupt PDF payload error boundary
      try {
        const checkRes = await fetch(url);
        if (!checkRes.ok) throw new Error(`PDF request failed (${checkRes.status})`);
        const bytes = new Uint8Array(await checkRes.arrayBuffer());
        const signature = String.fromCharCode(...bytes.slice(0, 5));
        if (signature !== '%PDF-') {
          throw new Error('pdf-render-error-alert: Corrupt PDF header');
        }
      } catch (err) {
        throw new Error(`PDF Render Error: ${err.message}`);
      }

      lastCompiled.current = cacheKey;

      // Force reload by appending v=timestamp, and use open parameters to hide chrome & document outline
      const hash = zoom === 'Fit'
        ? 'view=Fit&toolbar=0&navpanes=0&pagemode=none&scrollbar=1'
        : `toolbar=0&navpanes=0&pagemode=none&scrollbar=1&zoom=${zoom}`;
      const separator = url.includes('?') ? '&' : '?';
      setPdfSrc(`${url}${separator}v=${Date.now()}#${hash}`);
    } catch (e) {
      const message = e instanceof TypeError && /fetch|network/i.test(e.message)
        ? (isJa ? '履歴書サービスに接続できません。サーバーを確認して再試行してください。' : 'Resume service is unavailable. Check the server and retry.')
        : e.message;
      lastCompiled.current = '';
      setErrMsg(message);
      toast(`Compile error: ${message.slice(0, 70)}`, 'error');
    } finally {
      setCompiling(false);
    }
  }, [toast, zoom, pdfSrc, isJa]);

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
      fetchApps(id);
      if (!skipUrl) {
        syncUrlWithProfile(id);
      }
      lastCompiled.current = ''; // force recompile
      compile(normalized, template);
      toast(isJa ? `履歴書を切り替えました: ${id}` : `Switched to resume: ${id}`, 'success');
    } catch {
      toast(isJa ? `履歴書を読み込めませんでした: ${id}` : `Failed to switch resume: ${id}`, 'error');
    }
  };

  // onboarding=true → the wizard populates the CURRENT (blank, just-created) profile
  // instead of creating a new one. Used on first sign-in so a new account can import
  // a résumé PDF or fill it in. The 'new profile' path (onboarding=false) is retained
  // for the no-auth/local case.
  const openProfileWizard = (onboarding = false) => {
    setWizardOnboarding(onboarding);
    setWizardStep('start');
    setWizardData(null);
    setShowWizard(true);
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
        // New account: ensureSeed created a blank profile. Offer the onboarding
        // wizard (résumé PDF import or manual) so the user can populate it.
        if (authAvailable && auth?.currentUser && isResumeBlank(loaded)) {
          openProfileWizard(true);
        }
      } catch {
        toast('Could not load resume data', 'error');
      }
      fetchApps(initProfile);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchApps]);

  useEffect(() => {
    const handlePopState = () => {
      const id = getUrlProfile();
      if (id !== activeProfile) {
        handleSwitchProfile(id, true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeProfile, template, compile]);

  // Recompile on template switch
  useEffect(() => { if (resume) compile(resume, template); }, [template]);

  useEffect(() => {
    setTemplate(prev => {
      if (lang === 'en' && !prev.startsWith('en_')) return 'en_01';
      if (lang === 'ja' && !prev.startsWith('ja_')) return 'ja_01';
      return prev;
    });
    setChatMessages(prev => {
      if (prev.length !== 1 || prev[0].role !== 'assistant') return prev;
      return [{ role: 'assistant', text: chatWelcome(lang === 'ja') }];
    });
  }, [lang]);

  // Initial compile once loaded
  useEffect(() => {
    if (resume && !loaded.current) {
      loaded.current = true;
      compile(resume, template);
    }
  }, [resume]);

  // ── Change handler ───────────────────────────────────────
  const change = useCallback((next, options = {}) => {
    const normalized = normalizeResume(next);
    setResume(normalized);
    setSave('saving');
    if (options.immediate) {
      saveData.cancel?.();
      saveProfileImmediately(normalized, activeProfile, { refreshFromServer: options.refreshFromServer !== false })
        .then(serverResume => {
          if (autoCompile) compile(serverResume, template, { force: true });
        })
        .catch(error => {
          setSave('error');
          toast(error.message || (isJa ? '保存できませんでした' : 'Could not save resume'), 'error');
        });
      return;
    }
    saveData(normalized, activeProfile);
    if (cmpTimer.current) clearTimeout(cmpTimer.current);
    if (autoCompile) {
      cmpTimer.current = setTimeout(() => compile(normalized, template), 700);
    }
  }, [template, saveData, saveProfileImmediately, compile, activeProfile, autoCompile, toast, isJa]);

  const handleResumeChat = useCallback(async () => {
    const text = chatDraft.trim();
    if (!text || !resume || chatSending) return;
    setChatDraft('');
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setChatSending(true);
    const controller = new AbortController();
    chatAbortRef.current = controller;
    try {
      const result = await requestJson('/api/chat/edit', {
        method: 'POST',
        signal: controller.signal,
        body: { profile: activeProfile, instruction: text, resume, language: lang },
      });
      if (result.changedSections?.length && result.resume) {
        const nextResume = normalizeResume(result.resume);
        change(nextResume);
        setActiveSection(result.focusSection || result.changedSections?.[0] || 'summary');
      }
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: result.type === 'conversation'
          ? result.message
          : `${result.message}${result.engine ? ` · ${result.engine}` : ''}`,
      }]);
    } catch (error) {
      if (error.name === 'AbortError') {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          text: isJa ? '処理をキャンセルしました。' : 'Cancelled. You can edit your request and try again.',
        }]);
        return;
      }
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: isJa ? `変更を適用できませんでした: ${error.message}` : `I could not apply that change: ${error.message}`,
      }]);
      toast(error.message, 'error');
    } finally {
      setChatSending(false);
      chatAbortRef.current = null;
    }
  }, [chatDraft, resume, chatSending, activeProfile, lang, change, isJa, toast]);

  const handleCancelChat = useCallback(() => {
    chatAbortRef.current?.abort();
  }, []);

  const sec = key => val => change({ ...resume, [key]: val });

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

  const handleExport = async (type, url, filename, body) => {
    if (isResumeEmpty()) {
      setShowEmptyWarning(true);
      return;
    }
    toast(`Downloading ${type.toUpperCase()}…`);
    try {
      const res = await fetch(url, body ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      } : undefined);
      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || `Failed to compile for export`);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const id = ++_tid;
      setToasts(p => [...p, { id, message: err.message, type: 'error', testId: 'download-error-toast' }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    }
  };

  // Exports POST the in-memory résumé so the server needs no profile lookup
  // (the client owns the data in Firestore). JSON is produced entirely client-side.
  const onPDF  = () => handleExport('pdf', apiUrl('/api/export/pdf'), 'resume.pdf', { template, resume });
  const onTex  = () => handleExport('tex', apiUrl('/api/export/tex'), 'resume.tex', { template, resume });
  const onAI   = () => handleExport('ai', apiUrl('/api/export/ai'), 'resume.md', { resume });
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

  // Save pill class
  const saveClass = save === 'saved' ? 'saved' : save === 'error' ? 'err' : 'saving';
  const displayedSummary = isJa
    ? (resume.summaryJa || resume.japanese?.summary || resume.summary || '')
    : (resume.summaryEn || resume.summary || '');
  const updateDisplayedSummary = value => {
    if (isJa) {
      change({
        ...resume,
        summaryJa: value,
        japanese: { ...(resume.japanese || {}), summary: value },
      });
    } else {
      change({ ...resume, summaryEn: value, summary: value });
    }
  };
  const sectionEntries = [
    {
      key: 'personal',
      icon: 'user',
      label: isJa ? '個人情報' : 'Personal',
      meta: resume.personal?.nameJa || resume.personal?.nameEn || (isJa ? '氏名・連絡先' : 'Name and contact'),
      count: 4,
      node: <PersonalSec data={resume.personal} onChange={sec('personal')} isJa={isJa} />
    },
    {
      key: 'summary',
      icon: 'txt',
      label: isJa ? '自己紹介' : 'Summary',
      meta: displayedSummary ? (isJa ? '入力済み' : 'Drafted') : (isJa ? '未入力' : 'Empty'),
      count: displayedSummary ? 1 : 0,
      node: <SummarySec data={displayedSummary} onChange={updateDisplayedSummary} isJa={isJa} resume={resume} />
    },
    {
      key: 'education',
      icon: 'edu',
      label: isJa ? '学歴' : 'Education',
      meta: isJa ? '学校・専攻・期間' : 'Schools and dates',
      count: resume.education?.length || 0,
      node: <EducationSec data={resume.education} onChange={sec('education')} isJa={isJa} />
    },
    {
      key: 'experience',
      icon: 'work',
      label: isJa ? '職歴' : 'Experience',
      meta: isJa ? '会社・職務内容' : 'Roles and impact',
      count: resume.experience?.length || 0,
      node: <ExperienceSec data={resume.experience} onChange={sec('experience')} isJa={isJa} />
    },
    {
      key: 'projects',
      icon: 'code',
      label: isJa ? 'プロジェクト' : 'Projects',
      meta: isJa ? '成果物・技術' : 'Work samples',
      count: resume.projects?.length || 0,
      node: <ProjectsSec data={resume.projects} onChange={sec('projects')} isJa={isJa} />
    },
    {
      key: 'skills',
      icon: 'zap',
      label: isJa ? 'スキル' : 'Skills',
      meta: isJa ? '技術・語学' : 'Tools and languages',
      count: Array.isArray(resume.skills) ? resume.skills.length : Object.values(resume.skills || {}).filter(Boolean).length,
      node: <SkillsSec data={resume.skills} onChange={sec('skills')} isJa={isJa} />
    },
    {
      key: 'activities',
      icon: 'star',
      label: isJa ? '活動・資格' : 'Activities',
      meta: isJa ? '資格・受賞・活動' : 'Awards and credentials',
      count: resume.activities?.length || 0,
      node: <ActivitiesSec data={resume.activities} onChange={sec('activities')} isJa={isJa} />
    },
  ];
  const activeEntry = sectionEntries.find(entry => entry.key === activeSection) || sectionEntries[0];
  const totalItems = sectionEntries.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
  const completedSections = sectionEntries.filter(entry => Number(entry.count || 0) > 0).length;
  const completionPct = Math.round((completedSections / sectionEntries.length) * 100);
  const currentTemplate = TEMPLATES.find(t => t.id === template);
  const currentTemplates = lang === 'en' ? EN : JA;
  const displayName = isJa
    ? (resume.personal?.nameJa || resume.personal?.nameEn || (isJa ? '無題の履歴書' : 'Untitled resume'))
    : (resume.personal?.nameEn || resume.personal?.nameJa || 'Untitled resume');
  const baseInfoItems = [
    { label: isJa ? '氏名' : 'Name', value: displayName },
    { label: isJa ? 'メール' : 'Email', value: resume.personal?.email },
    { label: isJa ? '電話' : 'Phone', value: resume.personal?.phone },
    { label: isJa ? '住所' : 'Address', value: resume.personal?.address },
  ];

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
              const badge = id === 'dashboard' ? trackedRecords.length : 0;
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
          onNew={openProfileWizard}
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
          {/* No title bar: the sidebar already names the current view. The editor's
              Save/Export toolbar renders inside its .editor-view card below. */}

      {appView === 'dashboard' ? (
        <ProfileDashboard
          resume={resume}
          activeProfile={activeProfile}
          isJa={isJa}
          onOpenRadar={() => setAppView('radar')}
          onOpenEditor={() => setAppView('editor')}
          onResumeChange={change}
        />
      ) : appView === 'radar' ? (
        <InternshipDashboard isJa={isJa} activeProfile={activeProfile} resume={resume} onOpenEditor={() => setAppView('editor')} onOpenSettings={() => setAppView('settings')} />
      ) : appView === 'applications' ? (
        <ApplicationsView isJa={isJa} activeProfile={activeProfile} onOpenRadar={() => setAppView('radar')} onOpenEditor={() => setAppView('editor')} />
      ) : appView === 'profile' ? (
        <ProfileView resume={resume} isJa={isJa} onOpenEditor={() => setAppView('editor')} />
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
          resume={resume}
          isJa={isJa}
          activeProfile={activeProfile}
          canDelete={profiles.length > 1}
          onSaveProfile={async personal => { await saveProfileImmediately({ ...resume, personal }, activeProfile, { refreshFromServer: false }); }}
          onExportJson={onJson}
          onDeleteProfile={id => { handleDeleteProfile(id); setAppView('dashboard'); }}
          // Only offered when there is a real signed-in account. On the no-auth
          // path there is nothing to delete, so Settings hides the whole section.
          onDeleteAccount={authAvailable && auth?.currentUser ? deleteAccount : undefined}
          needsPassword={(auth?.currentUser?.providerData || []).some(p => p.providerId === 'password')}
        />
      ) : (
        <div className="editor-view">
          <header className="tb">
            <div className="tb-inner">
              <div className="tb-actions">
                <button className="btn" onClick={saveNow} disabled={save === 'saving'}>
                  <I n="check" s={12} />
                  {save === 'saving' ? (isJa ? '保存中' : 'Saving') : (isJa ? '保存' : 'Save')}
                </button>
                <ExportMenu onPDF={onPDF} onTex={onTex} onJson={onJson} onAI={onAI} isJa={isJa} />
              </div>
            </div>
          </header>
          <div className="editor-commandbar">
            <div className="editor-command-group template-command">
              <span className="command-label">{isJa ? 'テンプレート' : 'Template'}</span>
              <div className="tb-tabs">
                <div className="tb-tab-grp">
                  <span className={`tb-grp-lbl ${lang}`}>{lang.toUpperCase()}</span>
                  {currentTemplates.map(t => (
                    <button
                      key={t.id}
                      data-testid={`template-${testIdMap[t.id]}`}
                      aria-selected={template === t.id ? "true" : "false"}
                      className={`tpl ${template === t.id ? `active on-${lang} border-primary` : ''}`}
                      onClick={() => setTemplate(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Main split ───────────────────────────────── */}
          <div className="split">

        {/* Sidebar (collapsible, compiles instantly on blur/focusout) */}
        <aside
          className={`sidebar ${sidebar ? '' : 'closed'}`}
          onBlur={(e) => {
            if (resume && sidebarTab === 'editor') {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                compile(resume, template);
              }
            }
          }}
        >
          {/* Sidebar Tabs */}
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab-btn ${sidebarTab === 'editor' ? 'active' : ''}`}
              onClick={() => setSidebarTab('editor')}
            >
              <I n="user" s={12} style={{ marginRight: 6 }} />
              {isJa ? '編集' : 'Editor'}
            </button>
            <button
              className={`sidebar-tab-btn ${sidebarTab === 'chat' ? 'active' : ''}`}
              onClick={() => setSidebarTab('chat')}
            >
              <I n="brain" s={12} style={{ marginRight: 6 }} />
              {isJa ? 'チャット' : 'Chat'}
            </button>
          </div>

          {sidebarTab === 'editor' ? (
            <div className="editor-workspace">
              <nav className="section-rail" aria-label="Resume sections">
                <div className="rail-head">
                  <span>{isJa ? '入力項目' : 'Sections'}</span>
                  <strong>{sectionEntries.reduce((sum, entry) => sum + Number(entry.count || 0), 0)}</strong>
                </div>
                <div className="section-list">
                  {sectionEntries.map((entry, index) => (
                    <button
                      type="button"
                      key={entry.key}
                      className={`section-row ${entry.key === activeEntry.key ? 'active' : ''}`}
                      onClick={() => setActiveSection(entry.key)}
                    >
                      <span className={`section-status s-${entry.key}`}><I n={entry.icon} s={13} /></span>
                      <span className="section-copy">
                        <span className="section-title">{entry.label}</span>
                        <span className="section-meta">{entry.meta}</span>
                      </span>
                      <span className="section-count">{entry.count}</span>
                      <span className="section-id">R-{String(index + 1).padStart(2, '0')}</span>
                    </button>
                  ))}
                </div>
              </nav>
              <div className="editor-pane">
                <div className="editor-pane-head">
                  <div>
                    <span className="pane-kicker">{isJa ? '日本語履歴書' : 'Resume data'}</span>
                    <h1>{displayName}</h1>
                  </div>
                </div>
                <div className="active-section-card">
                  {activeEntry.node}
                </div>
              </div>
            </div>
          ) : (
            <div className="sidebar-scroll">
              <div className="resume-chat">
                <div className="chat-head">
                  <span className="section-status"><I n="brain" s={14} /></span>
                  <div>
                    <h2>{isJa ? '履歴書チャット' : 'Resume chat'}</h2>
                    <p>{isJa ? '相談も、履歴書への直接編集もできます。' : 'Conversation and direct resume editing in one place.'}</p>
                  </div>
                </div>
                <div className="chat-thread">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className={`chat-bubble ${msg.role}`}>
                      {msg.text}
                    </div>
                  ))}
                </div>
                <div className="chat-composer">
                  <textarea
                    className="fta"
                    rows={1}
                    value={chatDraft}
                    onChange={e => setChatDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleResumeChat();
                      }
                    }}
                    placeholder={isJa ? 'Codexに履歴書について相談…' : 'Message Codex about your resume…'}
                    aria-label={isJa ? '履歴書チャットへのメッセージ' : 'Message Resume Codex'}
                  />
                  <div className="chat-actions">
                    <button className="btn btn-primary" type="button" onClick={handleResumeChat} disabled={chatSending || !chatDraft.trim()}>
                      <I n="brain" s={12} />
                      {chatSending ? (isJa ? '考え中…' : 'Thinking…') : (isJa ? '送信' : 'Send')}
                    </button>
                    {chatSending && (
                      <button className="btn chat-cancel" type="button" onClick={handleCancelChat}>
                        <I n="x" s={12} />
                        {isJa ? 'キャンセル' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="chat-note">
                  {isJa
                    ? 'Codex LLMが現在の履歴書を参照します。変更していない項目は保持し、編集内容を返信で説明します。'
                    : 'Codex LLM reads the current resume context, preserves unrelated facts, and explains every applied edit.'}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* PDF preview */}
        <main className="preview" data-testid="preview-container">
          <div className="preview-toolbar">
            <span className="p-title">{isJa ? '履歴書プレビュー' : 'Resume Preview'}</span>
            <div className="preview-controls">
              <button
                className="btn preview-update"
                data-testid="compile-btn"
                onClick={() => compile(resume, template, { force: true })}
                disabled={compiling}
              >
                <I n="sync" s={12} style={{ animation: compiling ? 'spin 0.6s linear infinite' : 'none' }} />
                {compiling ? (isJa ? '更新中' : 'Updating') : (isJa ? '更新' : 'Update')}
              </button>
              <div className="p-zoom-grp">
                <span className="p-zoom-lbl">Zoom</span>
                {['Fit', 60, 80, 100, 120].map(z => (
                  <button
                    key={z}
                    className={`zoom-btn ${zoom === z ? 'active' : ''}`}
                    onClick={() => {
                      setZoom(z);
                      if (pdfSrc) {
                        const baseUrl = pdfSrc.split('#')[0];
                        const hash = z === 'Fit'
                          ? 'view=Fit&toolbar=0&navpanes=0&pagemode=none&scrollbar=1'
                          : `toolbar=0&navpanes=0&pagemode=none&scrollbar=1&zoom=${z}`;
                        setPdfSrc(`${baseUrl}#${hash}`);
                      }
                    }}
                  >
                    {z === 'Fit' ? 'Fit' : `${z}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`pdf-frame ${compiling ? 'compiling' : ''}`}>

            {pdfSrc && !errMsg && (
              <iframe
                key={pdfSrc}
                className="pdf-iframe"
                src={pdfSrc}
                title="Resume Preview"
                data-testid="preview-pdf"
              />
            )}

            {compiling && (
              <div className="overlay" data-testid="preview-loading-skeleton">
                <div className="spinner" />
                <p>{isJa ? 'PDFを作成中…' : 'Compiling…'}</p>
              </div>
            )}

            {errMsg && !compiling && (
              <div className="overlay" data-testid={errMsg.includes('PDF') ? "pdf-render-error-alert" : "compile-error-alert"}>
                <I n="x" s={22} style={{ color: 'var(--err)' }} />
                <p style={{ color: 'var(--err)' }}>{isJa ? '作成に失敗しました' : 'Compilation failed'}</p>
                <p className="err-p">{errMsg.slice(0, 240)}</p>
                <button className="btn" style={{ marginTop: 4 }} onClick={() => compile(resume, template, { force: true })}>
                  <I n="sync" s={11} /> {isJa ? '再試行' : 'Retry'}
                </button>
              </div>
            )}

            {!pdfSrc && !compiling && !errMsg && (
              <div className="overlay">
                <I n="file" s={40} style={{ color: 'var(--t3)', opacity: 0.35 }} />
                <p>{isJa ? 'PDF作成後にプレビューを表示します' : 'Preview loads after compilation'}</p>
              </div>
            )}

          </div>
        </main>
          </div>
        </div>
      )}

      {activeApp && (
        <div className="modal-overlay" onClick={() => setActiveApp(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <h3>{activeApp.jobTitle}</h3>
                <span className="m-subtitle">{activeApp.company} &bull; {activeApp.dateLogged}</span>
              </div>
              <button className="modal-close" onClick={() => setActiveApp(null)}>
                <I n="x" s={14} />
              </button>
            </div>
            <div className="modal-bd">
              <div className="m-sec">
                <h4>Status</h4>
                <span className={`alc-badge ${activeApp.status.includes('MCP') ? 'mcp' : 'web'}`}>{activeApp.status}</span>
              </div>
              {activeApp.jobDescription && (
                <div className="m-sec">
                  <h4>Job Description & Requirements</h4>
                  <p className="m-desc-text">{activeApp.jobDescription}</p>
                </div>
              )}
              {activeApp.notes && (
                <div className="m-sec">
                  <h4>Notes</h4>
                  <p className="m-notes-text">{activeApp.notes}</p>
                </div>
              )}
              {activeApp.coverLetter && (
                <div className="m-sec">
                  <div className="m-sec-hd">
                    <h4>Auto-Generated Cover Letter</h4>
                    <button
                      className="btn"
                      onClick={() => {
                        navigator.clipboard.writeText(activeApp.coverLetter);
                        toast('Copied to clipboard!', 'success');
                      }}
                    >
                      Copy Letter
                    </button>
                  </div>
                  <pre className="cover-letter-pre">{activeApp.coverLetter}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Resume Creator Wizard Overlay ──────────────────── */}
      {showWizard && (
        <div className="wizard-overlay">
          <div className="wizard-card">
            <div className="wizard-hd">
              <div className="wizard-hd-title-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3>{isJa ? '新しい履歴書を作成' : 'Create New Resume Profile'}</h3>
                {typeof wizardStep === 'number' && (
                  <div className="wizard-progress-bar-container" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="wizard-progress-track" style={{ width: '120px', height: '6px', background: 'var(--b0)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div className="wizard-progress-fill" style={{ width: `${(wizardStep / 8) * 100}%`, height: '100%', background: 'var(--b-focus)', borderRadius: '3px', transition: 'width 0.2s' }} />
                    </div>
                    <span className="wizard-progress-text" style={{ fontSize: '10.5px', color: 'var(--t3)' }}>Step {wizardStep} of 8</span>
                  </div>
                )}
              </div>
              <button className="wizard-close" onClick={() => setShowWizard(false)}>
                <I n="x" s={14} />
              </button>
            </div>
            
            <div className="wizard-bd">
              {wizardStep === 'start' && (
                <div className="wizard-start-flow">
                  <p className="wizard-intro-text">
                    Create a new professional resume profile. Choose how you would like to start:
                  </p>
                  <div className="wizard-options">
                    <button 
                      className="wizard-opt-btn"
                      onClick={() => {
                        setWizardData({
                          personal: { nameEn: '', nameJa: '', furigana: '', dob: '', address: '', postalCode: '', phone: '', email: '', linkedin: '', github: '' },
                          summary: '',
                          education: [],
                          experience: [],
                          projects: [],
                          skills: { languages: '', frameworks: '', tools: '', concepts: '', spoken: '' },
                          activities: []
                        });
                        setEditingIndex(-1);
                        setWizardStep(1);
                      }}
                    >
                      <div className="wob-icon"><I n="user" s={24} /></div>
                      <div className="wob-info">
                        <h4>Build from Scratch</h4>
                        <p>Fill out details step-by-step in a card-based questionnaire.</p>
                      </div>
                    </button>

                    <button 
                      className="wizard-opt-btn"
                      onClick={() => setWizardStep('pdf-upload')}
                    >
                      <div className="wob-icon"><I n="file" s={24} /></div>
                      <div className="wob-info">
                        <h4>Import from existing PDF</h4>
                        <p>Upload a PDF resume to extract details automatically.</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 'pdf-upload' && (
                <div className="wizard-pdf-upload-flow">
                  <h4>Upload your existing PDF resume</h4>
                  <p className="wizard-help-text">We will load PDF.js in the browser to extract name, email, phone, and online links.</p>
                  
                  <div className="pdf-dropzone">
                    {parsingPdf ? (
                      <div className="pdf-parsing-loader">
                        <div className="spinner" />
                        <p>Extracting resume data...</p>
                      </div>
                    ) : (
                      <label className="pdf-upload-label">
                        <I n="dl" s={30} style={{ marginBottom: 12, opacity: 0.6 }} />
                        <span>Choose PDF File or Drag & Drop</span>
                        <input 
                          type="file" 
                          accept=".pdf" 
                          className="pdf-file-input" 
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setParsingPdf(true);
                            try {
                              const text = await extractTextFromPdfFile(file);
                              const parsed = parseResumeTextHeuristically(text);
                              setWizardData(parsed);
                              toast('PDF text parsed successfully!', 'success');
                              setEditingIndex(-1);
                              setWizardStep(1); // Go to Step 1 (Personal) to review/complete
                            } catch (err) {
                              toast(`Failed to parse PDF: ${err.message}`, 'error');
                            } finally {
                              setParsingPdf(false);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <button className="btn" onClick={() => setWizardStep('start')}>Back</button>
                </div>
              )}

              {/* Step 1: Personal Details */}
              {wizardStep === 1 && (
                <div className="wizard-step-flow">
                  <div className="wizard-step-title">Step 1 of 8: Personal Details</div>
                  <div className="flds">
                    <div className="row2">
                      <div className="f">
                        <span className="fl">Full Name (EN) *</span>
                        <input className="fi" type="text" value={wizardData.personal.nameEn} onChange={e => setWizardData({...wizardData, personal: {...wizardData.personal, nameEn: e.target.value}})} placeholder="Mohamed Fuad" required />
                      </div>
                      <div className="f">
                        <span className="fl">日本語名 (JA)</span>
                        <input className="fi" type="text" value={wizardData.personal.nameJa} onChange={e => setWizardData({...wizardData, personal: {...wizardData.personal, nameJa: e.target.value}})} placeholder="モハメド フアド" />
                      </div>
                    </div>
                    <div className="row2">
                      <div className="f">
                        <span className="fl">ふりがな</span>
                        <input className="fi" type="text" value={wizardData.personal.furigana} onChange={e => setWizardData({...wizardData, personal: {...wizardData.personal, furigana: e.target.value}})} placeholder="もはめど ふあど" />
                      </div>
                      <div className="f">
                        <span className="fl">Date of Birth</span>
                        <input className="fi" type="text" value={wizardData.personal.dob} onChange={e => setWizardData({...wizardData, personal: {...wizardData.personal, dob: e.target.value}})} placeholder="2004-02-28" />
                      </div>
                    </div>
                    <div className="row2">
                      <div className="f">
                        <span className="fl">Email</span>
                        <input className="fi" type="email" value={wizardData.personal.email} onChange={e => setWizardData({...wizardData, personal: {...wizardData.personal, email: e.target.value}})} placeholder="you@email.com" />
                      </div>
                      <div className="f">
                        <span className="fl">Phone</span>
                        <input className="fi" type="text" value={wizardData.personal.phone} onChange={e => setWizardData({...wizardData, personal: {...wizardData.personal, phone: e.target.value}})} placeholder="080-0000-0000" />
                      </div>
                    </div>
                    <div className="f">
                      <span className="fl">Address (JP)</span>
                      <input className="fi" type="text" value={wizardData.personal.address} onChange={e => setWizardData({...wizardData, personal: {...wizardData.personal, address: e.target.value}})} placeholder="東京都世田谷区..." />
                    </div>
                    <div className="row2">
                      <div className="f">
                        <span className="fl">GitHub URL</span>
                        <input className="fi" type="text" value={wizardData.personal.github} onChange={e => setWizardData({...wizardData, personal: {...wizardData.personal, github: e.target.value}})} placeholder="https://github.com/..." />
                      </div>
                      <div className="f">
                        <span className="fl">LinkedIn URL</span>
                        <input className="fi" type="text" value={wizardData.personal.linkedin} onChange={e => setWizardData({...wizardData, personal: {...wizardData.personal, linkedin: e.target.value}})} placeholder="https://linkedin.com/in/..." />
                      </div>
                    </div>
                  </div>
                  
                  <div className="wizard-actions">
                    <button className="btn" onClick={() => setWizardStep('start')}>Back</button>
                    <button className="btn btn-primary" onClick={() => setWizardStep(2)} disabled={!wizardData.personal.nameEn.trim()}>Next</button>
                  </div>
                </div>
              )}

              {/* Step 2: Summary */}
              {wizardStep === 2 && (
                <div className="wizard-step-flow">
                  <div className="wizard-step-title">Step 2 of 8: Summary & Profile Statement</div>
                  <div className="f">
                    <span className="fl">Japanese Summary / Self-PR Statement</span>
                    <textarea 
                      className="fta" 
                      value={wizardData.summary} 
                      onChange={e => setWizardData({...wizardData, summary: e.target.value})} 
                      placeholder="職務要約 (e.g. 東海大学情報通信学部情報通信学科の3年次に在学中...)" 
                      style={{ minHeight: '150px' }}
                    />
                  </div>

                  <div className="wizard-actions">
                    <button className="btn" onClick={() => setWizardStep(1)}>Back</button>
                    <button className="btn btn-primary" onClick={() => setWizardStep(3)}>Next</button>
                  </div>
                </div>
              )}

              {/* Step 3: Education */}
              {wizardStep === 3 && (
                <div className="wizard-step-flow">
                  <div className="wizard-step-title">Step 3 of 8: Education History</div>
                  
                  {editingIndex === -1 ? (
                    <div className="wizard-list-view">
                      <div className="wizard-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <p className="wizard-help-text" style={{ margin: 0 }}>Add your universities, colleges, or high schools.</p>
                        <button className="btn btn-sm" style={{ padding: '5px 10px', background: 'var(--b-focus)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => {
                          const newList = [...(wizardData.education || []), { institution: '', institutionJa: '', location: '', degree: '', degreeJa: '', startDate: '', endDate: '', bullets: [] }];
                          setWizardData({...wizardData, education: newList});
                          setEditingIndex(newList.length - 1);
                        }}>+ Add School</button>
                      </div>
                      
                      <div className="wizard-items-stack" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                        {(!wizardData.education || wizardData.education.length === 0) ? (
                          <div className="wizard-list-empty" style={{ textAlign: 'center', padding: '20px', background: 'var(--card)', borderRadius: '6px', color: 'var(--t3)', border: '1px dashed var(--b1)' }}>No education entries added yet.</div>
                        ) : (
                          wizardData.education.map((edu, idx) => (
                            <div key={idx} className="wizard-item-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--card)', border: '1px solid var(--b0)', borderRadius: '8px' }}>
                              <div className="wic-info">
                                <h5 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600' }}>{edu.institution || 'Unnamed Institution'}</h5>
                                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--t3)' }}>{edu.degree || 'No Degree Specified'} ({edu.startDate || 'N/A'} - {edu.endDate || 'N/A'})</p>
                              </div>
                              <div className="wic-actions" style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-sm" onClick={() => setEditingIndex(idx)}>Edit</button>
                                <button className="btn btn-sm btn-delete-profile" onClick={() => {
                                  setWizardData({...wizardData, education: wizardData.education.filter((_, i) => i !== idx)});
                                }}>Delete</button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="wizard-actions">
                        <button className="btn" onClick={() => setWizardStep(2)}>Back</button>
                        <button className="btn btn-primary" onClick={() => setWizardStep(4)}>Next</button>
                      </div>
                    </div>
                  ) : (
                    // Edit education item
                    <div className="wizard-subform" style={{ background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: '8px', border: '1px solid var(--b0)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: 'var(--b-focus)' }}>Edit Education Entry</h4>
                      <div className="flds">
                        <div className="row2">
                          <SuggestInput
                            label="Institution (EN) *"
                            value={wizardData.education[editingIndex].institution}
                            onChange={v => {
                              const newList = [...wizardData.education];
                              newList[editingIndex].institution = v;
                              setWizardData({...wizardData, education: newList});
                            }}
                            suggestions={INSTITUTIONS_EN}
                            placeholder="Tokai University"
                          />
                          <SuggestInput
                            label="Institution (JA)"
                            value={wizardData.education[editingIndex].institutionJa}
                            onChange={v => {
                              const newList = [...wizardData.education];
                              newList[editingIndex].institutionJa = v;
                              setWizardData({...wizardData, education: newList});
                            }}
                            suggestions={INSTITUTIONS_JA}
                            placeholder="東海大学"
                          />
                        </div>
                        <div className="row2">
                          <SuggestInput
                            label="Degree / Program (EN)"
                            value={wizardData.education[editingIndex].degree}
                            onChange={v => {
                              const newList = [...wizardData.education];
                              newList[editingIndex].degree = v;
                              setWizardData({...wizardData, education: newList});
                            }}
                            suggestions={DEGREES_EN}
                            placeholder="Bachelor of Science in ICT"
                          />
                          <SuggestInput
                            label="Degree / Program (JA)"
                            value={wizardData.education[editingIndex].degreeJa}
                            onChange={v => {
                              const newList = [...wizardData.education];
                              newList[editingIndex].degreeJa = v;
                              setWizardData({...wizardData, education: newList});
                            }}
                            suggestions={DEGREES_JA}
                            placeholder="情報通信学科（学士課程）"
                          />
                        </div>
                        <div className="row3">
                          <SuggestInput
                            label="Location"
                            value={wizardData.education[editingIndex].location}
                            onChange={v => {
                              const newList = [...wizardData.education];
                              newList[editingIndex].location = v;
                              setWizardData({...wizardData, education: newList});
                            }}
                            suggestions={LOCATIONS}
                            placeholder="Tokyo, Japan"
                          />
                          <div className="f">
                            <span className="fl">Start Date</span>
                            <input className="fi" type="text" value={wizardData.education[editingIndex].startDate} onChange={e => {
                              const newList = [...wizardData.education];
                              newList[editingIndex].startDate = e.target.value;
                              setWizardData({...wizardData, education: newList});
                            }} placeholder="Apr 2024" />
                          </div>
                          <div className="f">
                            <span className="fl">End Date</span>
                            <input className="fi" type="text" value={wizardData.education[editingIndex].endDate} onChange={e => {
                              const newList = [...wizardData.education];
                              newList[editingIndex].endDate = e.target.value;
                              setWizardData({...wizardData, education: newList});
                            }} placeholder="Mar 2028 (Expected)" />
                          </div>
                        </div>

                        {/* Bullets Sub-editor */}
                        <div className="f" style={{ marginTop: '10px' }}>
                          <span className="fl">Bullet Points (Details about your study)</span>
                          <div className="bullet-stack" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(wizardData.education[editingIndex].bullets || []).map((bullet, bIdx) => (
                              <div key={bIdx} className="bullet-row" style={{ display: 'flex', gap: '6px' }}>
                                <textarea className="fta" value={bullet} onChange={e => {
                                  const newList = [...wizardData.education];
                                  newList[editingIndex].bullets[bIdx] = e.target.value;
                                  setWizardData({...wizardData, education: newList});
                                }} placeholder="e.g. Major GPA: 3.8/4.0..." style={{ minHeight: '40px', flex: 1 }} />
                                <button className="bullet-del" style={{ alignSelf: 'center', background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }} onClick={() => {
                                  const newList = [...wizardData.education];
                                  newList[editingIndex].bullets = newList[editingIndex].bullets.filter((_, i) => i !== bIdx);
                                  setWizardData({...wizardData, education: newList});
                                }} title="Remove"><I n="x" s={11} /></button>
                              </div>
                            ))}
                          </div>
                          <button className="btn-add-bullet" style={{ marginTop: '6px', fontSize: '11px', color: 'var(--b-focus)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => {
                            const newList = [...wizardData.education];
                            newList[editingIndex].bullets = [...(newList[editingIndex].bullets || []), ''];
                            setWizardData({...wizardData, education: newList});
                          }}>+ Add bullet point</button>
                        </div>
                      </div>

                      <div className="wizard-subform-actions" style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--b0)', paddingTop: '12px' }}>
                        <button className="btn btn-primary" onClick={() => {
                          const item = wizardData.education[editingIndex];
                          if (!item.institution.trim()) {
                            toast('Institution name is required', 'error');
                            return;
                          }
                          setEditingIndex(-1);
                        }}>Save School</button>
                        <button className="btn" onClick={() => {
                          if (!wizardData.education[editingIndex].institution.trim()) {
                            setWizardData({...wizardData, education: wizardData.education.filter((_, i) => i !== editingIndex)});
                          }
                          setEditingIndex(-1);
                        }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Experience */}
              {wizardStep === 4 && (
                <div className="wizard-step-flow">
                  <div className="wizard-step-title">Step 4 of 8: Work Experience</div>
                  
                  {editingIndex === -1 ? (
                    <div className="wizard-list-view">
                      <div className="wizard-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <p className="wizard-help-text" style={{ margin: 0 }}>Add your past or current jobs/internships.</p>
                        <button className="btn btn-sm" style={{ padding: '5px 10px', background: 'var(--b-focus)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => {
                          const newList = [...(wizardData.experience || []), { company: '', companyJa: '', role: '', roleJa: '', location: '', startDate: '', endDate: '', bullets: [] }];
                          setWizardData({...wizardData, experience: newList});
                          setEditingIndex(newList.length - 1);
                        }}>+ Add Job</button>
                      </div>
                      
                      <div className="wizard-items-stack" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                        {(!wizardData.experience || wizardData.experience.length === 0) ? (
                          <div className="wizard-list-empty" style={{ textAlign: 'center', padding: '20px', background: 'var(--card)', borderRadius: '6px', color: 'var(--t3)', border: '1px dashed var(--b1)' }}>No experience entries added yet.</div>
                        ) : (
                          wizardData.experience.map((exp, idx) => (
                            <div key={idx} className="wizard-item-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--card)', border: '1px solid var(--b0)', borderRadius: '8px' }}>
                              <div className="wic-info">
                                <h5 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600' }}>{exp.company || 'Unnamed Company'}</h5>
                                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--t3)' }}>{exp.role || 'No Role Specified'} ({exp.startDate || 'N/A'} - {exp.endDate || 'N/A'})</p>
                              </div>
                              <div className="wic-actions" style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-sm" onClick={() => setEditingIndex(idx)}>Edit</button>
                                <button className="btn btn-sm btn-delete-profile" onClick={() => {
                                  setWizardData({...wizardData, experience: wizardData.experience.filter((_, i) => i !== idx)});
                                }}>Delete</button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="wizard-actions">
                        <button className="btn" onClick={() => setWizardStep(3)}>Back</button>
                        <button className="btn btn-primary" onClick={() => setWizardStep(5)}>Next</button>
                      </div>
                    </div>
                  ) : (
                    // Edit experience item
                    <div className="wizard-subform" style={{ background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: '8px', border: '1px solid var(--b0)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: 'var(--b-focus)' }}>Edit Work Experience Entry</h4>
                      <div className="flds">
                        <div className="row2">
                          <SuggestInput
                            label="Company Name (EN) *"
                            value={wizardData.experience[editingIndex].company}
                            onChange={v => {
                              const newList = [...wizardData.experience];
                              newList[editingIndex].company = v;
                              setWizardData({...wizardData, experience: newList});
                            }}
                            suggestions={COMPANIES_EN}
                            placeholder="Altius Link"
                          />
                          <SuggestInput
                            label="Company Name (JA)"
                            value={wizardData.experience[editingIndex].companyJa}
                            onChange={v => {
                              const newList = [...wizardData.experience];
                              newList[editingIndex].companyJa = v;
                              setWizardData({...wizardData, experience: newList});
                            }}
                            suggestions={COMPANIES_JA}
                            placeholder="アルティウスリンク株式会社"
                          />
                        </div>
                        <div className="row2">
                          <SuggestInput
                            label="Role / Job Title (EN)"
                            value={wizardData.experience[editingIndex].role}
                            onChange={v => {
                              const newList = [...wizardData.experience];
                              newList[editingIndex].role = v;
                              setWizardData({...wizardData, experience: newList});
                            }}
                            suggestions={ROLES_EN}
                            placeholder="Translation Specialist"
                          />
                          <SuggestInput
                            label="Role / Job Title (JA)"
                            value={wizardData.experience[editingIndex].roleJa}
                            onChange={v => {
                              const newList = [...wizardData.experience];
                              newList[editingIndex].roleJa = v;
                              setWizardData({...wizardData, experience: newList});
                            }}
                            suggestions={ROLES_JA}
                            placeholder="翻訳スペシャリスト"
                          />
                        </div>
                        <div className="row3">
                          <SuggestInput
                            label="Location"
                            value={wizardData.experience[editingIndex].location}
                            onChange={v => {
                              const newList = [...wizardData.experience];
                              newList[editingIndex].location = v;
                              setWizardData({...wizardData, experience: newList});
                            }}
                            suggestions={LOCATIONS}
                            placeholder="Tokyo, Japan"
                          />
                          <div className="f">
                            <span className="fl">Start Date</span>
                            <input className="fi" type="text" value={wizardData.experience[editingIndex].startDate} onChange={e => {
                              const newList = [...wizardData.experience];
                              newList[editingIndex].startDate = e.target.value;
                              setWizardData({...wizardData, experience: newList});
                            }} placeholder="Jun 2023" />
                          </div>
                          <div className="f">
                            <span className="fl">End Date</span>
                            <input className="fi" type="text" value={wizardData.experience[editingIndex].endDate} onChange={e => {
                              const newList = [...wizardData.experience];
                              newList[editingIndex].endDate = e.target.value;
                              setWizardData({...wizardData, experience: newList});
                            }} placeholder="Present / Mar 2024" />
                          </div>
                        </div>

                        {/* Bullets Sub-editor */}
                        <div className="f" style={{ marginTop: '10px' }}>
                          <span className="fl">Work Achievements / Bullets</span>
                          <div className="bullet-stack" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(wizardData.experience[editingIndex].bullets || []).map((bullet, bIdx) => (
                              <div key={bIdx} className="bullet-row" style={{ display: 'flex', gap: '6px' }}>
                                <textarea className="fta" value={bullet} onChange={e => {
                                  const newList = [...wizardData.experience];
                                  newList[editingIndex].bullets[bIdx] = e.target.value;
                                  setWizardData({...wizardData, experience: newList});
                                }} placeholder="e.g. Handled translation for KDDI services..." style={{ minHeight: '40px', flex: 1 }} />
                                <button className="bullet-del" style={{ alignSelf: 'center', background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }} onClick={() => {
                                  const newList = [...wizardData.experience];
                                  newList[editingIndex].bullets = newList[editingIndex].bullets.filter((_, i) => i !== bIdx);
                                  setWizardData({...wizardData, experience: newList});
                                }} title="Remove"><I n="x" s={11} /></button>
                              </div>
                            ))}
                          </div>
                          <button className="btn-add-bullet" style={{ marginTop: '6px', fontSize: '11px', color: 'var(--b-focus)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => {
                            const newList = [...wizardData.experience];
                            newList[editingIndex].bullets = [...(newList[editingIndex].bullets || []), ''];
                            setWizardData({...wizardData, experience: newList});
                          }}>+ Add bullet point</button>
                        </div>
                      </div>

                      <div className="wizard-subform-actions" style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--b0)', paddingTop: '12px' }}>
                        <button className="btn btn-primary" onClick={() => {
                          const item = wizardData.experience[editingIndex];
                          if (!item.company.trim()) {
                            toast('Company name is required', 'error');
                            return;
                          }
                          setEditingIndex(-1);
                        }}>Save Job</button>
                        <button className="btn" onClick={() => {
                          if (!wizardData.experience[editingIndex].company.trim()) {
                            setWizardData({...wizardData, experience: wizardData.experience.filter((_, i) => i !== editingIndex)});
                          }
                          setEditingIndex(-1);
                        }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Projects */}
              {wizardStep === 5 && (
                <div className="wizard-step-flow">
                  <div className="wizard-step-title">Step 5 of 8: Key Projects</div>
                  
                  {editingIndex === -1 ? (
                    <div className="wizard-list-view">
                      <div className="wizard-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <p className="wizard-help-text" style={{ margin: 0 }}>Add academic or personal software/hardware projects.</p>
                        <button className="btn btn-sm" style={{ padding: '5px 10px', background: 'var(--b-focus)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => {
                          const newList = [...(wizardData.projects || []), { title: '', tech: '', year: '', bullets: [] }];
                          setWizardData({...wizardData, projects: newList});
                          setEditingIndex(newList.length - 1);
                        }}>+ Add Project</button>
                      </div>
                      
                      <div className="wizard-items-stack" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                        {(!wizardData.projects || wizardData.projects.length === 0) ? (
                          <div className="wizard-list-empty" style={{ textAlign: 'center', padding: '20px', background: 'var(--card)', borderRadius: '6px', color: 'var(--t3)', border: '1px dashed var(--b1)' }}>No projects added yet.</div>
                        ) : (
                          wizardData.projects.map((proj, idx) => (
                            <div key={idx} className="wizard-item-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--card)', border: '1px solid var(--b0)', borderRadius: '8px' }}>
                              <div className="wic-info">
                                <h5 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600' }}>{proj.title || 'Unnamed Project'}</h5>
                                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--t3)' }}>{proj.tech || 'No Stack Specified'} ({proj.year || 'N/A'})</p>
                              </div>
                              <div className="wic-actions" style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-sm" onClick={() => setEditingIndex(idx)}>Edit</button>
                                <button className="btn btn-sm btn-delete-profile" onClick={() => {
                                  setWizardData({...wizardData, projects: wizardData.projects.filter((_, i) => i !== idx)});
                                }}>Delete</button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="wizard-actions">
                        <button className="btn" onClick={() => setWizardStep(4)}>Back</button>
                        <button className="btn btn-primary" onClick={() => setWizardStep(6)}>Next</button>
                      </div>
                    </div>
                  ) : (
                    // Edit project item
                    <div className="wizard-subform" style={{ background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: '8px', border: '1px solid var(--b0)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: 'var(--b-focus)' }}>Edit Project Entry</h4>
                      <div className="flds">
                        <div className="row2">
                          <div className="f">
                            <span className="fl">Project Title *</span>
                            <input className="fi" type="text" value={wizardData.projects[editingIndex].title} onChange={e => {
                              const newList = [...wizardData.projects];
                              newList[editingIndex].title = e.target.value;
                              setWizardData({...wizardData, projects: newList});
                            }} placeholder="Tutor-System" required />
                          </div>
                          <SuggestInput
                            label="Year"
                            value={wizardData.projects[editingIndex].year}
                            onChange={v => {
                              const newList = [...wizardData.projects];
                              newList[editingIndex].year = v;
                              setWizardData({...wizardData, projects: newList});
                            }}
                            suggestions={YEARS}
                            placeholder="2025"
                          />
                        </div>
                        <TagInput
                          label="Technologies / Tech Stack"
                          value={wizardData.projects[editingIndex].tech}
                          onChange={v => {
                            const newList = [...wizardData.projects];
                            newList[editingIndex].tech = v;
                            setWizardData({...wizardData, projects: newList});
                          }}
                          suggestions={TECH_SUGGESTIONS}
                          placeholder="Select or type technologies..."
                        />

                        {/* Bullets Sub-editor */}
                        <div className="f" style={{ marginTop: '10px' }}>
                          <span className="fl">Project Details / Accomplishments</span>
                          <div className="bullet-stack" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(wizardData.projects[editingIndex].bullets || []).map((bullet, bIdx) => (
                              <div key={bIdx} className="bullet-row" style={{ display: 'flex', gap: '6px' }}>
                                <textarea className="fta" value={bullet} onChange={e => {
                                  const newList = [...wizardData.projects];
                                  newList[editingIndex].bullets[bIdx] = e.target.value;
                                  setWizardData({...wizardData, projects: newList});
                                }} placeholder="e.g. Integrated OpenRouter API for voice chat..." style={{ minHeight: '40px', flex: 1 }} />
                                <button className="bullet-del" style={{ alignSelf: 'center', background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }} onClick={() => {
                                  const newList = [...wizardData.projects];
                                  newList[editingIndex].bullets = newList[editingIndex].bullets.filter((_, i) => i !== bIdx);
                                  setWizardData({...wizardData, projects: newList});
                                }} title="Remove"><I n="x" s={11} /></button>
                              </div>
                            ))}
                          </div>
                          <button className="btn-add-bullet" style={{ marginTop: '6px', fontSize: '11px', color: 'var(--b-focus)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => {
                            const newList = [...wizardData.projects];
                            newList[editingIndex].bullets = [...(newList[editingIndex].bullets || []), ''];
                            setWizardData({...wizardData, projects: newList});
                          }}>+ Add bullet point</button>
                        </div>
                      </div>

                      <div className="wizard-subform-actions" style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--b0)', paddingTop: '12px' }}>
                        <button className="btn btn-primary" onClick={() => {
                          const item = wizardData.projects[editingIndex];
                          if (!item.title.trim()) {
                            toast('Project title is required', 'error');
                            return;
                          }
                          setEditingIndex(-1);
                        }}>Save Project</button>
                        <button className="btn" onClick={() => {
                          if (!wizardData.projects[editingIndex].title.trim()) {
                            setWizardData({...wizardData, projects: wizardData.projects.filter((_, i) => i !== editingIndex)});
                          }
                          setEditingIndex(-1);
                        }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 6: Skills */}
              {wizardStep === 6 && (
                <div className="wizard-step-flow">
                  <div className="wizard-step-title">Step 6 of 8: Skills Profile</div>
                  <div className="flds">
                    <TagInput
                      label="Programming Languages"
                      value={wizardData.skills.languages}
                      onChange={v => setWizardData({...wizardData, skills: {...wizardData.skills, languages: v}})}
                      suggestions={LANGS}
                      placeholder="Select or type languages..."
                    />
                    <TagInput
                      label="Frameworks & Libraries"
                      value={wizardData.skills.frameworks}
                      onChange={v => setWizardData({...wizardData, skills: {...wizardData.skills, frameworks: v}})}
                      suggestions={FRAMEWORKS}
                      placeholder="Select or type frameworks..."
                    />
                    <TagInput
                      label="Tools & Databases"
                      value={wizardData.skills.tools}
                      onChange={v => setWizardData({...wizardData, skills: {...wizardData.skills, tools: v}})}
                      suggestions={TOOLS}
                      placeholder="Select or type tools/DBs..."
                    />
                    <TagInput
                      label="Concepts & Methodologies"
                      value={wizardData.skills.concepts}
                      onChange={v => setWizardData({...wizardData, skills: {...wizardData.skills, concepts: v}})}
                      suggestions={CONCEPTS}
                      placeholder="Select or type concepts..."
                    />
                    <TagInput
                      label="Spoken Languages"
                      value={wizardData.skills.spoken}
                      onChange={v => setWizardData({...wizardData, skills: {...wizardData.skills, spoken: v}})}
                      suggestions={SPOKEN}
                      placeholder="Select or type spoken languages..."
                    />
                  </div>

                  <div className="wizard-actions">
                    <button className="btn" onClick={() => setWizardStep(5)}>Back</button>
                    <button className="btn btn-primary" onClick={() => setWizardStep(7)}>Next</button>
                  </div>
                </div>
              )}

              {/* Step 7: Activities */}
              {wizardStep === 7 && (
                <div className="wizard-step-flow">
                  <div className="wizard-step-title">Step 7 of 8: Activities & Certifications</div>
                  
                  {editingIndex === -1 ? (
                    <div className="wizard-list-view">
                      <div className="wizard-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <p className="wizard-help-text" style={{ margin: 0 }}>Add professional associations, certifications, or awards.</p>
                        <button className="btn btn-sm" style={{ padding: '5px 10px', background: 'var(--b-focus)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => {
                          const newList = [...(wizardData.activities || []), { title: '', org: '', location: '', startDate: '', endDate: '', bullets: [] }];
                          setWizardData({...wizardData, activities: newList});
                          setEditingIndex(newList.length - 1);
                        }}>+ Add Activity</button>
                      </div>
                      
                      <div className="wizard-items-stack" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                        {(!wizardData.activities || wizardData.activities.length === 0) ? (
                          <div className="wizard-list-empty" style={{ textAlign: 'center', padding: '20px', background: 'var(--card)', borderRadius: '6px', color: 'var(--t3)', border: '1px dashed var(--b1)' }}>No activities added yet.</div>
                        ) : (
                          wizardData.activities.map((act, idx) => (
                            <div key={idx} className="wizard-item-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--card)', border: '1px solid var(--b0)', borderRadius: '8px' }}>
                              <div className="wic-info">
                                <h5 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600' }}>{act.title || 'Unnamed Activity'}</h5>
                                <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--t3)' }}>{act.org || 'No Organization'} ({act.startDate || 'N/A'} - {act.endDate || 'N/A'})</p>
                              </div>
                              <div className="wic-actions" style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-sm" onClick={() => setEditingIndex(idx)}>Edit</button>
                                <button className="btn btn-sm btn-delete-profile" onClick={() => {
                                  setWizardData({...wizardData, activities: wizardData.activities.filter((_, i) => i !== idx)});
                                }}>Delete</button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="wizard-actions">
                        <button className="btn" onClick={() => setWizardStep(6)}>Back</button>
                        <button className="btn btn-primary" onClick={() => setWizardStep(8)}>Next</button>
                      </div>
                    </div>
                  ) : (
                    // Edit activity item
                    <div className="wizard-subform" style={{ background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: '8px', border: '1px solid var(--b0)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: 'var(--b-focus)' }}>Edit Activity Entry</h4>
                      <div className="flds">
                        <div className="row2">
                          <div className="f">
                            <span className="fl">Activity / Award Title *</span>
                            <input className="fi" type="text" value={wizardData.activities[editingIndex].title} onChange={e => {
                              const newList = [...wizardData.activities];
                              newList[editingIndex].title = e.target.value;
                              setWizardData({...wizardData, activities: newList});
                            }} placeholder="IEEE Student Member" required />
                          </div>
                          <div className="f">
                            <span className="fl">Organization</span>
                            <input className="fi" type="text" value={wizardData.activities[editingIndex].org} onChange={e => {
                              const newList = [...wizardData.activities];
                              newList[editingIndex].org = e.target.value;
                              setWizardData({...wizardData, activities: newList});
                            }} placeholder="IEEE Tokai Student Branch" />
                          </div>
                        </div>
                        <div className="row3">
                          <div className="f">
                            <span className="fl">Location</span>
                            <input className="fi" type="text" value={wizardData.activities[editingIndex].location} onChange={e => {
                              const newList = [...wizardData.activities];
                              newList[editingIndex].location = e.target.value;
                              setWizardData({...wizardData, activities: newList});
                            }} placeholder="Tokyo, Japan" />
                          </div>
                          <div className="f">
                            <span className="fl">Start Date</span>
                            <input className="fi" type="text" value={wizardData.activities[editingIndex].startDate} onChange={e => {
                              const newList = [...wizardData.activities];
                              newList[editingIndex].startDate = e.target.value;
                              setWizardData({...wizardData, activities: newList});
                            }} placeholder="2024" />
                          </div>
                          <div className="f">
                            <span className="fl">End Date</span>
                            <input className="fi" type="text" value={wizardData.activities[editingIndex].endDate} onChange={e => {
                              const newList = [...wizardData.activities];
                              newList[editingIndex].endDate = e.target.value;
                              setWizardData({...wizardData, activities: newList});
                            }} placeholder="Present" />
                          </div>
                        </div>

                        {/* Bullets Sub-editor */}
                        <div className="f" style={{ marginTop: '10px' }}>
                          <span className="fl">Activity Details / Bullets</span>
                          <div className="bullet-stack" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(wizardData.activities[editingIndex].bullets || []).map((bullet, bIdx) => (
                              <div key={bIdx} className="bullet-row" style={{ display: 'flex', gap: '6px' }}>
                                <textarea className="fta" value={bullet} onChange={e => {
                                  const newList = [...wizardData.activities];
                                  newList[editingIndex].bullets[bIdx] = e.target.value;
                                  setWizardData({...wizardData, activities: newList});
                                }} placeholder="e.g. Conducted workshops on network protocols..." style={{ minHeight: '40px', flex: 1 }} />
                                <button className="bullet-del" style={{ alignSelf: 'center', background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }} onClick={() => {
                                  const newList = [...wizardData.activities];
                                  newList[editingIndex].bullets = newList[editingIndex].bullets.filter((_, i) => i !== bIdx);
                                  setWizardData({...wizardData, activities: newList});
                                }} title="Remove"><I n="x" s={11} /></button>
                              </div>
                            ))}
                          </div>
                          <button className="btn-add-bullet" style={{ marginTop: '6px', fontSize: '11px', color: 'var(--b-focus)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => {
                            const newList = [...wizardData.activities];
                            newList[editingIndex].bullets = [...(newList[editingIndex].bullets || []), ''];
                            setWizardData({...wizardData, activities: newList});
                          }}>+ Add bullet point</button>
                        </div>
                      </div>

                      <div className="wizard-subform-actions" style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--b0)', paddingTop: '12px' }}>
                        <button className="btn btn-primary" onClick={() => {
                          const item = wizardData.activities[editingIndex];
                          if (!item.title.trim()) {
                            toast('Activity title is required', 'error');
                            return;
                          }
                          setEditingIndex(-1);
                        }}>Save Activity</button>
                        <button className="btn" onClick={() => {
                          if (!wizardData.activities[editingIndex].title.trim()) {
                            setWizardData({...wizardData, activities: wizardData.activities.filter((_, i) => i !== editingIndex)});
                          }
                          setEditingIndex(-1);
                        }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 8: Save & Finish */}
              {wizardStep === 8 && (
                <div className="wizard-step-flow">
                  <div className="wizard-step-title">
                    {wizardOnboarding ? 'Finish setting up your résumé' : 'Step 8 of 8: Finish & Save Profile'}
                  </div>
                  {wizardOnboarding ? (
                    <p className="wizard-intro-text">
                      Review your details, then save to start tailoring your résumé. You can refine everything in the Editor afterwards.
                    </p>
                  ) : (
                    <>
                      <p className="wizard-intro-text">
                        Enter a profile name / ID for your resume. This ID will be used in the URL query string (e.g. <code>?profile=your_id</code>) to share your profile.
                      </p>
                      <div className="f">
                        <span className="fl">Profile Name / ID (lowercase, alphanumeric, dashes, underscores) *</span>
                        <input
                          className="fi"
                          type="text"
                          placeholder="e.g. john_doe"
                          onChange={e => {
                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                            setWizardData({...wizardData, _profileId: val});
                          }}
                        />
                      </div>
                    </>
                  )}

                  <div className="wizard-actions">
                    <button className="btn" onClick={() => setWizardStep(7)}>Back</button>
                    <button
                      className="btn btn-submit-app"
                      disabled={!wizardOnboarding && (!wizardData._profileId || !wizardData._profileId.trim())}
                      onClick={async () => {
                        const data = { ...wizardData };
                        delete data._profileId;

                        // Guarantee the profile carries personal.postalCode (server validates it),
                        // including the PDF-import path which does not seed the field.
                        data.personal = { ...data.personal, postalCode: data.personal?.postalCode || '' };

                        if (!data.personal.nameEn.trim()) {
                          toast('Full name is required', 'error');
                          return;
                        }

                        try {
                          if (wizardOnboarding) {
                            // Populate the current (just-created) profile — no new profile.
                            const merged = { ...resume, ...data };
                            await saveProfileImmediately(merged, activeProfile, { refreshFromServer: false });
                            toast('Résumé saved!', 'success');
                            setShowWizard(false);
                            setWizardOnboarding(false);
                            lastCompiled.current = '';
                            compile(normalizeResume(merged), template, { force: true });
                          } else {
                            const pid = wizardData._profileId;
                            await profileApi.save(pid, data);
                            toast(`Created new resume profile "${pid}"!`, 'success');
                            setShowWizard(false);
                            fetchProfiles();
                            handleSwitchProfile(pid);
                          }
                        } catch (error) {
                          toast(error.message || 'Failed to save profile. Ensure the profile ID is unique and has no special characters.', 'error');
                        }
                      }}
                    >
                      {wizardOnboarding ? 'Save & Start' : 'Save Profile & Generate Resume'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
        </div>{/* /.app-main */}
      </div>{/* /.app-body */}

      {showEmptyWarning && (
        <div data-testid="empty-export-warning" className="modal-overlay" onClick={() => setShowEmptyWarning(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Empty Resume Warning</h3>
              <button className="modal-close" onClick={() => setShowEmptyWarning(false)}>
                <I n="x" s={14} />
              </button>
            </div>
            <div className="modal-bd">
              <p>Your resume data is empty. Please enter some details before exporting.</p>
              <button className="btn" onClick={() => setShowEmptyWarning(false)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <Toasts list={toasts} dismiss={dismiss} />
    </div>
  );
}
