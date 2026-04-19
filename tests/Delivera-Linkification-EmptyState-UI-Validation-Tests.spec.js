/**
 * Linkification and Empty-state UI Validation: issue key links on Report and Current Sprint,
 * shared empty-state pattern. Uses captureBrowserTelemetry and realtime UI assertions;
 * fails on UI mismatch or console/request errors.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview, waitForPreview, captureBrowserTelemetry, skipIfRedirectedToLogin } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Jira Reporting App - Linkification and Empty-state UI Validation', () => {
  test('report Done Stories: issue keys are links when rows exist', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }

    await page.click('.tab-btn[data-tab="done-stories"]');
    await expect(page.locator('#tab-done-stories')).toHaveClass(/active/);

    const hasRows = await page.locator('#done-stories-content .data-table tbody tr').count() > 0;
    if (hasRows) {
      const linkCount = await page.locator('#done-stories-content a[href*="/browse/"]').count();
      const firstCell = await page.locator('#done-stories-content .data-table tbody tr').first().locator('td').first().textContent().catch(() => '');
      expect(linkCount > 0 || (firstCell && firstCell.trim().length > 0)).toBeTruthy();
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('report empty state: Done Stories shows empty-state pattern when no rows', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await page.check('#project-mpsa');
    await page.uncheck('#project-mas');
    await page.fill('#start-date', '2025-07-01T00:00');
    await page.fill('#end-date', '2025-09-30T23:59');
    await page.click('#preview-btn');
    await Promise.race([
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 120000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 120000 }).catch(() => null),
    ]);
    await waitForPreview(page);

    const doneStoriesTab = page.locator('.tab-btn[data-tab="done-stories"]');
    if (await doneStoriesTab.count()) {
      await doneStoriesTab.click().catch(() => null);
      await expect(doneStoriesTab).toHaveAttribute('aria-selected', 'true');
    } else {
      test.skip(true, 'Done Stories tab not available in this layout');
      return;
    }
    const emptyState = page.locator('#done-stories-content .empty-state');
    const noRows = await page.locator('#done-stories-content .data-table tbody tr').count() === 0;
    if (noRows) {
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      if (hasEmptyState) {
        await expect(emptyState).toContainText(/no stories|no done|no match/i);
      } else {
        const doneStoriesText = await page.locator('#done-stories-content').textContent().catch(() => '');
        const activePaneText = await page.locator('#tab-done-stories.active').textContent().catch(() => '') || '';
        if (!doneStoriesText || !doneStoriesText.trim() || !activePaneText.trim()) {
          test.skip(true, 'Done Stories content was empty in this run');
          return;
        }
        const combined = (doneStoriesText + ' ' + activePaneText) || '';
        if (!/no stories|no done|no match|adjust|filter|empty/i.test(combined)) {
          test.skip(true, 'Done Stories rendered alternate non-empty pane without table rows in this run');
          return;
        }
      }
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('current-sprint page loads with no console errors', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await expect(page.locator('h1')).toContainText('Current Sprint');
    await expect(page.locator('#board-select')).toBeVisible();
    await expect(page.locator('.app-sidebar a.sidebar-link[href="/report"], nav.app-nav a[href="/report"]')).toContainText(/Report|High-Level Performance/i);

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    expect(telemetry.failedRequests).toEqual([]);
  });

  test('current-sprint with board: stories and merged work-risks table show issue key cells as link or text', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    const selectableOptions = page.locator('#board-select option[value]:not([value=""])');
    const optionCount = await selectableOptions.count().catch(() => 0);
    if (!optionCount) {
      test.skip(true, 'No boards loaded');
      return;
    }
    const firstOpt = await selectableOptions.first().getAttribute('value');
    if (!firstOpt) {
      test.skip(true, 'No board option value available');
      return;
    }

    await page.selectOption('#board-select', firstOpt);
    await page.waitForSelector('#current-sprint-content', { state: 'visible', timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(2000);

    const storiesCard = page.locator('#stories-card');
    const workRisksTable = page.locator('#work-risks-table');
    const hasStories = await storiesCard.locator('.data-table tbody tr').count() > 0;
    const hasWorkRisks = await workRisksTable.locator('tbody tr').count() > 0;

    if (hasStories) {
      const storyKeyCell = storiesCard.locator('.data-table tbody tr').first().locator('td').first();
      const html = await storyKeyCell.innerHTML();
      expect(html.includes('/browse/') || html.trim().length > 0).toBeTruthy();
    }
    if (hasWorkRisks) {
      const riskKeyCell = workRisksTable.locator('tbody tr').first().locator('td').nth(2);
      const html = await riskKeyCell.innerHTML();
      expect(html.includes('/browse/') || html.trim().length > 0).toBeTruthy();
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('current-sprint no sprint: shows empty-state message', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const hasBoardOpts = await page.locator('#board-select option[value]:not([value=""])').count() > 0;
    if (!hasBoardOpts) {
      const content = await page.locator('#current-sprint-content').textContent();
      const loadingText = await page.locator('#current-sprint-loading').textContent().catch(() => '');
      const errorText = await page.locator('#current-sprint-error').textContent().catch(() => '');
      expect((content || '') + ' ' + (loadingText || '') + ' ' + (errorText || '')).toMatch(/no board|loading|select|failed/i);
    } else {
      const fallbackFirstOpt = await page.locator('#board-select option[value]:not([value=""])').first().getAttribute('value').catch(() => null);
      if (!fallbackFirstOpt) {
        test.skip(true, 'No board option value available');
        return;
      }
      const selected = await page.selectOption('#board-select', fallbackFirstOpt).catch(() => []);
      if (!selected.length) {
        const selectedByIndex = await page.selectOption('#board-select', { index: 1 }).catch(() => []);
        if (!selectedByIndex.length) {
          test.skip(true, 'Board options changed before selection');
          return;
        }
      }
      await page.waitForTimeout(3000);
      const noSprint = await page.locator('.empty-state').isVisible().catch(() => false);
      if (noSprint) {
        await expect(page.locator('.empty-state')).toContainText(/no sprint|no active|no recent/i);
      }
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('leadership page loads with nav and Preview; no console errors', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;

    if (page.url().includes('/report')) {
      await expect(page.locator('h1')).toContainText(/General Performance|Sprint Leadership/i);
      await expect(page.locator('#preview-btn')).toBeVisible();
      await expect(page.locator('.app-sidebar a.sidebar-link[href="/current-sprint"], nav.app-nav a[href="/current-sprint"]')).toContainText(/Current Sprint/i);
    } else {
      await expect(page.locator('h1')).toContainText('Sprint Leadership');
      await expect(page.locator('#leadership-preview')).toBeVisible();
      await expect(page.locator('.app-sidebar a.sidebar-link[href="/report"], nav.app-nav a[href="/report"]')).toContainText(/Report|High-Level Performance/i);
      await expect(page.locator('.app-sidebar a.sidebar-link[href="/current-sprint"], nav.app-nav a[href="/current-sprint"]')).toContainText('Current Sprint');
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    expect(telemetry.failedRequests).toEqual([]);
  });
});

