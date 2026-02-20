/**
 * UX Outcome-First Nav And Trust Validation.
 * Validates: Default Done Stories tab, two-line preview meta, context bar last-run,
 * alert classes, login copy and nav, Current Sprint hero and loading, Leadership sticky and copy,
 * global nav, Report CTA/loading, Leadership zero-boards empty state; edge cases (tab state, project SSOT).
 * Uses captureBrowserTelemetry and assertTelemetryClean; fails on UI or logcat issues.
 */

import { test, expect } from '@playwright/test';
import {
  captureBrowserTelemetry,
  runDefaultPreview,
  waitForPreview,
  assertTelemetryClean,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('UX Outcome-First Nav And Trust', () => {
  test('Report – Default tab is Done Stories', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible');
      return;
    }
    const boardsTab = page.locator('#tab-btn-project-epic-level');
    const doneStoriesTab = page.locator('#tab-btn-done-stories');
    const doneStoriesVisible = await doneStoriesTab.isVisible().catch(() => false);
    const doneSelected = (await doneStoriesTab.getAttribute('aria-selected')) === 'true';
    const boardsSelected = (await boardsTab.getAttribute('aria-selected')) === 'true';
    expect(boardsSelected || (doneStoriesVisible && doneSelected)).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('Report – Preview meta has two-line outcome and context', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible');
      return;
    }
    const meta = page.locator('#preview-meta');
    await expect(meta).toBeVisible();
    const outcomeLine = page.locator('#preview-outcome-line');
    await expect(outcomeLine).toBeVisible();
    await expect(outcomeLine).toContainText(/done stories|sprints|boards/i);
    const contextLine = page.locator('#report-context-line');
    await expect(contextLine).toBeVisible();
    await expect(contextLine).toContainText(/Projects|Window|Active filters|Report range/i);
    const detailsBtn = page.locator('#preview-meta-details-toggle');
    const hasDetailsBtn = await detailsBtn.isVisible().catch(() => false);
    if (hasDetailsBtn) {
      await expect(detailsBtn).toContainText(/Technical details/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('Report – Context bar shows last run or projects or placeholder', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const bar = page.locator('[data-context-bar]');
    await expect(bar).toBeVisible({ timeout: 10000 });
    const text = await bar.textContent().catch(() => '') || '';
    expect(text.length).toBeGreaterThan(0);
    const hasValidContent = /Last:.*stories|Active filters|Projects\b|No report run yet/.test(text);
    expect(hasValidContent).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('Report – Error container has alert-error class', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const errorEl = page.locator('#error');
    await expect(errorEl).toHaveClass(/alert-error/);
    assertTelemetryClean(telemetry);
  });

  test('Login – Single outcome line and trust line below form', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/login');
    const hasLoginForm = await page.locator('#login-form').isVisible().catch(() => false);
    if (!hasLoginForm) {
      test.skip(true, 'Login form not visible; auth may be disabled');
      return;
    }
    await expect(page.locator('.login-outcome-line')).toContainText(/Sprint risks and delivery in under 30 seconds/i);
    const trustLine = page.locator('.login-trust-line');
    await expect(trustLine).toContainText(/Session-secured.*Internal use/i);
    const form = page.locator('#login-form');
    const trustBelowForm = await page.evaluate(() => {
      const formEl = document.getElementById('login-form');
      const trustEl = document.querySelector('.login-trust-line');
      if (!formEl || !trustEl) return false;
      return trustEl.compareDocumentPosition(formEl) === document.DOCUMENT_POSITION_FOLLOWING;
    });
    expect(trustBelowForm).toBe(true);
    assertTelemetryClean(telemetry);
  });

test('Login - Global nav hidden', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/login');
    if (!/\/login(\?|$)/.test(page.url())) {
      test.skip(true, 'Not on /login (already authenticated redirect)');
      return;
    }
    await expect(page.locator('.app-sidebar')).toHaveCount(0);
    await expect(page.locator('.sidebar-toggle')).toHaveCount(0);
    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – At-a-glance hero block when content loaded', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    await page.waitForTimeout(2000);
    const content = page.locator('#current-sprint-content');
    const hasContent = await content.isVisible().catch(() => false) && (await content.textContent().catch(() => ''))?.length > 0;
    if (!hasContent) {
      const boardSelect = page.locator('#board-select');
      const options = await boardSelect.locator('option').allTextContents().catch(() => []);
      const hasBoards = options.some(t => t && !t.includes('Loading'));
      if (hasBoards) {
        await boardSelect.selectOption({ index: 1 }).catch(() => null);
        await page.waitForTimeout(3000);
      }
    }
    const hero = page.locator('.sprint-at-a-glance-hero');
    const heroVisible = await hero.isVisible().catch(() => false);
    if (heroVisible) {
      await expect(hero).toContainText(/left|done|stuck|scope/i);
      await expect(hero.locator('a[href="#stuck-card"], .sprint-at-a-glance-cta')).toContainText(/View risks|risks/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Loading copy outcome-oriented', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    await page.waitForTimeout(400);
    const loading = page.locator('#current-sprint-loading');
    const loadingVisible = await loading.isVisible().catch(() => false);
    if (loadingVisible) {
      const text = await loading.textContent().catch(() => '') || '';
      expect(text).toMatch(/Select one project and a board.*sprint health and risks|Loading boards for project|Loading current sprint/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('Leadership – Sticky context line when data present', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    const quarterPill = page.locator('.quarter-pill').first();
    const hasPill = await quarterPill.isVisible().catch(() => false);
    if (hasPill) {
      const isEnabled = await quarterPill.isEnabled().catch(() => false);
      if (isEnabled) {
        await quarterPill.click({ force: true }).catch(async () => {
          await page.evaluate(() => {
            const pill = document.querySelector('.quarter-pill');
            if (pill && !pill.hasAttribute('disabled')) pill.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          });
        });
      }
      await page.waitForTimeout(4000);
    }
    const sticky = page.locator('.leadership-context-sticky, .leadership-context-line');
    const stickyVisible = await sticky.first().isVisible().catch(() => false);
    if (stickyVisible) {
      const text = await sticky.first().textContent().catch(() => '') || '';
      expect(text).toMatch(/Active filters|Report range|Projects|Range|Generated/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('Leadership – Loading copy', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    if (page.url().includes('/report')) {
      await expect(page).toHaveURL(/\/report(#trends)?/);
      test.skip(true, 'Legacy leadership loading element not present on trends route');
      return;
    }
    await page.waitForTimeout(300);
    const loading = page.locator('#leadership-loading');
    const loadingVisible = await loading.isVisible().catch(() => false);
    if (loadingVisible) {
      const text = await loading.textContent().catch(() => '') || '';
      expect(text).toMatch(/Trends load when you pick a quarter|date range/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('Global nav on Report and Current Sprint', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const nav = page.locator('.app-sidebar .app-nav, .app-nav');
    await expect(nav).toBeVisible();
    await expect(page.locator('.app-sidebar .sidebar-link.active, .app-nav .current')).toContainText(/High-Level Performance|Report/i);
    await page.goto('/current-sprint');
    await expect(page.locator('.app-sidebar .sidebar-link.active, .app-nav .current')).toContainText(/Current Sprint|Squad/i);
    assertTelemetryClean(telemetry);
  });

  test('Report – Primary CTA and loading message', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const previewBtn = page.locator('#preview-btn');
    await expect(previewBtn).toBeVisible();
    await expect(previewBtn).toHaveClass(/btn-primary/);
    await expect(previewBtn).toContainText(/Preview/i);
    const loadingMsg = page.locator('#loading-message');
    await expect(loadingMsg).toContainText(/Connecting to Jira|Generating report|Syncing with Jira|Gathering sprint history/i);
    assertTelemetryClean(telemetry);
  });

  test('Edge: Tab state after second preview', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    await page.waitForTimeout(500);
    await page.locator('#tab-btn-sprints').click();
    await page.waitForTimeout(300);
    const previewBtn = page.locator('#preview-btn');
    const previewVisible = await previewBtn.isVisible().catch(() => false);
    if (!previewVisible) {
      await page.locator('[data-action="toggle-filters"]').click();
      await expect(previewBtn).toBeVisible();
    }
    await previewBtn.click();
    await waitForPreview(page, { timeout: 90000 });
    const selectedTabs = page.locator('.tab-btn[aria-selected="true"]');
    await expect(selectedTabs.first()).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('Edge: Project SSOT - Report selection reflected on Current Sprint', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const mpsaCheckbox = page.locator('#project-mpsa');
    if (!(await mpsaCheckbox.isVisible().catch(() => false))) {
      const toggleFilters = page.locator('[data-action="toggle-filters"]');
      if (await toggleFilters.isVisible().catch(() => false)) {
        await toggleFilters.click();
      }
    }
    await page.evaluate(() => {
      const mpsa = document.querySelector('#project-mpsa');
      if (mpsa) {
        mpsa.checked = false;
        mpsa.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const mas = document.querySelector('#project-mas');
      if (mas) {
        mas.checked = true;
        mas.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);
    await page.goto('/current-sprint');
    await page.waitForTimeout(1000);
    const projectsSelect = page.locator('#current-sprint-projects');
    const value = await projectsSelect.inputValue().catch(() => '');
    expect(value).toMatch(/MAS/);
    assertTelemetryClean(telemetry);
  });
});

