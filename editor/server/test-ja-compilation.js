import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { fileURLToPath } from 'url';
import { generateLatex } from './templates.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_ROOT = path.resolve(__dirname, '../../');
const DATA_FILE = path.join(RESUME_ROOT, 'editor', 'resume.json');
const TECTONIC = '/opt/homebrew/bin/tectonic';

async function run() {
  console.log('📖 Loading resume data from', DATA_FILE);
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const resume = JSON.parse(raw);

  const templates = ['ja_01', 'ja_02', 'ja_03'];
  const results = {};

  for (const template of templates) {
    console.log(`\n📄 Compiling template: ${template}...`);
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `resume-test-${template}-`));
    const texFile = path.join(tmpDir, 'resume.tex');

    try {
      const latex = generateLatex(template, resume);
      await fs.writeFile(texFile, latex, 'utf8');

      console.log(`🏃 Running tectonic on ${texFile}...`);
      const { stdout, stderr } = await execFileAsync(TECTONIC, [texFile, '-r', '0', '--outdir', tmpDir]);
      
      console.log(`✅ ${template} compiled successfully.`);
      results[template] = { success: true };
    } catch (e) {
      console.error(`❌ ${template} compilation failed:`, e.message);
      results[template] = { success: false, error: e.message };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  console.log('\n📊 Compilation Results:');
  console.table(results);

  const failed = Object.values(results).some(r => !r.success);
  if (failed) {
    console.error('\n❌ One or more templates failed to compile.');
    process.exit(1);
  } else {
    console.log('\n🎉 All templates compiled successfully!');
    process.exit(0);
  }
}

run();
