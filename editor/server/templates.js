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
  // Note: Jake's-clean is a photoless single-column layout, so `options.photoFile`
  // is intentionally unused here; the parameter is kept so the dispatch signature
  // (generateLatex → genJa01(resume, options)) stays intact.
  const p = r.personal;
  const s = r.skills;
  const j = r.japanese || {};
  const js = j.skills || s;

  const dateRange = (start, end) => {
    const startJa = formatMonthJa(start);
    const expected = /expected|予定/i.test(String(end || ''));
    const endJa = formatMonthJa(end, { expected });
    if (startJa && endJa) return `${startJa} -- ${endJa}`;
    return startJa || endJa || '';
  };

  const edu = (r.education || []).filter(e => e.institutionJa || e.institution).map(e => {
    const bullets = japaneseBullets(e);
    return `
    \\resumeSubheading
      {${escJa(e.institutionJa || e.institution)}}{${escJa(e.location || '')}}
      {${escJa(e.degreeJa || e.degree || '')}}{${dateRange(e.startDate, e.endDate)}}` +
      (bullets.length > 0 ? `
      \\resumeItemListStart
        ${bullets.map(b => `\\resumeItem{${escJa(b)}}`).join('\n        ')}
      \\resumeItemListEnd` : '');
  }).join('\n');

  const exp = (j.experience || r.experience || []).filter(e => e.companyJa || e.company).map(e => {
    const bullets = japaneseBullets(e);
    return `
    \\resumeSubheading
      {${escJa(e.companyJa || e.company)}}{${dateRange(e.startDate, e.endDate)}}
      {${escJa(e.roleJa || e.role || '')}}{}` +
      (bullets.length > 0 ? `
      \\resumeItemListStart
        ${bullets.map(b => `\\resumeItem{${escJa(b)}}`).join('\n        ')}
      \\resumeItemListEnd` : '');
  }).join('\n');

  const proj = (r.projects || []).filter(pr => pr.title).map(pr => {
    const bullets = japaneseBullets(pr);
    return `
      \\resumeProjectHeading
          {\\textbf{${escJa(pr.title)}} $|$ \\emph{${esc(pr.tech || '')}}}{${escJa(pr.year || '')}}` +
      (bullets.length > 0 ? `
          \\resumeItemListStart
            ${bullets.map(b => `\\resumeItem{${escJa(b)}}`).join('\n            ')}
          \\resumeItemListEnd` : '');
  }).join('\n');

  const acts = (r.activities || []).filter(a => a.titleJa || a.title).map(a => {
    const bullets = japaneseBullets(a);
    return `
    \\resumeSubheading
      {${escJa(a.titleJa || a.title)}}{}
      {${escJa(a.orgJa || a.org || '')}}{${dateRange(a.startDate, a.endDate)}}` +
      (bullets.length > 0 ? `
      \\resumeItemListStart
        ${bullets.map(b => `\\resumeItem{${escJa(b)}}`).join('\n        ')}
      \\resumeItemListEnd` : '');
  }).join('\n');

  const langText = (j.languages && j.languages.length ? j.languages : [s.spoken || '']).filter(Boolean).map(escJa).join('　／　');
  const concepts = escJa(js.concepts || s.concepts || '');
  const skillRows = [
    `\\textbf{言語}{：${escJa(js.languages || '')}}`,
    `\\textbf{フレームワーク・ライブラリ}{：${escJa(js.frameworks || '')}}`,
    `\\textbf{ツール・データベース}{：${escJa(js.tools || '')}}`,
  ];
  if (concepts) skillRows.push(`\\textbf{専門知識}{：${concepts}}`);
  if (langText) skillRows.push(`\\textbf{語学}{：${langText}}`);

  return `%========================
% Jake's Clean (JA) — ${escJa(p.nameJa || p.nameEn)}
%========================
\\documentclass[a4paper,11pt]{article}
\\usepackage{fontspec}
\\usepackage{xeCJK}
\\usepackage{geometry}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage[hidelinks,bookmarks=false]{hyperref}
\\usepackage{tabularx}
% Refined Jake's-clean JA (Phase 6): Mincho body for an elegant read, Gothic for
% headings + the name, and a monotone (grayscale) palette — no accent color.
\\setCJKmainfont{Hiragino Mincho ProN}[BoldFont={Hiragino Mincho ProN W6}]
\\setCJKsansfont{Hiragino Kaku Gothic ProN W3}[BoldFont={Hiragino Kaku Gothic ProN W6}]
\\newCJKfontfamily\\gothicfont{Hiragino Kaku Gothic ProN W6}
\\setmainfont{Avenir Next}
\\geometry{a4paper,top=1.2cm,bottom=1.2cm,left=1.5cm,right=1.5cm}
\\hypersetup{hidelinks}
\\pagestyle{empty}
\\definecolor{subtle}{gray}{0.35}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\parindent}{0pt}
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{\\vspace{-2pt}\\large\\bfseries\\gothicfont\\raggedright}{}{0em}{}[\\color{black}\\titlerule \\vspace{-4pt}]
\\newcommand{\\resumeItem}[1]{\\item\\small{#1}}
\\newcommand{\\resumeSubheading}[4]{%
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & {\\small #2} \\\\
      {\\small\\color{subtle} #3} & {\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}
\\newcommand{\\resumeProjectHeading}[2]{%
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & {\\small #2} \\\\
    \\end{tabular*}\\vspace{-5pt}
}
\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}, topsep=3pt]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=1.3em, itemsep=1.5pt, topsep=2pt, parsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-4pt}}
\\begin{document}
\\begin{center}
    {\\small ${escJa(p.furigana || '')}}\\\\[2pt]
    {\\Huge\\bfseries\\gothicfont ${escJa(p.nameJa || p.nameEn)}}\\\\[5pt]
    \\small
    Tel: ${esc(p.phone)} $|$
    \\href{mailto:${p.email}}{\\underline{${esc(p.email)}}} $|$
    \\href{${p.linkedin}}{\\underline{LinkedIn}} $|$
    \\href{${p.github}}{\\underline{GitHub}}
\\end{center}` +
(edu ? `
\\section{学歴}
  \\resumeSubHeadingListStart
    ${edu}
  \\resumeSubHeadingListEnd` : '') +
(exp ? `
\\section{職歴}
  \\resumeSubHeadingListStart
    ${exp}
  \\resumeSubHeadingListEnd` : '') +
(proj ? `
\\section{開発実績・プロジェクト}
    \\resumeSubHeadingListStart
      ${proj}
    \\resumeSubHeadingListEnd` : '') + `
\\section{技術スキル}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
     ${skillRows.join(' \\\\\n     ')}
    }}
 \\end{itemize}` +
(acts ? `
\\section{課外活動}
  \\resumeSubHeadingListStart
    ${acts}
  \\resumeSubHeadingListEnd` : '') + `
\\end{document}
`;
}

function genJa02(r) {
  const p = r.personal;
  const s = r.skills;
  const j = r.japanese || {};
  const js = j.skills || s;
  const edu = r.education?.[0] || {};
  const asOf = formatIsoDateJa(j.asOfDate || new Date().toISOString().slice(0, 10));
  const githubHandle = (p.github || '').replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '');

  const projects = (r.projects || []).slice(0, 4).map(project => `
\\noindent{\\bfseries ${escJa(project.title)}}\\hfill{\\footnotesize\\textcolor{textmuted}{${escJa(project.year || '')}}}\\\\[2pt]
{\\footnotesize\\textcolor{accent}{${escJa(project.tech || '')}}}
\\begin{itemize}[leftmargin=1.3em, itemsep=2pt, topsep=3pt, parsep=0pt]
\\fontsize{9}{12.6}\\selectfont
  ${japaneseBullets(project).slice(0, 2).map(b => `\\item ${escJa(b)}`).join('\n  ')}
\\end{itemize}`).join('\n\\vspace{4pt}\n');

  const experiences = (j.experience || r.experience || []).filter(e => e.companyJa || e.company).slice(0, 3).map(exp => `
\\noindent{\\bfseries ${escJa(exp.companyJa || exp.company)}}\\hfill{\\footnotesize\\textcolor{textmuted}{${formatMonthJa(exp.startDate)} － ${formatMonthJa(exp.endDate)}}}\\\\[2pt]
{\\footnotesize\\textcolor{accent}{${escJa(exp.roleJa || exp.role || '')}}}
\\begin{itemize}[leftmargin=1.3em, itemsep=2pt, topsep=3pt, parsep=0pt]
\\fontsize{9}{12.6}\\selectfont
  ${japaneseBullets(exp).slice(0, 1).map(b => `\\item ${escJa(b)}`).join('\n  ')}
\\end{itemize}`).join('\n\\vspace{4pt}\n');

  const qualText = japaneseQualifications(r).slice(0, 4).map(q => `${escJa(q.year || '')}年${escJa(q.month || '')}月　${escJa(q.name || '')}`).join('　／　');
  const langText = (j.languages && j.languages.length ? j.languages : [js.spoken || s.spoken || '']).map(escJa).join('　／　');

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
\\geometry{a4paper,top=1.05cm,bottom=1.05cm,left=1.1cm,right=1.1cm}
\\hypersetup{hidelinks,colorlinks=true,urlcolor=accent}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\definecolor{accent}{RGB}{17, 70, 150}          % Deep corporate blue
\\definecolor{accentsoft}{RGB}{236, 242, 251}     % Soft panel fill
\\definecolor{ink}{RGB}{26, 32, 44}               % Near-black headline ink
\\definecolor{textmuted}{RGB}{96, 108, 126}       % Muted secondary text
\\definecolor{line}{RGB}{205, 216, 232}           % Hairline rules

\\newcommand{\\jasec}[1]{%
  \\par\\vspace{6.5pt}%
  \\noindent{\\color{accent}\\rule[-0.16em]{3.4pt}{1.04em}}\\hspace{7pt}{\\large\\bfseries\\textcolor{ink}{#1}}\\par
  \\vspace{3pt}{\\color{line}\\hrule height 0.6pt}\\par\\vspace{5pt}%
}

\\begin{document}
% ---------------- Header ----------------
\\noindent
\\begin{minipage}[b]{0.62\\linewidth}
  {\\footnotesize\\textcolor{textmuted}{${escJa(p.furigana || '')}}}\\\\[3pt]
  {\\fontsize{21}{25}\\selectfont\\bfseries\\textcolor{ink}{${escJa(p.nameJa || p.nameEn)}}}\\\\[4pt]
  {\\textcolor{accent}{\\bfseries インターン応募シート}}\\,{\\footnotesize\\textcolor{textmuted}{／ Application Sheet}}
\\end{minipage}\\hfill
\\begin{minipage}[b]{0.36\\linewidth}
  {\\raggedleft\\footnotesize\\color{textmuted}
  ${asOf}　現在\\\\[3pt]
  E-mail：${esc(p.email)}\\\\[3pt]
  TEL：${esc(p.phone)}\\\\[3pt]
  GitHub：${esc(githubHandle)}\\par}
\\end{minipage}\\\\[4pt]
{\\color{accent}\\hrule height 1.3pt}

\\vspace{7pt}
\\noindent\\fcolorbox{line}{accentsoft}{\\begin{minipage}{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}
\\vspace{4pt}
\\hspace{3pt}{\\bfseries\\textcolor{accent}{応募職種}}\\hspace{8pt}ソフトウェアエンジニア（フロントエンド／フルスタック／AIプロダクト）\\\\[5pt]
\\hspace{3pt}{\\bfseries\\textcolor{accent}{在籍}}\\hspace{20pt}${escJa(edu.institutionJa || edu.institution || '')}　${escJa(edu.degreeJa || edu.degree || '')}\\\\[5pt]
\\hspace{3pt}{\\bfseries\\textcolor{accent}{卒業予定}}\\hspace{8pt}${formatMonthJa(edu.endDate)}
\\vspace{4pt}
\\end{minipage}}

\\jasec{自己紹介・応募動機}
{\\fontsize{9}{13.2}\\selectfont ${escJa(j.summary || r.summaryJa || r.summary || '')}\\par}

\\jasec{技術スタック}
\\begin{tabularx}{\\linewidth}{@{}>{\\bfseries\\color{ink}}p{3.4cm} X@{}}
言語 & ${escJa(js.languages || '')}\\\\[4pt]
フレームワーク & ${escJa(js.frameworks || '')}\\\\[4pt]
開発基盤・ツール & ${escJa(js.tools || '')}\\\\
\\end{tabularx}

\\jasec{開発実績・プロジェクト}
${projects}

\\jasec{職務経験・コミュニケーション}
${experiences}

\\jasec{資格・語学}
\\begin{tabularx}{\\linewidth}{@{}>{\\bfseries\\color{ink}}p{3.4cm} X@{}}
資格 & ${qualText || '—'}\\\\[4pt]
語学 & ${langText}\\\\
\\end{tabularx}

\\end{document}
`;
}

function genJa03(r) {
  const p = r.personal;
  const s = r.skills;
  const j = r.japanese || {};
  const js = j.skills || s;
  const edu0 = r.education?.[0] || {};
  const githubHandle = (p.github || '').replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '');
  const linkedinHandle = (p.linkedin || '').replace(/^https?:\/\/(www\.)?linkedin\.com\/(in\/)?/, '').replace(/\/$/, '');

  const rightEntry = (title, meta, sub, bullets) => `
    \\noindent\\begin{minipage}[t]{\\linewidth}
      {\\fontsize{10}{12.5}\\selectfont\\bfseries\\textcolor{titleink}{${title}}}\\hfill{\\fontsize{8.2}{10}\\selectfont\\textcolor{metacolor}{${meta}}}\\par\\vspace{2pt}
      {\\fontsize{8.5}{11}\\selectfont\\textcolor{accentink}{${sub}}}\\par` +
    (bullets.length > 0 ? `\\vspace{2.5pt}
      \\begin{itemize}[leftmargin=1.25em, itemsep=2pt, topsep=1.5pt, parsep=0pt]
        \\fontsize{8.7}{12.6}\\selectfont\\color{bodycolor}
        ${bullets.map(b => `\\item ${escJa(b)}`).join('\n        ')}
      \\end{itemize}` : '\\vspace{1pt}') + `
    \\end{minipage}\\par\\vspace{8pt}`;

  const projList = r.projects.map(p2 =>
    rightEntry(escJa(p2.title), formatMonthJa(p2.year), escJa(p2.tech), japaneseBullets(p2).slice(0, 2))
  ).join('\n');

  const expList = (j.experience || r.experience || []).filter(e => e.companyJa || e.company).map(e =>
    rightEntry(escJa(e.companyJa || e.company), `${formatMonthJa(e.startDate)} － ${formatMonthJa(e.endDate)}`, escJa(e.roleJa || e.role || ''), japaneseBullets(e).slice(0, 1))
  ).join('\n');

  const actList = r.activities.map(a =>
    rightEntry(escJa(a.titleJa || a.title), `${formatMonthJa(a.startDate)} － ${formatMonthJa(a.endDate)}`, escJa(a.orgJa || a.org || ''), japaneseBullets(a).slice(0, 1))
  ).join('\n');

  const qualList = japaneseQualifications(r).map(q => `${escJa(q.year || '')}年${escJa(q.month || '')}月　${escJa(q.name || '')}`);

  const langList = (j.languages && j.languages.length ? j.languages : [s.spoken || '日本語能力試験 N2']).map(escJa);

  return `%======================================================================
% 新卒・インターン 職務経歴書 — ${escJa(p.nameJa || p.nameEn)}
%======================================================================
\\documentclass[10pt, a4paper]{article}
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

\\definecolor{darksidebar}{RGB}{17, 24, 39}       % Deep slate sidebar
\\definecolor{sidebarsoft}{RGB}{148, 163, 184}    % Muted text in sidebar
\\definecolor{lightgray}{RGB}{226, 232, 240}      % Primary sidebar text
\\definecolor{leftaccent}{RGB}{56, 189, 248}      % Sky-blue accent
\\definecolor{sectioncolor}{RGB}{23, 64, 130}     % Right section header (deep blue)
\\definecolor{rulesoft}{RGB}{206, 216, 230}       % Soft right-column rule
\\definecolor{titleink}{RGB}{24, 33, 50}          % Right entry titles
\\definecolor{accentink}{RGB}{37, 99, 170}        % Right entry sub-line
\\definecolor{metacolor}{RGB}{120, 132, 150}      % Dates / meta
\\definecolor{bodycolor}{RGB}{55, 67, 87}         % Body text

\\geometry{a4paper, top=0cm, bottom=0cm, left=0cm, right=0cm}
\\hypersetup{hidelinks, colorlinks=true, urlcolor=white}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\setlength{\\topskip}{0pt}
\\setlength{\\fboxsep}{0pt}
\\setlength{\\fboxrule}{0pt}

\\newcommand{\\leftsection}[1]{%
  \\vspace{13pt}
  {\\fontsize{10}{12}\\selectfont\\textcolor{leftaccent}{\\textbf{#1}}}\\par
  \\vspace{4pt}{\\color{sidebarsoft}\\hrule height 0.4pt}\\par\\vspace{7pt}%
}
\\newcommand{\\sideitem}[2]{%
  {\\fontsize{8.4}{11}\\selectfont\\textcolor{leftaccent}{\\textbf{#1}}\\par\\vspace{1pt}{\\color{lightgray}\\raggedright #2\\par}}\\vspace{5pt}%
}
\\newcommand{\\rightsection}[1]{%
  \\vspace{13pt}
  {\\fontsize{12}{14}\\selectfont\\textcolor{sectioncolor}{\\textbf{#1}}}\\par
  \\vspace{3pt}{\\color{sectioncolor}\\hrule height 1.4pt}\\par
  \\vspace{0.4pt}{\\color{rulesoft}\\hrule height 0.4pt}\\par\\vspace{8pt}%
}

\\begin{document}
\\noindent
% ---------------- Dark sidebar ----------------
\\colorbox{darksidebar}{%
  \\begin{minipage}[t][\\paperheight][t]{0.30\\paperwidth}
    \\hspace{0.85cm}\\begin{minipage}[t]{\\dimexpr0.30\\paperwidth-1.6cm\\relax}
      \\vspace*{1.25cm}
      {\\fontsize{19}{23}\\selectfont\\textbf{\\textcolor{white}{${esc(j.nameEn || p.nameEn)}}}}\\par\\vspace{4pt}
      {\\fontsize{11}{14}\\selectfont\\textcolor{leftaccent}{\\textbf{${escJa(p.nameJa || p.nameEn)}}}}\\par\\vspace{2pt}
      {\\fontsize{8.5}{11}\\selectfont\\textcolor{sidebarsoft}{${escJa(p.furigana)}}}\\par\\vspace{6pt}
      {\\fontsize{8.5}{11}\\selectfont\\textcolor{sidebarsoft}{ソフトウェアエンジニア志望}}\\par
      \\vspace{9pt}{\\color{leftaccent}\\hrule height 1.2pt}

      \\leftsection{連絡先}
      \\sideitem{住所}{${escJa(p.address)}}
      \\sideitem{電話}{${esc(p.phone)}}
      \\sideitem{E-mail}{\\href{mailto:${p.email}}{\\textcolor{lightgray}{${esc(p.email)}}}}
      \\sideitem{GitHub}{\\href{${p.github}}{\\textcolor{lightgray}{github.com/${esc(githubHandle)}}}}
      \\sideitem{LinkedIn}{\\href{${p.linkedin}}{\\textcolor{lightgray}{in/${esc(linkedinHandle)}}}}

      \\leftsection{学歴}
      {\\fontsize{8.6}{12.5}\\selectfont\\raggedright
      \\textcolor{white}{\\textbf{${escJa(edu0.institutionJa || edu0.institution || '')}}}\\par\\vspace{2pt}
      \\textcolor{lightgray}{${escJa(edu0.degreeJa || edu0.degree || '')}}\\par\\vspace{3pt}
      \\textcolor{sidebarsoft}{${formatMonthJa(edu0.startDate || '')} － ${formatMonthJa(edu0.endDate || '', { expected: true })}}\\par}

      \\leftsection{技術スキル}
      {\\fontsize{8.3}{12}\\selectfont\\raggedright
      \\textcolor{leftaccent}{\\textbf{言語}}\\par\\vspace{1pt}\\textcolor{lightgray}{${escJa(js.languages)}}\\par\\vspace{5pt}
      \\textcolor{leftaccent}{\\textbf{フレームワーク}}\\par\\vspace{1pt}\\textcolor{lightgray}{${escJa(js.frameworks)}}\\par\\vspace{5pt}
      \\textcolor{leftaccent}{\\textbf{ツール・開発環境}}\\par\\vspace{1pt}\\textcolor{lightgray}{${escJa(js.tools)}}\\par}

      \\leftsection{語学}
      {\\fontsize{8.6}{13}\\selectfont\\raggedright\\textcolor{lightgray}{${langList.join('\\\\\n      \\vspace{2pt}\n      ')}}\\par}
    \\end{minipage}
  \\end{minipage}%
}%
\\hspace{0.5cm}%
% ---------------- Right content column ----------------
\\begin{minipage}[t][\\paperheight][t]{\\dimexpr0.70\\paperwidth-1.6cm\\relax}
  \\vspace*{1.25cm}
  \\color{bodycolor}

  \\rightsection{自己紹介}
  {\\fontsize{9.3}{14}\\selectfont ${escJa(j.summary || r.summary || '')}\\par}

  \\rightsection{開発実績・プロジェクト}
  ${projList}

  \\rightsection{職務経歴}
  ${expList}

  \\rightsection{課外活動・資格}
  ${actList}
  {\\fontsize{8.8}{13}\\selectfont\\color{bodycolor}${qualList.map(q => `\\noindent ${q}\\par`).join('\n  ')}}
\\end{minipage}%
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
