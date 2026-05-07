import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera duplicate UI decision strip regression', () => {
  test('report avoids duplicate action strips and stale duplicate controls', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('#report-load-latest-wrap')).toHaveCount(0);
    await expect(page.locator('.report-tab-search-legacy')).toHaveCount(0);
    await expect(page.locator('#report-header-actions')).toBeVisible();
    await expect(page.locator('#report-header-actions #report-header-preview-btn')).toHaveCount(1);

    const duplicateStats = await page.evaluate(() => ({
      contextBars: document.querySelectorAll('#report-filter-strip .context-summary-strip').length,
      previewButtons: document.querySelectorAll('#report-header-actions #report-header-preview-btn').length,
      actionStatusNodes: document.querySelectorAll('#report-header-actions-status').length,
    }));
    expect(duplicateStats.contextBars).toBeLessThanOrEqual(1);
    expect(duplicateStats.previewButtons).toBe(1);
    expect(duplicateStats.actionStatusNodes).toBe(1);
    assertTelemetryClean(telemetry);
  });
});

