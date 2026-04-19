import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  getViewportClippingReport,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

async function validateLiveStage(page, telemetry, stageName, selectors) {
  for (const selector of selectors) {
    await expect(page.locator(selector).first(), `${stageName}: missing ${selector}`).toBeVisible();
  }

  const clipping = await getViewportClippingReport(page, {
    selectors: ['.container', 'header', '.main-layout', '.preview-area'],
    maxLeftGapPx: 16,
    maxRightOverflowPx: 1,
    checkScrollSelectors: ['body', '.container', '.preview-area'],
  });

  expect(
    clipping.offenders,
    `${stageName}: clipped containers found ${JSON.stringify(clipping.offenders)}`
  ).toEqual([]);
  expect(
    clipping.horizontalOverflow,
    `${stageName}: horizontal overflow found ${JSON.stringify(clipping.horizontalOverflow)}`
  ).toEqual([]);
  assertTelemetryClean(telemetry);
}

test.describe('Project Jira Reporting UX Responsiveness Customer Simplicity Trust Logcat Realtime Validation Tests', () => {
  test('report journey validates realtime UI geometry and browser logcat-equivalent signals', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await test.step('Stage 01: open report and validate shell', async () => {
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await validateLiveStage(page, telemetry, 'stage-01', ['header', '.container', '.main-layout']);
    });

    await test.step('Stage 02: open filters when collapsed and validate controls', async () => {
      const showFiltersBtn = page.locator('#filters-panel-collapsed-bar [data-action="toggle-filters"]');
      if (await showFiltersBtn.isVisible().catch(() => false)) {
        await showFiltersBtn.click({ force: true });
      }

      await validateLiveStage(page, telemetry, 'stage-02', [
        '#filters-panel',
      ]);
    });

    await test.step('Stage 03: attempt preview and validate stable post-action state', async () => {
      const previewBtn = page.locator('#preview-btn');
      if (!(await previewBtn.isVisible().catch(() => false))) {
        const showFiltersBtn = page.locator('#filters-panel-collapsed-bar [data-action="toggle-filters"]');
        if (await showFiltersBtn.isVisible().catch(() => false)) {
          await showFiltersBtn.click();
        }
      }
      const canClick = !(await previewBtn.isDisabled().catch(() => true));
      if (canClick) {
        await previewBtn.click().catch(() => null);
      }

      await Promise.race([
        page.waitForSelector('#loading', { state: 'visible', timeout: 8000 }).catch(() => null),
        page.waitForSelector('#preview-content', { state: 'visible', timeout: 8000 }).catch(() => null),
        page.waitForSelector('#error', { state: 'visible', timeout: 8000 }).catch(() => null),
      ]);

      await validateLiveStage(page, telemetry, 'stage-03', ['header', '.preview-area']);
    });
  });

  test('current sprint and leadership pages keep viewport fit on mobile and desktop', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    const pages = ['/current-sprint', '/sprint-leadership'];
    const viewports = [
      { width: 375, height: 667 },
      { width: 1024, height: 768 },
      { width: 1366, height: 900 },
    ];

    for (const route of pages) {
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(route);
        if (await skipIfRedirectedToLogin(page, test, { currentSprint: route.includes('current-sprint') })) return;

        const routeSelectors = route.includes('current-sprint')
          ? ['.container', 'header', 'main', '#current-sprint-content', '.current-sprint-grid-layout', '.sprint-cards-row.risks-row', '#stuck-card']
          : ['.container', 'header', '.main-layout', '.preview-area'];
        const scrollSelectors = route.includes('current-sprint')
          ? ['body', '.container', '#current-sprint-content', '.current-sprint-grid-layout', '.sprint-cards-row.risks-row', '#stuck-card']
          : ['body', '.container', '.preview-area'];
        const maxLeftGapPx = route.includes('sprint-leadership') && viewport.width >= 1200
          ? 700
          : (viewport.width >= 1200 ? 280 : 40);
        const clipping = await getViewportClippingReport(page, {
          selectors: routeSelectors,
          maxLeftGapPx,
          maxRightOverflowPx: 1,
          checkScrollSelectors: scrollSelectors,
        });

        expect(
          clipping.offenders,
          `${route} @ ${viewport.width}x${viewport.height}: ${JSON.stringify(clipping.offenders)}`
        ).toEqual([]);
        expect(
          clipping.horizontalOverflow,
          `${route} @ ${viewport.width}x${viewport.height} horizontal overflow: ${JSON.stringify(clipping.horizontalOverflow)}`
        ).toEqual([]);

        const rightBoundOkay = await page.evaluate(() => {
          const container = document.querySelector('.container');
          if (!container) return true;
          const rect = container.getBoundingClientRect();
          return rect.right <= document.documentElement.clientWidth + 1;
        });
        expect(rightBoundOkay).toBe(true);
      }
    }

    assertTelemetryClean(telemetry);
  });
});
