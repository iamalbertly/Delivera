import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  runDefaultPreview,
  selectFirstBoard,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Shell subtraction and direct-value contracts', () => {
  test('current sprint keeps jump links in overflow instead of adding a third top rail', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await expect(page.locator('.current-sprint-header-bar')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('.current-sprint-grid-layout > .sprint-jump-rail')).toHaveCount(0);
    await expect(page.locator('.current-sprint-header-bar .header-view-drawer')).toBeVisible();

    const headerHeight = await page.locator('.current-sprint-header-bar').evaluate((node) => node.getBoundingClientRect().height);
    expect(headerHeight).toBeLessThan(210);

    assertTelemetryClean(telemetry);
  });

  test('report keeps tabs and search in one shell and hides legacy context copy', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview unavailable for current dataset');
      return;
    }

    await expect(page.locator('.report-tabs-shell')).toBeVisible();
    await expect(page.locator('.report-tabs-shell .tabs')).toBeVisible();
    await expect(page.locator('.report-tabs-shell .report-unified-tab-search')).toBeVisible();
    await expect(page.locator('#report-context-line')).toBeHidden();

    const duplicateSearchBands = await page.locator('.report-tab-search-legacy:visible').count();
    expect(duplicateSearchBands).toBe(0);

    assertTelemetryClean(telemetry);
  });
});
