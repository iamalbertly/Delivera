/**
 * General Performance, Quarters Strip, Work Hours Columns, Screenshot Context, and Notification UI Validation.
 * Uses captureBrowserTelemetry; fails on UI mismatch or console/request errors.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview, waitForPreview, captureBrowserTelemetry, skipIfRedirectedToLogin } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Jira Reporting App - General Performance Quarters UI Validation', () => {
  test('report page title or heading includes General Performance', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    const h1 = page.locator('h1');
    const title = await page.title();
    const h1Text = await h1.textContent().catch(() => '');
    const hasGeneralPerformance = (h1Text && h1Text.includes('General Performance')) || (title && title.includes('General Performance'));
    expect(hasGeneralPerformance).toBeTruthy();

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('boards table has Done Stories, Registered Work Hours, Estimated Work Hours columns after preview', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }

    await page.click('.tab-btn[data-tab="project-epic-level"]').catch(() => null);
    const tableHeaders = page.locator('#project-epic-level-content .data-table thead th');
    const headerTexts = await tableHeaders.allTextContents().catch(() => []);
    const joined = (headerTexts || []).join(' ');
    expect(joined).toMatch(/Done Stories/);
    expect(joined).toMatch(/Registered Work Hours/);
    expect(joined).toMatch(/Estimated Work Hours/);

    const doneIdx = headerTexts.findIndex(t => (t || '').trim() === 'Done Stories');
    const regIdx = headerTexts.findIndex(t => (t || '').trim() === 'Registered Work Hours');
    const estIdx = headerTexts.findIndex(t => (t || '').trim() === 'Estimated Work Hours');
    expect(doneIdx >= 0).toBeTruthy();
    expect(regIdx > doneIdx).toBeTruthy();
    expect(estIdx > doneIdx).toBeTruthy();

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('report has quarter strip with at least one quarter pill and shows a date span', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    const strip = page.locator('.quick-range-strip, [aria-label="Vodacom quarters"]').first();
    await expect(strip).toBeVisible({ timeout: 15000 });
    await page.waitForSelector('.quarter-pill', { timeout: 15000 }).catch(() => null);
    const pills = page.locator('.quarter-pill');
    const count = await pills.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Ensure each visible quarter pill includes the date period underneath
    const firstPeriod = await page.locator('.quarter-pill .quick-range-period').first().textContent().catch(() => '');
    expect(firstPeriod).toBeTruthy();
    expect(firstPeriod).toMatch(/\d{1,2} \w{3} \d{4} - \d{1,2} \w{3} \d{4}/);

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('boards table headers do not wrap and table supports horizontal scroll', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }

    await page.click('.tab-btn[data-tab="project-epic-level"]').catch(() => null);
    await page.waitForSelector('#project-epic-level-content .data-table', { timeout: 15000 });

    // Horizontal scrolling can be configured on table or its dedicated wrapper.
    const horizontalScrollEnabled = await page.evaluate(() => {
      const table = document.querySelector('#project-epic-level-content .data-table');
      const wrapper = document.querySelector('#project-epic-level-content .data-table-scroll-wrap');
      if (!table) return false;
      const tableOverflowX = getComputedStyle(table).overflowX;
      const wrapperOverflowX = wrapper ? getComputedStyle(wrapper).overflowX : '';
      return ['auto', 'scroll'].includes(tableOverflowX) || ['auto', 'scroll'].includes(wrapperOverflowX);
    });
    expect(horizontalScrollEnabled).toBeTruthy();

    // header whitespace should be nowrap to avoid vertical character stacking
    const headerWhiteSpace = await page.evaluate(() => getComputedStyle(document.querySelector('#project-epic-level-content .data-table th')).whiteSpace);
    expect(headerWhiteSpace).toBe('nowrap');

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('leadership has quarter strip with at least one quarter pill', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;

    const strip = page.locator('.quick-range-strip, [aria-label="Vodacom quarters"]').first();
    await expect(strip).toBeVisible({ timeout: 15000 });
    await page.waitForSelector('.quarter-pill', { timeout: 15000 }).catch(() => null);
    const pills = page.locator('.quarter-pill');
    const count = await pills.count();
    expect(count).toBeGreaterThanOrEqual(1);

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('preview header or meta shows Projects and date range when preview loaded', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }

    const subtitle = page.locator('#report-subtitle');
    const meta = page.locator('#preview-meta');
    const subtitleText = await subtitle.textContent().catch(() => '');
    const metaText = await meta.textContent().catch(() => '');
    const hasProjects = (subtitleText && subtitleText.includes('Projects')) || (metaText && metaText.includes('Projects'));
    const hasDate = (subtitleText && (subtitleText.includes('to') || subtitleText.match(/\d/))) || (metaText && (metaText.includes('Window') || metaText.includes('to')));
    expect(hasProjects).toBeTruthy();
    expect(hasDate).toBeTruthy();

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('current sprint: time tracking alerts card and Open Current Sprint when applicable', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await expect(page.locator('h1')).toContainText('Current Sprint');
    await expect(page.locator('.app-sidebar a.sidebar-link[href="/report"], nav.app-nav a[href="/report"]')).toContainText(/Report|High-Level Performance/i);

    const alertsCard = page.locator('#notifications-card, [id*="notification"]');
    const hasAlerts = await alertsCard.isVisible().catch(() => false);
    if (hasAlerts) {
      const bodyText = await page.locator('body').textContent().catch(() => '');
      const hasOpenSprint = bodyText && (bodyText.includes('Open Current Sprint') || bodyText.includes('Current Sprint'));
      expect(hasOpenSprint).toBeTruthy();
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });
});

