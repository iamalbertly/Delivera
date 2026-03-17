import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  waitForPreview,
  selectFirstBoard,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Overlay, context, and attention SSOT', () => {
  test('report uses one context strip, a real overlay drawer, named views, and a compact leadership bridge', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('#report-filter-strip .context-summary-strip, #preview-meta .preview-context-bar').first()).toBeVisible();

    const namedViews = page.locator('#report-named-views .named-views-bar');
    await expect(namedViews).toBeVisible();
    await expect(page.locator('#report-filter-strip [data-report-named-view]').first()).toBeVisible();

    await page.locator('summary.btn:has-text("More")').click().catch(() => null);
    await page.locator('.report-header-more-panel [data-action="toggle-filters"]').click();
    await expect(page.locator('#filters-panel')).toHaveClass(/is-open/);
    await expect(page.locator('.app-overlay-backdrop')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#filters-panel')).not.toHaveClass(/is-open/);

    await page.locator('#report-filter-strip [data-report-named-view]').first().click().catch(() => null);
    await expect(page.locator('#report-filter-strip [data-report-named-view].is-active').first()).toBeVisible();

    await page.locator('#preview-btn').click().catch(() => null);
    await waitForPreview(page, { timeout: 60000 });
    const hasPreview = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!hasPreview) {
      test.skip(true, 'Preview did not load for current data set');
      return;
    }

    await expect(page.locator('#preview-meta .attention-queue')).toBeVisible();
    await page.click('#tab-btn-trends');
    await expect(page.locator('.leadership-bridge-card')).toBeVisible();
    await expect(page.locator('.leadership-bridge-card .btn[href="/leadership"]')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-kpi-strip')).toHaveCount(0);

    assertTelemetryClean(telemetry);
  });

  test('current sprint exposes shared context and compact attention actions without losing work focus', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No board options available');
      return;
    }

    await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error', { timeout: 45000 }).catch(() => null);
    await expect(page.locator('.current-sprint-header-bar')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .mission-context-ribbon')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .attention-queue--compact')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .sprint-intervention-queue')).toBeVisible();

    const firstAttention = page.locator('.current-sprint-header-bar .attention-queue [data-attention-action]').first();
    if (await firstAttention.isVisible().catch(() => false)) {
      await firstAttention.click().catch(() => null);
      await expect(page.locator('#stories-card')).toBeVisible();
    }

    assertTelemetryClean(telemetry);
  });

  test('leadership page exposes one context summary, attention queue, and quarterly story export entry', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/leadership');
    if (page.url().includes('/report#trends')) {
      await page.goto('/leadership.html');
    }
    if (await skipIfRedirectedToLogin(page, test)) return;

    await page.waitForTimeout(3000);
    const content = page.locator('#leadership-content');
    if (!(await content.isVisible().catch(() => false))) {
      test.skip(true, 'Leadership content not available in this environment');
      return;
    }

    await expect(page.locator('.leadership-context-sticky .context-summary-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .attention-queue')).toBeVisible();
    await expect(page.locator('[data-action="export-leadership-quarterly-story"]').first()).toBeVisible();
    await expect(page.locator('[data-action="export-leadership-kpis-csv"]').first()).toBeVisible();

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });
});
