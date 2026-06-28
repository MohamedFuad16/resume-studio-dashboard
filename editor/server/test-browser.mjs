import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = '/Users/mfuad16/.gemini/antigravity/brain/4b8ce412-bd78-47e1-8ebd-391d32ca3f3b';
const SCREENSHOT_MAIN = path.join(ARTIFACTS_DIR, 'main_page.png');
const SCREENSHOT_WIZARD = path.join(ARTIFACTS_DIR, 'wizard_overlay.png');

async function run() {
  console.log('🚀 Launching Playwright browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console logs
  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`);
  });

  // Listen for uncaught errors
  page.on('pageerror', err => {
    console.error(`❌ [Browser Uncaught Error]: ${err.message}`);
    console.error(err.stack);
  });

  try {
    console.log('🌐 Navigating to http://127.0.0.1:5173/...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ Page loaded.');

    // Check URL query parameters
    const url = page.url();
    console.log(`🔗 Current URL: ${url}`);
    if (url.includes('?profile=mohamed_fuad')) {
      console.log('✅ Query parameter verified: ?profile=mohamed_fuad is present.');
    } else {
      console.error('❌ Query parameter NOT verified on load.');
    }

    // Take screenshot of main page
    await page.screenshot({ path: SCREENSHOT_MAIN });
    console.log(`📸 Main page screenshot saved to: ${SCREENSHOT_MAIN}`);

    // Expand Experience section by clicking its header
    console.log('📂 Expanding Experience section...');
    const expHeader = page.locator('.sec-hd:has-text("Experience")');
    await expHeader.click();
    await page.waitForTimeout(300);

    // Scroll the sidebar scroll area to the bottom to verify the GitHub URL is accessible
    console.log('📜 Scrolling sidebar scroll container to the bottom...');
    const sidebarScroll = page.locator('.sidebar-scroll');
    await sidebarScroll.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(300);
    
    // Take screenshot of the scrolled sidebar bottom
    const SCREENSHOT_SCROLLED = path.join(ARTIFACTS_DIR, 'scrolled_sidebar.png');
    await page.screenshot({ path: SCREENSHOT_SCROLLED });
    console.log(`📸 Scrolled sidebar screenshot saved to: ${SCREENSHOT_SCROLLED}`);

    // Click theme toggle button to switch to dark mode
    console.log('🌓 Clicking on theme toggle button...');
    const themeBtn = page.locator('button.tbar-theme-toggle');
    await themeBtn.waitFor({ state: 'visible', timeout: 5000 });
    await themeBtn.click();
    console.log('✅ Clicked theme toggle button.');
    await page.waitForTimeout(300);
    
    // Take screenshot of dark mode page
    const SCREENSHOT_DARK = path.join(ARTIFACTS_DIR, 'dark_page.png');
    await page.screenshot({ path: SCREENSHOT_DARK });
    console.log(`📸 Dark mode page screenshot saved to: ${SCREENSHOT_DARK}`);

    // Switch back to light mode for wizard screenshot
    console.log('🌓 Switching back to light mode...');
    await themeBtn.click();
    await page.waitForTimeout(300);

    // Click "New Resume" button
    console.log('🖱️ Clicking on "New Resume" button...');
    const btn = page.locator('button.btn-new-profile');
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    console.log('✅ Clicked "New Resume" button.');

    // Wait for the wizard overlay to be visible
    console.log('⏳ Waiting for wizard overlay...');
    const overlay = page.locator('.wizard-overlay');
    await overlay.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(400); // Wait for transition animations to finish
    console.log('✅ Wizard overlay is visible and animations finished.');

    // Take screenshot of wizard overlay
    await page.screenshot({ path: SCREENSHOT_WIZARD });
    console.log(`📸 Wizard overlay screenshot saved to: ${SCREENSHOT_WIZARD}`);

  } catch (e) {
    console.error('❌ Diagnostics failed:', e.message);
  } finally {
    await browser.close();
    console.log('🔒 Browser closed.');
  }
}

run();
