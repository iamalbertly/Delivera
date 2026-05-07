import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera cross-surface context freshness SSOT', () => {
  test('report and leadership expose one coherent confidence/context story', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#report-filter-strip')).toBeVisible();

    await page.goto('/leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#project-context')).toBeVisible();
    await expect(page.locator('#leadership-confidence-strip')).toContainText(/State:/i);

    const values = await page.evaluate(() => {
      const context = document.getElementById('project-context')?.textContent || '';
      const confidence = document.getElementById('leadership-confidence-strip')?.textContent || '';
      return {
        context: context.replace(/\s+/g, ' ').trim(),
        confidence: confidence.replace(/\s+/g, ' ').trim(),
      };
    });
    expect(values.context.length).toBeGreaterThan(8);
    expect(values.confidence.length).toBeGreaterThan(8);
    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });
});

