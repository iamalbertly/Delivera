import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test('CSV export fallback copies CSV to clipboard when download fails', async ({ page }) => {
  await page.goto('/report');
  const hasLogin = await page.locator('#username').isVisible().catch(() => false);
  if (hasLogin) {
    test.skip(true, 'Auth enabled - export tests require unauthenticated access');
    return;
  }

  // Generate a default preview so export buttons are enabled
  await runDefaultPreview(page, { start: '2025-07-01T00:00', end: '2025-09-30T23:59' });

  const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
  const errorVisible = await page.locator('#error').isVisible().catch(() => false);
  if (!previewVisible || errorVisible) {
    test.skip('Preview data not available; skipping export fallback test.');
    return;
  }

  await page.locator('.tab-btn[data-tab="done-stories"]').dispatchEvent('click');
  await expect(page.locator('#tab-done-stories')).toHaveClass(/active/);
  await expect(page.locator('#export-excel-btn')).toBeVisible({ timeout: 15000 });

  // Monkeypatch anchor click to simulate browser blocking downloads
  await page.evaluate(() => {
    HTMLAnchorElement.prototype._origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { throw new Error('simulated download block'); };
    // Stub clipboard writeText to capture copied content
    window.__copied = null;
    navigator.clipboard = navigator.clipboard || {};
    navigator.clipboard.writeText = async (text) => { window.__copied = text; };
  });

  // Trigger the shared CSV fallback path directly so the test only validates the recovery contract.
  await page.evaluate(async () => {
    const mod = await import('/Reporting-App-Report-Page-Export-CSV.js');
    mod.downloadCSV('col1,col2\nA,B', 'fallback-test.csv');
  });

  // Fallback copy button should appear in error panel
  const copyBtn = page.locator('#export-copy-csv, .export-copy-csv').first();
  await expect(copyBtn).toBeVisible({ timeout: 5000 });

  // Click copy button and assert clipboard captured content
  await copyBtn.dispatchEvent('click');

  const copied = await page.evaluate(() => window.__copied);
  expect(copied).toBeTruthy();
  expect(copied).toContain(','); // simple sanity: CSV contains commas

  // Restore original anchor click to avoid flakiness for later tests
  await page.evaluate(() => {
    if (HTMLAnchorElement.prototype._origClick) {
      HTMLAnchorElement.prototype.click = HTMLAnchorElement.prototype._origClick;
      delete HTMLAnchorElement.prototype._origClick;
    }
  });
});
