/**
 * Validates CSS build output and mobile responsiveness: built styles.css exists,
 * report and current-sprint headers have no horizontal overflow at 375px, key text visible,
 * nav and filters present. Uses captureBrowserTelemetry and assertTelemetryClean per step.
 */

import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import path from 'path';
import { existsSync, statSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { captureBrowserTelemetry, assertTelemetryClean, skipIfRedirectedToLogin, getViewportClippingReport } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const stylesPath = path.join(projectRoot, 'public', 'styles.css');
const BUILD_MARKER = 'Built from public/css/';

test.describe('CSS Build And Mobile Responsive Validation', () => {
  test('CSS build output exists and has content', () => {
    expect(existsSync(stylesPath)).toBe(true);
    const stat = statSync(stylesPath);
    expect(stat.size).toBeGreaterThan(0);
    const content = readFileSync(stylesPath, 'utf-8');
    expect(content).toContain(BUILD_MARKER);
  });

  test('report page loads and header is responsive at 375px', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const headerOverflow = await page.evaluate(() => {
      const h = document.querySelector('header');
      return h ? h.scrollWidth > h.clientWidth : false;
    });
    expect(headerOverflow).toBe(false);
    await expect(page.locator('header h1')).toContainText(/General Performance|High-Level/i);
    const hasSubtitle = await page.locator('#report-subtitle').isVisible().catch(() => false);
    const hasHeaderActions = await page.locator('#report-header-actions').isVisible().catch(() => false);
    expect(hasSubtitle || hasHeaderActions).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('current-sprint header responsive at 375px', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const titleBlockOverflow = await page.evaluate(() => {
      const block = document.querySelector('header .board-select-wrap, .current-sprint-header-bar');
      return block ? block.scrollWidth > block.clientWidth : false;
    });
    expect(titleBlockOverflow).toBe(false);
    const mainTitle = page.locator('header h1, .current-sprint-header-bar .header-sprint-name, #current-sprint-title').first();
    await expect(mainTitle).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('report nav and filters visible after load at 375px', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const hasNav = await page.locator('.app-sidebar, .sidebar-toggle, nav.app-nav, .app-global-nav-wrap').first().isVisible().catch(() => false);
    const hasFilters = await page.locator('#filters-panel-collapsed-bar, #filters-panel-body, [data-action="toggle-filters"]').first().isVisible().catch(() => false);
    expect(hasNav || hasFilters).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('report page has no viewport horizontal overflow at 375px', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const clipping = await getViewportClippingReport(page, {
      selectors: ['.container', 'header', '.main-layout', '.preview-area'],
    });
    expect(clipping.offenders).toEqual([]);
    assertTelemetryClean(telemetry);
  });

  test('current-sprint page has no viewport horizontal overflow at 375px', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const clipping = await getViewportClippingReport(page, {
      selectors: ['.container', 'header', '.main-layout'],
    });
    expect(clipping.offenders).toEqual([]);
    assertTelemetryClean(telemetry);
  });

  test('leadership page has no viewport horizontal overflow at 375px', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/sprint-leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const clipping = await getViewportClippingReport(page, {
      selectors: ['.container', 'header', '.main-layout', '#leadership-content'],
    });
    expect(clipping.offenders).toEqual([]);
    assertTelemetryClean(telemetry);
  });

  test('report desktop container does not leave oversized empty gutter and keeps content in viewport', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const metrics = await page.evaluate(() => {
      const container = document.querySelector('.container');
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(metrics).toBeTruthy();
    expect(metrics.left).toBeLessThanOrEqual(260);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    assertTelemetryClean(telemetry);
  });

  test('report desktop uses header actions instead of an in-content collapsed filters bar', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#report-header-preview-btn')).toBeVisible();
    await page.locator('#report-header-actions details.report-header-more-menu summary').click();
    await expect(page.locator('.report-header-more-panel [data-action="toggle-filters"]').first()).toBeVisible();
    const collapsedBarVisible = await page.locator('#filters-panel-collapsed-bar').isVisible().catch(() => false);
    expect(collapsedBarVisible).toBe(false);
    assertTelemetryClean(telemetry);
  });
});
