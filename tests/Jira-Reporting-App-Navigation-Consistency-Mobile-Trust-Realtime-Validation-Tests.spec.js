import { test, expect } from '@playwright/test';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getViewportClippingReport,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

async function skipIfAuthRedirect(page) {
  const url = page.url() || '';
  if (url.includes('/login') || url.endsWith('/')) {
    test.skip(true, 'Auth redirect active; navigation validation requires app shell routes');
    return true;
  }
  return false;
}

test.describe('Jira Reporting App - Navigation Consistency Mobile Trust Realtime Validation Tests', () => {
  test('01 report renders global navigation with clear active state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await expect(page.locator('.app-sidebar')).toBeVisible();
    await expect(page.locator('.app-sidebar .sidebar-link[data-nav-key="report"]')).toBeVisible();
    await expect(page.locator('.app-sidebar a.sidebar-link[data-nav-key="current-sprint"]')).toBeVisible();
    await expect(page.locator('.app-sidebar .sidebar-link.current[data-nav-key="report"]')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('02 trends tab activation from report uses direct hash-to-value', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('#tab-btn-trends');
    await expect(page).toHaveURL(/\/report#trends/);
    await expect(page.locator('#tab-btn-trends')).toHaveClass(/active/);
    await expect(page.locator('.app-sidebar .sidebar-link.current[data-nav-key="report"]')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('03 deep-link report#trends opens leadership tab and nav state reliably', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report#trends');
    if (await skipIfAuthRedirect(page)) return;

    await expect(page.locator('#tab-btn-trends')).toHaveClass(/active/);
    await expect(page.locator('.app-sidebar .sidebar-link.current[data-nav-key="report"]')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('04 switching away from trends resets hash and returns report nav state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report#trends');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('#tab-btn-project-epic-level');
    await expect(page).toHaveURL(/\/report$/);
    await expect(page.locator('.app-sidebar .sidebar-link.current[data-nav-key="report"]')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('05 current sprint page keeps nav visible and active on sprint destination', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfAuthRedirect(page)) return;

    await expect(page.locator('.app-sidebar')).toBeVisible();
    await expect(page.locator('.app-sidebar .sidebar-link.current[data-nav-key="current-sprint"]')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('06 current sprint report nav resolves to report destination', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('.app-sidebar a.sidebar-link[data-nav-key="report"]');
    await expect(page).toHaveURL(/\/report$/);
    assertTelemetryClean(telemetry);
  });

  test('07 mobile sidebar opens with lock + accessible expanded state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('.sidebar-toggle');
    await expect(page.locator('.app-sidebar')).toHaveClass(/open/);
    await expect(page.locator('.sidebar-backdrop')).toHaveClass(/active/);
    await expect(page.locator('.sidebar-toggle')).toHaveAttribute('aria-expanded', 'true');
    const bodyClass = await page.locator('body').getAttribute('class');
    expect(bodyClass || '').toMatch(/sidebar-scroll-lock/);
    assertTelemetryClean(telemetry);
  });

  test('08 mobile backdrop click closes sidebar and restores toggle state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('.sidebar-toggle');
    await page.evaluate(() => {
      const backdrop = document.querySelector('.sidebar-backdrop');
      if (backdrop) backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect(page.locator('.app-sidebar')).not.toHaveClass(/open/);
    await expect(page.locator('.sidebar-toggle')).toHaveAttribute('aria-expanded', 'false');
    assertTelemetryClean(telemetry);
  });

  test('09 mobile Escape key closes sidebar reliably', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('.sidebar-toggle');
    await page.keyboard.press('Escape');
    await expect(page.locator('.app-sidebar')).not.toHaveClass(/open/);
    assertTelemetryClean(telemetry);
  });

  test('10 mobile nav click closes sidebar after destination change', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('.sidebar-toggle');
    const currentSprintLink = page.locator('.app-sidebar a.sidebar-link[data-nav-key="current-sprint"]');
    await currentSprintLink.scrollIntoViewIfNeeded();
    await currentSprintLink.dispatchEvent('click');
    await expect(page).toHaveURL(/\/current-sprint/);
    await expect(page.locator('.app-sidebar')).not.toHaveClass(/open/);
    assertTelemetryClean(telemetry);
  });

  test('11 report mobile layout keeps navigation and shell within viewport', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    const report = await getViewportClippingReport(page, {
      selectors: ['body', '.container', 'header', '.main-layout', '.sidebar-toggle'],
      maxLeftGapPx: 12,
      maxRightOverflowPx: 1,
    });
    expect(report.offenders).toEqual([]);
    assertTelemetryClean(telemetry);
  });

  test('12 /leadership route resolves to canonical report trends destination', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/leadership');
    if (await skipIfAuthRedirect(page)) return;

    await expect(page).toHaveURL(/\/report#trends/);
    await expect(page.locator('#tab-btn-trends')).toHaveClass(/active/);
    assertTelemetryClean(telemetry);
  });

  test('13 cross-page navigation journey remains telemetry-clean and state-consistent', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('.app-sidebar a.sidebar-link[data-nav-key="current-sprint"]');
    await expect(page).toHaveURL(/\/current-sprint/);
    await page.click('.app-sidebar a.sidebar-link[data-nav-key="report"]');
    await expect(page).toHaveURL(/\/report$/);
    await page.click('#tab-btn-project-epic-level');
    await expect(page).toHaveURL(/\/report(#.*)?$/);
    assertTelemetryClean(telemetry);
  });
});
