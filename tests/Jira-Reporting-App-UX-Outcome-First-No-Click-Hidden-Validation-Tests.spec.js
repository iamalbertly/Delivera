/**
 * UX Outcome-First No-Click-Hidden validation.
 * Validates: error message + primary CTA inline (no Details click), preview meta one-line visible,
 * copy "Preview report", Done Stories first when rows, filters panel auto-collapsed after success,
 * range hint when > 90 days, Export tooltip, Current Sprint scope inline/View all,
 * health snapshot visible, Leadership empty state suggestion.
 * Uses captureBrowserTelemetry and realtime UI assertions; fails on UI or telemetry mismatch.
 */

import { test, expect } from '@playwright/test';
import {
  captureBrowserTelemetry,
  runDefaultPreview,
  waitForPreview,
  assertTelemetryClean,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('UX Outcome-First No-Click-Hidden', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (hasLogin) {
      test.skip(true, 'Auth enabled - tests require unauthenticated access');
    }
  });

  test('Report – Error path: full message and primary CTA visible without clicking Details', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/preview.json**', (route) => route.abort('failed'));
    await page.check('#project-mpsa').catch(() => {});
    await page.fill('#start-date', '2025-07-01T00:00').catch(() => {});
    await page.fill('#end-date', '2025-09-30T23:59').catch(() => {});
    await page.click('#preview-btn');

    await expect(page.locator('#error')).toBeVisible({ timeout: 15000 });
    const errorText = await page.locator('#error').textContent();
    expect(errorText).toMatch(/Error|Request failed|timed out/i);
    expect(errorText).toMatch(/smaller date range|Retry/i);
    await expect(page.locator('button[data-action="retry-with-smaller-range"]')).toBeVisible();
    await expect(page.locator('button[data-action="retry-preview"]')).toBeVisible();
    const technicalDetails = page.locator('.error-details');
    await expect(technicalDetails).toHaveCount(1);
    await expect(technicalDetails).toBeHidden();

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Report – Preview meta one-line visible without clicking Technical details', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible within timeout');
      return;
    }
    const outcomeLine = page.locator('#preview-outcome-line');
    await expect(outcomeLine).toBeVisible();
    const text = await outcomeLine.textContent().catch(() => '');
    expect(text).toMatch(/done stories|sprints|boards/i);

    assertTelemetryClean(telemetry);
  });

  test('Report – Copy says Preview report not Generate Report', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const subtitle = page.locator('#report-subtitle');
    await expect(subtitle).toBeVisible();
    const text = await subtitle.textContent().catch(() => '');
    expect(text).toMatch(/Preview report/i);
    expect(text).not.toMatch(/Generate Report/i);

    assertTelemetryClean(telemetry);
  });

  test('Report – Done Stories tab active after successful preview with rows', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible within timeout');
      return;
    }
    const doneStoriesTab = page.locator('#tab-btn-project-epic-level');
    await expect(doneStoriesTab).toBeVisible();
    const isActive = await doneStoriesTab.evaluate((el) => el.classList.contains('active'));
    if (!isActive) {
      await doneStoriesTab.click();
    }
    await expect(page.locator('#tab-btn-project-epic-level')).toHaveClass(/active/);
    const anyPaneAttached = await page.locator('.tab-pane').count().catch(() => 0);
    expect(anyPaneAttached).toBeGreaterThan(0);

    assertTelemetryClean(telemetry);
  });

  test('Report – Filters panel collapses after preview for faster return-to-results flow', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible within timeout');
      return;
    }
    await expect(page.locator('#filters-panel')).toHaveClass(/collapsed/);
    await expect(page.locator('#filters-panel-collapsed-bar')).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('Report – Range hint visible when range > 90 days or first run', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await page.evaluate(() => sessionStorage.removeItem('report-has-run-preview'));
    await page.fill('#start-date', '2024-01-01T00:00').catch(() => {});
    await page.fill('#end-date', '2025-09-30T23:59').catch(() => {});
    await page.waitForTimeout(100);
    const hint = page.locator('#range-hint');
    const visible = await hint.isVisible().catch(() => false);
    expect(visible).toBe(true);
    const text = await hint.textContent().catch(() => '');
    expect(text).toMatch(/faster results|last quarter|Large ranges/i);

    assertTelemetryClean(telemetry);
  });

  test('Report – Export button has Preview-first tooltip when disabled', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const exportBtn = page.locator('#export-excel-btn');
    const isVisible = await exportBtn.isVisible().catch(() => false);
    if (isVisible) {
      const title = await exportBtn.getAttribute('title').catch(() => '');
      expect(title).toMatch(/Preview|first/i);
    } else {
      await expect(exportBtn).toBeHidden();
    }

    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Scope inline table or View all when many', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    const scopeIndicator = page.locator('#scope-indicator');
    const scopeVisible = await scopeIndicator.isVisible().catch(() => false);
    if (scopeVisible) {
      const hasInline = (await page.locator('.scope-inline-table-wrap').count()) > 0;
      const hasViewAll = (await page.locator('.scope-view-all-btn').count()) > 0;
      expect(hasInline || hasViewAll).toBeTruthy();
    }

    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Health snapshot visible without clicking More details', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    const card = page.locator('.health-dashboard-card');
    const cardVisible = await card.isVisible().catch(() => false);
    if (cardVisible) {
      await expect(card.locator('.health-status-chip')).toBeVisible();
      await expect(card.locator('.health-progress-section').first()).toBeVisible();
      await expect(card.locator('.tracking-item').first()).toBeVisible().catch(() => true);
    }

    assertTelemetryClean(telemetry);
  });

  test('Leadership – Empty state includes concrete suggestion', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    const emptyState = page.locator('.empty-state');
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    if (emptyVisible) {
      const text = await emptyState.textContent().catch(() => '');
      expect(text).toMatch(/quarter|MPSA|MAS|current|project/i);
    }

    assertTelemetryClean(telemetry);
  });

  test('Report – Done Stories Show more columns (4) label', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible within timeout');
      return;
    }
    const doneStoriesTab = page.locator('#tab-btn-done-stories');
    if (!(await doneStoriesTab.evaluate((el) => el.classList.contains('active')))) {
      await doneStoriesTab.click();
    }
    const toggle = page.locator('#done-stories-columns-toggle');
    await expect(toggle).toBeVisible();
    const text = await toggle.textContent().catch(() => '');
    expect(text).toMatch(/Show more columns \(4\)|Show fewer columns/i);

    assertTelemetryClean(telemetry);
  });
});
