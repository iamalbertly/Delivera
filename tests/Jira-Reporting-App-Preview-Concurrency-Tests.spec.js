import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview, waitForPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Jira Reporting App – Preview Concurrency & Rate Limit UX', () => {
  test('multiple quick preview clicks do not leave UI stuck', async ({ page }) => {
    test.setTimeout(180000);

    await page.goto('/report');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (hasLogin) {
      test.skip(true, 'Auth enabled - preview tests require unauthenticated access');
      return;
    }

    // First preview
    await page.click('#preview-btn');

    // While first is in flight, click again a couple of times to simulate impatient users
    await page.waitForTimeout(500);
    await page.click('#preview-btn');
    await page.waitForTimeout(500);
    await page.click('#preview-btn');

    await waitForPreview(page, { timeout: 120000 });

    const loadingVisible = await page.locator('#loading').isVisible().catch(() => false);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);

    // Spinner must not remain stuck; either preview or error should be visible.
    expect(loadingVisible).toBeFalsy();
    expect(previewVisible || errorVisible).toBeTruthy();
  });

  test('rate limit cooldown error shows clear guidance', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/report');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (hasLogin) {
      test.skip(true, 'Auth enabled - preview tests require unauthenticated access');
      return;
    }

    // Intercept preview call and simulate a server-side rate limit cooldown response.
    await page.route('**/preview.json**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to generate preview',
          code: 'RATE_LIMIT_COOLDOWN',
          message: 'Rate limit cooldown in effect for discoverBoards',
        }),
      });
    });

    await page.click('#preview-btn');

    const errorLocator = page.locator('#error');
    await errorLocator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
    const errorText = (await errorLocator.innerText().catch(() => '')).toLowerCase();

    expect(errorText).toContain('jira api has recently rate limited');
  });
});

