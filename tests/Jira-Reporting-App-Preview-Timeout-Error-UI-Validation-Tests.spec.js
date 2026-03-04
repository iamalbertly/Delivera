/**
 * Preview timeout and error UI validation tests.
 * Ensures that when a preview fails (abort/timeout or simulated failure), the error UI
 * is visible, non-empty, and includes retry actions; validates logcat-style (console/network).
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  IGNORE_CONSOLE_ERRORS,
  IGNORE_REQUEST_PATTERNS,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Preview timeout and error UI validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (hasLogin) {
      test.skip(true, 'Auth enabled - preview tests require unauthenticated access');
    }
  });

  test('error panel has content and retry actions after preview failure', async ({ page }) => {
    await page.route('**/preview.json**', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.abort('failed');
    });

    const toggleFilters = page.locator('[data-action="toggle-filters"]');
    if (await toggleFilters.isVisible().catch(() => false)) await toggleFilters.click();
    await page.locator('#start-date').scrollIntoViewIfNeeded();
    await page.locator('#end-date').scrollIntoViewIfNeeded();
    await page.check('#project-mpsa').catch(() => {});
    await page.fill('#start-date', '2025-07-01T00:00').catch(() => {});
    await page.fill('#end-date', '2025-09-30T23:59').catch(() => {});
    await page.click('#preview-btn');

    await expect(page.locator('#error')).toBeVisible({ timeout: 20000 });
    const errorText = await page.locator('#error').textContent();
    expect(errorText).toMatch(/Error|Request failed|timed out|fetch|Failed/i);
    const hasAction = /Retry|smaller|refresh|date range|Re-run/i.test(errorText || '');
    expect(hasAction).toBeTruthy();

    const retryBtn = page.locator('button[data-action="retry-preview"]');
    await expect(retryBtn).toBeVisible();
  });

  test('no critical console or network errors during error path', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/preview.json**', async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.abort('failed');
    });

    const toggleFilters = page.locator('[data-action="toggle-filters"]');
    if (await toggleFilters.isVisible().catch(() => false)) await toggleFilters.click();
    await page.locator('#start-date').scrollIntoViewIfNeeded();
    await page.locator('#end-date').scrollIntoViewIfNeeded();
    await page.check('#project-mpsa').catch(() => {});
    await page.fill('#start-date', '2025-07-01T00:00').catch(() => {});
    await page.fill('#end-date', '2025-09-30T23:59').catch(() => {});
    await page.click('#preview-btn');

    await expect(page.locator('#error')).toBeVisible({ timeout: 20000 });

    const unexpectedConsole = telemetry.consoleErrors.filter(
      (t) => !IGNORE_CONSOLE_ERRORS.some((ignored) => t === ignored || t.includes(ignored))
    );
    expect(unexpectedConsole).toEqual([]);

    const criticalFailures = telemetry.failedRequests.filter(
      (r) => !IGNORE_REQUEST_PATTERNS.some((p) => p.test(r.url)) && !r.url.includes('preview.json')
    );
    expect(criticalFailures).toEqual([]);
  });
});
