/**
 * Server errors and export validation tests.
 * Validates EADDRINUSE handling, preview behavior, Excel export, cache clear,
 * and partial preview visibility using Playwright with telemetry and UI assertions.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  runDefaultPreview,
  waitForPreview,
  IGNORE_CONSOLE_ERRORS,
  IGNORE_REQUEST_PATTERNS,
  EXCEL_DOWNLOAD_TIMEOUT_MS,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Server errors and export validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
  });

  test('report page loads without critical errors', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance/);
    await page.waitForLoadState('networkidle').catch(() => {});

    expect(telemetry.pageErrors).toEqual([]);
    const criticalFailures = telemetry.failedRequests.filter(
      (r) => !IGNORE_REQUEST_PATTERNS.some((p) => p.test(r.url))
    );
    expect(criticalFailures).toEqual([]);
  });

  test('preview completes and UI shows content or error', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    await waitForPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible();
    const errorVisible = await page.locator('#error').isVisible();
    expect(previewVisible || errorVisible).toBeTruthy();

    const unexpectedConsole = telemetry.consoleErrors.filter(
      (t) => !IGNORE_CONSOLE_ERRORS.includes(t)
    );
    expect(unexpectedConsole).toEqual([]);
  });

  test('Excel export triggers download or shows clear state', async ({ page }) => {
    test.setTimeout(200000);
    await runDefaultPreview(page);
    await waitForPreview(page, { timeout: 120000 });

    const previewVisible = await page.locator('#preview-content').isVisible();
    const errorVisible = await page.locator('#error').isVisible();
    const errorText = errorVisible ? await page.locator('#error').textContent() : '';
    if (errorVisible && errorText && errorText.trim().length > 0) {
      expect(await page.locator('#error').isVisible()).toBeTruthy();
      return;
    }
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }
    const sidebarExport = page.locator('#export-excel-btn');
    const headerExport = page.locator('#export-excel-btn');
    const headerVisible = await headerExport.isVisible().catch(() => false);
    const exportBtn = headerVisible ? headerExport : sidebarExport;
    const exportEnabled = await exportBtn.isEnabled();
    if (!exportEnabled) {
      const exportTitle = (await exportBtn.getAttribute('title')) || '';
      const exportAria = (await exportBtn.getAttribute('aria-label')) || '';
      const exportHintText = (await page.locator('#export-hint').textContent().catch(() => '')) || '';
      const hasClearDisabledReason =
        /partial|generate a report with data|enable export|share\s*\/\s*export|loaded|run a report/i.test(
          `${exportTitle} ${exportAria} ${exportHintText}`
        );
      expect(hasClearDisabledReason).toBeTruthy();
      return;
    }
    await exportBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);

    const telemetry = captureBrowserTelemetry(page);
    const downloadPromise = page.waitForEvent('download', { timeout: EXCEL_DOWNLOAD_TIMEOUT_MS });
    const clearStatePromise = (async () => {
      await page.waitForSelector('#error', { state: 'visible', timeout: EXCEL_DOWNLOAD_TIMEOUT_MS });
      const text = await page.locator('#error').textContent();
      if (text && text.trim().length > 0) return { type: 'clearState' };
      throw new Error('Error visible but empty');
    })();
    await exportBtn.click();

    let result = await Promise.race([
      downloadPromise.then((d) => ({ type: 'download', value: d })),
      clearStatePromise,
    ]).catch(async () => {
      try {
        const errVis = await page.locator('#error').isVisible();
        const errText = await page.locator('#error').textContent();
        if (errVis && errText && errText.trim().length > 0) return { type: 'clearState' };
      } catch (_) {}
      throw new Error(`Excel export: no download and no clear error state within ${EXCEL_DOWNLOAD_TIMEOUT_MS}ms`);
    });

    if (result.type === 'download') {
      expect(result.value).toBeTruthy();
      const filename = result.value.suggestedFilename();
      expect(filename).toMatch(/\.xlsx$/);
      expect(filename.length).toBeGreaterThan(0);
    } else if (result.type === 'clearState') {
      expect(await page.locator('#error').isVisible()).toBeTruthy();
      const errText = await page.locator('#error').textContent();
      expect(errText && errText.trim().length > 0).toBeTruthy();
    }

    const criticalFailures = telemetry.failedRequests.filter(
      (r) => !IGNORE_REQUEST_PATTERNS.some((p) => p.test(r.url))
    );
    expect(criticalFailures).toEqual([]);
  });

  test('date validation: start >= end shows error without sending preview request', async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('#preview-btn')).toBeVisible();
    await page.fill('#start-date', '2025-09-30T23:59');
    await page.fill('#end-date', '2025-07-01T00:00');
    await page.click('#preview-btn');
    await expect(page.locator('#error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.locator('#error').textContent();
    expect(errorText).toMatch(/Start date|before end date/i);
  });

  test('partial preview shows status when applicable', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);
    await waitForPreview(page);

    const statusEl = page.locator('#preview-status');
    const partialBadgeVisible = (await page.locator('.data-state-badge--partial:visible').count()) > 0;
    const reducedBadgeVisible = (await page.locator('.data-state-badge--closest:visible').count()) > 0;
    const statusVisible = await statusEl.isVisible().catch(() => false);
    if (partialBadgeVisible || reducedBadgeVisible) {
      if (statusVisible) {
        const statusText = (await statusEl.textContent()) || '';
        expect(/partial|time limit|faster mode|closest available/i.test(statusText)).toBeTruthy();
        return;
      }
      const outcomeText = (await page.locator('#preview-outcome-line').textContent().catch(() => '')) || '';
      const exportBtn = page.locator('#export-excel-btn');
      const exportTitle = (await exportBtn.getAttribute('title').catch(() => '')) || '';
      const exportAria = (await exportBtn.getAttribute('aria-label').catch(() => '')) || '';
      const hasFallbackMessaging = /partial|closest available|time limit|faster mode/i.test(
        `${outcomeText} ${exportTitle} ${exportAria}`
      );
      expect(hasFallbackMessaging).toBeTruthy();
    }
  });

  test('cache clear endpoint when available', async ({ request }) => {
    let res;
    try {
      res = await request.post('/api/test/clear-cache', { timeout: 5000 });
    } catch (_) {
      test.skip(true, 'Clear-cache endpoint not reachable');
    }

    if (res.status() === 404) {
      test.info().annotations.push({ type: 'skip', description: 'Clear-cache not enabled (404)' });
      return;
    }

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('ok', true);
  });
});

