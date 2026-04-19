import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  runDefaultPreview,
  skipIfRedirectedToLogin,
  waitForPreview,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Trust State Consistency Validation', () => {
  test('report uses one freshness vocabulary without generated/stale conflicts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    if (await skipIfRedirectedToLogin(page, test)) return;
    await waitForPreview(page, { timeout: 90000 });

    const bodyText = (await page.locator('body').textContent()) || '';
    expect(bodyText).not.toMatch(/Generated just now|Generated \d+/i);
    expect(bodyText).not.toMatch(/Leadership HUD|Open in Jira: undefined/i);

    const freshnessMatches = bodyText.match(/Just updated|Updated \d+ min ago|Stale - refresh recommended|Unavailable/gi) || [];
    expect(freshnessMatches.length).toBeGreaterThan(0);

    const hasJustUpdated = /Just updated/i.test(bodyText);
    const hasStale = /Stale - refresh recommended/i.test(bodyText);
    expect(hasJustUpdated && hasStale).toBe(false);
    assertTelemetryClean(telemetry);
  });
});
