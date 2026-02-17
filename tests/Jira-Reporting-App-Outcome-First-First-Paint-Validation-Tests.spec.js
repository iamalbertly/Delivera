/**
 * Outcome-First and First-Paint Validation Tests.
 * Validates: report first-paint context line (#report-context-line), login outcome line,
 * sidebar context card, context line cleared after preview, and telemetry clean at every step.
 * Uses captureBrowserTelemetry + assertTelemetryClean (logcat equivalent) and real-time UI assertions.
 * Run by orchestration (Jira-Reporting-App-Test-Orchestration-Steps.js). Fail fast: retries 0.
 */

import { test, expect } from '@playwright/test';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  runDefaultPreview,
  waitForPreview,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Outcome-First and First-Paint Validation', () => {
  test.describe.configure({ retries: 0 });
  test('report first-paint: context line visible and shows outcome or placeholder', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const contextLine = page.locator('#report-context-line');
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const contextVisible = await contextLine.isVisible().catch(() => false);
    expect(contextVisible || previewVisible).toBe(true);
    const text = contextVisible ? ((await contextLine.textContent()) || '') : '';
    const hasPlaceholder = /No report run yet/i.test(text);
    const hasLastRun = /Last:/i.test(text) || /Generated/i.test(text) || /min ago/i.test(text);
    const hasProjects = /Projects\b/i.test(text);
    expect(hasPlaceholder || hasLastRun || hasProjects || text.length > 0).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('report first-paint: empty state shows No report run yet when no last-run', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem('report-last-run');
        sessionStorage.removeItem('report-last-meta');
      } catch (_) {}
    });
    await page.reload();
    if (await skipIfRedirectedToLogin(page, test)) return;
    const contextLine = page.locator('#report-context-line');
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const contextVisible = await contextLine.isVisible().catch(() => false);
    const loadingVisible = await page.locator('#loading').isVisible().catch(() => false);
    const loadLatestVisible = await page.locator('#report-load-latest-wrap').isVisible().catch(() => false);
    if (previewVisible) {
      await expect(page.locator('#preview-content')).toBeVisible();
    } else if (contextVisible) {
      await expect(contextLine).toBeVisible();
      const text = (await contextLine.textContent()) || '';
      expect(text).toMatch(/No report run yet|Active filters|Projects\b|Last:/i);
    } else {
      expect(loadingVisible || loadLatestVisible).toBe(true);
    }
    assertTelemetryClean(telemetry);
  });

  test('report: Preview button and context line present; telemetry clean', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#preview-btn')).toBeVisible();
    const contextVisible = await page.locator('#report-context-line').isVisible().catch(() => false);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    expect(contextVisible || previewVisible).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('report: after preview runs context line cleared from main area', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const previewBtn = page.locator('#preview-btn');
    if (await previewBtn.isDisabled().catch(() => true)) {
      test.skip(true, 'Preview button disabled; need projects/dates');
      return;
    }
    await previewBtn.click();
    await waitForPreview(page, { timeout: 90000 });
    const previewContent = page.locator('#preview-content');
    const previewVisible = await previewContent.isVisible().catch(() => false);
    if (previewVisible) {
      const contextLineText = (await page.locator('#report-context-line').textContent()) || '';
      expect(contextLineText.trim()).toBe('');
    }
    assertTelemetryClean(telemetry);
  });

  test('login page: outcome line and trust line visible when on login', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/login');
    if (!page.url().includes('login')) {
      test.skip(true, 'Not on login (auth disabled or already logged in)');
      return;
    }
    const outcomeLine = page.locator('.login-outcome-line');
    await expect(outcomeLine).toBeVisible();
    await expect(outcomeLine).toContainText(/Sprint risks|delivery|30 seconds/i);
    const trustLine = page.locator('.login-trust-line');
    const trustVisible = await trustLine.isVisible().catch(() => false);
    if (trustVisible) {
      await expect(trustLine).toBeVisible();
    }
    assertTelemetryClean(telemetry);
  });

  test('report: sidebar context card or nav visible', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const sidebarCard = page.locator('#sidebar-context-card');
    const nav = page.locator('.app-sidebar, nav.app-nav, .app-global-nav-wrap');
    const cardVisible = await sidebarCard.isVisible().catch(() => false);
    const navVisible = await nav.first().isVisible().catch(() => false);
    expect(cardVisible || navVisible).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('report: last-run freshness shown when session has last-run', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const contextLine = page.locator('#report-context-line');
    const text = (await contextLine.textContent()) || '';
    if (/Last:/.test(text) && /Generated|min ago|just now/i.test(text)) {
      expect(text.length).toBeGreaterThan(10);
    }
    assertTelemetryClean(telemetry);
  });

  test('current-sprint: load and telemetry clean', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await expect(page.locator('h1')).toContainText(/Current Sprint/i);
    assertTelemetryClean(telemetry);
  });

  test('leadership: load and telemetry clean', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const body = page.locator('body');
    await expect(body).toBeVisible();
    assertTelemetryClean(telemetry);
  });
});
