import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  runDefaultPreview,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Outcome Context and Report Range Trust Validation', () => {
  test('Report context line is non-empty before or after preview (placeholder or filters)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const contextLine = page.locator('#report-context-line');
    await expect(contextLine).toBeVisible({ timeout: 10000 });
    const text = (await contextLine.textContent().catch(() => '') || '').trim();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/No report run yet|Active filters|Projects|Report range/i);
    assertTelemetryClean(telemetry);
  });

  test('Report context line uses Active filters + Report range label', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await runDefaultPreview(page);

    const contextLine = page.locator('#report-context-line');
    const visible = await contextLine.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Report context line not visible');
      return;
    }

    const text = (await contextLine.textContent().catch(() => '') || '').trim();
    expect(text).toContain('Active filters: Projects');
    expect(text).toContain('Report range:');
    expect(text.toLowerCase()).not.toContain('query window');

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Leadership trends context line reuses the same Active filters + Report range label', async ({ page }, testInfo) => {
    const telemetry = captureBrowserTelemetry(page);

    await runDefaultPreview(page);
    await page.goto('/report#trends');

    const leadershipContext = page.locator('.leadership-context-line .leadership-range-hint').first();
    const visible = await leadershipContext.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Leadership context line not visible');
      return;
    }

    const text = (await leadershipContext.textContent().catch(() => '') || '').trim();
    expect(text).toContain('Active filters: Projects');
    expect(text).toContain('Report range:');
    expect(text.toLowerCase()).not.toContain('query window');

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Current Sprint header cache chip shows report context with Report range label when available', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const cacheChip = page.locator('.header-context-chip-cache').first();
    const visible = await cacheChip.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Report cache context chip not visible for current dataset');
      return;
    }

    const text = (await cacheChip.textContent().catch(() => '') || '').trim();
    expect(text).toContain('From report cache:');
    expect(text).toContain('Report range:');

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

