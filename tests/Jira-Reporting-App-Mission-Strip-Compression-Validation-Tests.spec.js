import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  runDefaultPreview,
  selectFirstBoard,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Mission strip compression contracts', () => {
  test('current sprint keeps context, intervention, and attention inside one header shell', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error', { timeout: 45000 }).catch(() => null);
    await expect(page.locator('.current-sprint-header-bar')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .mission-context-ribbon')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .attention-queue--compact')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .sprint-intervention-queue')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .header-view-drawer')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar + .context-summary-strip')).toHaveCount(0);
    await expect(page.locator('.current-sprint-header-bar + .attention-queue')).toHaveCount(0);

    const viewport = await page.locator('.current-sprint-header-bar').evaluate((node) => node.getBoundingClientRect().height);
    expect(viewport).toBeLessThan(220);

    assertTelemetryClean(telemetry);
  });

  test('current sprint story table stays terse and defers deep evidence to the drawer', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await page.waitForSelector('#stories-card, #current-sprint-error', { timeout: 45000 }).catch(() => null);
    const stories = page.locator('#stories-table');
    const storiesVisible = await stories.isVisible().catch(() => false);
    if (!storiesVisible) {
      test.skip(true, 'Stories table unavailable for current dataset');
      return;
    }

    const subtaskSummaryDisplay = await page.locator('.story-subtask-summary').first().evaluate((node) => getComputedStyle(node).display).catch(() => 'none');
    expect(subtaskSummaryDisplay).toBe('none');
    const hiddenReporter = await page.locator('#stories-table th:nth-child(5)').evaluate((node) => getComputedStyle(node).display).catch(() => '');
    expect(hiddenReporter).toBe('none');

    const firstIssue = page.locator('#stories-table tbody tr a[href*="/browse/"]').first();
    await firstIssue.click({ force: true }).catch(() => null);
    await expect(page.locator('#current-sprint-issue-preview')).toHaveClass(/issue-preview-open/);
    await expect(page.locator('#current-sprint-issue-preview .issue-preview-summary')).not.toHaveText(/^$/);

    assertTelemetryClean(telemetry);
  });

  test('report preview stays compressed without a second attention tower after preview', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview unavailable for current dataset');
      return;
    }

    await expect(page.locator('#preview-meta .attention-queue')).toBeVisible();
    const attentionHeight = await page.locator('#preview-meta .attention-queue').evaluate((node) => node.getBoundingClientRect().height);
    expect(attentionHeight).toBeLessThan(120);

    assertTelemetryClean(telemetry);
  });

  test('leadership keeps attention and context in the compact top stack', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/leadership');
    if (page.url().includes('/report#trends')) {
      await page.goto('/leadership.html');
    }
    if (await skipIfRedirectedToLogin(page, test)) return;

    await page.waitForTimeout(3000);
    const content = page.locator('#leadership-content');
    if (!(await content.isVisible().catch(() => false))) {
      test.skip(true, 'Leadership content unavailable in this environment');
      return;
    }

    await expect(page.locator('.leadership-context-sticky .context-summary-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .attention-queue')).toBeVisible();
    const duplicateQueues = await page.locator('#leadership-content .attention-queue').count();
    expect(duplicateQueues).toBe(1);

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });
});
