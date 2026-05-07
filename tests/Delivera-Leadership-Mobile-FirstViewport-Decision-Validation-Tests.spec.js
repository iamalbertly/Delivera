import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera leadership mobile first viewport decision clarity', () => {
  test('mobile viewport keeps key decision state visible with readable contrast', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('h1')).toContainText(/Leadership/i);
    await expect(page.locator('#connection-status')).toBeVisible();
    await expect(page.locator('#leadership-confidence-strip')).toBeVisible();

    const contrastAudit = await page.evaluate(() => {
      const bg = getComputedStyle(document.body).backgroundColor;
      const status = document.getElementById('connection-status');
      const confidence = document.getElementById('leadership-confidence-strip');
      return {
        bg,
        statusColor: status ? getComputedStyle(status).color : '',
        confidenceColor: confidence ? getComputedStyle(confidence).color : '',
        headerHeight: document.querySelector('.hud-header-mission-control')?.getBoundingClientRect().height || 0,
      };
    });

    expect(contrastAudit.statusColor).not.toBe(contrastAudit.bg);
    expect(contrastAudit.confidenceColor).not.toBe(contrastAudit.bg);
    expect(contrastAudit.headerHeight).toBeLessThan(560);
    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });
});

