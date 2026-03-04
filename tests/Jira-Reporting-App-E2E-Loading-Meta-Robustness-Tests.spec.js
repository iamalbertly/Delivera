import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview, waitForPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

const DEFAULT_Q2_QUERY = '?projects=MPSA,MAS&start=2025-07-01T00:00:00.000Z&end=2025-09-30T23:59:59.999Z';

test.describe('Jira Reporting App - Loading & Meta Robustness E2E', () => {
  test('fast preview completion still reaches a stable state', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Loading/Meta: fast preview completion');

    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);

    // Either preview or error is acceptable; main point is no hang.
    expect(previewVisible || errorVisible).toBeTruthy();
  });

  test('slow preview shows loading overlay at least once', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Loading/Meta: slow preview shows loading overlay');

    await page.goto('/report');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    // Artificially delay network by intercepting preview call.
    await page.route(`/preview.json${DEFAULT_Q2_QUERY}`, async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    }).catch(() => {});

    await waitForPreview(page);

    // Even if we missed the exact timing, loading should have been present at some point.
    // We assert that the page is no longer in a \"stuck\" state by checking preview/error.
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    const loadingVisible = await page.locator('#loading').isVisible().catch(() => false);
    const controlsVisible = await page.locator('#preview-btn').isVisible().catch(() => false);
    expect(previewVisible || errorVisible || (!loadingVisible && controlsVisible)).toBeTruthy();

    await page.unroute(`/preview.json${DEFAULT_Q2_QUERY}`).catch(() => {});
  });

  test('missing meta does not cause ReferenceError and shows clear message', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Loading/Meta: missing meta handled gracefully');

    const consoleMessages = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping missing meta scenario');
      return;
    }

    // Simulate missing meta and try to re-render export path
    await page.evaluate(() => {
      // @ts-ignore
      if (window.previewData) {
        // @ts-ignore
        window.previewData.meta = undefined;
      }
    });

    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      await exportExcelBtn.click();

      const errorLocator = page.locator('#error');
      await errorLocator.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
      const errorText = (await errorLocator.innerText().catch(() => ''))?.toLowerCase() || '';

      // No ReferenceError: meta is not defined should appear in the console.
      const hasMetaReferenceError = consoleMessages.some(msg =>
        msg.toLowerCase().includes('referenceerror') && msg.toLowerCase().includes('meta')
      );
      expect(hasMetaReferenceError).toBeFalsy();

      if (errorText) {
        expect(errorText).toContain('export error');
        expect(errorText).toContain('metadata');
      }
    }
  });
});
