import { test, expect } from '@playwright/test';

/**
 * Smoke coverage for the CURRENT dashboard-first Internship Portal shell.
 *
 * The previous `editor.spec.ts` (~59 cases) was written against an idealized
 * form-first UI with a `/api/resume` → `personalInfo` contract that the shipped
 * app never implemented (it is dashboard-first with a `personal`/`nameEn` shape
 * and `/api/profile` + `/api/internships` endpoints). 57 of those cases failed
 * purely on spec drift, so the file was removed. Only the two language-toggle
 * behaviours that exercised the real shell survived; they are preserved below
 * alongside a few structural navigation checks. See agent/tests.md.
 *
 * The résumé editor was removed on 2026-09-24 (ADR-0042): the Profile view's
 * PDF upload replaced it, so these checks assert the editor is gone.
 */
test.describe('Internship Portal — app shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the shell with language switcher and primary navigation', async ({ page }) => {
    await expect(page.getByTestId('language-toggle-en')).toBeVisible();
    await expect(page.getByTestId('language-toggle-ja')).toBeVisible();
    await expect(page.locator('.side-nav-btn', { hasText: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.side-nav-btn', { hasText: 'Internship Radar' })).toBeVisible();
    await expect(page.locator('.side-nav-btn', { hasText: 'Editor' })).toHaveCount(0);
  });

  test('language switcher updates the active language indicator', async ({ page }) => {
    await page.getByTestId('language-toggle-ja').click();
    await expect(page.getByTestId('current-language-indicator')).toHaveText('JA');

    await page.getByTestId('language-toggle-en').click();
    await expect(page.getByTestId('current-language-indicator')).toHaveText('EN');
  });

  test('rapid language toggling stays consistent', async ({ page }) => {
    await page.getByTestId('language-toggle-ja').click();
    await page.getByTestId('language-toggle-en').click();
    await page.getByTestId('language-toggle-ja').click();
    await page.getByTestId('language-toggle-en').click();

    await expect(page.getByTestId('current-language-indicator')).toHaveText('EN');
  });

  test('primary navigation switches between dashboard, radar, and profile', async ({ page }) => {
    // Radar view exposes the internship search field.
    await page.locator('.side-nav-btn', { hasText: 'Internship Radar' }).click();
    const search = page.getByPlaceholder('Search company, role, or keyword');
    await expect(search).toBeVisible();

    // Profile view offers the résumé PDF upload that replaced the editor.
    await page.locator('.side-nav-btn', { hasText: 'Profile' }).click();
    await expect(page.getByRole('button', { name: 'Upload résumé PDF' })).toBeVisible();

    // Back to the dashboard hides the radar search field again.
    await page.locator('.side-nav-btn', { hasText: 'Dashboard' }).click();
    await expect(search).toHaveCount(0);
  });

  test('the activity period is shared between Dashboard and Applications', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Unit' }).first().selectOption('months');
    await page.locator('.side-nav-btn', { hasText: 'Applications' }).click();
    await expect(page.getByRole('combobox', { name: 'Unit' })).toHaveValue('months');
    await expect(page.getByRole('combobox', { name: 'Number' })).toHaveValue('2');
  });
});
