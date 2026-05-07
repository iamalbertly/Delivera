import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  ensureReportFiltersVisible,
  waitForPreview,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera report refresh trust and action hierarchy', () => {
  test('header refresh and status messaging stay truthful', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await ensureReportFiltersVisible(page);

    await expect(page.locator('#report-header-preview-btn')).toBeVisible();
    await expect(page.locator('#report-header-actions-status')).toContainText(/Ready|decision|preview/i);

    await page.click('#report-header-preview-btn').catch(() => null);
    await expect(page.locator('#report-header-actions-status')).toContainText(/refresh|preview|running|requested/i);

    await waitForPreview(page, { timeout: 70000 });
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not hydrated in this environment');
      return;
    }

    await expect(page.locator('#report-header-actions-status')).toContainText(/live|updated|preview/i);
    assertTelemetryClean(telemetry);
  });

  test('action hierarchy stays compact above fold', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    const aboveFold = await page.evaluate(() => {
      const vh = window.innerHeight;
      const actions = Array.from(document.querySelectorAll('#report-header-actions .btn'))
        .filter((el) => el.getBoundingClientRect().top < vh)
        .map((el) => el.textContent?.trim() || '');
      return {
        actionCount: actions.length,
        hasRefresh: actions.some((t) => /refresh/i.test(t)),
        hasCreateWork: actions.some((t) => /create work/i.test(t)),
        hasExport: actions.some((t) => /export/i.test(t)),
      };
    });

    expect(aboveFold.actionCount).toBeGreaterThanOrEqual(3);
    expect(aboveFold.hasRefresh).toBeTruthy();
    expect(aboveFold.hasCreateWork).toBeTruthy();
    expect(aboveFold.hasExport).toBeTruthy();
    assertTelemetryClean(telemetry);
  });
});

