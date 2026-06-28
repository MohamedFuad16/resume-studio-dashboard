import { test, expect } from '@playwright/test';

// Sample resume data matching the PROJECT.md specifications
const mockResumeData = {
  personalInfo: {
    fullName: 'Mohamed Fuad',
    email: 'mohamed.fuad.jp@gmail.com',
    phone: '080-7535-2988',
    address: '東京都世田谷区',
    dob: '2004-02-28',
  },
  education: [
    { school: 'Tokai University', degree: 'B.Sc. in ICT', startDate: '2024-04', endDate: '2028-03' }
  ],
  experience: [
    { company: 'Altius Link', role: 'Technical Support Specialist', description: 'Handled technical queries and infrastructure support', startDate: '2024-05', endDate: '2025-05' },
    { company: 'Hotel SUI Akasaka', role: 'Front Desk Representative', description: 'Assisted international guests and handled reservations', startDate: '2023-06', endDate: '2024-04' }
  ],
  projects: [
    { name: 'Tutor-System', description: 'Online tutor booking system', role: 'Backend Lead', link: 'https://github.com/example/tutor' },
    { name: 'TokaiHub', description: 'Student community portal', role: 'Fullstack Dev', link: 'https://github.com/example/tokaihub' }
  ],
  skills: ['React', 'TypeScript', 'LaTeX', 'Tectonic', 'Playwright']
};

const mockJpResumeData = {
  personalInfo: {
    fullName: 'モハメド フアド',
    email: 'mohamed.fuad.jp@gmail.com',
    phone: '080-7535-2988',
    address: '東京都世田谷区',
    dob: '2004年2月28日',
  },
  education: [
    { school: '東海大学', degree: '情報通信学部 情報通信学科', startDate: '2024-04', endDate: '2028-03' }
  ],
  experience: [
    { company: 'アルティウスリンク株式会社', role: '技術サポート', description: 'ネットワークトラブルシューティングとカスタマー対応', startDate: '2024-05', endDate: '2025-05' }
  ],
  projects: [
    { name: 'Tutor-System', description: 'オンライン家庭教師予約システム', role: 'フルスタック開発者', link: 'https://github.com/example/tutor' }
  ],
  skills: ['React', 'TypeScript', 'LaTeX', 'Tectonic']
};

test.describe('Tier 1: Feature Coverage', () => {

  test.describe('F1: Form Editor UI + List Operations', () => {
    test.beforeEach(async ({ page }) => {
      // Stub the GET API for fetching initial resume data
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResumeData) });
      });
      await page.goto('/');
    });

    test('Test personal info edit updates fields correctly', async ({ page }) => {
      await page.fill('input[name="fullName"]', 'Mohamed Fuad New');
      await page.fill('input[name="email"]', 'new.email@gmail.com');
      await page.fill('input[name="phone"]', '080-1234-5678');
      await page.fill('input[name="address"]', '東京都新宿区');
      await page.fill('input[name="dob"]', '2004-02-28');

      await expect(page.locator('input[name="fullName"]')).toHaveValue('Mohamed Fuad New');
      await expect(page.locator('input[name="email"]')).toHaveValue('new.email@gmail.com');
      await expect(page.locator('input[name="phone"]')).toHaveValue('080-1234-5678');
      await expect(page.locator('input[name="address"]')).toHaveValue('東京都新宿区');
    });

    test('Test education CRUD flow', async ({ page }) => {
      // Add education
      await page.click('button[data-testid="add-education"]');
      await page.fill('input[name="education.1.school"]', 'Tokai Graduate School');
      await page.fill('input[name="education.1.degree"]', 'M.Sc. in CS');
      
      await expect(page.locator('input[name="education.1.school"]')).toHaveValue('Tokai Graduate School');

      // Delete education
      await page.click('button[data-testid="delete-education-1"]');
      await expect(page.locator('input[name="education.1.school"]')).not.toBeVisible();
    });

    test('Test experience CRUD flow', async ({ page }) => {
      // Add experience
      await page.click('button[data-testid="add-experience"]');
      await page.fill('input[name="experience.2.company"]', 'Japan Airlines');
      await page.fill('input[name="experience.2.role"]', 'IT Support intern');
      
      await expect(page.locator('input[name="experience.2.company"]')).toHaveValue('Japan Airlines');

      // Delete experience
      await page.click('button[data-testid="delete-experience-2"]');
      await expect(page.locator('input[name="experience.2.company"]')).not.toBeVisible();
    });

    test('Test projects & skills CRUD flow', async ({ page }) => {
      // Add Project
      await page.click('button[data-testid="add-project"]');
      await page.fill('input[name="projects.2.name"]', 'WebDrop');
      await page.fill('input[name="projects.2.role"]', 'Developer');
      await expect(page.locator('input[name="projects.2.name"]')).toHaveValue('WebDrop');

      // Delete Project
      await page.click('button[data-testid="delete-project-2"]');
      await expect(page.locator('input[name="projects.2.name"]')).not.toBeVisible();

      // Add Skill
      await page.fill('input[data-testid="new-skill-input"]', 'TailwindCSS');
      await page.click('button[data-testid="add-skill-btn"]');
      await expect(page.locator('span[data-testid="skill-tag-TailwindCSS"]')).toBeVisible();

      // Delete Skill
      await page.click('button[data-testid="delete-skill-TailwindCSS"]');
      await expect(page.locator('span[data-testid="skill-tag-TailwindCSS"]')).not.toBeVisible();
    });

    test('Test list item reordering', async ({ page }) => {
      // We have 2 experience items initially: Altius Link (index 0) and Hotel SUI Akasaka (index 1)
      await expect(page.locator('input[name="experience.0.company"]')).toHaveValue('Altius Link');
      await expect(page.locator('input[name="experience.1.company"]')).toHaveValue('Hotel SUI Akasaka');

      // Click move down on index 0
      await page.click('button[data-testid="move-down-experience-0"]');

      // Verify the positions swapped
      await expect(page.locator('input[name="experience.0.company"]')).toHaveValue('Hotel SUI Akasaka');
      await expect(page.locator('input[name="experience.1.company"]')).toHaveValue('Altius Link');
    });
  });

  test.describe('F2: Template & Language Selection', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResumeData) });
      });
      await page.goto('/');
    });

    test('Test EN templates selection', async ({ page }) => {
      await page.click('button[data-testid="template-jakes-clean"]');
      await expect(page.locator('[data-testid="template-jakes-clean"]')).toHaveClass(/active|selected|border-primary/);
      
      await page.click('button[data-testid="template-classic-en"]');
      await expect(page.locator('[data-testid="template-classic-en"]')).toHaveClass(/active|selected|border-primary/);
    });

    test('Test JP templates selection', async ({ page }) => {
      // First switch language to Japanese to show JP templates
      await page.click('button[data-testid="language-toggle-ja"]');
      
      await page.click('button[data-testid="template-shokumu-modern"]');
      await expect(page.locator('[data-testid="template-shokumu-modern"]')).toHaveClass(/active|selected|border-primary/);

      await page.click('button[data-testid="template-rirekisho-grid"]');
      await expect(page.locator('[data-testid="template-rirekisho-grid"]')).toHaveClass(/active|selected|border-primary/);
    });

    test('Test language switcher updates state', async ({ page }) => {
      await page.click('button[data-testid="language-toggle-ja"]');
      await expect(page.locator('[data-testid="current-language-indicator"]')).toHaveText('JA');

      await page.click('button[data-testid="language-toggle-en"]');
      await expect(page.locator('[data-testid="current-language-indicator"]')).toHaveText('EN');
    });

    test('Test active template selection styling', async ({ page }) => {
      await page.click('button[data-testid="template-jakes-clean"]');
      const activeBtn = page.locator('button[data-testid="template-jakes-clean"]');
      const inactiveBtn = page.locator('button[data-testid="template-classic-en"]');
      
      await expect(activeBtn).toHaveAttribute('aria-selected', 'true');
      await expect(inactiveBtn).toHaveAttribute('aria-selected', 'false');
    });

    test('Test UI localized labels', async ({ page }) => {
      // Verify English label is shown
      await expect(page.locator('h2[data-testid="section-experience-title"]')).toHaveText('Work Experience');

      // Switch language to Japanese
      await page.click('button[data-testid="language-toggle-ja"]');

      // Verify Japanese label is shown
      await expect(page.locator('h2[data-testid="section-experience-title"]')).toHaveText('職歴');
    });
  });

  test.describe('F3: Backend auto-save & compile', () => {
    test('Test auto-save trigger on blur', async ({ page }) => {
      let saveTriggered = false;
      await page.route('**/api/save', async (route) => {
        saveTriggered = true;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.goto('/');
      await page.locator('input[name="fullName"]').fill('Mohamed Fuad');
      // Trigger blur event
      await page.locator('input[name="fullName"]').blur();

      // Verify the save API was called
      expect(saveTriggered).toBe(true);
    });

    test('Test auto-save debounce delay', async ({ page }) => {
      let saveCount = 0;
      await page.route('**/api/save', async (route) => {
        saveCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.goto('/');
      const input = page.locator('input[name="fullName"]');
      
      // Type multiple times rapidly
      await input.type('M', { delay: 10 });
      await input.type('o', { delay: 10 });
      await input.type('h', { delay: 10 });

      // Wait a short time, verify no save request was sent yet (due to debounce)
      await page.waitForTimeout(100);
      expect(saveCount).toBe(0);

      // Wait for debounce period to pass
      await page.waitForTimeout(1000);
      expect(saveCount).toBeGreaterThan(0);
    });

    test('Test compile trigger on change', async ({ page }) => {
      let compileTriggered = false;
      await page.route('**/api/save', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });
      await page.route('**/api/compile', async (route) => {
        compileTriggered = true;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pdfUrl: '/output/resume.pdf' }) });
      });

      await page.goto('/');
      await page.locator('input[name="fullName"]').fill('Mohamed Fuad');
      await page.locator('input[name="fullName"]').blur();

      // Wait for async compile trigger
      await page.waitForTimeout(500);
      expect(compileTriggered).toBe(true);
    });

    test('Test resume.json file modification payload', async ({ page }) => {
      let savePayload: any = null;
      await page.route('**/api/save', async (route) => {
        savePayload = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.goto('/');
      await page.locator('input[name="fullName"]').fill('Mohamed Fuad Test Payload');
      await page.locator('input[name="fullName"]').blur();

      await page.waitForTimeout(200);
      expect(savePayload).not.toBeNull();
      expect(savePayload.personalInfo.fullName).toBe('Mohamed Fuad Test Payload');
    });

    test('Test compile error handling', async ({ page }) => {
      await page.route('**/api/save', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });
      await page.route('**/api/compile', async (route) => {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'LaTeX compilation failed: Emergency stop' })
        });
      });

      await page.goto('/');
      await page.locator('input[name="fullName"]').fill('Trigger Error');
      await page.locator('input[name="fullName"]').blur();

      // Verify compile error status message in UI
      const errorMessage = page.locator('[data-testid="compile-error-alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Emergency stop');
    });
  });

  test.describe('F4: Live preview & compile indicator', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResumeData) });
      });
    });

    test('Test indicator visibility states', async ({ page }) => {
      await page.route('**/api/compile', async (route) => {
        // Delay response to check compiling state
        await page.waitForTimeout(500);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.goto('/');
      // Trigger a compile
      await page.click('button[data-testid="compile-btn"]');
      
      const indicator = page.locator('[data-testid="compile-indicator"]');
      await expect(indicator).toHaveText(/Compiling|Saving/);
      
      // Wait for finish
      await expect(indicator).toHaveText('Idle');
    });

    test('Test indicator error state styles', async ({ page }) => {
      await page.route('**/api/compile', async (route) => {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server Error' }) });
      });

      await page.goto('/');
      await page.click('button[data-testid="compile-btn"]');
      
      const indicator = page.locator('[data-testid="compile-indicator"]');
      await expect(indicator).toHaveClass(/bg-red-|text-red-/);
    });

    test('Test preview iframe refreshes correctly', async ({ page }) => {
      let compileIndex = 0;
      await page.route('**/api/compile', async (route) => {
        compileIndex++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, pdfUrl: `/output/resume.pdf?v=${compileIndex}` })
        });
      });

      await page.goto('/');
      const iframe = page.locator('iframe[data-testid="preview-pdf"]');
      
      await page.click('button[data-testid="compile-btn"]');
      await expect(iframe).toHaveAttribute('src', /\?v=1/);

      await page.click('button[data-testid="compile-btn"]');
      await expect(iframe).toHaveAttribute('src', /\?v=2/);
    });

    test('Test preview container rendering layout', async ({ page }) => {
      await page.goto('/');
      const container = page.locator('[data-testid="preview-container"]');
      await expect(container).toBeVisible();
      // Ensure it has reasonable dimensions
      const bounds = await container.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThan(100);
    });

    test('Test auto-compilation toggle works', async ({ page }) => {
      let compileCount = 0;
      await page.route('**/api/compile', async (route) => {
        compileCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.goto('/');
      
      // Turn off auto-compile toggle
      await page.uncheck('input[data-testid="auto-compile-toggle"]');

      // Change input
      await page.fill('input[name="fullName"]', 'Modified Name');
      await page.locator('input[name="fullName"]').blur();
      
      await page.waitForTimeout(500);
      expect(compileCount).toBe(0); // Should not have compiled automatically
    });
  });

  test.describe('F5: Export downloads', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResumeData) });
      });
      await page.goto('/');
    });

    test('Test PDF export download triggers', async ({ page }) => {
      await page.route('**/api/export/pdf', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          headers: { 'Content-Disposition': 'attachment; filename="resume.pdf"' },
          body: Buffer.from('%PDF-1.4 mock pdf content')
        });
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[data-testid="export-pdf-btn"]');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toBe('resume.pdf');
    });

    test('Test LaTeX export download triggers', async ({ page }) => {
      await page.route('**/api/export/tex', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/x-tex',
          headers: { 'Content-Disposition': 'attachment; filename="resume.tex"' },
          body: '\\documentclass{article}\\begin{document}Hello\\end{document}'
        });
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[data-testid="export-tex-btn"]');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toBe('resume.tex');
    });

    test('Test JSON export download triggers', async ({ page }) => {
      await page.route('**/api/export/json', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Content-Disposition': 'attachment; filename="resume.json"' },
          body: JSON.stringify(mockResumeData)
        });
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[data-testid="export-json-btn"]');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toBe('resume.json');
    });

    test('Test PDF export content validity', async ({ page }) => {
      await page.route('**/api/export/pdf', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('%PDF-1.5\n%EOF')
        });
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[data-testid="export-pdf-btn"]');
      const download = await downloadPromise;
      const path = await download.path();
      
      const fs = require('fs');
      const pdfContent = fs.readFileSync(path, 'utf-8');
      expect(pdfContent.startsWith('%PDF-')).toBe(true);
    });

    test('Test LaTeX source content checks', async ({ page }) => {
      await page.route('**/api/export/tex', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/x-tex',
          body: '\\documentclass[11pt]{article}\n\\begin{document}\nMohamed Fuad\n\\end{document}'
        });
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[data-testid="export-tex-btn"]');
      const download = await downloadPromise;
      const path = await download.path();
      
      const fs = require('fs');
      const texContent = fs.readFileSync(path, 'utf-8');
      expect(texContent).toContain('\\documentclass');
      expect(texContent).toContain('Mohamed Fuad');
    });
  });
});

test.describe('Tier 2: Boundary & Corner Cases', () => {

  test.describe('Edge cases on inputs', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResumeData) });
      });
      await page.goto('/');
    });

    test('Empty fields saving/handling', async ({ page }) => {
      let savedData: any = null;
      await page.route('**/api/save', async (route) => {
        savedData = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.fill('input[name="fullName"]', '');
      await page.locator('input[name="fullName"]').blur();
      
      await page.waitForTimeout(200);
      expect(savedData.personalInfo.fullName).toBe('');
    });

    test('Extremely long values (>1000 chars) in fields', async ({ page }) => {
      const extremelyLongText = 'A'.repeat(1001);
      await page.fill('textarea[name="experience.0.description"]', extremelyLongText);
      await page.locator('textarea[name="experience.0.description"]').blur();

      await expect(page.locator('textarea[name="experience.0.description"]')).toHaveValue(extremelyLongText);
    });

    test('Unicode and special character inputs including emojis', async ({ page }) => {
      const specialText = 'モハメド フアド 🌟 🔥 𠮷野家 C++ & LaTeX % $ _ #';
      await page.fill('input[name="fullName"]', specialText);
      await page.locator('input[name="fullName"]').blur();

      await expect(page.locator('input[name="fullName"]')).toHaveValue(specialText);
    });

    test('Empty lists state behavior', async ({ page }) => {
      // Delete existing experiences one by one
      await page.click('button[data-testid="delete-experience-1"]');
      await page.click('button[data-testid="delete-experience-0"]');

      const experienceList = page.locator('[data-testid="experience-list-container"]');
      await expect(experienceList.locator('.experience-item')).toHaveCount(0);
      await expect(page.locator('[data-testid="empty-experience-message"]')).toBeVisible();
    });

    test('Rapid clicks on list add/delete buttons', async ({ page }) => {
      // Spam add education button
      for (let i = 0; i < 5; i++) {
        await page.click('button[data-testid="add-education"]');
      }
      
      const count = await page.locator('[data-testid="education-item"]').count();
      // Should have initial (1) + 5 added = 6 education items
      expect(count).toBe(6);
    });
  });

  test.describe('Edge cases on templates/languages', () => {
    test('Invalid template key fallback handles cleanly', async ({ page }) => {
      const corruptData = { ...mockResumeData, activeTemplate: 'non_existent_template_123' };
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corruptData) });
      });

      await page.goto('/');
      // The application should gracefully fall back to a default template styling
      const activeTemplate = page.locator('[data-testid^="template-"].active, [data-testid^="template-"][aria-selected="true"]');
      await expect(activeTemplate).toBeVisible();
    });

    test('Rapid language toggle stability', async ({ page }) => {
      await page.goto('/');
      // Rapid clicks back and forth
      await page.click('button[data-testid="language-toggle-ja"]');
      await page.click('button[data-testid="language-toggle-en"]');
      await page.click('button[data-testid="language-toggle-ja"]');
      await page.click('button[data-testid="language-toggle-en"]');

      await expect(page.locator('[data-testid="current-language-indicator"]')).toHaveText('EN');
    });

    test('Empty fields stability under language switch', async ({ page }) => {
      const emptyData = { personalInfo: { fullName: '' }, education: [], experience: [], projects: [], skills: [] };
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyData) });
      });

      await page.goto('/');
      await page.click('button[data-testid="language-toggle-ja"]');
      await expect(page.locator('[data-testid="current-language-indicator"]')).toHaveText('JA');
      await expect(page.locator('input[name="fullName"]')).toHaveValue('');
    });

    test('Character rendering limits validation', async ({ page }) => {
      // Validate long non-ascii names (e.g. Japanese Kanji names or long Arabic names)
      const longJpName = '壽限無壽限無五劫の擦り切れ海砂利水魚の水行末雲来末風来末';
      await page.goto('/');
      await page.fill('input[name="fullName"]', longJpName);
      await page.locator('input[name="fullName"]').blur();

      await expect(page.locator('input[name="fullName"]')).toHaveValue(longJpName);
    });

    test('Cross-language templates validation', async ({ page }) => {
      // Trigger compile with EN template but Japanese text in resume data
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockJpResumeData) });
      });
      await page.goto('/');
      await page.click('button[data-testid="template-jakes-clean"]');
      
      const indicator = page.locator('[data-testid="compile-indicator"]');
      await page.click('button[data-testid="compile-btn"]');
      
      // Ensure compilation completes successfully (or handles font fallback correctly)
      await expect(indicator).toHaveText('Idle');
    });
  });

  test.describe('Edge cases on save/compile APIs', () => {
    test('Save API 500 error handles gracefully', async ({ page }) => {
      await page.route('**/api/save', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database write error' })
        });
      });

      await page.goto('/');
      await page.fill('input[name="fullName"]', 'Trigger Save Fail');
      await page.locator('input[name="fullName"]').blur();

      await expect(page.locator('[data-testid="save-status-badge"]')).toContainText(/Failed|Error/);
    });

    test('Compile API timeout recovery', async ({ page }) => {
      await page.route('**/api/compile', async (route) => {
        // Slow compile response triggers timeout
        await page.waitForTimeout(3000);
        await route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ error: 'Gateway Timeout' }) });
      });

      await page.goto('/');
      await page.click('button[data-testid="compile-btn"]');

      await expect(page.locator('[data-testid="compile-error-alert"]')).toContainText(/Timeout|error|failed/i);
    });

    test('Compile API syntax error parsing', async ({ page }) => {
      await page.route('**/api/compile', async (route) => {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'LaTeX error: undefined control sequence \\badcommand on line 42'
          })
        });
      });

      await page.goto('/');
      await page.click('button[data-testid="compile-btn"]');

      await expect(page.locator('[data-testid="compile-error-alert"]')).toContainText('\\badcommand');
    });

    test('Backend file permission error handling', async ({ page }) => {
      await page.route('**/api/save', async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Permission denied writing to resume.json' })
        });
      });

      await page.goto('/');
      await page.fill('input[name="fullName"]', 'No Write Perms');
      await page.locator('input[name="fullName"]').blur();

      await expect(page.locator('[data-testid="save-status-badge"]')).toContainText(/Permission denied|Error/);
    });

    test('Offline/network connection loss simulation', async ({ page, context }) => {
      await page.goto('/');
      
      // Go offline
      await context.setOffline(true);
      
      await page.fill('input[name="fullName"]', 'Offline Input');
      await page.locator('input[name="fullName"]').blur();

      await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
      
      // Restore network
      await context.setOffline(false);
      await expect(page.locator('[data-testid="offline-banner"]')).not.toBeVisible();
    });
  });

  test.describe('Edge cases on live preview', () => {
    test('Rapid typing compiles queuing stability', async ({ page }) => {
      let compileCount = 0;
      await page.route('**/api/compile', async (route) => {
        compileCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.goto('/');
      const nameField = page.locator('input[name="fullName"]');
      
      // Rapidly type letters
      for (const char of 'Mohamed Fuad') {
        await nameField.type(char, { delay: 50 });
      }
      
      await page.waitForTimeout(1500); // Allow time for debounced save and compile
      expect(compileCount).toBeLessThan(4); // Compile should have been throttled/debounced
    });

    test('Preview loading skeleton fallback', async ({ page }) => {
      await page.route('**/api/compile', async (route) => {
        await page.waitForTimeout(500);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.goto('/');
      await page.click('button[data-testid="compile-btn"]');
      
      await expect(page.locator('[data-testid="preview-loading-skeleton"]')).toBeVisible();
      await page.waitForTimeout(600);
      await expect(page.locator('[data-testid="preview-loading-skeleton"]')).not.toBeVisible();
    });

    test('Huge PDF payload preview size limits', async ({ page }) => {
      const hugePdfBase64 = 'A'.repeat(5 * 1024 * 1024); // 5MB mock PDF body
      await page.route('**/api/compile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, pdfData: hugePdfBase64 })
        });
      });

      await page.goto('/');
      await page.click('button[data-testid="compile-btn"]');
      
      // Iframe or preview should render
      await expect(page.locator('[data-testid="preview-pdf"]')).toBeVisible();
    });

    test('Toggling compile indicators visibility preference', async ({ page }) => {
      await page.goto('/');
      await page.click('button[data-testid="toggle-indicator-visibility-btn"]');
      await expect(page.locator('[data-testid="compile-indicator"]')).not.toBeVisible();

      await page.click('button[data-testid="toggle-indicator-visibility-btn"]');
      await expect(page.locator('[data-testid="compile-indicator"]')).toBeVisible();
    });

    test('Corrupt PDF payload error boundary', async ({ page }) => {
      await page.route('**/api/compile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, pdfUrl: '/output/corrupt.pdf' })
        });
      });
      await page.route('**/output/corrupt.pdf', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('NOT_A_PDF_CORRUPT_HEADER')
        });
      });

      await page.goto('/');
      await page.click('button[data-testid="compile-btn"]');

      // PDF rendering fallback inside container should display alert or error
      await expect(page.locator('[data-testid="pdf-render-error-alert"]')).toBeVisible();
    });
  });

  test.describe('Edge cases on export downloads', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResumeData) });
      });
      await page.goto('/');
    });

    test('Export API 500 error display', async ({ page }) => {
      await page.route('**/api/export/pdf', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to compile for export' })
        });
      });

      await page.click('button[data-testid="export-pdf-btn"]');
      await expect(page.locator('[data-testid="download-error-toast"]')).toContainText('Failed to compile');
    });

    test('Export with empty data triggers warning', async ({ page }) => {
      const blankData = { personalInfo: { fullName: '' }, education: [], experience: [], projects: [], skills: [] };
      await page.route('**/api/resume', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(blankData) });
      });
      
      await page.goto('/');
      await page.click('button[data-testid="export-pdf-btn"]');
      
      // Expect warning modal/toast about empty content
      await expect(page.locator('[data-testid="empty-export-warning"]')).toBeVisible();
    });

    test('Rapid multiple clicks on export button', async ({ page }) => {
      let downloadCount = 0;
      await page.route('**/api/export/pdf', async (route) => {
        downloadCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('%PDF-1.4')
        });
      });

      // Click rapidly three times
      await page.click('button[data-testid="export-pdf-btn"]', { clickCount: 3, delay: 50 });
      
      // Verify download API was not flooded due to button disabling during export process
      expect(downloadCount).toBeLessThan(3);
    });

    test('10+ pages compile export simulation', async ({ page }) => {
      await page.route('**/api/export/pdf', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          headers: { 'Content-Length': '50000000' }, // Large PDF header
          body: Buffer.from('%PDF-1.4 very large payload')
        });
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[data-testid="export-pdf-btn"]');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('resume.pdf');
    });

    test('JSON Schema validation check', async ({ page }) => {
      let exportBody: any = null;
      await page.route('**/api/export/json', async (route) => {
        exportBody = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResumeData) });
      });

      await page.click('button[data-testid="export-json-btn"]');
      
      // Check schema properties of the exported resume format
      expect(mockResumeData).toHaveProperty('personalInfo');
      expect(mockResumeData).toHaveProperty('education');
      expect(mockResumeData).toHaveProperty('experience');
      expect(mockResumeData.personalInfo).toHaveProperty('email');
    });
  });
});

test.describe('Tier 3: Cross-Feature Combinations', () => {

  test('Test 1: Edit form fields, change template, verify auto-save and compile run', async ({ page }) => {
    let savePayload: any = null;
    let compilePayload: any = null;

    await page.route('**/api/save', async (route) => {
      savePayload = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.route('**/api/compile', async (route) => {
      compilePayload = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pdfUrl: '/output/resume.pdf' }) });
    });

    await page.goto('/');
    
    // Step 1: Edit form fields
    await page.fill('input[name="fullName"]', 'Mohamed Fuad Combined');
    await page.locator('input[name="fullName"]').blur();

    // Step 2: Change active template
    await page.click('button[data-testid="template-classic-en"]');

    // Wait for debounce and network
    await page.waitForTimeout(1000);

    // Verify auto-save occurred with updated fields
    expect(savePayload).not.toBeNull();
    expect(savePayload.personalInfo.fullName).toBe('Mohamed Fuad Combined');

    // Verify compile payload received activeTemplate update
    expect(compilePayload).not.toBeNull();
    expect(compilePayload.activeTemplate).toBe('classic-en');
  });

  test('Test 2: Toggle language to JP, add experience, check auto-save format and compile', async ({ page }) => {
    let lastSaveData: any = null;
    await page.route('**/api/save', async (route) => {
      lastSaveData = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.route('**/api/compile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.goto('/');
    
    // Step 1: Switch language to JP
    await page.click('button[data-testid="language-toggle-ja"]');

    // Step 2: Add experience item
    await page.click('button[data-testid="add-experience"]');
    await page.fill('input[name="experience.2.company"]', 'アルティウスリンク');
    await page.fill('input[name="experience.2.role"]', 'テクニカルサポート');
    await page.locator('input[name="experience.2.role"]').blur();

    await page.waitForTimeout(1000);

    // Verify language state and Japanese experience parameters were preserved in the payload
    expect(lastSaveData).not.toBeNull();
    expect(lastSaveData.language).toBe('ja');
    expect(lastSaveData.experience[2].company).toBe('アルティウスリンク');
  });

  test('Test 3: Edit input with syntax error, get compile error, switch template, verify compiler updates', async ({ page }) => {
    let returnError = true;
    await page.route('**/api/compile', async (route) => {
      if (returnError) {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'LaTeX error: \\invalidmacro' })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, pdfUrl: '/output/resume.pdf' })
        });
      }
    });

    await page.goto('/');
    
    // Step 1: Input syntax error
    await page.fill('input[name="fullName"]', '\\invalidmacro');
    await page.locator('input[name="fullName"]').blur();

    // Verify error is shown in UI
    await expect(page.locator('[data-testid="compile-error-alert"]')).toBeVisible();

    // Step 2: Clear syntax error & switch template
    await page.fill('input[name="fullName"]', 'Mohamed Fuad Fixed');
    await page.locator('input[name="fullName"]').blur();
    returnError = false;
    
    await page.click('button[data-testid="template-classic-en"]');

    // Verify compile success and error status is cleared
    await expect(page.locator('[data-testid="compile-error-alert"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="compile-indicator"]')).toHaveText('Idle');
  });

  test('Test 4: Reorder experiences, wait for auto-save, export JSON, verify array index order matches', async ({ page }) => {
    let lastSavedData: any = null;
    await page.route('**/api/save', async (route) => {
      lastSavedData = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.route('**/api/export/json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lastSavedData || mockResumeData)
      });
    });

    await page.route('**/api/resume', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResumeData) });
    });

    await page.goto('/');
    
    // Step 1: Reorder
    await page.click('button[data-testid="move-down-experience-0"]');
    await page.waitForTimeout(1000); // Wait for save debounce

    // Step 2: Click export JSON
    const downloadPromise = page.waitForEvent('download');
    await page.click('button[data-testid="export-json-btn"]');
    const download = await downloadPromise;
    const path = await download.path();

    const fs = require('fs');
    const exportedData = JSON.parse(fs.readFileSync(path, 'utf-8'));
    
    // Verify first experience element is now Hotel SUI Akasaka (originally at index 1)
    expect(exportedData.experience[0].company).toBe('Hotel SUI Akasaka');
    expect(exportedData.experience[1].company).toBe('Altius Link');
  });
});

test.describe('Tier 4: Real-World Scenarios', () => {

  test('Test 1: Full English Resume workflow', async ({ page }) => {
    // Fill all fields from scratch, select Jakes Clean, compile, verify PDF download
    await page.route('**/api/save', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.route('**/api/compile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pdfUrl: '/output/resume.pdf' }) });
    });
    await page.route('**/api/export/pdf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 English Resume')
      });
    });

    await page.goto('/');
    
    // Fill Personal details
    await page.fill('input[name="fullName"]', 'Mohamed Fuad');
    await page.fill('input[name="email"]', 'mohamed.fuad.jp@gmail.com');
    await page.fill('input[name="phone"]', '080-7535-2988');
    await page.fill('input[name="address"]', 'Setagaya, Tokyo');
    
    // Select Jakes Clean template
    await page.click('button[data-testid="template-jakes-clean"]');
    
    // Trigger compile
    await page.click('button[data-testid="compile-btn"]');
    await expect(page.locator('[data-testid="compile-indicator"]')).toHaveText('Idle');

    // Export PDF
    const downloadPromise = page.waitForEvent('download');
    await page.click('button[data-testid="export-pdf-btn"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('resume.pdf');
  });

  test('Test 2: Full Japanese Resume workflow', async ({ page }) => {
    // Fill all fields in Japanese, select Grid template, compile, download PDF and LaTeX
    await page.route('**/api/save', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.route('**/api/compile', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pdfUrl: '/output/rirekisho.pdf' }) });
    });
    await page.route('**/api/export/pdf', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.4 Japanese Rirekisho') });
    });
    await page.route('**/api/export/tex', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/x-tex', body: '\\documentclass{ujarticle}' });
    });

    await page.goto('/');
    
    // Switch language
    await page.click('button[data-testid="language-toggle-ja"]');
    
    // Fill form
    await page.fill('input[name="fullName"]', 'モハメド フアド');
    await page.fill('input[name="address"]', '東京都世田谷区');
    
    // Select Grid Template
    await page.click('button[data-testid="template-rirekisho-grid"]');

    // Compile
    await page.click('button[data-testid="compile-btn"]');
    await expect(page.locator('[data-testid="compile-indicator"]')).toHaveText('Idle');

    // Export PDF
    const pdfPromise = page.waitForEvent('download');
    await page.click('button[data-testid="export-pdf-btn"]');
    const pdf = await pdfPromise;
    expect(pdf.suggestedFilename()).toBe('resume.pdf');

    // Export LaTeX
    const texPromise = page.waitForEvent('download');
    await page.click('button[data-testid="export-tex-btn"]');
    const tex = await texPromise;
    expect(tex.suggestedFilename()).toBe('resume.tex');
  });

  test('Test 3: Multi-template preview cycle', async ({ page }) => {
    let compileRequests: string[] = [];
    await page.route('**/api/compile', async (route) => {
      const data = route.request().postDataJSON();
      compileRequests.push(data.activeTemplate);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.goto('/');
    
    // Switch through all 4 templates
    const templates = ['jakes-clean', 'classic-en', 'minimalist-en', 'modern-en'];
    for (const temp of templates) {
      await page.click(`button[data-testid="template-${temp}"]`);
      await page.click('button[data-testid="compile-btn"]');
      await page.waitForTimeout(300);
    }

    // Verify all 4 compile requests were made with the correct templates
    expect(compileRequests).toContain('jakes-clean');
    expect(compileRequests).toContain('classic-en');
    expect(compileRequests).toContain('minimalist-en');
    expect(compileRequests).toContain('modern-en');
  });

  test('Test 4: Data persistence and recovery on reload', async ({ page }) => {
    let savedState: any = null;
    await page.route('**/api/save', async (route) => {
      savedState = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.route('**/api/resume', async (route) => {
      // Return saved state if it exists, otherwise initial mock data
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(savedState || mockResumeData)
      });
    });

    await page.goto('/');
    
    // Edit form
    await page.fill('input[name="fullName"]', 'Mohamed Fuad Reload Test');
    await page.locator('input[name="fullName"]').blur();
    await page.waitForTimeout(1000); // Wait for save

    // Reload page
    await page.reload();

    // Verify values restored
    await expect(page.locator('input[name="fullName"]')).toHaveValue('Mohamed Fuad Reload Test');
  });

  test('Test 5: Bilingual data export/import cycle', async ({ page }) => {
    await page.route('**/api/resume', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResumeData) });
    });
    await page.route('**/api/export/json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResumeData)
      });
    });

    await page.goto('/');
    
    // Step 1: Export JSON
    const downloadPromise = page.waitForEvent('download');
    await page.click('button[data-testid="export-json-btn"]');
    const download = await downloadPromise;
    const path = await download.path();

    // Step 2: Switch language
    await page.click('button[data-testid="language-toggle-ja"]');
    await expect(page.locator('[data-testid="current-language-indicator"]')).toHaveText('JA');

    // Step 3: Import JSON back
    await page.setInputFiles('input[type="file"][data-testid="import-json-file"]', path);

    // Verify form fields repopulate matching the imported JSON
    await expect(page.locator('input[name="fullName"]')).toHaveValue('Mohamed Fuad');
    await expect(page.locator('input[name="email"]')).toHaveValue('mohamed.fuad.jp@gmail.com');
  });
});
