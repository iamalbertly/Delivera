import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  runDefaultPreview,
  skipIfRedirectedToLogin,
  waitForPreview,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Trust State Consistency Validation', () => {
  test('report uses one freshness vocabulary without generated/stale conflicts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    if (await skipIfRedirectedToLogin(page, test)) return;
    await waitForPreview(page, { timeout: 90000 });

    const bodyText = (await page.locator('body').textContent()) || '';
    expect(bodyText).not.toMatch(/Generated just now|Generated \d+/i);
    expect(bodyText).not.toMatch(/Open in Jira: undefined/i);

    const freshnessMatches = bodyText.match(/Just updated|Updated \d+ min ago|Older snapshot|Unavailable/gi) || [];
    expect(freshnessMatches.length).toBeGreaterThan(0);

    const hasJustUpdated = /Just updated/i.test(bodyText);
    const hasStale = /Older snapshot/i.test(bodyText);
    expect(hasJustUpdated && hasStale).toBe(false);
    assertTelemetryClean(telemetry);
  });
});
