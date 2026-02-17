import { test, expect } from '@playwright/test';
import {
  captureBrowserTelemetry,
  runDefaultPreview,
  waitForPreview,
  assertTelemetryClean,
  getViewportClippingReport,
  skipIfRedirectedToLogin,
  clickReportPreviewFromCurrentState,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

// Customer + Speed + Simplicity + Trust validation with fail-fast telemetry checks.
test.describe('Jira Reporting App - Customer Speed Simplicity Trust Realtime Validation Tests', () => {
  test('01 report first paint has controls and clean realtime telemetry', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');

    await expect(page.locator('h1')).toContainText(/General Performance|VodaAgileBoard/i);
    await expect(page.locator('#preview-btn')).toBeVisible();
    await expect(page.locator('#applied-filters-summary')).toBeVisible();
    const hasSidebar = await page.locator('.app-sidebar').isVisible().catch(() => false);
    const hasNav = await page.locator('nav.app-nav').first().isVisible().catch(() => false);
    expect(hasSidebar || hasNav).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('02 report desktop viewport has no clipped containers', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/report');

    const report = await getViewportClippingReport(page, {
      selectors: ['body', '.app-main', '.container', '.preview-area', '.tabs'],
      maxLeftGapPx: 1000,
      maxRightOverflowPx: 1,
    });
    const hardOverflow = report.offenders.filter((o) => o.right > report.viewportWidth + 1 || o.left < -1);
    expect(hardOverflow).toEqual([]);

    assertTelemetryClean(telemetry);
  });

  test('03 report mobile viewport has no forced left gutter or horizontal overflow', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');

    const report = await getViewportClippingReport(page, {
      selectors: ['body', '.app-main', '.container', '.preview-area', '.tabs'],
      maxLeftGapPx: 12,
      maxRightOverflowPx: 1,
    });
    const hardOverflow = report.offenders.filter((o) => o.right > report.viewportWidth + 1 || o.left < -1);
    expect(hardOverflow).toEqual([]);
    expect(report.bodyScrollWidth <= report.viewportWidth + 1).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('04 preview meta keeps outcome-first semantics after render', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    if (await skipIfRedirectedToLogin(page, test)) return;

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible for current environment.');
      return;
    }

    const outcomeLine = page.locator('#preview-meta .meta-outcome-line').first();
    const contextLine = page.locator('#preview-meta .meta-context-line').first();
    await expect(outcomeLine).toContainText(/done stories|sprints|boards/i);
    await expect(contextLine).toContainText(/Active filters|Projects\b|Report range|Range:|Generated:|Data freshness/i);

    assertTelemetryClean(telemetry);
  });

  test('05 project and epic level keeps throughput merged in boards columns only', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible for throughput merge validation.');
      return;
    }

    await page.click('.tab-btn[data-tab="project-epic-level"]');
    await page.waitForSelector('#project-epic-level-content', { state: 'visible', timeout: 10000 });

    const metricsText = (await page.locator('#project-epic-level-content').textContent()) || '';
    expect(metricsText.includes('Throughput Stories') || metricsText.includes('Throughput SP')).toBeTruthy();
    expect(metricsText.includes('Throughput (Per Project)')).toBeFalsy();

    const boardsTablesCount = await page.locator('#project-epic-level-content table#boards-table').count();
    expect(boardsTablesCount).toBe(1);

    assertTelemetryClean(telemetry);
  });

  test('06 report deep-scroll preview keeps loading feedback visible near top and context discoverable', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const previewBtn = page.locator('#preview-btn');
    if (!(await previewBtn.isVisible().catch(() => false))) {
      const toggleFilters = page.locator('[data-action="toggle-filters"]');
      if (await toggleFilters.isVisible().catch(() => false)) {
        await toggleFilters.click();
      }
    }
    await expect(previewBtn).toBeVisible();
    await page.evaluate(() => {
      const btn = document.querySelector('#preview-btn');
      if (btn) btn.click();
    });
    await page.waitForSelector('#loading', { state: 'visible', timeout: 10000 }).catch(() => null);
    const loadingTop = await page.evaluate(() => {
      const el = document.getElementById('loading');
      if (!el) return 9999;
      return el.getBoundingClientRect().top;
    });
    expect(loadingTop).toBeLessThan(340);

    await waitForPreview(page, { timeout: 120000 });
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible for deep-scroll validation.');
      return;
    }

    const sticky = page.locator('#preview-summary-sticky');
    const stickyVisible = await sticky.isVisible().catch(() => false);
    if (!stickyVisible) {
      await expect(page.locator('#preview-meta .meta-summary-line')).toBeVisible();
    }

    assertTelemetryClean(telemetry);
  });

  test('07 export controls stay hidden before preview and become available after successful preview', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await expect(page.locator('#export-excel-btn')).toBeHidden();

    const clicked = await clickReportPreviewFromCurrentState(page);
    expect(clicked).toBeTruthy();
    await waitForPreview(page, { timeout: 120000 });

    const hasPreviewContent = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!hasPreviewContent) {
      test.skip(true, 'Preview not visible; export state not asserted.');
      return;
    }

    await expect(page.locator('#export-excel-btn')).toBeVisible();
    await expect(page.locator('#export-dropdown-trigger')).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('08 current sprint page loads with board selector or clear fallback and clean telemetry', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForTimeout(700);
    const hasBoardSelect = await page.locator('#board-select').isVisible().catch(() => false);
    const bodyText = (await page.locator('body').textContent()) || '';
    const hasFallback = /No boards available|Couldn't load boards|No active or recent closed sprint|Loading boards for project/i.test(bodyText);
    const hasRuntimeErrorText = /ReferenceError|TypeError|is not defined|Cannot read properties of|undefined is not an object/i.test(bodyText);

    expect(hasBoardSelect || hasFallback).toBeTruthy();
    expect(hasRuntimeErrorText).toBeFalsy();

    assertTelemetryClean(telemetry);
  });

  test('09 current sprint page keeps viewport fit on mobile', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const report = await getViewportClippingReport(page, {
      selectors: ['body', '.app-main', '.container', '.dashboard-grid', '.current-sprint-header-bar'],
      maxLeftGapPx: 8,
      maxRightOverflowPx: 1,
    });
    expect(report.offenders).toEqual([]);

    assertTelemetryClean(telemetry);
  });

  test('10 leadership route resolves to trends experience with context and clean telemetry', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/sprint-leadership');

    await expect(page).toHaveURL(/report#trends|sprint-leadership/i);
    const trendsCount = await page.locator('#tab-btn-trends').count();
    expect(trendsCount > 0).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('11 leadership trends shows usable content or explicit empty explanation', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');

    const trendsTab = page.locator('#tab-btn-trends');
    if (await trendsTab.isVisible().catch(() => false)) {
      await trendsTab.click();
    }

    const bodyText = (await page.locator('body').textContent()) || '';
    const hasUsableCopy = /leadership|trend|sprint|delivery|No boards|No report run yet/i.test(bodyText);
    expect(hasUsableCopy).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('12 hydration chooses widest cached project scope when last query missing', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('vodaAgileBoard_lastQuery_v1');
        localStorage.removeItem('vodaAgileBoard_selectedProjects');
        sessionStorage.setItem('report-last-meta', JSON.stringify({
          projects: ['MPSA', 'MAS', 'SD', 'RPA'],
          generatedAt: new Date().toISOString(),
          fromCache: true,
        }));
      } catch (_) {}
    });

    await page.goto('/report');
    for (const key of ['MPSA', 'MAS', 'SD', 'RPA']) {
      await expect(page.locator(`.project-checkbox[data-project="${key}"]`)).toBeChecked();
    }

    assertTelemetryClean(telemetry);
  });

  test('13 no duplicated boards visualization blocks in project and epic level tab', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; duplicate visualization guard skipped.');
      return;
    }

    await page.click('.tab-btn[data-tab="project-epic-level"]');

    const boardsHeadingCount = await page
      .locator('#project-epic-level-content h3')
      .filter({ hasText: /^Boards$/ })
      .count();

    expect(boardsHeadingCount).toBe(1);

    assertTelemetryClean(telemetry);
  });

  test('14 edge case - invalid date range fails fast with clear error and no stuck loading', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');

    await page.fill('#start-date', '2025-10-01T00:00', { force: true });
    await page.fill('#end-date', '2025-09-01T00:00', { force: true });
    await page.click('#preview-btn');

    const error = page.locator('#error');
    await expect(error).toBeVisible({ timeout: 5000 });
    const errorText = (await error.textContent()) || '';
    expect(errorText.trim().length > 0).toBeTruthy();
    await expect(page.locator('#preview-btn')).toBeEnabled({ timeout: 5000 });

    assertTelemetryClean(telemetry);
  });

  test('15 edge case - double-click preview guard prevents unstable duplicate in-flight state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');

    const previewBtn = page.locator('#preview-btn');
    await previewBtn.scrollIntoViewIfNeeded();
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();
    await page.evaluate(() => {
      const btn = document.getElementById('preview-btn');
      if (btn) btn.click();
    });

    await expect(previewBtn).toBeDisabled({ timeout: 5000 });
    await waitForPreview(page, { timeout: 120000 });

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    expect(previewVisible || errorVisible).toBeTruthy();

    assertTelemetryClean(telemetry);
  });

  test('16 edge case - realtime logcat-equivalent captures only expected noise', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    expect(previewVisible || errorVisible).toBeTruthy();

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});
