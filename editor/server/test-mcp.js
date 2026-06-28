import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_SERVER = path.join(__dirname, 'mcp-server.js');

console.log('🧪 Starting MCP Server E2E Test...');

const child = spawn('node', [MCP_SERVER]);
let buffer = '';

child.stderr.on('data', (data) => {
  // Debug output from server goes to stderr
  console.log(`[MCP Debug]: ${data.toString().trim()}`);
});

child.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep partial line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      handleResponse(message);
    } catch (e) {
      console.error('❌ Failed to parse response line:', line, e.message);
      process.exit(1);
    }
  }
});

child.on('close', (code) => {
  console.log(`MCP server child process exited with code ${code}`);
});

// Test steps
const steps = [
  // 1. Initialize
  {
    desc: 'Send initialize',
    msg: { jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 },
    validate: (res) => {
      if (res.result?.serverInfo?.name !== 'resume-mcp-server') throw new Error('Invalid server name');
      console.log('✅ Initialize call: PASSED');
    }
  },
  // 2. List tools
  {
    desc: 'List tools',
    msg: { jsonrpc: '2.0', method: 'tools/list', params: {}, id: 2 },
    validate: (res) => {
      const tools = res.result?.tools || [];
      const names = tools.map(t => t.name);
      if (!names.includes('get_resume')) throw new Error('Missing get_resume tool');
      if (!names.includes('get_resume_markdown')) throw new Error('Missing get_resume_markdown tool');
      if (!names.includes('get_resume_pdf_paths')) throw new Error('Missing get_resume_pdf_paths tool');
      if (!names.includes('log_job_application')) throw new Error('Missing log_job_application tool');
      console.log('✅ Tools list call: PASSED');
    }
  },
  // 3. Call get_resume
  {
    desc: 'Call get_resume',
    msg: { jsonrpc: '2.0', method: 'tools/call', params: { name: 'get_resume', arguments: {} }, id: 3 },
    validate: (res) => {
      const text = res.result?.content?.[0]?.text;
      const data = JSON.parse(text);
      if (data.personal?.nameEn !== 'Mohamed Fuad') throw new Error('Invalid resume data returned');
      console.log('✅ get_resume call: PASSED');
    }
  },
  // 4. Call get_resume_markdown
  {
    desc: 'Call get_resume_markdown',
    msg: { jsonrpc: '2.0', method: 'tools/call', params: { name: 'get_resume_markdown', arguments: {} }, id: 4 },
    validate: (res) => {
      const text = res.result?.content?.[0]?.text;
      if (!text.includes('# AI JOB MATCHING PROFILE')) throw new Error('Missing markdown header');
      console.log('✅ get_resume_markdown call: PASSED');
    }
  },
  // 5. Call get_resume_pdf_paths
  {
    desc: 'Call get_resume_pdf_paths',
    msg: { jsonrpc: '2.0', method: 'tools/call', params: { name: 'get_resume_pdf_paths', arguments: {} }, id: 5 },
    validate: (res) => {
      const text = res.result?.content?.[0]?.text;
      const paths = JSON.parse(text);
      if (!paths.englishPdfPath.endsWith('resume_en_01.pdf')) throw new Error('Invalid PDF path returned');
      console.log('✅ get_resume_pdf_paths call: PASSED');
    }
  },
  // 6. Call log_job_application
  {
    desc: 'Call log_job_application',
    msg: {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'log_job_application',
        arguments: {
          company: 'Acme Corp',
          jobTitle: 'Frontend Intern',
          jobDescription: 'Build modern React/Vite applications and style with modern CSS.',
          notes: 'Test application logged'
        }
      },
      id: 6
    },
    validate: (res) => {
      const text = res.result?.content?.[0]?.text;
      if (!text.includes('Successfully logged job application!')) throw new Error('Log failed');
      console.log('✅ log_job_application call: PASSED');
    }
  }
];

let currentStep = 0;

function runNextStep() {
  if (currentStep >= steps.length) {
    console.log('🎉 All MCP Server E2E Tests: PASSED! Server is fully compliant.');
    child.kill();
    process.exit(0);
    return;
  }

  const step = steps[currentStep];
  console.log(`👉 Running test step ${currentStep + 1}: ${step.desc}...`);
  child.stdin.write(JSON.stringify(step.msg) + '\n');
}

function handleResponse(res) {
  if (res.id !== currentStep + 1) {
    console.error(`❌ Received response with unexpected ID ${res.id}, expected ${currentStep + 1}`);
    child.kill();
    process.exit(1);
  }

  try {
    if (res.error) {
      throw new Error(`RPC Error: ${res.error.message} (code ${res.error.code})`);
    }
    steps[currentStep].validate(res);
    currentStep++;
    runNextStep();
  } catch (e) {
    console.error(`❌ Test step failed:`, e.message);
    child.kill();
    process.exit(1);
  }
}

// Start E2E execution
runNextStep();
