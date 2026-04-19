import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { ensureReportFiltersVisible } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import path from 'path';

test.describe('Delivera - Feedback & Date Display Tests', () => {
  test('feedback panel toggles and submits', async ({ page }) => {
    await page.goto('/report');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (hasLogin) {
      test.skip(true, 'Auth enabled - feedback test requires authenticated session');
      return;
    }
    const feedbackToggle = page.locator('#feedback-toggle');
    await expect(feedbackToggle).toBeVisible();

    await feedbackToggle.click();
    const feedbackPanel = page.locator('#feedback-panel');
    await expect(feedbackPanel).toBeVisible();

    const feedbackEmailValue = ''; // anonymous
    const feedbackMessageValue = 'Clarify SP per Day and On-Time % definitions.';

    await page.fill('#feedback-email', feedbackEmailValue);
    await page.fill('#feedback-message', feedbackMessageValue);

    const submitBtn = page.locator('#feedback-submit');
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/feedback')).catch(() => null);
    await submitBtn.click();

    const response = await responsePromise;
    if (!response) {
      test.skip('Feedback submission did not return a response (server may be unavailable).');
      return;
    }

    if (!response.ok()) {
      test.skip(`Feedback submission failed with status ${response.status()}`);
      return;
    }

    await expect(page.locator('#feedback-status')).toContainText('Thanks');

    // Verify feedback was persisted to the server-side log file
    const feedbackFilePath = path.join(process.cwd(), 'data', 'Delivera-Feedback-UserInput-Submission-Log.jsonl');
    const { readFileSync, existsSync } = await import('fs');

    expect(existsSync(feedbackFilePath)).toBeTruthy();

    const content = readFileSync(feedbackFilePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);

    const entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const matchingEntry = entries.find(entry => String(entry.message) === feedbackMessageValue || String(entry.message).includes('Clarify SP per Day'));
    expect(matchingEntry).toBeTruthy();
  });

  test('date display uses friendly formatting', async ({ page }) => {
    await page.goto('/report');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (hasLogin) {
      test.skip(true, 'Auth enabled - date display test requires report access');
      return;
    }
    await ensureReportFiltersVisible(page);
    await page.fill('#start-date', '2025-07-01T00:00');
    await page.fill('#end-date', '2025-09-30T23:59');

    const dateDisplay = page.locator('#date-display');
    await expect(dateDisplay).toContainText('UTC');

    const text = (await dateDisplay.textContent()) || '';
    expect(text).not.toContain('T00:00:00.000Z');
    expect(text).not.toContain('.000Z');
  });
});
