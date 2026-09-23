// Résumé PDF upload: read the text with pdf.js (loaded from cdnjs on demand),
// guess the résumé fields from it, and merge them into the stored résumé. The
// PDF itself is never kept; only the parsed fields are saved to the profile.
import { newItemId } from './helpers.js';

// Heuristic keyword buckets for the free-text skills parser (module scope: the
// sets are constant, so building them once beats rebuilding per parsed line, and
// Set.has beats Array.includes for the per-word lookups below).
const HEURISTIC_LANGS = new Set(['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'rust', 'go', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'bash', 'shell']);
const HEURISTIC_FWKS = new Set(['react', 'node', 'express', 'next', 'vue', 'angular', 'svelte', 'django', 'flask', 'spring', 'laravel', 'tailwind', 'bootstrap']);
const HEURISTIC_TOOLS = new Set(['git', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'sqlite', 'mysql', 'postgresql', 'mongodb', 'redis', 'firebase', 'vite', 'webpack', 'npm', 'yarn']);



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

export async function extractTextFromPdfFile(file) {
  // Library load and file read don't depend on each other; pages are
  // independent too, so extract them all concurrently and join in order.
  const [pdfjs, arrayBuffer] = await Promise.all([loadPdfJs(), file.arrayBuffer()]);
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pageTexts = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, index) =>
      pdf.getPage(index + 1)
        .then(page => page.getTextContent())
        .then(content => content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''))),
  );
  return pageTexts.join('\n') + '\n';
}

export function parseResumeTextHeuristically(text) {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  // Longest run of digits and separators with 9+ digits; years and date ranges are shorter.
  const phoneMatch = (text.match(/\+?\d[\d \t().-]{7,}\d/g) || []).map(m => [m.trim()]).find(([m]) => m.replace(/\D/g, '').length >= 9) || null;
  const githubMatch = text.match(/(github\.com\/[a-zA-Z0-9_-]+)/i);
  const linkedinMatch = text.match(/(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i);

  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Multi-page résumés repeat the name/title/contact header on every page; keep
  // only the first copy so page 2's header does not land inside a section.
  const header = new Set(rawLines.slice(0, 3));
  const lines = rawLines.filter((line, index) => index < 3 || !header.has(line));
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
    { key: 'summary', patterns: [/^(summary|profile|objective|about me)$/i] },
    // Before experience: "LANGUAGE & WORK AUTHORIZATION" is a skills block, not a job.
    { key: 'skills', patterns: [/skills/i, /technologies/i, /expertise/i, /technical profile/i, /tech stack/i, /^languages?\b/i] },
    { key: 'education', patterns: [/education/i, /academic/i, /study/i] },
    { key: 'experience', patterns: [/experience/i, /employment/i, /history/i, /work/i] },
    // "Selected project portfolio" and "Technical profile" are common headings too.
    { key: 'projects', patterns: [/\bprojects?\b/i, /portfolio/i] },
    { key: 'activities', patterns: [/activities/i, /certifications/i, /awards/i, /honors/i] }
  ];

  const sectionIndexes = [];
  // A heading is short, carries no sentence punctuation, and is either ALL CAPS
  // or at most three words. Without this, a wrapped line like "and shipped
  // ecommerce work." matched /work/ and swallowed the projects into Experience.
  const looksLikeHeading = line => {
    const words = line.split(/\s+/).length;
    // "Languages: Python, Go" is content, not a heading; "Skills:" alone is one.
    if (words > 4 || /[.,;]$/.test(line) || /:\s*\S/.test(line)) return false;
    return line === line.toUpperCase() || /:$/.test(line) || words <= 3;
  };
  lines.forEach((line, index) => {
    if (looksLikeHeading(line)) {
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
        const bulletVal = line.replace(/^[•\-*\s]+/, '').replace(/^\\resumeItem\{/, '').replace(/\}$/, '').trim();
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
          
          // Unknown fields stay blank: a made-up "Tokyo, Japan" or "Present"
          // would be saved as if the résumé said it.
          if (isEdu) {
            currentEntry = {
              institution: name,
              institutionJa: '',
              location: parts[1] || '',
              degree: parts[2] || '',
              degreeJa: '',
              startDate: dateStr.split(/[-–to]+/)[0]?.trim() || '',
              endDate: dateStr.split(/[-–to]+/)[1]?.trim() || '',
              bullets: []
            };
          } else {
            currentEntry = {
              company: name,
              companyJa: '',
              role: parts[2] || '',
              roleJa: '',
              location: parts[1] || '',
              startDate: dateStr.split(/[-–to]+/)[0]?.trim() || '',
              endDate: dateStr.split(/[-–to]+/)[1]?.trim() || '',
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
        const bulletVal = line.replace(/^[•\-*\s]+/, '').replace(/^\\resumeItem\{/, '').replace(/\}$/, '').trim();
        if (currentEntry) currentEntry.bullets.push(bulletVal);
      } else if (currentEntry && !currentEntry.tech && !currentEntry.bullets.length && line.includes(',') && !/\.$/.test(line)) {
        // "TypeScript, React, Vite" right under a title is its tech stack.
        currentEntry.tech = line;
      } else if (!currentEntry && (/^[a-z]/.test(line) || /\.$/.test(line))) {
        // Tail of the section intro sentence, before the first project title.
      } else if (currentEntry && (/\.$/.test(line) || line.length >= 50
        || (currentEntry.tech && !currentEntry.bullets.length)
        || /[^.]$/.test(currentEntry.bullets.at(-1) || '.'))) {
        // Sentence text: the wrapped tail of an unfinished line, or a new one.
        const last = currentEntry.bullets.length - 1;
        if (last >= 0 && !/\.$/.test(currentEntry.bullets[last])) currentEntry.bullets[last] += ` ${line}`;
        else currentEntry.bullets.push(line);
      } else {
        const dateMatch = line.match(/\d{4}/);
        if (dateMatch || (line.length > 2 && line.length < 50 && !line.includes('@'))) {
          if (currentEntry) projs.push(currentEntry);
          const parts = line.split(/[|·•\t()]/).map(p => p.trim());
          currentEntry = {
            title: parts[0] || '',
            tech: parts[1] || '',
            year: dateMatch ? dateMatch[0] : '',
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
      words.forEach(w => {
        const wl = w.toLowerCase();
        if (HEURISTIC_LANGS.has(wl)) langsList.push(w);
        else if (HEURISTIC_FWKS.has(wl)) fwksList.push(w);
        else if (HEURISTIC_TOOLS.has(wl)) toolsList.push(w);
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
    education: parseListSection(sections.education, true).map(item => ({ ...item, id: newItemId() })),
    experience: parseListSection(sections.experience, false).map(item => ({ ...item, id: newItemId() })),
    projects: parseProjects(sections.projects).map(item => ({ ...item, id: newItemId() })),
    skills: parsedSkills,
    // Stored activities use {title, org}; the list parser speaks {company, role}.
    activities: parseListSection(sections.activities, false).map(({ company, role, location, startDate, endDate, bullets }) => ({
      id: newItemId(), title: company, org: role, location, startDate, endDate, bullets,
    })),
    summary: summaryText || '',
  };
}

const hasText = value => typeof value === 'string' ? value.trim() !== '' : Boolean(value);
const hasSkills = skills => skills && Object.values(skills).some(hasText);

// Non-destructive merge. Personal fields take the parsed value when the parse
// found one (the Profile page can edit them back). List sections never lose an
// entry: a parsed item that matches a stored one (same company, school or
// project title) only fills that entry's blank fields, so ids, Japanese fields
// and links survive; an unmatched item is appended. Skills and summary fill
// only when empty, because nothing in the app can edit them after an upload.
const LIST_KEYS = { education: 'institution', experience: 'company', projects: 'title', activities: 'title' };
const normKey = value => String(value || '').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, '');

function mergeList(stored, parsed, keyField) {
  const out = (stored || []).map(item => ({ ...item }));
  for (const item of parsed) {
    const key = normKey(item[keyField]);
    const match = key && out.find(existing => {
      const other = normKey(existing[keyField]);
      return other && (other.startsWith(key) || key.startsWith(other));
    });
    if (!match) { out.push({ ...item, id: item.id || newItemId() }); continue; }
    for (const [field, value] of Object.entries(item)) {
      if (field === 'id') continue;
      const current = match[field];
      const blank = Array.isArray(current) ? !current.length : !hasText(current);
      if (blank && (Array.isArray(value) ? value.length : hasText(value))) match[field] = value;
    }
  }
  return out;
}

export function mergeParsedResume(resume, parsed) {
  const base = resume || {};
  const personal = { ...(base.personal || {}) };
  for (const [key, value] of Object.entries(parsed.personal || {})) {
    if (hasText(value)) personal[key] = value;
  }
  const next = { ...base, personal };
  for (const [key, keyField] of Object.entries(LIST_KEYS)) {
    if (Array.isArray(parsed[key]) && parsed[key].length) next[key] = mergeList(base[key], parsed[key], keyField);
  }
  // Legacy profiles keep skills as a plain list the parse cannot map onto;
  // leave a non-empty one alone rather than replace it.
  const legacyList = Array.isArray(base.skills) && base.skills.length > 0;
  if (hasSkills(parsed.skills) && !legacyList) {
    const skills = { ...(base.skills && !Array.isArray(base.skills) ? base.skills : {}) };
    for (const [field, value] of Object.entries(parsed.skills)) if (!hasText(skills[field]) && hasText(value)) skills[field] = value;
    next.skills = skills;
  }
  if (hasText(parsed.summary) && !hasText(base.summary)) next.summary = parsed.summary;
  return next;
}
