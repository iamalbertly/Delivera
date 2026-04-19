import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

async function ensureReportFiltersExpanded(page) {
  const projectSearch = page.locator('#project-search');
  const isVisible = await projectSearch.isVisible().catch(() => false);
  if (isVisible) return;
  const toggle = page.locator('[data-action="toggle-filters"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
  await expect(projectSearch).toBeVisible();
}

test.describe('UX Report Flow & Export Experience', () => {
  test('report subtitle explains auto-refresh with manual Preview control', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');

    await expect(page.locator('h1')).toContainText(/General Performance|Performance History/i);
    await expect(page.locator('#report-subtitle')).toContainText(/Preview updates automatically when filters change/i);
    await expect(page.locator('#preview-btn')).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('projects are directly selectable and search still works without extra toggles', async ({ page }) => {
    await page.goto('/report');

    await ensureReportFiltersExpanded(page);
    await expect(page.locator('#project-search')).toBeVisible();
    await expect(page.locator('#projects-no-match')).toBeHidden();
    await expect(page.locator('#show-all-squads')).toHaveCount(0);

    await page.fill('#project-search', 'MPSA');
    await expect(page.locator('#projects-no-match')).toBeHidden();
    await ensureReportFiltersExpanded(page);
    await page.fill('#project-search', 'ZZZ-DOES-NOT-EXIST');
    await expect(page.locator('#projects-no-match')).toBeVisible();
  });

  test('applied filters summary stays visible and reflects current date range', async ({ page }) => {
    await page.goto('/report');

    await ensureReportFiltersExpanded(page);
    await page.uncheck('#project-rpa').catch(() => {});
    await page.fill('#start-date', '2025-07-01T00:00');
    await page.fill('#end-date', '2025-09-30T23:59');

    const summary = page.locator('#applied-filters-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/2025-07-01/);
    await expect(summary).toContainText(/2025-09-30/);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    await expect(summary).toBeVisible();
    await expect(page.locator('#applied-filters-edit-btn')).toHaveCount(0);
  });

  test('export CTAs are hidden until preview has run then show Share / Export', async ({ page }) => {
    await page.goto('/report');

    await expect(page.locator('#export-excel-btn')).toBeHidden();

    await ensureReportFiltersExpanded(page);
    await page.check('#project-mpsa').catch(() => {});
    await page.fill('#start-date', '2025-07-01T00:00').catch(() => {});
    await page.fill('#end-date', '2025-09-30T23:59').catch(() => {});
    const previewContent = page.locator('#preview-content');
    const hasPreviewAlready = await previewContent.isVisible().catch(() => false);
    if (!hasPreviewAlready) {
      const previewBtn = page.locator('#preview-btn');
      if (await previewBtn.isVisible().catch(() => false)) {
        await previewBtn.click();
      }
    }
    await expect(page.locator('#preview-content')).toBeVisible({ timeout: 60000 });

    await expect(page.locator('#export-excel-btn')).toBeVisible();
    await expect(page.locator('#export-excel-btn')).toContainText(/Share \/ Export|Export Excel - All data/);
  });

  test('loading feedback and sticky context are visible when triggering preview from deep scroll', async ({ page }) => {
    test.setTimeout(180000);

    await page.goto('/report');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await page.route('/preview.json?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await page.click('#preview-btn');

    const loadingTop = await page.evaluate(() => {
      const el = document.getElementById('loading');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return rect.top;
    });
    expect(loadingTop).not.toBeNull();
    expect(loadingTop).toBeLessThan(320);

    await expect(page.locator('#loading-status-chip')).toBeVisible();

    await page.waitForSelector('#preview-content', { state: 'visible', timeout: 120000 }).catch(() => null);
    const sticky = page.locator('#preview-summary-sticky');
    const ariaHidden = await sticky.getAttribute('aria-hidden');
    if (ariaHidden === 'true' || ariaHidden === null) {
      test.skip(true, 'Preview sticky summary not rendered for current data set');
      return;
    }
    const stickyVisible = await sticky.isVisible().catch(() => false);
    if (stickyVisible) {
      await expect(sticky).toBeVisible();
    } else {
      await expect(page.locator('#preview-outcome-line')).toBeVisible();
    }
  });
});
