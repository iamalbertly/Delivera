import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, ensureReportFiltersVisible } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera - Validation Plan (UI + Telemetry)', () => {
  test('report page loads with expected controls and no console errors', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/report');
    await ensureReportFiltersVisible(page);

    await expect(page.locator('h1')).toContainText(/Proof|Evidence|Delivery|Delivera|General Performance|Performance History/i);
    await expect(page.locator('#project-mpsa')).toBeAttached();
    await expect(page.locator('#project-mas')).toBeAttached();
    await expect(page.locator('#start-date')).toBeVisible();
    await expect(page.locator('#end-date')).toBeVisible();
    await expect(page.locator('#preview-btn')).toBeAttached();

    // Wayfinding: top chrome surface switcher (sidebar nav hidden on desktop with top chrome).
    const topChrome = page.locator('#app-top-chrome');
    if (await topChrome.isVisible().catch(() => false)) {
      await expect(topChrome.locator('a[href="/current-sprint"]')).toBeVisible();
      await expect(topChrome.locator('a[href="/governance"], [data-surface="governance"]').first()).toBeVisible();
    } else {
      const nav = page.locator('.app-sidebar .app-nav, nav.app-nav');
      await expect(nav).toBeAttached();
      await expect(nav.locator('a.sidebar-link[href="/current-sprint"]')).toContainText(/Sprint|Current Sprint/i);
    }
    await page.goto('/sprint-leadership');
    await expect(page).toHaveURL(/\/(governance|report(#trends)?|leadership)/);
    await page.goto('/report');

    // Tabs are present in the DOM but hidden until preview is generated
    await expect(page.locator('.tabs')).toHaveCount(1);
    await expect(page.locator('#preview-content')).toBeHidden();

    // Export buttons hidden until preview has run
    await expect(page.locator('#export-excel-btn')).toBeHidden();
    await expect(page.locator('#export-dropdown-trigger')).toBeHidden();

    // Validate no browser errors on load (ignoring favicon noise)
    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    expect(telemetry.failedRequests).toEqual([]);
  });

  test('preview button disables when no projects are selected', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/report');
    await ensureReportFiltersVisible(page);

    await page.uncheck('#project-mpsa');
    await page.uncheck('#project-mas');

    const previewButton = page.locator('#preview-btn');
    await expect(previewButton).toBeDisabled();
    await expect(previewButton).toHaveAttribute('title', /select at least one project/i);

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('preview button validates date ordering and shows error state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/report');
    await ensureReportFiltersVisible(page);

    await page.check('#project-mpsa');
    await page.fill('#start-date', '2025-09-30T23:59', { force: true });
    await page.fill('#end-date', '2025-07-01T00:00', { force: true });

    await page.click('#preview-btn');

    const errorBanner = page.locator('#error');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Start date must be before end date');

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });
});
