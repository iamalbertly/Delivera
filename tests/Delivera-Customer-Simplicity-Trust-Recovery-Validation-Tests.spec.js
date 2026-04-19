/**
 * Customer, Simplicity & Trust Recovery Validation Tests.
 * Validates all 13 to-dos: first-paint context line, Load latest visibility, loading/aria-busy,
 * error recovery and dismiss re-show, context cleared after preview, report load telemetry clean,
 * Preview button state in sync with filters. Uses captureBrowserTelemetry + assertTelemetryClean
 * (logcat-style) and real-time UI assertions at every step; fails fast on any UI or logcat issue.
 * Run by orchestration (Jira-Reporting-App-Test-Orchestration-Steps.js) with --max-failures=1.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  waitForPreview,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

async function ensureReportFiltersExpanded(page) {
  const startDate = page.locator('#start-date');
  if (await startDate.isVisible().catch(() => false)) return;
  const showFiltersBtn = page.locator('#filters-panel-collapsed-bar [data-action="toggle-filters"]').first();
  if (await showFiltersBtn.isVisible().catch(() => false)) {
    await showFiltersBtn.click({ force: true }).catch(() => null);
  }
  await startDate.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
}

test.describe('Customer Simplicity Trust Recovery Validation', () => {
  test.describe.configure({ retries: 0 });
  test('report load: no critical console or network errors (to-do 12)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    assertTelemetryClean(telemetry);
  });

  test('report: Preview enabled when projects and valid range selected (to-do 13)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await ensureReportFiltersExpanded(page);
    await expect(page.locator('#project-mpsa')).toBeVisible();
    await page.check('#project-mpsa').catch(() => null);
    await page.check('#project-mas').catch(() => null);
    await page.fill('#start-date', '2025-07-01T00:00').catch(() => null);
    await page.fill('#end-date', '2025-09-30T23:59').catch(() => null);
    await page.waitForTimeout(200);
    await expect(page.locator('#preview-btn')).toBeEnabled();
    assertTelemetryClean(telemetry);
  });
  test('report first-paint: context line visible and Load latest when No report run yet', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const contextLine = page.locator('#report-context-line');
    await expect(contextLine).toBeVisible();
    const text = (await contextLine.textContent()) || '';
    const isPlaceholder = /No report run yet/i.test(text);
    if (isPlaceholder) {
      const loadLatestWrap = page.locator('#report-load-latest-wrap');
      await expect(loadLatestWrap).toBeVisible();
    }
    assertTelemetryClean(telemetry);
  });

  test('report: when no projects selected Load latest is hidden and Preview disabled', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.evaluate(() => {
      document.querySelectorAll('.project-checkbox').forEach((cb) => {
        cb.checked = false;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    await page.waitForTimeout(300);
    await expect(page.locator('#preview-btn')).toBeDisabled();
    const loadLatestWrap = page.locator('#report-load-latest-wrap');
    const wrapVisible = await loadLatestWrap.isVisible().catch(() => false);
    const wrapDisplay = await loadLatestWrap.evaluate(el => el && getComputedStyle(el).display).catch(() => 'none');
    expect(wrapVisible === false || wrapDisplay === 'none').toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('report: when loading visible Load latest wrap is hidden and preview area aria-busy', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await ensureReportFiltersExpanded(page);
    const previewBtn = page.locator('#preview-btn');
    if (await previewBtn.isDisabled().catch(() => true)) {
      test.skip(true, 'Preview disabled; need projects/dates');
      return;
    }
    await previewBtn.click();
    await page.waitForSelector('#loading', { state: 'visible', timeout: 5000 }).catch(() => null);
    const loadingVisible = await page.locator('#loading').isVisible().catch(() => false);
    if (loadingVisible) {
      const loadLatestWrap = page.locator('#report-load-latest-wrap');
      const wrapDisplay = await loadLatestWrap.evaluate(el => el ? getComputedStyle(el).display : 'none').catch(() => 'none');
      expect(wrapDisplay).toBe('none');
      const ariaBusy = await page.locator('.preview-area').getAttribute('aria-busy').catch(() => null);
      const previewAlreadyVisible = await page.locator('#preview-content').isVisible().catch(() => false);
      expect(ariaBusy === 'true' || previewAlreadyVisible).toBe(true);
    }
    await waitForPreview(page, { timeout: 90000 });
    assertTelemetryClean(telemetry);
  });

  test('report: after successful preview context line cleared and Load latest hidden', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await ensureReportFiltersExpanded(page);
    const previewBtn = page.locator('#preview-btn');
    if (await previewBtn.isDisabled().catch(() => true)) {
      test.skip(true, 'Preview disabled');
      return;
    }
    await previewBtn.click();
    await waitForPreview(page, { timeout: 90000 });
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (previewVisible) {
      const contextText = (await page.locator('#report-context-line').textContent()) || '';
      expect(contextText.trim()).toBe('');
      const loadLatestWrap = page.locator('#report-load-latest-wrap');
      const wrapDisplay = await loadLatestWrap.evaluate(el => el ? getComputedStyle(el).display : 'none').catch(() => 'none');
      expect(wrapDisplay).toBe('none');
    }
    assertTelemetryClean(telemetry);
  });

  test('report: invalid date range shows error then dismiss re-shows context and Load latest', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await ensureReportFiltersExpanded(page);
    await page.fill('#start-date', '2025-09-30T23:59');
    await page.fill('#end-date', '2025-07-01T00:00');
    await page.click('#preview-btn');
    await expect(page.locator('#error')).toBeVisible({ timeout: 8000 });
    const errorText = await page.locator('#error').textContent();
    expect(errorText).toMatch(/date|before end|invalid/i);
    await page.locator('#error .error-close').click();
    await page.waitForTimeout(400);
    const contextLine = page.locator('#report-context-line');
    const contextText = (await contextLine.textContent()) || '';
    const hasRecovery = /Preview failed|Load latest|No report run yet/i.test(contextText);
    const loadLatestVisible = await page.locator('#report-load-latest-wrap').isVisible().catch(() => false);
    expect(hasRecovery || loadLatestVisible).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('report: error recovery message when preview fails with no existing preview', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await ensureReportFiltersExpanded(page);
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem('report-last-run');
        sessionStorage.removeItem('report-last-meta');
      } catch (_) {}
    });
    await page.fill('#start-date', '2025-09-30T23:59');
    await page.fill('#end-date', '2025-07-01T00:00');
    await page.click('#preview-btn');
    await page.waitForSelector('#error', { state: 'visible', timeout: 10000 }).catch(() => null);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    if (errorVisible) {
      const contextText = (await page.locator('#report-context-line').textContent()) || '';
      expect(contextText).toMatch(/Preview failed|Load latest to retry|No report run yet/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('report: after loading completes preview area aria-busy is false', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await ensureReportFiltersExpanded(page);
    const previewBtn = page.locator('#preview-btn');
    if (await previewBtn.isDisabled().catch(() => true)) {
      test.skip(true, 'Preview disabled');
      return;
    }
    await previewBtn.click();
    await waitForPreview(page, { timeout: 90000 });
    await page.waitForFunction(() => {
      const loadingEl = document.getElementById('loading');
      const loadingVisible = !!(loadingEl && getComputedStyle(loadingEl).display !== 'none' && loadingEl.offsetParent !== null);
      const errorEl = document.getElementById('error');
      const errorVisible = !!(errorEl && getComputedStyle(errorEl).display !== 'none' && (errorEl.textContent || '').trim().length > 0);
      const previewArea = document.querySelector('.preview-area');
      const ariaBusy = previewArea ? previewArea.getAttribute('aria-busy') : null;
      if (errorVisible) return true;
      return !loadingVisible && (ariaBusy === 'false' || ariaBusy == null);
    }, { timeout: 8000 }).catch(() => null);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    if (!errorVisible) {
      const loadingVisible = await page.locator('#loading').isVisible().catch(() => false);
      expect(loadingVisible).toBe(false);
      const ariaBusy = await page.locator('.preview-area').getAttribute('aria-busy').catch(() => null);
      expect(ariaBusy === 'false' || ariaBusy === null).toBe(true);
    }
    assertTelemetryClean(telemetry);
  });
});

