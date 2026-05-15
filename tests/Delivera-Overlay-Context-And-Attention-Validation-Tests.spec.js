import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  waitForPreview,
  selectFirstBoard,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Overlay, context, and attention SSOT', () => {
  test('report uses one context strip, a real overlay drawer, named views, and the shared leadership lens', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('#report-filter-strip .context-summary-strip').first()).toBeVisible();

    const namedViews = page.locator('#report-named-views .named-views-bar');
    await expect(namedViews).toBeVisible();
    await expect(page.locator('#report-filter-strip [data-report-named-view]').first()).toBeVisible();

    const toggleCount = await page.locator('[data-action="toggle-filters"]').count();
    if (toggleCount > 0) {
      await page.evaluate(() => {
        const toggles = Array.from(document.querySelectorAll('[data-action="toggle-filters"]'));
        const visibleToggle = toggles.find((node) => node instanceof HTMLElement && node.offsetParent !== null);
        (visibleToggle || toggles[0])?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }).catch(() => null);
      await expect.poll(async () => {
        const className = await page.locator('#filters-panel').getAttribute('class').catch(() => '');
        return /expanded|is-open/.test(String(className || ''));
      }).toBe(true);
      await expect(page.locator('#filters-panel')).toHaveClass(/expanded|is-open/);
    } else {
      await expect(page.locator('#filters-panel')).toBeVisible();
    }
    const overlaySignals = await page.evaluate(() => {
      const panel = document.getElementById('filters-panel');
      const backdrop = document.querySelector('.app-overlay-backdrop');
      const panelClasses = panel ? Array.from(panel.classList) : [];
      const isDesktop = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1025px)').matches;
      const backdropVisible = backdrop instanceof HTMLElement && !backdrop.hidden && getComputedStyle(backdrop).display !== 'none' && getComputedStyle(backdrop).visibility !== 'hidden';
      const backdropPresent = Boolean(backdrop);
      return {
        isDesktop,
        panelClasses,
        backdropPresent,
        backdropVisible,
      };
    });
    if (overlaySignals.isDesktop) {
      expect(overlaySignals.panelClasses.includes('expanded')).toBe(true);
      expect(overlaySignals.backdropVisible).toBe(false);
    } else {
      expect(
        overlaySignals.backdropVisible
        || (overlaySignals.backdropPresent && overlaySignals.panelClasses.includes('overlay-drawer'))
        || overlaySignals.panelClasses.includes('is-open')
      ).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('#filters-panel')).toHaveClass(/collapsed/);

    await page.locator('#report-filter-strip [data-report-named-view]').first().click().catch(() => null);
    await expect(page.locator('#report-filter-strip [data-report-named-view].is-active').first()).toBeVisible();

    await page.locator('#preview-btn').click().catch(() => null);
    await waitForPreview(page, { timeout: 60000 });
    const hasPreview = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!hasPreview) {
      test.skip(true, 'Preview did not load for current data set');
      return;
    }

    await expect(page.locator('#preview-meta .attention-queue')).toBeVisible();
    await expect(page.locator('#preview-meta .app-context-bar')).toHaveCount(0);
    await expect(page.locator('#report-filter-strip-summary .app-context-bar')).toHaveCount(1);
    await page.click('#tab-btn-trends');
    await expect(page.locator('#leadership-content .leadership-shell-top')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-mission-strip')).toBeVisible();
    const leadershipText = await page.locator('#leadership-content').textContent().catch(() => '');
    expect(leadershipText || '').toMatch(/Boards at risk|Velocity|Portfolio looks readable|need attention/i);
    await expect(page.locator('#leadership-content .leadership-export-menu > summary').first()).toBeVisible();
    await page.locator('#leadership-content .leadership-export-menu > summary').first().click();
    await expect(page.locator('#leadership-content [data-action="export-leadership-manager-briefing"]').first()).toBeVisible();
    await expect(page.locator('#leadership-content [data-action="export-leadership-quarterly-story"]').first()).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('current sprint exposes shared context and compact attention actions without losing work focus', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No board options available');
      return;
    }

    await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error', { timeout: 45000 }).catch(() => null);
    await expect(page.locator('.current-sprint-header-bar')).toBeVisible();
    const missionContext = page.locator('.current-sprint-header-bar .mission-context-ribbon, .current-sprint-header-bar .report-context-strip, .current-sprint-header-bar [data-context-bar="true"]').first();
    if (await missionContext.count()) {
      await expect(missionContext).toBeVisible();
    }
    const secondaryStrip = page.locator('.current-sprint-header-bar .mission-strip-secondary, .current-sprint-header-bar .header-intelligence-strip').first();
    if (await secondaryStrip.count()) {
      const isMiniMode = await page.locator('.current-sprint-header-bar').evaluate((node) =>
        node.classList.contains('header-mini-mode')
      );
      if (isMiniMode) {
        await expect(secondaryStrip).toBeHidden();
      } else {
        await expect(secondaryStrip).toBeVisible();
      }
    }
    const historicalAttention = page.locator('.current-sprint-header-bar .attention-queue--compact');
    if (await historicalAttention.isVisible().catch(() => false)) {
      const firstAttention = page.locator('.current-sprint-header-bar .attention-queue [data-attention-action]').first();
      if (await firstAttention.isVisible().catch(() => false)) {
        await firstAttention.click().catch(() => null);
        await expect(page.locator('#stories-card')).toBeVisible();
      }
    }

    assertTelemetryClean(telemetry);
  });

  test('leadership page exposes one context summary, attention queue, and quarterly story export entry', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/leadership');
    if (page.url().includes('/report#trends')) {
      await page.goto('/leadership.html');
    }
    if (await skipIfRedirectedToLogin(page, test)) return;

    await page.waitForTimeout(3000);
    const content = page.locator('#leadership-content');
    if (!(await content.isVisible().catch(() => false))) {
      test.skip(true, 'Leadership content not available in this environment');
      return;
    }

    await expect(page.locator('.leadership-shell-top .context-summary-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .attention-queue')).toBeVisible();
    await expect(page.locator('.leadership-export-menu > summary').first()).toBeVisible();
    await page.locator('.leadership-export-menu > summary').first().click();
    await expect(page.locator('[data-action="export-leadership-manager-briefing"]').first()).toBeVisible();
    await expect(page.locator('[data-action="export-leadership-quarterly-story"]').first()).toBeVisible();
    await expect(page.locator('[data-action="export-leadership-kpis-csv"]').first()).toBeVisible();

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });
});
