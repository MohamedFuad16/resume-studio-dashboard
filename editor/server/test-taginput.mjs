import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = '/Users/mfuad16/.gemini/antigravity/brain/4b8ce412-bd78-47e1-8ebd-391d32ca3f3b';
const SCREENSHOT_WIZARD_TAGS = path.join(ARTIFACTS_DIR, 'wizard_tags_step.png');
const SCREENSHOT_SIDEBAR_TAGS = path.join(ARTIFACTS_DIR, 'sidebar_tags.png');

async function run() {
  console.log('🚀 Launching Playwright browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.error(`❌ [Browser Uncaught Error]: ${err.message}`));

  try {
    console.log('🌐 Navigating to http://127.0.0.1:5173/...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 15000 });
    
    // Test the Sidebar Editor first
    console.log('📂 Testing sidebar editor skills section...');
    const skillsHeader = page.locator('.sec-hd:has-text("Skills")');
    await skillsHeader.scrollIntoViewIfNeeded();
    await skillsHeader.click();
    await page.waitForTimeout(300);

    // Let's add a tag in Programming Languages (using "go" for "Go", which is not selected by default)
    console.log('✏️ Adding "Go" and custom tag "Zig" in sidebar...');
    const langInp = page.locator('.tag-inp-container:has-text("Programming Languages") input.tag-inp-field');
    await langInp.fill('go');
    await page.waitForSelector('.tag-dropdown');
    
    // Click suggestion
    const item = page.locator('.tag-dropdown-item:has-text("Go")');
    await item.click();
    console.log('✓ Clicked "Go" suggestion.');

    // Add custom tag
    await langInp.fill('Zig');
    await page.waitForTimeout(100);
    await langInp.press('Enter');
    console.log('✓ Added custom tag "Zig".');

    // Take screenshot of the sidebar tags
    await page.screenshot({ path: SCREENSHOT_SIDEBAR_TAGS });
    console.log(`📸 Sidebar tags screenshot saved to: ${SCREENSHOT_SIDEBAR_TAGS}`);

    // Click "New Resume" button to open wizard
    console.log('🖱️ Clicking on "New Resume" button...');
    const btn = page.locator('button.btn-new-profile');
    await btn.click();
    await page.waitForSelector('.wizard-overlay', { state: 'visible' });
    await page.waitForTimeout(400);

    // Click "Build from Scratch" option button
    console.log('🖱️ Clicking "Build from Scratch"...');
    const scratchBtn = page.locator('.wizard-opt-btn:has-text("Build from Scratch")');
    await scratchBtn.click();
    await page.waitForTimeout(300);

    // Fill Step 1
    console.log('📝 Filling Wizard Step 1...');
    const nameInp = page.locator('.wizard-step-flow input[placeholder="Mohamed Fuad"]');
    await nameInp.fill('John Doe');
    await page.waitForTimeout(100);

    const nextBtn = page.locator('.wizard-actions button.btn-primary');
    await nextBtn.click(); // to Step 2
    await page.waitForTimeout(200);

    // Step 2 Summary
    console.log('📝 Navigating through Step 2...');
    await nextBtn.click(); // to Step 3
    await page.waitForTimeout(200);

    // Step 3 Education
    console.log('📝 Navigating through Step 3...');
    await nextBtn.click(); // to Step 4
    await page.waitForTimeout(200);

    // Step 4 Experience
    console.log('📝 Navigating through Step 4...');
    await nextBtn.click(); // to Step 5
    await page.waitForTimeout(200);

    // Step 5 Projects
    console.log('📝 Navigating through Step 5...');
    await nextBtn.click(); // to Step 6
    await page.waitForTimeout(300);

    console.log('🔍 Arrived at Wizard Step 6: Skills Profile.');
    const wizLangInp = page.locator('.wizard-step-flow .tag-inp-container:has-text("Programming Languages") input.tag-inp-field');
    await wizLangInp.fill('java');
    await page.waitForSelector('.tag-dropdown');
    
    // Choose JavaScript (in a fresh wizard it's empty, so JavaScript matches 'java')
    const jsItem = page.locator('.tag-dropdown-item:has-text("JavaScript")');
    await jsItem.click();
    console.log('✓ Added "JavaScript" via dropdown.');

    // Add custom tag "Rust"
    await wizLangInp.fill('Rust');
    await page.waitForTimeout(100);
    await wizLangInp.press('Enter');
    console.log('✓ Added custom tag "Rust".');

    // Take screenshot of Step 6 tags
    await page.screenshot({ path: SCREENSHOT_WIZARD_TAGS });
    console.log(`📸 Wizard tags step screenshot saved to: ${SCREENSHOT_WIZARD_TAGS}`);

  } catch (e) {
    console.error('❌ Diagnostics failed:', e.stack || e.message);
  } finally {
    await browser.close();
    console.log('🔒 Browser closed.');
  }
}

run();
