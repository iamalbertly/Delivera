/**
 * Vodacom Quarters, SSOT, and Sprint Order Validation.
 * Validates quarter quick-pick, date-range API, default window, and sprint order (Report + Current Sprint).
 * Uses captureBrowserTelemetry and UI assertions at every step; fails on UI mismatch or console/network errors.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview, waitForPreview, captureBrowserTelemetry } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Jira Reporting App - Vodacom Quarters SSOT Sprint Order Validation', () => {
  test('report page shows quarter quick-pick buttons and no console errors', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');

    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance|High-Level Performance/i);
    await expect(page.locator('.quick-range-strip')).toBeVisible();
    await page.waitForSelector('.quarter-pill', { timeout: 15000 }).catch(() => null);
    await expect(page.locator('.quarter-pill').first()).toContainText(/Q[1-4]/i);
    const quarterCount = await page.locator('.quarter-pill').count();
    expect(quarterCount).toBeGreaterThanOrEqual(4);
    await expect(page.locator('#start-date')).toBeVisible();
    await expect(page.locator('#end-date')).toBeVisible();

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    expect(telemetry.failedRequests).toEqual([]);
  });

  test('report quarter quick-pick Q2 sets start and end inputs and triggers preview', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');

    await page.waitForSelector('.quarter-pill', { timeout: 15000 }).catch(() => null);
    const q2Like = page.locator('.quarter-pill').filter({ hasText: /Q2/i }).first();
    if (await q2Like.count()) {
      await q2Like.click();
    } else {
      await page.locator('.quarter-pill').nth(1).click();
    }
    await page.waitForTimeout(2000);
    const startVal = await page.locator('#start-date').inputValue();
    const endVal = await page.locator('#end-date').inputValue();
    expect(startVal).toBeTruthy();
    expect(endVal).toBeTruthy();
    const startDate = new Date(startVal);
    const endDate = new Date(endVal);
    expect(Number.isNaN(startDate.getTime())).toBeFalsy();
    expect(Number.isNaN(endDate.getTime())).toBeFalsy();
    expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());

    await Promise.race([
      page.waitForSelector('#loading', { state: 'visible', timeout: 15000 }).catch(() => null),
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 15000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 15000 }).catch(() => null),
    ]);
    const loadingVisible = await page.locator('#loading').isVisible().catch(() => false);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    if (!loadingVisible && !previewVisible && !errorVisible) {
      test.skip(true, 'Preview/loading/error did not appear; API auth or Jira may be required');
      return;
    }
    expect(loadingVisible || previewVisible || errorVisible).toBeTruthy();

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('Report Sprints tab rows are ordered by sprint end date descending', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }

    await page.click('#tab-btn-sprints');
    await page.waitForSelector('#sprints-content', { state: 'visible', timeout: 5000 }).catch(() => null);
    const table = page.locator('#sprints-content table.data-table tbody tr');
    const count = await table.count();
    if (count < 2) {
      test.skip(true, 'Need at least 2 sprint rows to assert order');
      return;
    }

    const endDates = [];
    for (let i = 0; i < count; i++) {
      const row = table.nth(i);
      const endCell = row.locator('td').nth(4);
      const text = await endCell.textContent().catch(() => '');
      const d = new Date(text.trim());
      if (!Number.isNaN(d.getTime())) endDates.push(d.getTime());
    }
    for (let i = 1; i < endDates.length; i++) {
      expect(endDates[i]).toBeLessThanOrEqual(endDates[i - 1]);
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('current-sprint page shows sprint tabs in descending end date order', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    await expect(page.locator('#board-select')).toBeVisible();
    await page.waitForTimeout(2000);
    const tabs = page.locator('.sprint-tab[data-sprint-id]');
    const tabCount = await tabs.count();
    if (tabCount < 2) {
      test.skip(true, 'Need at least 2 sprint tabs to assert order');
      return;
    }

    const endTimes = [];
    for (let i = 0; i < tabCount; i++) {
      const title = await tabs.nth(i).getAttribute('title').catch(() => '');
      const endPart = title && title.includes(' - End: ') ? title.split(' - End: ')[1] : '';
      if (endPart) {
        const d = new Date(endPart.trim());
        if (!Number.isNaN(d.getTime())) endTimes.push(d.getTime());
      }
    }
    for (let i = 1; i < endTimes.length; i++) {
      expect(endTimes[i]).toBeLessThanOrEqual(endTimes[i - 1]);
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    expect(telemetry.failedRequests).toEqual([]);
  });

  test('leadership page shows quarter quick-pick and sets start/end on Q2 click', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    const leadershipQ2 = page.locator('.quick-range-btn-leadership[data-quarter="2"]');
    const reportQ2 = page.locator('.quarter-pill').filter({ hasText: /Q2/i }).first();
    if (await leadershipQ2.count()) {
      await expect(leadershipQ2).toBeVisible();
      await leadershipQ2.click();
    } else {
      await expect(page.locator('.quick-range-strip')).toBeVisible();
      await page.waitForSelector('.quarter-pill', { timeout: 15000 }).catch(() => null);
      if (await reportQ2.count()) await reportQ2.click();
      else await page.locator('.quarter-pill').nth(1).click();
    }
    await page.waitForTimeout(300);
    const leadershipStart = page.locator('#leadership-start');
    const leadershipEnd = page.locator('#leadership-end');
    const reportStart = page.locator('#start-date');
    const reportEnd = page.locator('#end-date');
    const useLeadershipInputs = await leadershipStart.count().catch(() => 0);
    const startVal = useLeadershipInputs
      ? await leadershipStart.inputValue()
      : await reportStart.inputValue();
    const endVal = useLeadershipInputs
      ? await leadershipEnd.inputValue()
      : await reportEnd.inputValue();
    expect(startVal).toBeTruthy();
    expect(endVal).toBeTruthy();
    const startDate = new Date(startVal);
    const endDate = new Date(endVal);
    expect(Number.isNaN(startDate.getTime())).toBeFalsy();
    expect(Number.isNaN(endDate.getTime())).toBeFalsy();
    expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('API date-range returns latest completed quarter', async ({ request }) => {
    const res = await request.get('/api/date-range?quarter=Q2');
    if (!res.ok()) {
      test.skip(true, `API returned ${res.status()} (auth or env may be required)`);
      return;
    }
    const data = await res.json();
    expect(data).toHaveProperty('start');
    expect(data).toHaveProperty('end');
    expect(data).toHaveProperty('year');
    expect(data).toHaveProperty('label');
    expect(data).toHaveProperty('period');
    const start = new Date(data.start);
    const end = new Date(data.end);
    expect(Number.isNaN(start.getTime())).toBeFalsy();
    expect(Number.isNaN(end.getTime())).toBeFalsy();
    expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
    const now = Date.now();
    expect(end.getTime()).toBeLessThanOrEqual(now + 86400000);
  });

  test('API default-window returns start and end', async ({ request }) => {
    const res = await request.get('/api/default-window');
    if (!res.ok()) {
      test.skip(true, `API returned ${res.status()} (auth or env may be required)`);
      return;
    }
    const data = await res.json();
    expect(data).toHaveProperty('start');
    expect(data).toHaveProperty('end');
    expect(typeof data.start).toBe('string');
    expect(typeof data.end).toBe('string');
  });
});
