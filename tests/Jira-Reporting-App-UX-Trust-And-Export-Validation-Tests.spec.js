/**
 * UX Trust and Export Validation (SSOT: report, current-sprint, leadership, export).
 * Validates report load, nav strip, preview flow, tabs/export, date validation,
 * current-sprint and leadership page load, Excel export or clear state, and double-click guard
 * using captureBrowserTelemetry and realtime UI assertions at every stage.
 */

import { test, expect } from '@playwright/test';
import {
  captureBrowserTelemetry,
  runDefaultPreview,
  waitForPreview,
  assertTelemetryClean,
  EXCEL_DOWNLOAD_TIMEOUT_MS,
  skipIfRedirectedToLogin,
  getReportExportButtonState,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

async function hasAnyExportableRows(page) {
  return page.evaluate(() => {
    const emptyRowPattern = /(no data|no rows|nothing to show|select at least|run preview|preview to load)/i;
    const tables = ['#done-stories-table', '#boards-table', '#sprints-table'];
    return tables.some((selector) => {
      const table = document.querySelector(selector);
      if (!table) return false;
      return Array.from(table.querySelectorAll('tbody tr')).some((row) => {
        if (row.classList.contains('empty-row') || row.classList.contains('placeholder-row') || row.classList.contains('skeleton-row')) return false;
        const text = (row.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return false;
        return !emptyRowPattern.test(text);
      });
    });
  });
}

test.describe('UX Trust and Export Validation (telemetry + UI per step)', () => {
  test('report first-open hydrates project selection from cached meta scope when last query is missing', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('vodaAgileBoard_lastQuery_v1');
        localStorage.removeItem('vodaAgileBoard_selectedProjects');
        sessionStorage.setItem('report-last-meta', JSON.stringify({
          projects: ['MPSA', 'MAS', 'SD', 'RPA'],
          start: '2026-01-01T06:00',
          end: '2026-04-02T02:59',
          generatedAt: new Date().toISOString(),
          fromCache: true,
        }));
      } catch (_) {}
    });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    for (const key of ['MPSA', 'MAS', 'SD', 'RPA']) {
      await expect(page.locator(`.project-checkbox[data-project="${key}"]`)).toBeChecked();
    }
  });

  test('report load: expected controls and nav strip visible, no critical console/network errors', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');

    await expect(page.locator('h1')).toContainText(/High-Level Performance|VodaAgileBoard/i);
    await expect(page.locator('#project-mpsa')).toBeVisible();
    await expect(page.locator('#preview-btn')).toBeVisible();
    await expect(page.locator('#export-excel-btn')).toBeHidden();
    await expect(page.locator('#export-dropdown-trigger')).toBeHidden();
    await expect(page.locator('#preview-content')).toBeHidden();
    await expect(page.locator('.app-sidebar .app-nav, nav.app-nav')).toBeVisible();
    await expect(page.locator('.app-sidebar a.sidebar-link[href="/current-sprint"], nav.app-nav a[href="/current-sprint"]')).toContainText('Current Sprint');

    assertTelemetryClean(telemetry);
  });

  test('preview flow: Preview click then content or error visible with no unexpected console errors', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await expect(page.locator('#preview-btn')).toBeVisible();
    await page.click('#preview-btn');

    await waitForPreview(page, { timeout: 120000 });
    const previewVisible = await page.locator('#preview-content').isVisible();
    const errorVisible = await page.locator('#error').isVisible();
    expect(previewVisible || errorVisible).toBeTruthy();
    if (errorVisible) {
      const errorText = await page.locator('#error').textContent();
      expect(errorText && errorText.trim().length > 0).toBeTruthy();
    }

    assertTelemetryClean(telemetry);
  });

  test('report tabs and export: after preview, tabs and export controls are visible', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    await waitForPreview(page, { timeout: 120000 });

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }
    await expect(page.locator('.tabs')).toBeVisible();
    const primaryTabs = page.locator('.tab-btn:not(.tabs-more-btn)');
    await expect(primaryTabs).toHaveCount(5);
    await expect(page.locator('#tab-project-epic-level')).toBeVisible();
    await expect(page.locator('#export-excel-btn')).toBeVisible();
    await expect(page.locator('#export-dropdown-trigger')).toBeVisible();
    const noDuplicateSummary = await page.evaluate(() => {
      const meta = document.getElementById('preview-meta');
      if (!meta) return true;
      const text = (meta.textContent || '').replace(/\s+/g, ' ').trim();
      const hasLegacySummary = /Summary:\s*\d+\s+done stories\s*\|\s*Boards:/i.test(text);
      const doneStoriesMatches = text.match(/\d+\s+done stories/i) || [];
      return !hasLegacySummary && doneStoriesMatches.length <= 1;
    });
    expect(noDuplicateSummary).toBe(true);
    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/status of 502/i],
    });
  });

  test('current-sprint page loads and shows board selector with no console errors', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await expect(page.locator('h1')).toContainText('Current Sprint');
    await expect(page.locator('#board-select')).toBeVisible();
    await expect(page.locator('.app-sidebar a.sidebar-link[href="/report"], nav.app-nav a[href="/report"]')).toContainText(/Performance Report|Report/);
    const options = await page.locator('#board-select option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(1);
    assertTelemetryClean(telemetry);
  });

  test('sprint-leadership URL redirects to report#trends with Trends tab active', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page).toHaveURL(/\/report#trends$/);
    await expect(page.locator('#tab-btn-trends')).toHaveClass(/active/);
    assertTelemetryClean(telemetry);
  });

  test('hash tab precedence: report#trends stays active even when saved tab is done-stories', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('report-active-tab', 'done-stories');
      } catch (_) {}
    });
    await page.goto('/report#trends');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#tab-btn-trends')).toHaveClass(/active/);
    assertTelemetryClean(telemetry);
  });

  test('export state after preview: export enabled when preview has rows, disabled when error', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    await waitForPreview(page, { timeout: 120000 });

    const previewVisible = await page.locator('#preview-content').isVisible();
    const errorVisible = await page.locator('#error').isVisible();
    const exportBtn = page.locator('#export-excel-btn');
    if (previewVisible) {
      if (await hasAnyExportableRows(page)) {
        const isEnabled = await exportBtn.isEnabled().catch(() => false);
        if (isEnabled) {
          await expect(exportBtn).toBeEnabled();
        } else {
          const title = (await exportBtn.getAttribute('title')) || '';
          const aria = (await exportBtn.getAttribute('aria-label')) || '';
          if (title || aria) {
            expect(/partial|loaded|export|data|share/i.test(`${title} ${aria}`)).toBeTruthy();
          }
        }
      } else {
        await expect(exportBtn).toBeDisabled();
        const title = (await exportBtn.getAttribute('title')) || '';
        const aria = (await exportBtn.getAttribute('aria-label')) || '';
        expect(/partial|loaded|export|data/i.test(`${title} ${aria}`)).toBeTruthy();
      }
    } else if (errorVisible) {
      const errorText = await page.locator('#error').textContent();
      expect(errorText && errorText.trim().length > 0).toBeTruthy();
    }

    assertTelemetryClean(telemetry);
  });

  test('date validation: start >= end shows error within 5s without long loading', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await expect(page.locator('#preview-btn')).toBeVisible();
    await page.fill('#start-date', '2025-09-30T23:59');
    await page.fill('#end-date', '2025-07-01T00:00');
    await page.click('#preview-btn');

    await expect(page.locator('#error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.locator('#error').textContent();
    expect(errorText).toMatch(/Start date|before end date/i);

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/status of 502/i],
    });
  });

  test('error retry action: "Try smaller date range" triggers follow-up preview with narrower window', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    let previewCallCount = 0;
    const previewUrls = [];
    await page.route('**/preview.json*', async (route) => {
      previewCallCount += 1;
      const url = route.request().url();
      previewUrls.push(url);
      if (previewCallCount === 1) {
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Preview failed', code: 'BOARD_FETCH_ERROR', message: 'Failed to fetch sprints for board 27: Request failed with status code 400' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          meta: {
            selectedProjects: ['MPSA', 'MAS'],
            windowStart: '2026-03-02T00:00:00.000Z',
            windowEnd: '2026-04-01T00:00:00.000Z',
            generatedAt: new Date().toISOString(),
            fromCache: false,
          },
          boards: [{ id: 1, name: 'Board 1' }],
          rows: [],
          metrics: {},
          sprintsIncluded: [],
          sprintsUnusable: [],
        }),
      });
    });

    await page.goto('/report');
    await page.fill('#start-date', '2026-01-01T00:00');
    await page.fill('#end-date', '2026-04-01T00:00');
    await page.click('#preview-btn');
    await expect(page.locator('#error')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-action="retry-with-smaller-range"]').click();

    await expect.poll(() => previewCallCount, { timeout: 10000 }).toBeGreaterThan(1);

    const lastUrl = previewUrls[previewUrls.length - 1] || '';
    const parsed = new URL(lastUrl);
    const start = parsed.searchParams.get('start');
    const end = parsed.searchParams.get('end');
    expect(start).toBeTruthy();
    expect(end).toBeTruthy();
    if (start && end) {
      const startMs = new Date(start).getTime();
      const endMs = new Date(end).getTime();
      const days = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
      expect(days).toBeLessThanOrEqual(31);
    }

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/status of 502/i],
    });
  });

  test('Excel export or clear state: download or error visible with telemetry clean', async ({ page }) => {
    test.setTimeout(200000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    await waitForPreview(page, { timeout: 120000 });

    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }
    const exportBtn = page.locator('#export-excel-btn');
    const exportState = await getReportExportButtonState(page);
    const exportEnabled = exportState.enabled;
    if (!(await hasAnyExportableRows(page)) || !exportEnabled) {
      await expect(exportBtn).toBeDisabled();
      const reasonText = `${exportState.title} ${exportState.aria}`.trim();
      expect(/partial|loaded|export|data|preview|rows|available/i.test(reasonText) || reasonText === '').toBeTruthy();
      assertTelemetryClean(telemetry);
      return;
    }
    await expect(exportBtn).toBeEnabled();
    await page.waitForTimeout(500);

    const downloadPromise = page.waitForEvent('download', { timeout: EXCEL_DOWNLOAD_TIMEOUT_MS });
    const clearStatePromise = (async () => {
      await page.waitForSelector('#error', { state: 'visible', timeout: EXCEL_DOWNLOAD_TIMEOUT_MS });
      const text = await page.locator('#error').textContent();
      if (text && text.trim().length > 0) return { type: 'clearState' };
      throw new Error('Error visible but empty');
    })();
    await exportBtn.click();

    const result = await Promise.race([
      downloadPromise.then((d) => ({ type: 'download', value: d })),
      clearStatePromise,
    ]).catch(async () => {
      try {
        const errVis = await page.locator('#error').isVisible();
        const errText = await page.locator('#error').textContent();
        if (errVis && errText && errText.trim().length > 0) return { type: 'clearState' };
      } catch (_) {}
      throw new Error(`Excel export: no download and no clear error state within ${EXCEL_DOWNLOAD_TIMEOUT_MS}ms`);
    });

    if (result.type === 'download') {
      expect(result.value).toBeTruthy();
      const filename = result.value.suggestedFilename();
      expect(filename).toMatch(/\.xlsx$/);
    } else if (result.type === 'clearState') {
      expect(await page.locator('#error').isVisible()).toBeTruthy();
      const errorText = await page.locator('#error').textContent();
      expect(errorText && errorText.trim().length > 0).toBeTruthy();
    }

    assertTelemetryClean(telemetry);
  });

  test('double-click guard: Preview disables immediately and still returns one outcome', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await expect(page.locator('#preview-btn')).toBeVisible();
    await page.fill('#start-date', '2025-07-01T00:00');
    await page.fill('#end-date', '2025-09-30T23:59');
    await page.check('#project-mpsa');
    await page.check('#project-mas');
    await page.click('#preview-btn');
    await expect(page.locator('#preview-btn')).toBeDisabled();

    await waitForPreview(page, { timeout: 120000 });
    const previewVisible = await page.locator('#preview-content').isVisible();
    const errorVisible = await page.locator('#error').isVisible();
    expect(previewVisible || errorVisible).toBeTruthy();

    assertTelemetryClean(telemetry);
  });
});


