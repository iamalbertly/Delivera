import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  routeDeterministicCurrentSprint,
  runDefaultPreview,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

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
    await expect(page.locator('body')).toHaveClass(/preview-active/);
    await expect(page.locator('#preview-content .preview-context-bar[role="group"]').first()).toBeVisible();
    const filterStripContext = page.locator('#report-filter-strip-summary .context-summary-strip');
    if (await filterStripContext.count()) {
      await expect(filterStripContext.first()).toBeVisible();
    }

    const bodyText = await page.locator('body').textContent().catch(() => '');
    expect(bodyText).not.toMatch(/\bcache\./i);

    await expect(page.locator('#report-header-preview-btn')).toBeVisible();
    await expect(page.locator('#app-top-chrome [data-top-action="create-work"]')).toBeVisible();
    await expect(page.locator('#report-header-actions .report-outcome-intake-create-btn').first()).toBeHidden();
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
    const chipCount = await page.locator('#preview-content .preview-context-bar[role="group"] .preview-context-chip').count();
    expect(chipCount).toBeLessThanOrEqual(6);

    const wrapState = await page.locator('#preview-content .preview-context-bar[role="group"]').first().evaluate((node) => getComputedStyle(node).flexWrap);
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
    const kpiStrip = page.locator('#leadership-content .leadership-kpi-strip');
    if (await kpiStrip.count() === 0) {
      test.skip(true, 'Leadership KPI strip omitted when no project KPIs in dataset');
      return;
    }
    await expect(kpiStrip).toBeVisible();
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
    await routeDeterministicCurrentSprint(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/current-sprint?projects=SD&boardId=1');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    const bodyText = await page.locator('body').textContent().catch(() => '');
    if (/Couldn't load boards|No active or recent closed sprint|No sprint/i.test(bodyText)) {
      test.skip(true, 'Current sprint unavailable for current dataset');
      return;
    }

    const cockpitReady = await page.locator('.decision-cockpit-shell').first()
      .waitFor({ state: 'visible', timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    if (!cockpitReady) {
      test.skip(true, 'Decision cockpit not visible for current sprint dataset');
      return;
    }
    await expect(page.locator('.current-sprint-header-bar').first()).toBeVisible();
    await expect(page.locator('#stories-card')).toBeVisible();
    const sprintChrome = page.locator('.current-sprint-advanced-controls, .sprint-switcher-card-inline').first();
    await expect(sprintChrome).toBeVisible();
    await expect(page.locator('.sprint-switcher-card-inline')).not.toHaveAttribute('open', /./);
    const advancedControls = page.locator('.current-sprint-advanced-controls');
    if (await advancedControls.count()) {
      await expect(advancedControls).not.toHaveAttribute('open', /./);
    }
    await expect(page.locator('.decision-metrics-row .decision-metric-card')).toHaveCount(4);
    await expect(page.locator('.sprint-hud-carousel-inline')).toHaveCount(0);
    await expect(page.locator('.mobile-secondary-details')).toHaveCount(0);
    const interventionCount = await page.locator('.decision-action-queue li').count();
    expect(interventionCount).toBeLessThanOrEqual(5);
    await expect(page.locator('.current-sprint-grid-layout > .sprint-jump-rail')).toHaveCount(0);

    const foldOrder = await page.evaluate(() => {
      const stories = document.getElementById('stories-card');
      const cockpit = document.querySelector('.decision-cockpit-shell');
      if (!stories || !cockpit) return null;
      return {
        storiesTop: stories.getBoundingClientRect().top,
        cockpitTop: cockpit.getBoundingClientRect().top,
      };
    });
    if (foldOrder) {
      expect(foldOrder.storiesTop).toBeLessThan(foldOrder.cockpitTop);
    }
    const foldBudget = await page.evaluate(() => {
      const cockpitSummary = document.querySelector('.decision-cockpit-details-summary');
      const metrics = document.querySelector('.decision-metrics-row');
      if (!cockpitSummary) return null;
      const top = cockpitSummary.getBoundingClientRect().top;
      const bottom = metrics ? metrics.getBoundingClientRect().bottom : cockpitSummary.getBoundingClientRect().bottom;
      return { answerHeight: Math.round(bottom - top), viewportHeight: window.innerHeight };
    });
    if (foldBudget) {
      expect(foldBudget.answerHeight).toBeLessThanOrEqual(760);
    }
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
    await routeDeterministicCurrentSprint(page);
    await page.goto('/current-sprint?projects=SD&boardId=1');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('#current-sprint-projects', { timeout: 15000 }).catch(() => null);
    await expect(page.locator('.current-sprint-header-bar').first()).toBeVisible();
    const drawerSummary = page.locator('.current-sprint-header-bar .header-view-drawer > summary').first();
    if (await drawerSummary.isVisible().catch(() => false)) {
      await drawerSummary.click();
    }
    await expect(page.locator('.header-drawer-jump-section .sprint-section-links-compact, .current-sprint-scope-stack .current-sprint-jump-inline').first()).toBeAttached();
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

  test('governance first paint keeps agent queue and secondary chrome collapsed', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('#gov-right-rail-mount')).toBeVisible();
    await expect(page.locator('#gov-secondary-chrome')).not.toHaveAttribute('open', /.+/);
    await expect(page.locator('#gov-supporting-evidence')).not.toHaveAttribute('open', /.+/);
    await expect(page.locator('#app-top-chrome')).toBeVisible();
    await expect(page.locator('[data-top-action="agent"]')).toHaveCount(0);

    const answerMount = page.locator('#gov-answer-mount');
    if (await answerMount.locator('.gov-command-answer, .gov-visual-answer-blocks').count()) {
      const box = await answerMount.boundingBox();
      expect(box?.y ?? 9999).toBeLessThan(900);
    }

    assertTelemetryClean(telemetry);
  });
});
