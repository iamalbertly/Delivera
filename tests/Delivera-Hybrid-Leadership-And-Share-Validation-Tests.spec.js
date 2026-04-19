import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  runDefaultPreview,
  selectFirstBoard,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Hybrid leadership lens and visible sprint sharing', () => {
  test.describe.configure({ retries: 0 });

  test('current sprint keeps Copy summary visible in the mission action cluster', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error', { timeout: 45000 }).catch(() => null);
    const header = page.locator('.current-sprint-header-bar');
    if (!(await header.isVisible().catch(() => false))) {
      test.skip(true, 'Current sprint header unavailable for current dataset');
      return;
    }

    await expect(header.locator('.header-band-actions .export-dashboard-btn')).toBeVisible();
    await expect(header.locator('.header-band-actions .export-menu-toggle')).toBeVisible();
    await expect(header.locator('.header-view-drawer .export-dashboard-container')).toHaveCount(0);

    assertTelemetryClean(telemetry);
  });

  test('report trends renders the shared leadership shell instead of the old bridge card', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview unavailable for current dataset');
      return;
    }

    await page.click('#tab-btn-trends');
    await expect(page.locator('#leadership-content .leadership-shell-top')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-mission-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-kpi-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-bridge-card')).toHaveCount(0);

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });

  test('report trends exposes leadership share and export actions without leaving the report shell', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview unavailable for current dataset');
      return;
    }

    await page.click('#tab-btn-trends');
    await expect(page.locator('#leadership-content .leadership-export-menu > summary').first()).toBeVisible();
    await page.locator('#leadership-content .leadership-export-menu > summary').first().click();
    await expect(page.locator('#leadership-content [data-action="export-leadership-manager-briefing"]').first()).toBeVisible();
    await expect(page.locator('#leadership-content [data-action="export-leadership-quarterly-story"]').first()).toBeVisible();
    await expect(page.locator('#leadership-content [data-action="export-leadership-kpis-csv"]').first()).toBeVisible();
    await expect(page.locator('#leadership-content [data-open-outcome-modal]').first()).toBeVisible();

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });

  test('standalone leadership route still shows the same mission shell for deep-link use', async ({ page }) => {
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

    await expect(page.locator('.leadership-shell-top .context-summary-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-mission-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .attention-queue')).toBeVisible();

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });
});
