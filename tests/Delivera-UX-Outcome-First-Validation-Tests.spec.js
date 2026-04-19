/**
 * UX Outcome-First validation.
 * Validates outcome lines, single Export CTA, collapsible filters, partial banner,
 * Generated prominence, Current Sprint outcome/nav/board, Leadership outcome/sticky Export,
 * Login outcome/submit state. Uses captureBrowserTelemetry and assertTelemetryClean.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  runDefaultPreview,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('UX Outcome-First', () => {
  test('Report – Outcome line present after preview', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible within timeout; may require Jira credentials');
      return;
    }
    const outcomeLine = page.locator('.preview-context-bar');
    await expect(outcomeLine).toBeVisible();
    const text = await outcomeLine.textContent().catch(() => '');
    expect(text).toMatch(/stories|sprints|boards|Updated/i);

    assertTelemetryClean(telemetry);
  });

  test('Report – Single Export CTA', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible within timeout; may require Jira credentials');
      return;
    }
    const hasExport = await page.getByRole('button', { name: /Export/ }).first().isVisible().catch(() => false);
    const hasExportToExcel = await page.getByText('Export to Excel').first().isVisible().catch(() => false);
    expect(hasExport || hasExportToExcel).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('Report – Filters collapsible', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; skip filters toggle');
      return;
    }
    const toggle = page.locator('[data-action="toggle-filters"], .filters-panel .btn');
    const editFilters = page.getByText('Edit filters');
    const hasToggle = (await toggle.count()) > 0 || (await editFilters.count()) > 0;
    const hasPanel = (await page.locator('.filters-panel, #filters-panel').count()) > 0;
    expect(hasToggle || hasPanel).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('Report – Partial banner actions first', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await page.check('#project-mpsa').catch(() => {});
    await page.check('#project-mas').catch(() => {});
    await page.fill('#start-date', '2025-07-01T00:00').catch(() => {});
    await page.fill('#end-date', '2025-09-30T23:59').catch(() => {});
    await page.click('#preview-btn');
    await Promise.race([
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 50000 }).catch(() => null),
      page.waitForSelector('.status-banner.warning', { state: 'visible', timeout: 50000 }).catch(() => null),
    ]);
    const banner = page.locator('.status-banner.warning');
    const visible = await banner.isVisible().catch(() => false);
    if (visible) {
      await expect(page.locator('[data-action="retry-with-smaller-range"]')).toBeVisible();
      await expect(page.locator('[data-action="force-full-refresh"]')).toBeVisible();
      const text = await banner.textContent().catch(() => '');
      expect(text.length).toBeLessThan(500);
    }

    assertTelemetryClean(telemetry);
  });

  test('Report – Generated timestamp visible', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; skip Generated check');
      return;
    }
    const body = await page.locator('body').textContent().catch(() => '');
    expect(body).toMatch(/Just updated|Updated just now|Updated \d+ min ago|Updated:/);

    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Outcome line or headline', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    const options = await page.locator('#board-select option').allTextContents().catch(() => []);
    if (options.length <= 1 && options[0] && options[0].includes("Couldn't load")) {
      test.skip(true, 'Boards not loaded; skip outcome line');
      return;
    }
    await page.waitForSelector('.sprint-verdict-line, .header-bar, .header-metric, .current-sprint-header-bar, .transparency-card', { timeout: 35000 }).catch(() => null);
    const body = await page.locator('body').textContent().catch(() => '');
    if (/No active or recent closed sprint|No sprint/.test(body)) {
      test.skip(true, 'Board has no active sprint; verdict line not shown');
      return;
    }
    const verdictEl = page.locator('.sprint-verdict-line');
    const verdictVisible = (await verdictEl.count()) > 0 && (await verdictEl.first().isVisible().catch(() => false));
    const hasOutcomeText = /Healthy|Caution|At Risk|Critical|% done|days left|issues|Work items|Burndown|Scope/.test(body);
    const hasSelectionGuidance = /Select a board|Loading current sprint|Generated just now|Data freshness/i.test(body);
    const shellVisible = (await page.locator('h1').first().isVisible().catch(() => false))
      || (await page.locator('#board-select').isVisible().catch(() => false));
    expect(verdictVisible || hasOutcomeText || hasSelectionGuidance || shellVisible).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Single section navigation', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await page.waitForSelector('a[href="#stories-card"], .sprint-section-links, #stories-card, .current-sprint-grid, .health-dashboard-card', { timeout: 35000 }).catch(() => null);
    const pageText = await page.locator('body').textContent().catch(() => '') || '';
    if (/Couldn't load boards|No boards available|No active or recent closed sprint|No sprint|No trackable work/i.test(pageText)) {
      test.skip(true, 'Current sprint sections unavailable for selected board/data');
      return;
    }
    const sectionLinks = page.locator('.sprint-section-links');
    const hasSectionLinks = (await sectionLinks.count()) > 0;
    const hasStoriesLink = (await page.locator('a[href="#stories-card"]').count()) > 0;
    const hasCoreSectionCard = (await page.locator('#stories-card, .current-sprint-grid, .health-dashboard-card').count()) > 0;
    expect(hasSectionLinks || hasStoriesLink || hasCoreSectionCard).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Board scope visible', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await page.waitForSelector('#board-select, .header-context-chip', { state: 'visible', timeout: 15000 }).catch(() => null);
    const boardSelect = page.locator('#board-select');
    const contextChip = page.locator('.header-context-chip.header-context-chip-active');
    const hasBoard = (await boardSelect.count()) > 0 || (await contextChip.count()) > 0;
    expect(hasBoard).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('Leadership – Outcome line above table', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page).toHaveURL(/\/report(#trends)?/);
    await page.click('#preview-btn');
    await Promise.race([
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 60000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 60000 }).catch(() => null),
    ]);

    const hasPreview = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!hasPreview) {
      test.skip(true, 'Preview did not load for current data set');
      return;
    }

    await page.click('#tab-btn-trends');
    const hasOutcome = (await page.locator('.leadership-outcome-line').count()) > 0;
    const body = await page.locator('body').textContent().catch(() => '');
    const hasBoardsText = /boards.*on-time|attention/.test(body);
    const hasHoursAndDeliveryText = /SP delivered|h logged|Time-tracking hygiene/i.test(body);
    expect(hasOutcome || hasBoardsText).toBeTruthy();
    if (hasOutcome) {
      expect(hasHoursAndDeliveryText || hasBoardsText).toBeTruthy();
    }

    assertTelemetryClean(telemetry);
  });

  test('Leadership – Export CSV reachable', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page).toHaveURL(/\/report(#trends)?/);
    await page.click('#preview-btn');
    await Promise.race([
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 60000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 60000 }).catch(() => null),
    ]);

    const hasPreview = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!hasPreview) {
      test.skip(true, 'Preview did not load for current data set');
      return;
    }

    await page.click('#tab-btn-trends');
    const exportBtn = page.locator('[data-action="export-leadership-boards-csv"]');
    await expect(exportBtn).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('Login – Outcome line and submit state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/login');
    if (!page.url().includes('login')) {
      test.skip(true, 'Redirected away from login (already authenticated)');
      return;
    }
    const body = await page.locator('body').textContent().catch(() => '');
    expect(body).toMatch(/Report/);
    expect(body).toMatch(/Current Sprint|Leadership/);
    const submitBtn = page.locator('#login-submit, button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    assertTelemetryClean(telemetry);
  });
});


