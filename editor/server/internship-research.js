import { spawn } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const SCHEMA_FILE = fileURLToPath(new URL('./internship-search.schema.json', import.meta.url));
const BLOCKED_JOB_DOMAINS = /(?:indeed|glassdoor|linkedin|ziprecruiter|simplyhired)\./i;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const slugify = value => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 52) || 'company';

function todayInTokyo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || BLOCKED_JOB_DOMAINS.test(url.hostname)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function parseResult(raw) {
  const text = String(raw || '').trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Research agent did not return valid JSON');
    return JSON.parse(text.slice(start, end + 1));
  }
}

function normalizeResult(company, result, index, verifiedDate) {
  const url = safeUrl(result.url);
  const sourceUrl = safeUrl(result.sourceUrl);
  if (!url || !sourceUrl || !result.title?.trim()) return null;
  const location = result.location?.trim() || 'Not stated';
  const isJapan = /Japan|Tokyo|大阪|東京|京都|横浜/i.test(location);
  const scoreBase = isJapan ? 88 : /remote/i.test(`${location} ${result.workMode}`) ? 83 : 78;
  const fingerprint = createHash('sha1').update(`${company}|${result.title}|${url}`).digest('hex').slice(0, 10);
  const process = Array.isArray(result.applicationProcess) ? result.applicationProcess.filter(Boolean).slice(0, 8) : [];
  const codingText = result.codingTest === 'required'
    ? 'Coding test stated in the official process'
    : result.codingTest === 'not_required'
      ? 'Official process says no coding test'
      : 'No coding test stated on the official page';

  return {
    id: `live-${slugify(company)}-${fingerprint}`,
    company: company.trim(),
    role: result.title.trim(),
    location,
    region: isJapan ? 'Japan' : /remote/i.test(`${location} ${result.workMode}`) ? 'Remote' : 'APAC',
    country: isJapan ? 'Japan' : 'Not stated',
    city: /Tokyo|東京/i.test(location) ? 'Tokyo' : '',
    workMode: result.workMode?.trim() || 'Not stated',
    language: result.language?.trim() || 'Not stated',
    languageType: /Japanese/i.test(result.language || '') ? 'Bilingual' : 'English-first',
    duration: result.duration?.trim() || 'Not stated',
    deadline: result.deadline?.trim() || 'Not stated',
    deadlineDate: /^\d{4}-\d{2}-\d{2}$/.test(result.deadlineDate || '') ? result.deadlineDate : null,
    compensation: result.compensation?.trim() || 'Not stated',
    track: result.track?.trim() || 'Software Engineering',
    score: clamp(scoreBase + (result.codingTest === 'not_required' ? 3 : 0), 70, 94),
    priority: isJapan,
    workAuth: result.eligibility?.trim() || 'Re-check eligibility on the official page',
    reasons: [isJapan ? 'Japan-based official opening' : 'Official opening found by live research', codingText],
    fitNote: result.about?.trim() || 'Review the official description for responsibilities and fit.',
    applicationProcess: process,
    codingTest: result.codingTest,
    url,
    source: result.sourceType === 'official_ats' ? 'Official applicant tracking page' : 'Official company careers page',
    sourceUrl,
    companyUrl: sourceUrl,
    companyDomain: (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
    logoUrl: '',
    verifiedDate,
    prestigeTier: 'Live company research',
    deadlineType: result.deadlineDate ? 'Fixed date shown on official page' : 'Not stated',
    researchIndex: index,
  };
}

function fallbackCompanyName(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'Company';
  if (/^[a-z0-9&.' -]+$/i.test(trimmed)) {
    return trimmed.split(/(\s+)/).map(part => {
      if (/\s+/.test(part) || !part) return part;
      if (/^[A-Z0-9&.'-]+$/.test(part)) return part;
      return `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`;
    }).join('');
  }
  return trimmed;
}

async function runCodexSearch(prompt, rootDir) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'internship-research-'));
  const outputFile = path.join(tempDir, 'result.json');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('codex', [
        '--search', 'exec', '--ignore-user-config', '--ephemeral', '--sandbox', 'read-only',
        '--skip-git-repo-check', '--ignore-rules', '--color', 'never',
        '--output-schema', SCHEMA_FILE, '-C', rootDir, '-o', outputFile, '-',
      ], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stderr = '';
      let stdout = '';
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.stdout.on('data', chunk => { stdout += chunk.toString(); });
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Company research timed out after two minutes'));
      }, Number(process.env.INTERNSHIP_RESEARCH_TIMEOUT_MS || 120000));
      child.on('error', error => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('exit', code => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else {
          const useful = stderr.split('\n').reverse().find(line => line.trim() && !/\bWARN\b|^hook:/i.test(line));
          reject(new Error(useful || stdout.split('\n').reverse().find(Boolean) || `Research agent exited with code ${code}`));
        }
      });
      child.stdin.end(prompt);
    });
    return await fs.readFile(outputFile, 'utf8');
  } finally {
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function researchCompanyInternships({ company, resume, rootDir }) {
  const verifiedDate = todayInTokyo();
  const profile = {
    education: (resume?.education || []).slice(0, 1),
    projects: (resume?.projects || []).map(item => ({ title: item.title, tech: item.tech })).slice(0, 5),
    skills: resume?.skills || {},
    languages: resume?.skills?.spoken || '',
    graduation: 'March 2028',
    location: 'Tokyo, Japan',
  };
  const prompt = `Act as a current internship research sub-agent for Resume Studio. Today is ${verifiedDate}. Search the live web for currently open internships or student programs at the company named below.

Company: ${company}
Candidate profile: ${JSON.stringify(profile)}

Search priorities:
1. Tokyo or elsewhere in Japan.
2. Remote roles explicitly open to a Japan-based student.
3. APAC roles only when the official page shows plausible eligibility.
4. Prefer English-first roles and straightforward applications. Do not claim an application has no coding test unless the official process explicitly says so; otherwise use codingTest = "not_stated".

Evidence rules:
- Set the top-level "company" field to the official company or brand capitalization shown by the employer, not necessarily the user's typed query.
- Include only openings verified on an official company careers page or the company's official ATS page.
- Include any currently open official internship/student-program result before judging profile fit, including sales, business, product, marketing, design, support, data, and engineering internships.
- Do not exclude a role merely because it is not a software-engineering internship; set the track accordingly and let the match score be lower in the app.
- Exclude job boards, reposts, news articles, expired pages, generic talent communities, and full-time roles.
- Use the direct official apply/detail URL.
- Never invent deadlines, duration, language, compensation, eligibility, or stages. Use "Not stated" when absent.
- If no qualifying opening is verified, return an empty results array and say so in summary.
- Return at most 8 results matching the provided output schema.`;
  let parsed;
  try {
    parsed = parseResult(await runCodexSearch(prompt, rootDir));
  } catch (error) {
    throw new Error(`Live research agent failed: ${error.message}`);
  }
  const officialCompany = fallbackCompanyName(parsed.company || company);
  const normalizedResults = (Array.isArray(parsed.results) ? parsed.results : [])
    .map((result, index) => normalizeResult(officialCompany, result, index, verifiedDate))
    .filter(Boolean);
  const results = normalizedResults;
  return {
    company: officialCompany,
    searchedAt: new Date().toISOString(),
    summary: String(parsed.summary || (results.length ? `Found ${results.length} verified opening(s).` : 'No verified openings found.')),
    results,
  };
}
