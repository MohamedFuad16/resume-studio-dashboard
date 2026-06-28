// LaTeX template generators for all 8 resume formats
// Each function takes a `resume` data object and returns a LaTeX string

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function escJa(str) {
  if (!str) return '';
  // For Japanese text, avoid escaping CJK chars but still escape LaTeX specials
  return String(str)
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#');
}

// ══════════════════════════════════════════════════════════════════
// EN 01 — Jake's Clean
// ══════════════════════════════════════════════════════════════════
function genEn01(r) {
  const p = r.personal;
  const edu = r.education.map(e => `
    \\resumeSubheading
      {${esc(e.institution)}}{${esc(e.location)}}
      {${esc(e.degree)}}{${esc(e.startDate)} -- ${esc(e.endDate)}}` +
      (e.bullets && e.bullets.length > 0 ? `
      \\resumeItemListStart
        ${e.bullets.map(b => `\\resumeItem{${esc(b)}}`).join('\n        ')}
      \\resumeItemListEnd` : '')).join('\n');

  const exp = r.experience.map(e => `
    \\resumeSubheading
      {${esc(e.role)}}{${esc(e.location)}}
      {${esc(e.company)}}{${esc(e.startDate)} -- ${esc(e.endDate)}}` +
      (e.bullets && e.bullets.length > 0 ? `
      \\resumeItemListStart
        ${e.bullets.map(b => `\\resumeItem{${esc(b)}}`).join('\n        ')}
      \\resumeItemListEnd` : '')).join('\n');

  const proj = r.projects.map(p => `
      \\resumeProjectHeading
          {\\textbf{${esc(p.title)}} $|$ \\emph{${esc(p.tech)}}}{${esc(p.year)}}` +
          (p.bullets && p.bullets.length > 0 ? `
          \\resumeItemListStart
            ${p.bullets.map(b => `\\resumeItem{${esc(b)}}`).join('\n            ')}
          \\resumeItemListEnd` : '')).join('\n');

  const acts = r.activities.map(a => `
    \\resumeSubheading
      {${esc(a.title)}}{${esc(a.location)}}
      {${esc(a.org)}}{${esc(a.startDate)} -- ${esc(a.endDate)}}` +
      (a.bullets && a.bullets.length > 0 ? `
      \\resumeItemListStart
        ${a.bullets.map(b => `\\resumeItem{${esc(b)}}`).join('\n        ')}
      \\resumeItemListEnd` : '')).join('\n');

  const s = r.skills;
  return `%========================
% Jake's Clean Resume — ${esc(p.nameEn)}
%========================
\\documentclass[letterpaper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks,bookmarks=false]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{microtype}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]
\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-2pt}}}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}
\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}
\\begin{document}
\\begin{center}
    {\\Huge \\scshape ${esc(p.nameEn)}} \\\\ \\vspace{1pt}
    \\small
    Tel: ${esc(p.phone)} $|$
    \\href{mailto:${p.email}}{\\underline{${esc(p.email)}}} $|$
    \\href{${p.linkedin}}{\\underline{linkedin}} $|$
    \\href{${p.github}}{\\underline{github}}
\\end{center}` +
(r.education && r.education.length > 0 ? `
\\section{Education}
  \\resumeSubHeadingListStart
    ${edu}
  \\resumeSubHeadingListEnd` : '') +
(r.experience && r.experience.length > 0 ? `
\\section{Experience}
  \\resumeSubHeadingListStart
    ${exp}
  \\resumeSubHeadingListEnd` : '') +
(r.projects && r.projects.length > 0 ? `
\\section{Projects}
    \\resumeSubHeadingListStart
      ${proj}
    \\resumeSubHeadingListEnd` : '') + `
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
     \\textbf{Languages}{: ${esc(s.languages)}} \\\\
     \\textbf{Frameworks \\& Libraries}{: ${esc(s.frameworks)}} \\\\
     \\textbf{Tools \\& Databases}{: ${esc(s.tools)}} \\\\
     \\textbf{Concepts}{: ${esc(s.concepts)}} \\\\
     \\textbf{Spoken Languages}{: ${esc(s.spoken)}}
    }}
 \\end{itemize}` +
(r.activities && r.activities.length > 0 ? `
\\section{Activities}
  \\resumeSubHeadingListStart
    ${acts}
  \\resumeSubHeadingListEnd` : '') + `
\\end{document}
`;
}

// ══════════════════════════════════════════════════════════════════
// EN 02 — Awesome CV
// ══════════════════════════════════════════════════════════════════
function genEn02(r) {
  const p = r.personal;
  const s = r.skills;

  const edu = r.education.map(e => `
  \\cventry
    {${esc(e.startDate)} -- ${esc(e.endDate)}}
    {${esc(e.degree)}}
    {${esc(e.institution)}}
    {${esc(e.location)}}
    {` + (e.bullets && e.bullets.length > 0 ? `\\begin{cvitems}
      ${e.bullets.map(b => `\\item {${esc(b)}}`).join('\n      ')}
    \\end{cvitems}` : '') + `}`).join('\n');

  const exp = r.experience.map(e => `
  \\cventry
    {${esc(e.startDate)} -- ${esc(e.endDate)}}
    {${esc(e.role)}}
    {${esc(e.company)}}
    {${esc(e.location)}}
    {` + (e.bullets && e.bullets.length > 0 ? `\\begin{cvitems}
      ${e.bullets.map(b => `\\item {${esc(b)}}`).join('\n      ')}
    \\end{cvitems}` : '') + `}`).join('\n');

  const proj = r.projects.map(p => `
  \\cventry
    {${esc(p.year)}}
    {${esc(p.title)}}
    {${esc(p.tech)}}
    {}
    {` + (p.bullets && p.bullets.length > 0 ? `\\begin{cvitems}
      ${p.bullets.map(b => `\\item {${esc(b)}}`).join('\n      ')}
    \\end{cvitems}` : '') + `}`).join('\n');

  return `%========================
% Awesome CV — ${esc(p.nameEn)}
%========================
\\documentclass[10pt, a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage[bookmarks=false]{hyperref}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{microtype}
\\usepackage{setspace}
\\definecolor{accentblue}{RGB}{20, 60, 140}
\\definecolor{darkgray}{RGB}{40, 40, 40}
\\definecolor{medgray}{RGB}{90, 90, 90}
\\geometry{a4paper, top=0.8cm, bottom=0.8cm, left=1.2cm, right=1.2cm}
\\hypersetup{hidelinks, colorlinks=true, urlcolor=accentblue}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\newcommand{\\cventry}[5]{
  \\vspace{5pt}
  \\begin{tabular*}{\\linewidth}{@{}l@{\\extracolsep{\\fill}}r@{}}
    \\textbf{\\color{darkgray}#2} & {\\small\\color{medgray}#1} \\\\
    {\\color{accentblue}\\small#3} & {\\small\\color{medgray}#4} \\\\
  \\end{tabular*}\\vspace{2pt}
  #5
  \\vspace{3pt}
}
\\newenvironment{cvitems}{
  \\begin{itemize}[leftmargin=2em,topsep=2pt,itemsep=1pt,parsep=0pt]
  \\small
}{
  \\end{itemize}
}
\\newcommand{\\sectionline}{\\vspace{1pt}{\\color{accentblue}\\hrule}\\vspace{6pt}}
\\begin{document}
%--- Header ---
\\begin{center}
  {\\fontsize{26}{30}\\selectfont\\bfseries\\color{darkgray}${esc(p.nameEn)}}\\\\[6pt]
  {\\small\\color{medgray}
    ${esc(p.phone)} \\quad|\\quad
    \\href{mailto:${p.email}}{${esc(p.email)}} \\quad|\\quad
    \\href{${p.linkedin}}{LinkedIn} \\quad|\\quad
    \\href{${p.github}}{GitHub}
  }
\\end{center}
\\vspace{8pt}
{\\large\\bfseries\\color{accentblue}EDUCATION}\\\\
\\sectionline
${edu}
\\vspace{6pt}
{\\large\\bfseries\\color{accentblue}EXPERIENCE}\\\\
\\sectionline
${exp}
\\vspace{6pt}
{\\large\\bfseries\\color{accentblue}PROJECTS}\\\\
\\sectionline
${proj}
\\vspace{6pt}
{\\large\\bfseries\\color{accentblue}SKILLS}\\\\
\\sectionline
\\begin{tabular*}{\\linewidth}{@{}p{3cm}p{\\dimexpr\\linewidth-3cm-2\\tabcolsep}@{}}
  \\textbf{Languages} & ${esc(s.languages)} \\\\[2pt]
  \\textbf{Frameworks} & ${esc(s.frameworks)} \\\\[2pt]
  \\textbf{Tools} & ${esc(s.tools)} \\\\[2pt]
  \\textbf{Spoken} & ${esc(s.spoken)} \\\\
\\end{tabular*}
\\end{document}
`;
}

// ══════════════════════════════════════════════════════════════════
// EN 03 — Alta Classic
// ══════════════════════════════════════════════════════════════════
function genEn03(r) {
  const p = r.personal;
  const s = r.skills;

  const edu = r.education.map(e => `
\\textbf{${esc(e.institution)}} \\hfill ${esc(e.location)} \\\\
\\textit{${esc(e.degree)}} \\hfill ${esc(e.startDate)} -- ${esc(e.endDate)}` +
(e.bullets && e.bullets.length > 0 ? ` \\\\
\\begin{itemize}[leftmargin=1.5em,topsep=2pt,itemsep=1pt,parsep=0pt]
  \\small
  ${e.bullets.map(b => `\\item ${esc(b)}`).join('\n  ')}
\\end{itemize}` : '') + `\\vspace{4pt}`).join('\n');

  const exp = r.experience.map(e => `
\\textbf{${esc(e.role)}} \\hfill ${esc(e.startDate)} -- ${esc(e.endDate)} \\\\
\\textit{${esc(e.company)}, ${esc(e.location)}}` +
(e.bullets && e.bullets.length > 0 ? ` \\\\
\\begin{itemize}[leftmargin=1.5em,topsep=2pt,itemsep=1pt,parsep=0pt]
  \\small
  ${e.bullets.map(b => `\\item ${esc(b)}`).join('\n  ')}
\\end{itemize}` : '') + `\\vspace{4pt}`).join('\n');

  const proj = r.projects.map(p => `
\\textbf{${esc(p.title)}} \\textit{(${esc(p.tech)})} \\hfill ${esc(p.year)}` +
(p.bullets && p.bullets.length > 0 ? ` \\\\
\\begin{itemize}[leftmargin=1.5em,topsep=2pt,itemsep=1pt,parsep=0pt]
  \\small
  ${p.bullets.map(b => `\\item ${esc(b)}`).join('\n  ')}
\\end{itemize}` : '') + `\\vspace{4pt}`).join('\n');

  return `%========================
% Alta Classic — ${esc(p.nameEn)}
%========================
\\documentclass[11pt,a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage[bookmarks=false]{hyperref}
\\usepackage{enumitem}
\\usepackage{microtype}
\\usepackage{parskip}
\\definecolor{headcolor}{RGB}{0,70,127}
\\geometry{a4paper,top=1.5cm,bottom=1.5cm,left=1.8cm,right=1.8cm}
\\hypersetup{hidelinks,colorlinks=true,urlcolor=headcolor}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\newcommand{\\ressection}[1]{%
  \\vspace{8pt}
  {\\large\\bfseries\\color{headcolor}#1}\\\\[-4pt]
  {\\color{headcolor}\\rule{\\linewidth}{0.8pt}}
  \\vspace{4pt}
}
\\begin{document}
\\begin{center}
  {\\Huge\\bfseries\\color{headcolor}${esc(p.nameEn)}}\\\\[4pt]
  {\\small ${esc(p.phone)} $\\cdot$ \\href{mailto:${p.email}}{${esc(p.email)}} $\\cdot$ \\href{${p.linkedin}}{LinkedIn} $\\cdot$ \\href{${p.github}}{GitHub}}
\\end{center}
\\ressection{Education}
${edu}
\\ressection{Experience}
${exp}
\\ressection{Projects}
${proj}
\\ressection{Technical Skills}
\\begin{tabular*}{\\linewidth}{@{}p{3.2cm}p{\\dimexpr\\linewidth-3.2cm-2\\tabcolsep}@{}}
  \\textbf{Languages} & ${esc(s.languages)} \\\\[2pt]
  \\textbf{Frameworks} & ${esc(s.frameworks)} \\\\[2pt]
  \\textbf{Tools} & ${esc(s.tools)} \\\\[2pt]
  \\textbf{Concepts} & ${esc(s.concepts)} \\\\[2pt]
  \\textbf{Spoken} & ${esc(s.spoken)} \\\\
\\end{tabular*}
\\end{document}
`;
}

// ══════════════════════════════════════════════════════════════════
// EN 04 — Slate Modern
// ══════════════════════════════════════════════════════════════════
function genEn04(r) {
  const p = r.personal;
  const s = r.skills;

  const edu = r.education.map(e => `
  \\vspace{3pt}
  \\textbf{${esc(e.institution)}} \\hfill {\\small ${esc(e.startDate)} -- ${esc(e.endDate)}} \\\\
  {\\small\\color{slate}${esc(e.degree)} \\hfill ${esc(e.location)}}\\\\
  ${e.bullets.map(b => `\\cvbullet{${esc(b)}}`).join('\n  ')}`).join('\n');

  const exp = r.experience.map(e => `
  \\vspace{3pt}
  \\textbf{${esc(e.company)}} \\hfill {\\small ${esc(e.startDate)} -- ${esc(e.endDate)}} \\\\
  {\\small\\color{accent}${esc(e.role)} \\hfill \\color{slate}${esc(e.location)}}\\\\
  ${e.bullets.map(b => `\\cvbullet{${esc(b)}}`).join('\n  ')}`).join('\n');

  const proj = r.projects.map(p => `
  \\vspace{3pt}
  \\textbf{${esc(p.title)}} {\\small\\color{slate}| ${esc(p.tech)}} \\hfill {\\small ${esc(p.year)}}\\\\
  ${p.bullets.map(b => `\\cvbullet{${esc(b)}}`).join('\n  ')}`).join('\n');

  return `%========================
% Slate Modern — ${esc(p.nameEn)}
%========================
\\documentclass[10pt,a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage[bookmarks=false]{hyperref}
\\usepackage{enumitem}
\\usepackage{microtype}
\\usepackage{tabularx}
\\definecolor{accent}{RGB}{14,99,182}
\\definecolor{slate}{RGB}{100,116,139}
\\definecolor{dark}{RGB}{15,23,42}
\\geometry{a4paper,top=1.2cm,bottom=1.2cm,left=1.5cm,right=1.5cm}
\\hypersetup{hidelinks,colorlinks=true,urlcolor=accent}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\newcommand{\\cvbullet}[1]{%
  \\hspace{1em}{\\small\\color{dark}$\\bullet$ #1}\\\\[-2pt]
}
\\newcommand{\\cvsection}[1]{%
  \\vspace{6pt}
  {\\large\\bfseries\\color{accent}\\uppercase{#1}}\\\\[-2pt]
  {\\color{accent!40}\\rule{\\linewidth}{0.6pt}}
  \\vspace{2pt}
}
\\begin{document}
\\colorbox{accent}{%
  \\parbox{\\linewidth}{%
    \\vspace{8pt}
    \\centering
    {\\Huge\\bfseries\\color{white}${esc(p.nameEn)}}\\\\[4pt]
    {\\small\\color{white!80}
      ${esc(p.phone)} \\quad $\\cdot$ \\quad
      \\href{mailto:${p.email}}{${esc(p.email)}} \\quad $\\cdot$ \\quad
      \\href{${p.linkedin}}{LinkedIn} \\quad $\\cdot$ \\quad
      \\href{${p.github}}{GitHub}
    }
    \\vspace{6pt}
  }
}
\\cvsection{Education}
${edu}
\\cvsection{Experience}
${exp}
\\cvsection{Projects}
${proj}
\\cvsection{Technical Skills}
\\begin{tabular*}{\\linewidth}{@{}p{3cm}p{\\dimexpr\\linewidth-3cm-2\\tabcolsep}@{}}
  {\\small\\bfseries Languages} & {\\small ${esc(s.languages)}} \\\\[2pt]
  {\\small\\bfseries Frameworks} & {\\small ${esc(s.frameworks)}} \\\\[2pt]
  {\\small\\bfseries Tools} & {\\small ${esc(s.tools)}} \\\\[2pt]
  {\\small\\bfseries Spoken} & {\\small ${esc(s.spoken)}} \\\\
\\end{tabular*}
\\end{document}
`;
}

function parseDateJa(dateStr) {
  if (!dateStr) return { yr: '', mo: '' };
  const s = String(dateStr).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m) return { yr: m[1], mo: String(parseInt(m[2], 10)) };
  m = s.match(/^(\d{4})年\s*(\d{1,2})月/);
  if (m) return { yr: m[1], mo: String(parseInt(m[2], 10)) };
  const monthsMap = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  m = s.match(/^([A-Za-z]+)\s*(\d{4})/);
  if (m && monthsMap[m[1].toLowerCase().substring(0, 3)]) {
    return { yr: m[2], mo: String(monthsMap[m[1].toLowerCase().substring(0, 3)]) };
  }
  m = s.match(/^(\d{4})\s*([A-Za-z]+)/);
  if (m && monthsMap[m[2].toLowerCase().substring(0, 3)]) {
    return { yr: m[1], mo: String(monthsMap[m[2].toLowerCase().substring(0, 3)]) };
  }
  m = s.match(/^(\d{4})/);
  if (m) return { yr: m[1], mo: '' };
  return { yr: s, mo: '' };
}

function formatIsoDateJa(dateStr) {
  const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return escJa(dateStr || '');
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function formatMonthJa(dateStr, { expected = false } = {}) {
  if (!dateStr) return '';
  const value = String(dateStr).trim();
  if (value.toLowerCase() === 'present') return '現在';
  const range = value.match(/^(\d{4})\s*[–—-]\s*(\d{4})$/);
  if (range) return `${range[1]}年 - ${range[2]}年`;
  const parsed = parseDateJa(value);
  if (!/^\d{4}$/.test(parsed.yr)) return escJa(dateStr);
  const month = parsed.mo ? `${Number(parsed.mo)}月` : '';
  return `${parsed.yr}年${month}${expected ? '（卒業予定）' : ''}`;
}

function japaneseBullets(item) {
  return item?.bulletsJa?.length ? item.bulletsJa : (item?.bullets || []);
}

function japaneseQualifications(r) {
  return r.japanese?.qualifications || [];
}

function buildJapaneseTimeline(r) {
  const rows = [];
  if (r.education?.length) {
    rows.push({ det: '\\hfill \\textbf{学\\quad 歴} \\hfill' });
    r.education.forEach((education) => {
      const start = parseDateJa(education.startDate);
      const end = parseDateJa(education.endDate);
      const institution = escJa(education.institutionJa || education.institution);
      const degree = escJa(education.degreeJa || '').replace(/（.*?在学中）/g, '');
      rows.push({ yr: start.yr, mo: start.mo, det: `${institution}${degree ? ` ${degree}` : ''} 入学` });
      rows.push({ yr: end.yr, mo: end.mo, det: `${institution}${degree ? ` ${degree}` : ''} 卒業予定` });
    });
  }

  const japaneseExperience = r.japanese?.experience || r.experience || [];
  if (japaneseExperience.length) {
    rows.push({ det: '\\hfill \\textbf{職\\quad 歴} \\hfill' });
    const events = [];
    let hasCurrentRole = false;
    japaneseExperience.filter((experience) => experience.companyJa || experience.company).forEach((experience) => {
      const company = escJa(experience.companyJa || experience.company);
      const start = parseDateJa(experience.startDate);
      events.push({ yr: start.yr, mo: start.mo, order: 1, det: `${company} 入社` });
      if (String(experience.endDate || '').trim().toLowerCase() === 'present') {
        hasCurrentRole = true;
      } else {
        const end = parseDateJa(experience.endDate);
        if (end.yr) events.push({ yr: end.yr, mo: end.mo, order: 0, det: `${company} 退社` });
      }
    });
    events.sort((a, b) => {
      const keyA = Number(a.yr || 0) * 100 + Number(a.mo || 0);
      const keyB = Number(b.yr || 0) * 100 + Number(b.mo || 0);
      return keyA - keyB || a.order - b.order;
    });
    rows.push(...events);
    if (hasCurrentRole) rows.push({ yr: '', mo: '', det: '現在に至る' });
    rows.push({ yr: '', mo: '', det: '\\hfill 以上' });
  }
  return rows;
}

function japaneseTimelineRows(r, minimumRows = 0) {
  const rows = buildJapaneseTimeline(r);
  while (rows.length < minimumRows) rows.push({ yr: '', mo: '', det: '' });
  return rows.map((row) => `${row.yr || ''} & ${row.mo || ''} & ${row.det} \\\\ \\hline`).join('\n');
}

function japaneseQualificationRows(r, minimumRows = 0) {
  const rows = japaneseQualifications(r).map((qualification) => ({
    yr: qualification.year || '',
    mo: qualification.month || '',
    det: escJa(qualification.name || ''),
  }));
  while (rows.length < minimumRows) rows.push({ yr: '', mo: '', det: '' });
  return rows.map((row) => `${row.yr} & ${row.mo} & ${row.det} \\\\ \\hline`).join('\n');
}

function genJa01(r, options = {}) {
  const p = r.personal;
  const s = r.skills;
  const j = r.japanese || {};
  const js = j.skills || s;

  const dob = formatIsoDateJa(p.dob);
  let age = '  ';
  if (p.dob) {
    const dobDate = new Date(p.dob);
    if (!isNaN(dobDate.getTime())) {
      const diffMs = Date.now() - dobDate.getTime();
      const ageDate = new Date(diffMs);
      age = Math.abs(ageDate.getUTCFullYear() - 1970);
    }
  }

  const timelineRows = japaneseTimelineRows(r, 16);
  const qualRows = japaneseQualificationRows(r, 4);
  const photoBlock = options.photoFile
    ? `\\includegraphics[width=3cm,height=4cm,keepaspectratio]{\\detokenize{${options.photoFile}}}`
    : `\\begin{minipage}[c][4cm][c]{3cm}\\centering\\textcolor{gray}{写\\quad 真}\\\\[3pt]\\small\\textcolor{gray}{縦4cm × 横3cm}\\end{minipage}`;

  return `%====================================================================
% 学校指定 履歴書 — ${escJa(p.nameJa || p.nameEn)}
%====================================================================
\\documentclass[11pt, a4paper]{article}
\\usepackage{fontspec}
\\usepackage{xeCJK}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage[bookmarks=false]{hyperref}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{multirow}
\\usepackage{colortbl}
\\usepackage{graphicx}
\\setCJKmainfont{Hiragino Kaku Gothic ProN W3}[BoldFont={Hiragino Kaku Gothic ProN W6}]
\\setCJKsansfont{Hiragino Kaku Gothic ProN W3}[BoldFont={Hiragino Kaku Gothic ProN W6}]
\\setmainfont{Avenir Next}
\\geometry{a4paper,top=1.1cm,bottom=1.1cm,left=1.35cm,right=1.35cm}
\\hypersetup{hidelinks}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\renewcommand{\\arraystretch}{1.18}

\\definecolor{gridcolor}{RGB}{180, 195, 210}      % Beautiful soft slate blue for grid
\\definecolor{bannercolor}{RGB}{240, 244, 248}    % Soft background color for section headers

\\arrayrulecolor{gridcolor}

\\begin{document}
% --- PAGE 1 ---
\\begin{center}
  {\\Large\\bfseries\\textcolor{darkgray}{学 校 指 定 \\quad 履 歴 書}}\\\\[4pt]
  \\hfill {\\small\\textcolor{gray}{${formatIsoDateJa(j.asOfDate || new Date().toISOString().slice(0, 10))} 現在}}
\\end{center}

\\vspace{5pt}
\\begin{tabularx}{\\linewidth}{|p{2.55cm}|X|p{3.2cm}|}
\\hline
\\rowcolor{bannercolor}
\\rule{0pt}{1.02cm}\\textbf{ふりがな} & ${escJa(p.furigana)} & \\multirow{3}{*}{\\centering ${photoBlock}} \\\\ \\cline{1-2}
\\rule{0pt}{1.52cm}\\textbf{氏名} & {\\Large \\textbf{${escJa(p.nameJa || p.nameEn)}}} & \\\\ \\cline{1-2}
\\rule{0pt}{1.02cm}\\textbf{生年月日} & ${dob} \\quad （満 ${age} 歳） & \\\\ \\hline
\\rowcolor{bannercolor}
\\textbf{現住所} & \\multicolumn{2}{l|}{${escJa(p.address)}} \\\\ \\hline
\\textbf{連絡先} & \\multicolumn{2}{l|}{Tel: ${esc(p.phone)} \\quad Email: \\href{mailto:${p.email}}{${esc(p.email)}}} \\\\ \\hline
\\end{tabularx}

\\vspace{10pt}
\\begin{tabularx}{\\linewidth}{|p{1.8cm}|p{1.0cm}|X|}
\\hline
\\rowcolor{bannercolor}
\\multicolumn{1}{|c|}{\\textbf{年}} & \\multicolumn{1}{c|}{\\textbf{月}} & \\multicolumn{1}{c|}{\\textbf{学歴・職歴}} \\\\ \\hline
${timelineRows}
\\end{tabularx}

\\newpage

% --- PAGE 2 ---
\\begin{center}
  {\\Large\\bfseries\\textcolor{darkgray}{学 校 指 定 \\quad 履 歴 書 \\quad (2/2)}}
\\end{center}
\\vspace{10pt}

\\begin{tabularx}{\\linewidth}{|p{1.8cm}|p{1.0cm}|X|}
\\hline
\\rowcolor{bannercolor}
\\multicolumn{1}{|c|}{\\textbf{年}} & \\multicolumn{1}{c|}{\\textbf{月}} & \\multicolumn{1}{c|}{\\textbf{免許・資格}} \\\\ \\hline
${qualRows}
\\end{tabularx}

\\vspace{10pt}
\\begin{tabularx}{\\linewidth}{|X|}
\\hline
\\rowcolor{bannercolor} \\textbf{学業・ゼミ・研究分野} \\\\ \\hline
\\parbox[t][4.5cm][t]{\\dimexpr\\linewidth-2\\tabcolsep}{
  \\vspace{6pt}
  \\fontsize{9.5}{14.5}\\selectfont ${escJa(j.academicFocus || j.summary || r.summary || '')}
} \\\\ \\hline
\\end{tabularx}

\\vspace{10pt}
\\begin{tabularx}{\\linewidth}{|X|}
\\hline
\\rowcolor{bannercolor} \\textbf{自己PR・学生時代に力を入れたこと（ガクチカ）} \\\\ \\hline
\\parbox[t][8.5cm][t]{\\dimexpr\\linewidth-2\\tabcolsep}{
  \\vspace{6pt}
  \\fontsize{9.5}{14.5}\\selectfont
  ${escJa(j.selfPr || j.summary || r.summary || '')}

  \\vspace{8pt}
  \\textbf{技術スキル:} ${escJa(js.languages)}
  \\\\ \\textbf{フレームワーク:} ${escJa(js.frameworks)}
  \\\\ \\textbf{開発環境・基盤:} ${escJa(js.tools)}
} \\\\ \\hline
\\end{tabularx}

\\end{document}
`;
}

function genJa02(r) {
  const p = r.personal;
  const s = r.skills;
  const j = r.japanese || {};
  const js = j.skills || s;
  const edu = r.education?.[0] || {};
  const projects = (r.projects || []).slice(0, 4).map(project => `
\\textbf{${escJa(project.title)}} \\hfill {\\footnotesize ${escJa(project.year || '')}}\\\\
{\\footnotesize\\textcolor{textmuted}{${escJa(project.tech || '')}}}\\\\[-2pt]
\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=1pt]
  ${japaneseBullets(project).slice(0, 2).map(b => `\\item ${escJa(b)}`).join('\n  ')}
\\end{itemize}`).join('\n\\vspace{2pt}\n');
  const experiences = (j.experience || r.experience || []).slice(0, 3).map(exp => `
\\textbf{${escJa(exp.companyJa || exp.company)}} \\hfill {\\footnotesize ${formatMonthJa(exp.startDate)} -- ${formatMonthJa(exp.endDate)}}\\\\
{\\footnotesize\\textcolor{textmuted}{${escJa(exp.roleJa || exp.role || '')}}}\\\\[-2pt]
\\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=1pt]
  ${japaneseBullets(exp).slice(0, 1).map(b => `\\item ${escJa(b)}`).join('\n  ')}
\\end{itemize}`).join('\n\\vspace{2pt}\n');
  const qualifications = japaneseQualifications(r).slice(0, 4).map(q => `${escJa(q.year || '')}年${escJa(q.month || '')}月 ${escJa(q.name || '')}`).join(' \\\\ ');

  return `%====================================================================
% インターン応募シート — ${escJa(p.nameJa || p.nameEn)}
%====================================================================
\\documentclass[10pt, a4paper]{article}
\\usepackage{fontspec}
\\usepackage{xeCJK}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage[bookmarks=false]{hyperref}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{enumitem}
\\setCJKmainfont{Hiragino Kaku Gothic ProN W3}[BoldFont={Hiragino Kaku Gothic ProN W6}]
\\setCJKsansfont{Hiragino Kaku Gothic ProN W3}[BoldFont={Hiragino Kaku Gothic ProN W6}]
\\setmainfont{Avenir Next}
\\geometry{a4paper,top=1.15cm,bottom=1.15cm,left=1.35cm,right=1.35cm}
\\hypersetup{hidelinks,colorlinks=true,urlcolor=accent}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\definecolor{accent}{RGB}{0, 92, 185}
\\definecolor{accentsoft}{RGB}{232, 242, 255}
\\definecolor{textmuted}{RGB}{80, 93, 112}
\\definecolor{line}{RGB}{210, 222, 238}
\\newcommand{\\sectionblock}[1]{\\vspace{7pt}{\\large\\bfseries\\textcolor{accent}{#1}}\\vspace{2pt}{\\color{accent}\\hrule height 0.6pt}\\vspace{6pt}}

\\begin{document}
\\begin{tabularx}{\\linewidth}{@{}X r@{}}
  {\\fontsize{24}{28}\\selectfont\\bfseries ${escJa(p.nameJa || p.nameEn)}} & {\\small ${formatIsoDateJa(j.asOfDate || new Date().toISOString().slice(0, 10))} 現在}\\\\
  {\\large\\textcolor{accent}{インターン応募シート}} & {\\small ${esc(p.email)} / ${esc(p.phone)}}\\\\
  {\\footnotesize ${escJa(p.furigana || '')}} & {\\small GitHub: ${esc(p.github || '')}}
\\end{tabularx}

\\vspace{8pt}
\\fcolorbox{line}{accentsoft}{\\begin{minipage}{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule}
\\vspace{6pt}
\\textbf{応募ポジション:} ソフトウェアエンジニア / フロントエンド / フルスタック / AIプロダクト\\\\[4pt]
\\textbf{在籍:} ${escJa(edu.institutionJa || edu.institution || '')} ${escJa(edu.degreeJa || edu.degree || '')} \\hfill
\\textbf{卒業予定:} ${formatMonthJa(edu.endDate)}
\\vspace{6pt}
\\end{minipage}}

\\sectionblock{自己紹介・応募動機}
{\\fontsize{9.5}{14}\\selectfont ${escJa(j.summary || r.summaryJa || r.summary || '')}}

\\sectionblock{技術スタック}
\\textbf{言語:} ${escJa(js.languages || '')}\\\\[2pt]
\\textbf{フレームワーク:} ${escJa(js.frameworks || '')}\\\\[2pt]
\\textbf{開発基盤:} ${escJa(js.tools || '')}

\\sectionblock{開発実績・プロジェクト}
${projects}

\\sectionblock{職務経験・コミュニケーション}
${experiences}

\\sectionblock{資格・語学}
${qualifications || escJa(js.spoken || s.spoken || '')}

\\end{document}
`;
}

function genJa03(r) {
  const p = r.personal;
  const s = r.skills;
  const j = r.japanese || {};
  const js = j.skills || s;

  const expList = (j.experience || r.experience || []).filter(e => e.companyJa || e.company).map(e => `
    \\noindent
    \\begin{minipage}[t]{\\linewidth}
      \\textbf{\\fontsize{9.5}{11.5}\\selectfont ${escJa(e.companyJa || e.company)}}\\hfill\\textcolor{bodycolor}{\\fontsize{8}{10}\\selectfont ${formatMonthJa(e.startDate)} -- ${formatMonthJa(e.endDate)}}\\par\\vspace{2pt}
      \\textcolor{bodycolor}{\\fontsize{8.5}{11}\\selectfont ${escJa(e.roleJa || e.role)}}\\par\\vspace{2pt}` +
      (japaneseBullets(e).length > 0 ? `
      \\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=1pt, parsep=0pt]
        \\fontsize{8.2}{11.5}\\selectfont
        ${japaneseBullets(e).slice(0, 1).map(b => `\\item ${escJa(b)}`).join('\n        ')}
      \\end{itemize}` : '') + `
    \\end{minipage}
    \\vspace{6pt}`).join('\n');

  const projList = r.projects.map(p2 => `
    \\noindent
    \\begin{minipage}[t]{\\linewidth}
      \\textbf{\\fontsize{9.5}{11.5}\\selectfont ${escJa(p2.title)}}\\hfill\\textcolor{bodycolor}{\\fontsize{8}{10}\\selectfont ${formatMonthJa(p2.year)}}\\par\\vspace{2pt}
      \\textcolor{bodycolor}{\\fontsize{8}{10}\\selectfont ${escJa(p2.tech)}}\\par\\vspace{2pt}` +
      (japaneseBullets(p2).length > 0 ? `
      \\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=1pt, parsep=0pt]
        \\fontsize{8.2}{11.5}\\selectfont
        ${japaneseBullets(p2).slice(0, 1).map(b => `\\item ${escJa(b)}`).join('\n        ')}
      \\end{itemize}` : '') + `
    \\end{minipage}
    \\vspace{5pt}`).join('\n');

  const actList = r.activities.map(a => `
    \\noindent
    \\begin{minipage}[t]{\\linewidth}
      \\textbf{\\fontsize{9.5}{11.5}\\selectfont ${escJa(a.titleJa || a.title)}}\\hfill\\textcolor{bodycolor}{\\fontsize{8}{10}\\selectfont ${formatMonthJa(a.startDate)} -- ${formatMonthJa(a.endDate)}}\\par\\vspace{2pt}
      \\textcolor{bodycolor}{\\fontsize{8.5}{11}\\selectfont ${escJa(a.orgJa || a.org)}}\\par\\vspace{2pt}` +
      (japaneseBullets(a).length > 0 ? `
      \\begin{itemize}[leftmargin=1.2em, itemsep=1pt, topsep=1pt, parsep=0pt]
        \\fontsize{8.2}{11.5}\\selectfont
        ${japaneseBullets(a).slice(0, 1).map(b => `\\item ${escJa(b)}`).join('\n        ')}
      \\end{itemize}` : '') + `
    \\end{minipage}
    \\vspace{6pt}`).join('\n');

  return `%======================================================================
% 新卒・インターン 職務経歴書 — ${escJa(p.nameJa || p.nameEn)}
%======================================================================
\\documentclass[9.5pt, a4paper]{article}
\\usepackage{fontspec}
\\usepackage{xeCJK}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage[bookmarks=false]{hyperref}
\\usepackage{enumitem}
\\usepackage{tabularx}
\\usepackage{array}

\\setCJKmainfont{Hiragino Kaku Gothic ProN W3}[BoldFont={Hiragino Kaku Gothic ProN W6}]
\\setCJKsansfont{Hiragino Kaku Gothic ProN W3}[BoldFont={Hiragino Kaku Gothic ProN W6}]
\\setmainfont{Avenir Next}

\\definecolor{darksidebar}{RGB}{15, 23, 42}      % Midnight Slate 900 left sidebar background
\\definecolor{lightgray}{RGB}{241, 245, 249}     % Light gray text in sidebar
\\definecolor{leftaccent}{RGB}{56, 189, 248}     % Beautiful sky blue accent
\\definecolor{sectioncolor}{RGB}{30, 80, 160}     % Right column section header (deep blue)
\\definecolor{bodycolor}{RGB}{51, 65, 85}         % Slate 700 body text

\\geometry{a4paper, top=0.8cm, bottom=0.8cm, left=1.2cm, right=1.2cm}
\\hypersetup{hidelinks, colorlinks=true, urlcolor=sectioncolor}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\fboxsep}{0pt}
\\setlength{\\fboxrule}{0pt}

\\newcommand{\\leftsection}[1]{%
  \\vspace{10pt}
  {\\fontsize{10.5}{12.5}\\selectfont\\textcolor{leftaccent}{\\textbf{#1}}}\\par
  \\vspace{3pt}
  {\\color{lightgray}\\hrule height 0.5pt}\\par
  \\vspace{6pt}
}

\\newcommand{\\rightsection}[1]{%
  \\vspace{10pt}
  {\\fontsize{11.5}{13.5}\\selectfont\\textcolor{sectioncolor}{\\textbf{#1}}}\\par
  \\vspace{3pt}
  {\\color{sectioncolor}\\hrule height 1.2pt}\\par
  \\vspace{6pt}
}

\\begin{document}
\\noindent
\\colorbox{darksidebar}{%
  \\begin{minipage}[t][0.96\\textheight][t]{0.34\\textwidth}
    \\centering
    \\vspace*{12pt}
    \\begin{minipage}[t]{0.88\\textwidth}
      \\color{white}
      {\\fontsize{18}{22}\\selectfont\\textbf{${esc(j.nameEn || p.nameEn)}}}\\\\
      \\vspace{4pt}
      {\\fontsize{10.5}{13.5}\\selectfont\\textcolor{leftaccent}{\\textbf{${escJa(p.nameJa || p.nameEn)}}}}\\\\
      \\vspace{3pt}
      {\\fontsize{9}{12}\\selectfont\\textcolor{lightgray}{${escJa(p.furigana)}}}
      
      \\vspace{8pt}
      \\leftsection{連絡先}
      {\\fontsize{8.5}{12}\\selectfont
      \\textcolor{leftaccent}{\\textbf{住所:}} \\textcolor{lightgray}{${escJa(p.address)}}\\\\
      \\vspace{3pt}
      \\textcolor{leftaccent}{\\textbf{電話:}} \\textcolor{lightgray}{${esc(p.phone)}}\\\\
      \\vspace{3pt}
      \\textcolor{leftaccent}{\\textbf{メール:}} \\href{mailto:${p.email}}{\\color{white}${esc(p.email)}}\\\\
      \\vspace{3pt}
      \\textcolor{leftaccent}{\\textbf{GitHub:}} \\href{${p.github}}{\\color{white}github.com/${esc(p.github.replace(/https?:\/\/(www\.)?github\.com\//, ''))}}\\\\
      \\vspace{3pt}
      \\textcolor{leftaccent}{\\textbf{LinkedIn:}} \\href{${p.linkedin}}{\\color{white}${esc((p.linkedin || '').replace(/^https?:\/\/(www\.)?linkedin\.com\//, 'linkedin.com/'))}}
      }

      \\leftsection{学歴}
      {\\fontsize{8.5}{12.5}\\selectfont
      \\textbf{${escJa(r.education[0]?.institutionJa || r.education[0]?.institution || '')}}\\\\
      \\vspace{2pt}
      ${escJa(r.education[0]?.degreeJa || r.education[0]?.degree || '')}\\\\
      \\vspace{2pt}
      \\textcolor{lightgray}{${formatMonthJa(r.education[0]?.startDate || '')} -- ${formatMonthJa(r.education[0]?.endDate || '', { expected: true })}}
      }

      \\leftsection{技術スキル}
      {\\fontsize{8.2}{11.5}\\selectfont
      \\textcolor{leftaccent}{\\textbf{プログラミング言語}}\\\\
      \\vspace{1pt}
      \\textcolor{lightgray}{${escJa(js.languages)}}\\\\
      \\vspace{4pt}
      \\textcolor{leftaccent}{\\textbf{フレームワーク}}\\\\
      \\vspace{1pt}
      \\textcolor{lightgray}{${escJa(js.frameworks)}}\\\\
      \\vspace{4pt}
      \\textcolor{leftaccent}{\\textbf{ツール・開発環境}}\\\\
      \\vspace{1pt}
      \\textcolor{lightgray}{${escJa(js.tools)}}
      }

      \\leftsection{語学}
      {\\fontsize{8.5}{12}\\selectfont
      \\textcolor{lightgray}{${(j.languages || [s.spoken || '日本語能力試験 N2']).map((language) => escJa(language)).join('\\\\\n      \\vspace{2pt}\n      ')}}
      }
    \\end{minipage}
  \\end{minipage}%
}%
\\hfill
\\begin{minipage}[t][0.96\\textheight][t]{0.63\\textwidth}
  \\vspace*{12pt}
  \\begin{minipage}[t]{\\linewidth}
    \\color{bodycolor}
    
    \\rightsection{自己紹介}
    {\\fontsize{9}{13}\\selectfont
    ${escJa(j.summary || r.summary || '')}
    }
    
    \\vspace{6pt}
    \\rightsection{開発実績・プロジェクト}
    ${projList}
    
    \\vspace{6pt}
    \\rightsection{課外活動・職務経歴}
    ${expList}

    \\vspace{6pt}
    \\rightsection{活動・資格}
    ${actList}
  \\end{minipage}
\\end{minipage}
\\end{document}
`;
}

// ── Dispatch ──────────────────────────────────────────────────────
export function generateLatex(template, resume, options = {}) {
  switch (template) {
    case 'en_01': return genEn01(resume);
    case 'en_02': return genEn02(resume);
    case 'en_03': return genEn03(resume);
    case 'en_04': return genEn04(resume);
    case 'ja_01': return genJa01(resume, options);
    case 'ja_02': return genJa02(resume);
    case 'ja_03': return genJa03(resume);
    default: throw new Error(`Unknown template: ${template}`);
  }
}
