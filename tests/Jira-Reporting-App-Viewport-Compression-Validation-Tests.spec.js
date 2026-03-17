import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  runDefaultPreview,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Viewport compression and layering', () => {
  test.describe.configure({ retries: 0 });

  test('report desktop first paint keeps chrome compressed after preview', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview unavailable for current dataset');
      return;
    }

    await expect(page.locator('.tab-hint')).toBeHidden();
    await expect(page.locator('#report-filter-strip')).toBeVisible();
    await expect(page.locator('#report-filter-strip .context-summary-strip')).toBeVisible();
    await expect(page.locator('.preview-context-bar')).toBeVisible();

    const bodyText = await page.locator('body').textContent().catch(() => '');
    expect(bodyText).not.toMatch(/\bcache\./i);

    await expect(page.locator('#report-header-preview-btn')).toBeVisible();
    await expect(page.locator('#report-header-actions .report-outcome-intake-create-btn').first()).toBeVisible();
    await expect(page.locator('#report-header-export-btn')).toBeVisible();
    await expect(page.locator('.report-header-more-menu > summary')).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('report preview context stays single-line and avoids duplicate shortcut pills', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview unavailable for current dataset');
      return;
    }

    await expect(page.locator('.preview-context-chip-outcomes-shortcut')).toHaveCount(0);
    const chipCount = await page.locator('.preview-context-bar .preview-context-chip').count();
    expect(chipCount).toBeLessThanOrEqual(6);

    const wrapState = await page.locator('.preview-context-bar').evaluate((node) => getComputedStyle(node).flexWrap);
    expect(wrapState).toBe('nowrap');

    assertTelemetryClean(telemetry);
  });

  test('leadership trends reuses the shared leadership shell without duplicate trust chrome', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview unavailable for current dataset');
      return;
    }

    await page.click('#tab-btn-trends');
    await expect(page.locator('#leadership-content')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-shell-top')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-mission-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-kpi-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-context-line')).toHaveCount(0);
    const trustCard = page.locator('#leadership-content .leadership-trust-card').first();
    if (await trustCard.count()) {
      await expect(trustCard).toBeHidden();
    }

    assertTelemetryClean(telemetry);
  });

  test('current sprint top area compresses actions and collapses sprint switching', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    const bodyText = await page.locator('body').textContent().catch(() => '');
    if (/Couldn't load boards|No active or recent closed sprint|No sprint/i.test(bodyText)) {
      test.skip(true, 'Current sprint unavailable for current dataset');
      return;
    }

    await page.waitForSelector('.current-sprint-header-bar, .sprint-jump-rail', { timeout: 45000 }).catch(() => null);
    await expect(page.locator('.header-intelligence-strip')).toHaveCount(0);
    await expect(page.locator('.sprint-hud-carousel-inline')).toHaveCount(0);
    await expect(page.locator('.mobile-secondary-details')).toHaveCount(0);
    const interventionCount = await page.locator('.current-sprint-header-bar .sprint-intervention-item').count();
    expect(interventionCount).toBeLessThanOrEqual(3);
    const contextChipCount = await page.locator('.current-sprint-header-bar .context-summary-chip').count();
    expect(contextChipCount).toBeGreaterThanOrEqual(3);
    await expect(page.locator('.current-sprint-grid-layout > .sprint-jump-rail')).toHaveCount(0);

    const headerText = await page.locator('.current-sprint-header-bar').textContent().catch(() => '');
    const visibleActionLabels = await page.locator('.header-band-actions button, .header-band-actions summary').evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== 'none'
            && style.visibility !== 'hidden'
            && rect.width > 0
            && rect.height > 0
            && node.offsetParent !== null;
        })
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean)
    );
    expect(headerText || '').toMatch(/Focus risk work|View historical risks/i);
    expect(headerText || '').toMatch(/Refresh/i);
    expect(visibleActionLabels.join(' | ')).toMatch(/Copy summary/i);
    const visibleDrawerText = await page.locator('.current-sprint-header-bar .header-view-drawer-panel').evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const style = window.getComputedStyle(node);
          return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().height > 0;
        })
        .map((node) => (node.textContent || '').trim())
        .join(' | ')
    );
    expect(visibleDrawerText).not.toMatch(/Why this verdict/i);

    assertTelemetryClean(telemetry);
  });

  test('current sprint scope keeps jump box merged into the same compact control row', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('#current-sprint-projects', { state: 'visible', timeout: 15000 }).catch(() => null);
    const compactRow = page.locator('.current-sprint-scope-row--compact');
    await expect(compactRow).toBeVisible();
    await expect(compactRow.locator('#issue-jump-input')).toBeVisible();
    await expect(page.locator('.current-sprint-scope-stack .current-sprint-jump-inline')).toHaveCount(1);

    assertTelemetryClean(telemetry);
  });

  test('report keeps tabs and unified search in one compact shell', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview unavailable for current dataset');
      return;
    }

    await expect(page.locator('.report-tabs-shell')).toBeVisible();
    await expect(page.locator('.report-tabs-shell .tabs')).toBeVisible();
    await expect(page.locator('.report-tabs-shell .report-unified-tab-search')).toBeVisible();
    await expect(page.locator('#report-context-line')).toBeHidden();

    assertTelemetryClean(telemetry);
  });
});
