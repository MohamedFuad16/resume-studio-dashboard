import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const VALID_SECTIONS = new Set(['personal', 'summary', 'education', 'experience', 'projects', 'skills', 'activities']);
const PATCHABLE_KEYS = new Set(['personal', 'summary', 'summaryEn', 'summaryJa', 'japanese', 'education', 'experience', 'projects', 'skills', 'activities']);

const clone = value => JSON.parse(JSON.stringify(value));

function appendCsv(current, value) {
  const values = String(current || '').split(',').map(item => item.trim()).filter(Boolean);
  if (!values.some(item => item.toLowerCase() === value.toLowerCase())) values.push(value.trim());
  return values.join(', ');
}

function applyLocalEdit(resume, instruction, language) {
  const next = clone(resume);
  const changed = new Set();
  const applied = [];
  const text = instruction.trim();
  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0];
  const github = text.match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_-]+\/?/i)?.[0];
  const linkedin = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i)?.[0];
  const phone = text.match(/(?:\+?\d{1,3}[-.\s]?)?\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}/)?.[0];
  const summary = text.match(/(?:set|change|replace|update)\s+(?:my\s+)?summary\s*(?:to|:|as)\s+([\s\S]+)/i)?.[1];
  const skill = text.match(/add\s+(.+?)\s+to\s+(?:my\s+)?(programming languages|languages|frameworks|tools|concepts|spoken languages|skills)/i);
  const projectBullet = text.match(/add\s+(?:this\s+)?bullet\s+(?:to|under)\s+(.+?)\s*:\s*([\s\S]+)/i);

  next.personal ||= {};
  if (email && email !== next.personal.email) { next.personal.email = email; applied.push('email'); changed.add('personal'); }
  if (phone && phone !== next.personal.phone) { next.personal.phone = phone; applied.push('phone'); changed.add('personal'); }
  if (github && github !== next.personal.github) { next.personal.github = github.replace(/^http:/, 'https:'); applied.push('GitHub'); changed.add('personal'); }
  if (linkedin && linkedin !== next.personal.linkedin) { next.personal.linkedin = linkedin.replace(/^http:/, 'https:'); applied.push('LinkedIn'); changed.add('personal'); }
  if (summary) { next.summary = summary.trim(); applied.push('summary'); changed.add('summary'); }

  if (skill) {
    next.skills ||= {};
    const sectionMap = {
      'programming languages': 'languages', languages: 'languages', frameworks: 'frameworks', tools: 'tools', concepts: 'concepts', 'spoken languages': 'spoken', skills: 'tools',
    };
    const section = sectionMap[skill[2].toLowerCase()];
    next.skills[section] = appendCsv(next.skills[section], skill[1]);
    applied.push(skill[1].trim());
    changed.add('skills');
  }

  if (projectBullet) {
    const project = (next.projects || []).find(item => (item.title || item.name || '').toLowerCase().includes(projectBullet[1].trim().toLowerCase()));
    if (project) {
      project.bullets = [...(project.bullets || []), projectBullet[2].trim()];
      project.description = project.bullets.join(' ');
      applied.push(`${project.title || project.name} bullet`);
      changed.add('projects');
    }
  }

  return {
    resume: next,
    changedSections: [...changed],
    focusSection: [...changed][0] || 'summary',
    message: applied.length
      ? (language === 'ja' ? `${applied.join('、')}を更新しました。` : `Updated ${applied.join(', ')}.`)
      : '',
  };
}

function splitCsv(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function buildSummaryFromFacts(resume, language) {
  const personal = resume.personal || {};
  const education = Array.isArray(resume.education) ? resume.education[0] : null;
  const skills = resume.skills || {};
  const projects = Array.isArray(resume.projects) ? resume.projects.slice(0, 3) : [];
  const name = personal.nameEn || personal.nameJa || 'Candidate';
  const school = education?.institution || education?.school || 'university';
  const degree = education?.degree || education?.program || 'information technology';
  const frameworks = splitCsv(skills.frameworks).slice(0, 4);
  const tools = splitCsv(skills.tools).slice(0, 4);
  const languages = splitCsv(skills.languages).slice(0, 4);
  const projectNames = projects.map(item => item.title || item.name).filter(Boolean);
  const tech = [...new Set([...languages, ...frameworks, ...tools])].slice(0, 7);

  if (language === 'ja') {
    return `${name}は${school}で${degree}を学ぶ、2028年卒業予定のICT学生です。${tech.join('、')}を用いたフルスタック開発、クラウド、AIプロダクト開発に強みがあり、${projectNames.join('、')}などの実装経験を通じて、ユーザー価値を意識したプロダクト改善に取り組んでいます。英語での実務コミュニケーションと日本語での業務対応を活かし、技術力と顧客理解の両面からインターンシップに貢献できます。`;
  }

  return `${name} is a 2028 ICT student at ${school} studying ${degree}, with hands-on experience across full-stack development, cloud tools, and AI-enabled product work. He works with ${tech.join(', ')} and has shipped projects including ${projectNames.join(', ')}, combining practical engineering, user-focused product thinking, and bilingual communication in English and Japanese.`;
}

function applyHeuristicFineTune(resume, instruction, language) {
  const next = clone(resume);
  const text = instruction.toLowerCase();
  const changed = new Set();
  let message = language === 'ja'
    ? '既存の事実のみを使って要約を整えました。'
    : 'Polished the summary using only existing resume facts.';

  if (/summary|profile|rewrite|improve|tailor|fine[ -]?tune|professional|impact|自然|改善|書き直|整え|応募先/.test(text)) {
    next.summary = buildSummaryFromFacts(next, language);
    changed.add('summary');
  }

  return {
    resume: next,
    changedSections: [...changed],
    focusSection: [...changed][0] || 'summary',
    message,
    engine: 'Structured local fine-tune',
  };
}

function isConversationOnly(instruction) {
  const text = instruction.trim().toLowerCase();
  if (/^(hi|hello|hey|yo|こんにちは|こんばんは|おはよう|やあ)[!.。\s]*$/.test(text)) return true;
  if (/\?$|？$/.test(text)) return true;
  return /(what do you think|review my resume|how can i improve|any advice|suggest|help me|相談|どう思|改善点|アドバイス)/i.test(instruction)
    && !/(add|update|change|replace|set|remove|delete|rewrite|improve my summary|fine[ -]?tune|反映|追加|変更|削除|書き換)/i.test(instruction);
}

function buildConversationReply(resume, instruction, language) {
  const projects = (resume.projects || []).map(item => item.title || item.name).filter(Boolean).slice(0, 4);
  const skills = resume.skills || {};
  const skillLine = [skills.languages, skills.frameworks, skills.tools].filter(Boolean).join(', ');
  const greeting = /^(hi|hello|hey|yo|こんにちは|こんばんは|おはよう|やあ)/i.test(instruction.trim());

  if (language === 'ja') {
    if (greeting) {
      return 'こんにちは。履歴書の内容確認、応募先に合わせた調整、要約・職歴・プロジェクト文の改善ができます。変更したい場合は「HENNGE向けに要約を調整して」のように具体的に依頼してください。';
    }
    return `現在の履歴書では、${projects.join('、') || 'プロジェクト経験'}と、${skillLine || '技術スキル'}が強みです。東京・日本のインターン向けには、応募先ごとに「使用技術」「成果」「チーム/利用者への価値」を1〜2文で強めると効果的です。変更を反映したい場合は、そのまま「要約を改善して」「Tutor-Systemの説明を短くして」のように依頼してください。`;
  }

  if (greeting) {
    return 'Hi — I can review your resume, talk through internship strategy, or apply concrete edits. If you want a change, say something like “tailor my summary for HENNGE” or “add a bullet to Tutor-System: ...”.';
  }
  return `Your strongest resume signals are ${projects.join(', ') || 'your project work'} plus ${skillLine || 'your technical stack'}. For Tokyo/Japan internships, I would make each application emphasize the exact stack, the user value, and your English/Japanese communication. If you want me to edit the resume, ask for the specific section and target role.`;
}

function parseJsonResponse(raw) {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(trimmed); } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Codex did not return a structured edit');
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function validateResult(result, original) {
  if (!result || typeof result !== 'object' || !result.resume || typeof result.resume !== 'object') throw new Error('Invalid structured resume edit');
  const resume = result.resume;
  for (const section of ['education', 'experience', 'projects', 'activities']) {
    if (!Array.isArray(resume[section])) resume[section] = clone(original[section] || []);
  }
  resume.personal = resume.personal && typeof resume.personal === 'object' ? resume.personal : clone(original.personal || {});
  resume.skills = resume.skills && typeof resume.skills === 'object' ? resume.skills : clone(original.skills || {});
  const changedSections = Array.isArray(result.changedSections)
    ? result.changedSections.filter(section => VALID_SECTIONS.has(section))
    : [];
  return {
    resume,
    changedSections,
    focusSection: VALID_SECTIONS.has(result.focusSection) ? result.focusSection : (changedSections[0] || 'summary'),
    message: String(result.message || 'Applied the requested resume changes.'),
    engine: 'Codex LLM',
    type: changedSections.length ? 'edit' : 'conversation',
  };
}

function validatePatchResult(result, original) {
  if (!result || typeof result !== 'object' || !result.updates || typeof result.updates !== 'object' || Array.isArray(result.updates)) {
    throw new Error('Invalid structured resume patch');
  }
  const resume = clone(original);
  for (const [key, value] of Object.entries(result.updates)) {
    if (!PATCHABLE_KEYS.has(key)) continue;
    const current = resume[key];
    const mergeObject = current && value
      && typeof current === 'object' && typeof value === 'object'
      && !Array.isArray(current) && !Array.isArray(value);
    resume[key] = mergeObject ? { ...current, ...clone(value) } : clone(value);
  }
  for (const section of ['education', 'experience', 'projects', 'activities']) {
    if (!Array.isArray(resume[section])) resume[section] = clone(original[section] || []);
  }
  resume.personal = resume.personal && typeof resume.personal === 'object' ? resume.personal : clone(original.personal || {});
  resume.skills = resume.skills && typeof resume.skills === 'object' ? resume.skills : clone(original.skills || {});
  const changedSections = Array.isArray(result.changedSections)
    ? result.changedSections.filter(section => VALID_SECTIONS.has(section))
    : [];
  return {
    resume,
    changedSections,
    focusSection: VALID_SECTIONS.has(result.focusSection) ? result.focusSection : (changedSections[0] || 'summary'),
    message: String(result.message || (changedSections.length ? 'Applied the requested resume changes.' : 'No resume fields were changed.')),
    engine: 'Codex LLM',
    type: changedSections.length ? 'edit' : 'conversation',
  };
}

async function runCodexPrompt(prompt, rootDir) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-chat-'));
  const outputFile = path.join(tempDir, 'result.json');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('codex', [
      'exec', '--ephemeral', '--sandbox', 'read-only', '--skip-git-repo-check', '--ignore-rules',
      '--color', 'never', '-C', rootDir, '-o', outputFile, '-',
      ], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stderr = '';
      let stdout = '';
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.stdout.on('data', chunk => { stdout += chunk.toString(); });
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Codex CLI timed out'));
      }, Number(process.env.RESUME_CHAT_CODEX_TIMEOUT_MS || 90000));
      child.on('error', error => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('exit', code => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else {
          const usefulError = stderr.split('\n').reverse().find(line => line.trim() && !/\bWARN\b|^hook:/i.test(line));
          reject(new Error(usefulError || stdout.split('\n').reverse().find(Boolean) || `Codex CLI exited with code ${code}`));
        }
      });
      child.stdin.end(prompt);
    });
    const raw = await fs.readFile(outputFile, 'utf8');
    if (!raw.trim()) throw new Error('Codex returned an empty response');
    return raw.trim();
  } finally {
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runCodexEdit(resume, instruction, language, rootDir) {
  const prompt = `You are the resume-editing LLM inside Resume Studio. Apply the user's natural-language request to CURRENT_RESUME and return ONLY a valid JSON object with exactly these keys: message, focusSection, changedSections, updates.

Rules:
- updates must contain only changed top-level fields. Allowed keys: personal, summary, summaryEn, summaryJa, japanese, education, experience, projects, skills, activities.
- For personal, skills, and japanese, return only changed nested keys; the server safely merges them. For arrays, return the complete updated array. For summary changes, keep summary and summaryEn synchronized in English, or summaryJa and japanese.summary synchronized in Japanese.
- Preserve every unrelated field by omitting it from updates.
- Never invent employers, dates, metrics, credentials, skills, responsibilities, or achievements.
- You may improve wording using facts already present, reorder existing bullets, and apply facts explicitly supplied in the user instruction.
- If the user is only talking or asking for advice, return updates as an empty object, changedSections as an empty array, and answer naturally in message.
- changedSections is an array containing only personal, summary, education, experience, projects, skills, activities.
- focusSection is one of those same strings.
- Keep English content in English and Japanese-specific fields/content natural in Japanese.
- Do not include markdown fences or commentary outside the JSON.

LANGUAGE: ${language}
USER REQUEST: ${instruction}
CURRENT_RESUME:
${JSON.stringify(resume)}`;
  const raw = await runCodexPrompt(prompt, rootDir);
  return validatePatchResult(parseJsonResponse(raw), resume);
}

async function runCodexConversation(resume, instruction, language, rootDir) {
  const context = {
    personal: resume.personal,
    summary: language === 'ja' ? (resume.summaryJa || resume.japanese?.summary || resume.summary) : (resume.summaryEn || resume.summary),
    education: (resume.education || []).slice(0, 2),
    experience: (resume.experience || []).map(item => ({ company: item.company, role: item.role, bullets: (item.bullets || []).slice(0, 2) })).slice(0, 3),
    projects: (resume.projects || []).map(item => ({ title: item.title, tech: item.tech, bullets: (item.bullets || []).slice(0, 2) })).slice(0, 5),
    skills: resume.skills,
  };
  const prompt = `You are the conversational Codex resume agent inside Resume Studio. Answer the user's message naturally and concisely in ${language === 'ja' ? 'Japanese' : 'English'}.

You can discuss this resume, suggest improvements, explain strategy, and tell the user how to request an edit. Use only the supplied resume facts; never invent experience, metrics, credentials, or eligibility. Keep the answer under 140 words. Return plain text only.

USER MESSAGE: ${instruction}
RESUME CONTEXT:
${JSON.stringify(context)}`;
  const message = await runCodexPrompt(prompt, rootDir);
  return {
    resume,
    changedSections: [],
    focusSection: 'summary',
    message,
    engine: 'Codex LLM',
    type: 'conversation',
  };
}

export async function runResumeChat({ resume, instruction, language = 'en', rootDir }) {
  if (!resume || typeof resume !== 'object') throw new Error('Resume data is required');
  if (!instruction || typeof instruction !== 'string' || !instruction.trim()) throw new Error('An edit instruction is required');
  if (instruction.length > 6000) throw new Error('Please keep each edit request under 6,000 characters');

  const local = applyLocalEdit(resume, instruction, language);
  const complex = /(improve|rewrite|tailor|fine[ -]?tune|shorten|professional|impact|job description|target role|自然|改善|書き直|整え|応募先)/i.test(instruction);
  const conversationOnly = isConversationOnly(instruction);
  const useCodex = process.env.RESUME_CHAT_ENGINE !== 'local';

  if (useCodex) {
    try {
      return conversationOnly
        ? await runCodexConversation(resume, instruction, language, rootDir)
        : await runCodexEdit(resume, instruction, language, rootDir);
    } catch (error) {
      if (local.changedSections.length) return { ...local, engine: 'Instant local fallback', type: 'edit' };
      if (complex) return { ...applyHeuristicFineTune(resume, instruction, language), engine: 'Structured local fallback', type: 'edit' };
      return {
        resume,
        changedSections: [],
        focusSection: 'summary',
        message: `${buildConversationReply(resume, instruction, language)} ${language === 'ja' ? '（Codexへの接続を再試行してください。）' : '(The Codex connection was unavailable; please retry.)'}`,
        engine: language === 'ja' ? 'ローカル予備応答' : 'Local fallback',
        type: 'conversation',
      };
    }
  }

  if (!local.changedSections.length && !complex && isConversationOnly(instruction)) {
    return {
      resume,
      changedSections: [],
      focusSection: 'summary',
      message: buildConversationReply(resume, instruction, language),
      engine: language === 'ja' ? '履歴書チャット' : 'Resume chat',
      type: 'conversation',
    };
  }
  if (local.changedSections.length && !complex) return { ...local, engine: 'Instant local edit' };
  if (complex) {
    return { ...applyHeuristicFineTune(resume, instruction, language), engine: 'Structured local fine-tune', type: 'edit' };
  }

  if (local.changedSections.length) return { ...local, engine: 'Instant local edit', type: 'edit' };
  return {
    resume,
    changedSections: [],
    focusSection: 'summary',
    message: buildConversationReply(resume, instruction, language),
    engine: language === 'ja' ? '履歴書チャット' : 'Resume chat',
    type: 'conversation',
  };
}
