import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Redirect console.log to console.error to avoid corrupting standard output stream (JSON-RPC)
const log = console.log;
console.log = (...args) => {
  console.error(...args);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_ROOT = path.resolve(__dirname, '../../');
const DATA_FILE = path.join(__dirname, 'profiles', 'mohamed_fuad.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const APPLICATIONS_DIR = path.join(__dirname, 'applications');

// ── AI Profile Markdown Builder ─────────────────────────────────────
function buildAIProfile(r) {
  const p = r.personal || {};
  const sk = r.skills || {};
  const edu = r.education || [];
  const exp = r.experience || [];
  const proj = r.projects || [];
  const acts = r.activities || [];
  const now = new Date().toISOString().slice(0, 10);

  const allTechTags = [
    ...(sk.languages || '').split(','),
    ...(sk.frameworks || '').split(','),
    ...(sk.tools || '').split(','),
    ...(sk.concepts || '').split(','),
  ].map(t => t.trim()).filter(Boolean).map(t => `[${t}]`).join(' ');

  const spokenTags = (sk.spoken || '').split(',').map(t => `[${t.trim()}]`).join(' ');
  const educationTags = edu
    .flatMap(e => [e.institution, e.degree, e.location])
    .filter(Boolean);
  const profileTags = [
    p.address,
    sk.spoken,
    ...educationTags,
  ]
    .join(', ')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => `[${t}]`)
    .join(' ');

  const expBlock = exp.map(e =>
    `### ${e.role || e.roleJa || ''} — ${e.company || e.companyJa || ''}\n` +
    `- **Period**: ${e.startDate || ''} – ${e.endDate || ''}\n` +
    `- **Location**: ${e.location || ''}\n` +
    (e.bullets?.length ? e.bullets.map(b => `- ${b}`).join('\n') : '')
  ).join('\n\n');

  const eduBlock = edu.map(e =>
    `### ${e.degree || ''} — ${e.institution || ''}\n` +
    `- **Period**: ${e.startDate || ''} – ${e.endDate || ''}\n` +
    `- **Location**: ${e.location || ''}\n` +
    (e.bullets?.length ? e.bullets.map(b => `- ${b}`).join('\n') : '')
  ).join('\n\n');

  const projBlock = proj.map(p =>
    `### ${p.title || ''} (${p.year || 'N/A'})\n` +
    `- **Stack**: ${p.tech || ''}\n` +
    (p.bullets?.length ? p.bullets.map(b => `- ${b}`).join('\n') : '')
  ).join('\n\n');

  const actsBlock = acts.map(a =>
    `### ${a.title || ''}${a.org ? ` — ${a.org}` : ''}\n` +
    `- **Period**: ${a.startDate || ''} – ${a.endDate || ''}\n` +
    (a.bullets?.length ? a.bullets.map(b => `- ${b}`).join('\n') : '')
  ).join('\n\n');

  return `---
# AI JOB MATCHING PROFILE
<!-- Generated: ${now} | Format: Structured Markdown for AI parsing -->
<!-- Intended consumers: ChatGPT, Claude, Gemini, LinkedIn AI, ATS systems -->
---

## CANDIDATE OVERVIEW

| Field             | Value |
|-------------------|-------|
| **Full Name**     | ${p.nameEn || ''} (${p.nameJa || ''}) |
| **Location**      | ${p.address || ''} |
| **Email**         | ${p.email || ''} |
| **Phone**         | ${p.phone || ''} |
| **LinkedIn**      | ${p.linkedin || ''} |
| **GitHub**        | ${p.github || ''} |
| **Date of Birth** | ${p.dob || ''} |
| **Languages**     | ${sk.spoken || ''} |

---

## PROFESSIONAL SUMMARY

${r.summary || ''}

---

## TECHNICAL SKILLS

### Programming Languages
${sk.languages || ''}

### Frameworks & Libraries
${sk.frameworks || ''}

### Tools & Infrastructure
${sk.tools || ''}

### Concepts & Methodologies
${sk.concepts || ''}

### Spoken Languages
${sk.spoken || ''}

---

## WORK EXPERIENCE

${expBlock || '_No experience listed._'}

---

## EDUCATION

${eduBlock || '_No education listed._'}

---

## PROJECTS

${projBlock || '_No projects listed._'}

---

## ACTIVITIES & CERTIFICATIONS

${actsBlock || '_No activities listed._'}

---

## JOB MATCHING TAGS

### Technical Tags
${allTechTags}

### Language Tags
${spokenTags}

### Profile Tags
${profileTags || '_No profile tags listed._'}

---
<!-- END OF AI JOB PROFILE -->
`;
}

// ── Cover Letter Generator ──────────────────────────────────────────
function buildCoverLetter(r, company, jobTitle, jobDescription) {
  const p = r.personal || {};
  const sk = r.skills || {};
  const edu = r.education?.[0] || {};
  const exp = r.experience?.[0] || {};
  const primaryProjects = (r.projects || []).slice(0, 2).map(project => project.title).filter(Boolean);
  const skills = [
    sk.languages,
    sk.frameworks,
    sk.tools,
  ].filter(Boolean).join(', ');
  const candidateIntro = [
    edu.degree ? `${edu.degree}${edu.institution ? ` student at ${edu.institution}` : ''}` : '',
    skills ? `with experience across ${skills}` : '',
  ].filter(Boolean).join(' ');
  const experienceLine = exp.company
    ? `My experience at ${exp.company}${exp.role ? ` as ${exp.role}` : ''} strengthened the communication and execution habits I would bring to this role.`
    : 'My projects and academic work have strengthened the communication and execution habits I would bring to this role.';
  const projectLine = primaryProjects.length
    ? `Relevant project work includes ${primaryProjects.join(' and ')}, which I would be glad to discuss in relation to ${company}'s needs.`
    : 'I would be glad to discuss how my background maps to your team needs.';
  const contactLine = [p.email, p.phone].filter(Boolean).join(' | ');
  return `Dear Hiring Team at ${company},

I am writing to express my strong interest in the ${jobTitle} position at ${company}.${candidateIntro ? ` As a ${candidateIntro},` : ''} I am excited about the opportunity to contribute to your team.

${experienceLine} ${projectLine}

Thank you for your time and consideration. I would welcome the opportunity to discuss how my technical skills and background align with the needs of ${company}.

Sincerely,
${p.nameEn || p.nameJa || ''}
${contactLine}
`;
}

// ── Stdin/Stdout JSON-RPC handling ──────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    const response = await handleRequest(request);
    if (response) {
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (e) {
    console.error('Error handling line:', e.message);
    const errRes = {
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error" },
      id: null
    };
    process.stdout.write(JSON.stringify(errRes) + '\n');
  }
});

async function handleRequest(req) {
  const { jsonrpc, method, params, id } = req;

  // Non-notifications require an ID
  if (id === undefined && !method.startsWith('notifications/')) {
    return null;
  }

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "resume-mcp-server",
            version: "1.0.0"
          }
        }
      };

    case 'notifications/initialized':
      // Notification, no response
      return null;

    case 'ping':
      return { jsonrpc: "2.0", id, result: {} };

    case 'tools/list':
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "get_resume",
              description: "Retrieve candidate's complete resume in parsed JSON format",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_resume_markdown",
              description: "Retrieve candidate's AI-optimized resume profile in structured Markdown format (ideal for ATS matching and LLM context)",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_resume_pdf_paths",
              description: "Retrieve candidate's local absolute file system paths for compiled EN and JA PDF resumes",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "log_job_application",
              description: "Log an internship or job application dossier. Auto-generates a tailored cover letter and writes a markdown record to the local applications folder.",
              inputSchema: {
                type: "object",
                required: ["company", "jobTitle", "jobDescription"],
                properties: {
                  company: { type: "string", description: "Company name (e.g. Google, Line)" },
                  jobTitle: { type: "string", description: "Job or internship title (e.g. Software Engineer Intern)" },
                  jobDescription: { type: "string", description: "Job posting description or key requirements" },
                  notes: { type: "string", description: "Any additional notes or status information" }
                }
              }
            }
          ]
        }
      };

    case 'tools/call':
      return await handleToolCall(params.name, params.arguments, id);

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      };
  }
}

async function handleToolCall(name, args, id) {
  try {
    let rawData;
    try {
      rawData = await fs.readFile(DATA_FILE, 'utf8');
    } catch {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: "Could not read resume.json. Verify the file exists in the editor folder." }
      };
    }
    const resume = JSON.parse(rawData);

    switch (name) {
      case 'get_resume':
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(resume, null, 2)
              }
            ]
          }
        };

      case 'get_resume_markdown':
        const mdProfile = buildAIProfile(resume);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: mdProfile
              }
            ]
          }
        };

      case 'get_resume_pdf_paths':
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  englishPdfPath: path.join(PUBLIC_DIR, 'resume_en_01.pdf'),
                  japanesePdfPath: path.join(PUBLIC_DIR, 'resume_ja_02.pdf'),
                  verifiedDir: PUBLIC_DIR
                }, null, 2)
              }
            ]
          }
        };

      case 'log_job_application':
        const { company, jobTitle, jobDescription, notes = '' } = args;
        const coverLetter = buildCoverLetter(resume, company, jobTitle, jobDescription);
        
        // Ensure application folder exists
        await fs.mkdir(APPLICATIONS_DIR, { recursive: true }).catch(() => {});

        const filename = `${company.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${jobTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_application.md`;
        const dossierPath = path.join(APPLICATIONS_DIR, filename);
        
        const dossierContent = `# Application Dossier: ${jobTitle} at ${company}
- **Date Logged**: ${new Date().toISOString().slice(0, 10)}
- **Status**: Applied / Logged via MCP

## Job Description / Requirements
${jobDescription}

${notes ? `## Notes\n${notes}\n` : ''}
## Auto-Generated Cover Letter
\`\`\`text
${coverLetter}
\`\`\`
`;
        await fs.writeFile(dossierPath, dossierContent, 'utf8');

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Successfully logged job application!\n\nSaved application dossier to: ${dossierPath}\n\nGenerated Cover Letter:\n\n${coverLetter}`
              }
            ]
          }
        };

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Unknown tool name: ${name}` }
        };
    }
  } catch (e) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: `Internal error: ${e.message}` }
    };
  }
}
