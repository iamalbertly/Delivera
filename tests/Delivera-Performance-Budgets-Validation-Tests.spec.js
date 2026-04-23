import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  runDefaultPreview,
  skipIfRedirectedToLogin,
  selectFirstBoard,
  assertPreviewOrSkip,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

async function readPerf(page, key) {
  return page.evaluate((routeKey) => {
    const marks = window.__perfMarks || {};
    return marks[routeKey] || null;
  }, key);
}

test.describe('Delivera - Performance Budgets Validation', () => {
  test('report exposes perf marks and direct-to-value content inside budget', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await runDefaultPreview(page, {
      projects: ['MPSA'],
      start: '2025-10-01T00:00',
      end: '2025-12-31T23:59',
    });

    const skipped = await skipIfRedirectedToLogin(page, test);
    if (skipped) return;

    await assertPreviewOrSkip(page, test, { timeout: 20000 });
    await expect(page.locator('#preview-content')).toBeVisible();
    await expect(page.locator('#preview-meta .preview-context-bar')).toBeVisible();
    await expect(page.locator('#preview-status-strip')).toHaveCount(1);

    const perf = await readPerf(page, 'report');
    expect(perf).toBeTruthy();
    expect(perf.navStart).toBeTruthy();
    expect(perf.firstValueRendered).toBeTruthy();
    expect(perf.fullRenderComplete).toBeTruthy();
    expect(perf.firstValueRendered - perf.navStart).toBeLessThanOrEqual(15000);
    expect(perf.fullRenderComplete - perf.navStart).toBeLessThanOrEqual(30000);
    expect(perf.fullRenderComplete).toBeGreaterThanOrEqual(perf.firstValueRendered);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('current sprint exposes perf marks and above-the-fold summary inside budget', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    const skipped = await skipIfRedirectedToLogin(page, test, { currentSprint: true });
    if (skipped) return;

    const boardId = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardId) {
      test.skip(true, 'No boards available for current sprint.');
      return;
    }

    await expect(page.locator('.current-sprint-header-bar')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.sprint-at-a-glance-hero, #current-sprint-content .transparency-card').first()).toBeVisible();

    const perf = await readPerf(page, 'current-sprint');
    expect(perf).toBeTruthy();
    expect(perf.navStart).toBeTruthy();
    expect(perf.firstValueRendered).toBeTruthy();
    expect(perf.fullRenderComplete).toBeTruthy();
    expect(perf.firstValueRendered - perf.navStart).toBeLessThanOrEqual(25000);
    expect(perf.fullRenderComplete - perf.navStart).toBeLessThanOrEqual(35000);
    expect(perf.fullRenderComplete).toBeGreaterThanOrEqual(perf.firstValueRendered);

    assertTelemetryClean(telemetry);
  });
});
