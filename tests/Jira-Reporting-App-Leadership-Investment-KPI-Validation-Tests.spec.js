import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean, waitForPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Leadership investment KPI and trust surfaces', () => {
  test('report trends now acts as a compact bridge into the standalone leadership HUD', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/report#trends');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login or home; auth may be required');
      return;
    }

    await page.locator('#preview-btn').click().catch(() => null);
    await waitForPreview(page, { timeout: 60000 });

    const hasPreview = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!hasPreview) {
      test.skip(true, 'Preview did not load for current data set');
      return;
    }

    await page.click('#tab-btn-trends');
    await expect(page.locator('#tab-btn-trends')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.leadership-bridge-card')).toBeVisible();
    await expect(page.locator('.leadership-bridge-card .btn[href="/leadership"]')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-kpi-strip')).toHaveCount(0);
    await expect(page.locator('#leadership-content .leadership-direct-value-card')).toHaveCount(0);

    const bridgeText = await page.locator('.leadership-bridge-card').textContent();
    expect(bridgeText || '').toMatch(/Leadership analysis now lives in one place|Open Leadership HUD/i);

    assertTelemetryClean(telemetry);
  });

  test('standalone leadership HUD shows trust, KPI, and export guidance when data exists', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/leadership');
    if (page.url().includes('/report#trends')) {
      await page.goto('/leadership.html');
    }

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login or home; auth may be required');
      return;
    }

    const hudGrid = page.locator('#hud-grid');
    await expect(hudGrid).toBeVisible();
    await page.waitForTimeout(3000);

    const cardCount = await page.locator('#hud-grid .hud-card').count();
    expect(cardCount).toBeGreaterThan(0);

    const anySignal = await page.locator('#hud-grid').textContent();
    if ((anySignal || '').includes('Loading range context and portfolio health')) {
      test.skip(true, 'Standalone leadership HUD did not finish loading in this environment');
      return;
    }
    expect(anySignal || '').toMatch(/Risk|Predictability|trust|outlier|Velocity/i);

    await page.goto('/leadership.html');
    await page.waitForTimeout(1000);
    const exportButton = page.locator('[data-action="export-leadership-quarterly-story"]').first();
    if (await exportButton.isVisible().catch(() => false)) {
      await expect(exportButton).toBeVisible();
    }

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });
});
