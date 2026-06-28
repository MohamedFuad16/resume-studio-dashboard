import { chromium } from '@playwright/test';

async function run() {
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 }
  });
  const page = await context.newPage();

  console.log('🌐 Navigating to resume editor...');
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForTimeout(3000);

  // Take screenshot of main page
  await page.screenshot({ path: '/Users/mfuad16/.gemini/antigravity/brain/4b8ce412-bd78-47e1-8ebd-391d32ca3f3b/editor_main.png' });
  console.log('📸 Main editor page captured.');

  await browser.close();
  console.log('🏁 Browser closed.');
}

run().catch(console.error);
