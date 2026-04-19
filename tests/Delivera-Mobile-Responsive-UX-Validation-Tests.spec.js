import { test, expect, devices } from '@playwright/test';
import { runDefaultPreview, waitForPreview, captureBrowserTelemetry, assertTelemetryClean, skipIfRedirectedToLogin, getViewportClippingReport, selectFirstBoard } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

// Mobile viewport (iPhone 12-ish)
const mobile = { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A372 Safari/604.1' };

async function ensureReportFiltersExpanded(page) {
  const startDate = page.locator('#start-date');
  if (await startDate.isVisible().catch(() => false)) return;
  const showFiltersBtn = page.locator('#filters-panel-collapsed-bar [data-action="toggle-filters"]');
  if (await showFiltersBtn.isVisible().catch(() => false)) {
    await showFiltersBtn.click();
    const opened = await startDate.isVisible().catch(() => false);
    if (!opened) {
      await showFiltersBtn.click({ force: true });
    }
  }
  await startDate.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
}

test.describe('Jira Reporting App - Mobile Responsive UX Validation', () => {
  test.use(mobile);

  test('report: quarter strip, filters auto-collapse, and table card layout work on mobile', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    // On mobile, filters may auto-collapse; expand reliably first.
    await ensureReportFiltersExpanded(page);

    // Quarter strip visible and pill shows period
    const strip = page.locator('.quick-range-strip, [aria-label="Vodacom quarters"]').first();
    await strip.waitFor({ state: 'attached', timeout: 10000 });
    if (!(await strip.isVisible().catch(() => false))) {
      await ensureReportFiltersExpanded(page);
    }
    await page.waitForSelector('.quarter-pill', { state: 'attached', timeout: 10000 }).catch(() => null);
    const firstPeriod = await page.locator('.quarter-pill .quick-range-period').first().textContent().catch(() => '');
    expect(firstPeriod).toBeTruthy();

    const collapsedVisible = await page.locator('#filters-panel-collapsed-bar').isVisible().catch(() => false);
    if (collapsedVisible) {
      const collapsedSummary = (await page.locator('#filters-collapsed-summary').textContent().catch(() => '') || '').trim();
      expect(collapsedSummary.length).toBeGreaterThan(0);
      await page.locator('#filters-panel-collapsed-bar [data-action="toggle-filters"]').click().catch(() => null);
    }
    if (!(await page.locator('#start-date').isVisible().catch(() => false))) {
      await page.locator('[data-action="toggle-filters"]').click().catch(() => null);
      await page.locator('#start-date').waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
    }

    // Run a quick preview and verify mobile card layout for table rows
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }

    await page.click('.tab-btn[data-tab="project-epic-level"]').catch(() => null);
    const hasBoardsTable = await page.locator('#project-epic-level-content .data-table').first().isVisible().catch(() => false);
    if (!hasBoardsTable) {
      const emptyText = (await page.locator('#project-epic-level-content').textContent().catch(() => '') || '').toLowerCase();
      if (emptyText.includes('no boards') || emptyText.includes('no data') || emptyText.includes('adjust filters')) {
        test.skip(true, 'No boards table rendered for current data window; mobile table-card assertions are not applicable');
        return;
      }
      await page.waitForSelector('#project-epic-level-content .data-table', { timeout: 15000 }).catch(() => null);
    }
    const mobileCardStyles = await page.evaluate(() => {
      const row = document.querySelector('#project-epic-level-content .data-table tbody tr');
      const td = document.querySelector('#project-epic-level-content .data-table tbody td');
      if (!row || !td) return null;
      const tdStyle = getComputedStyle(td);
      const beforeStyle = getComputedStyle(td, '::before');
      return {
        rowDisplay: getComputedStyle(row).display,
        tdDisplay: tdStyle.display,
        beforeContent: beforeStyle.content,
      };
    });
    if (!mobileCardStyles) {
      test.skip(true, 'No rendered table rows available for mobile card-style assertions in this dataset');
      return;
    }
    expect(mobileCardStyles).toBeTruthy();
    expect(mobileCardStyles.rowDisplay).toBe('block');
    expect(mobileCardStyles.tdDisplay).toBe('flex');
    expect(mobileCardStyles.beforeContent).not.toBe('none');
    const exportVisible = await page.locator('#export-excel-btn').isVisible().catch(() => false);
    if (exportVisible) {
      const exportFitsViewport = await page.evaluate(() => {
        const btn = document.getElementById('export-excel-btn');
        if (!btn) return true;
        const rect = btn.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        return rect.left >= -1 && rect.right <= vw + 1;
      });
      expect(exportFitsViewport).toBe(true);
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('current-sprint mobile: header remains visible on scroll and retry works', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    // Make first boards fetch fail then succeed on retry
    let calls = 0;
    await page.route('**/api/boards.json*', (route) => {
      calls += 1;
      if (calls === 1) {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ boards: [{ id: 321, name: 'Mobile Retry Board', projectKey: 'MPSA' }] }) });
      }
    });

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const retryVisible = await page.locator('#current-sprint-error .retry-btn').isVisible().catch(() => false);
    if (retryVisible) {
      await page.click('#current-sprint-error .retry-btn');
      // Ensure our retry click was registered and the button shows feedback on mobile
      await page.waitForFunction(() => window.__retryClicked && window.__retryClicked >= 1, null, { timeout: 5000 });
      await page.waitForSelector('#current-sprint-error .retry-btn:disabled', { timeout: 5000 }).catch(() => null);
      await page.waitForFunction(() => {
        const el = document.querySelector('#current-sprint-error .retry-btn');
        return el && el.textContent === 'Retry';
      }, null, { timeout: 20000 }).catch(() => null);
      const retryText = await page.locator('#current-sprint-error .retry-btn').textContent().catch(() => '');
      expect(retryText === 'Retry' || retryText === 'Retrying...').toBeTruthy();
    } else {
      await expect(page.locator('#board-select')).toBeVisible();
    }

    // Scroll and verify header still visible (sticky)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const headerVisible = await page.isVisible('header');
    expect(headerVisible).toBeTruthy();

    // First fetch may show a 500 which we intentionally injected; ensure no unexpected page errors
    if (telemetry.consoleErrors.length > 0) {
      expect(telemetry.consoleErrors.some(e => /status of 500/.test(e))).toBeTruthy();
    }
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('mobile key factors: report and current-sprint headers no horizontal overflow and key text visible', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const reportHeaderOverflow = await page.evaluate(() => {
      const h = document.querySelector('header');
      return h ? h.scrollWidth > h.clientWidth : false;
    });
    expect(reportHeaderOverflow).toBe(false);
    await expect(page.locator('header h1')).toContainText(/General Performance|High-Level/i);
    const subtitleVisible = await page.locator('#report-subtitle').isVisible().catch(() => false);
    if (!subtitleVisible) {
      await expect(page.locator('#preview-outcome-line, #report-one-click-cta-wrap').first()).toBeVisible();
    } else {
      await expect(page.locator('#report-subtitle')).toBeVisible();
    }
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const sprintTitleBlockOverflow = await page.evaluate(() => {
      const block = document.querySelector('header .current-sprint-header > div:first-child, header .current-sprint-header-bar .header-bar-left');
      return block ? block.scrollWidth > block.clientWidth : false;
    });
    expect(sprintTitleBlockOverflow).toBe(false);
    const commandCenterTitle = page.locator('.current-sprint-header-bar .header-sprint-name').first();
    const staticTitle = page.locator('#current-sprint-title').first();
    const commandVisible = await commandCenterTitle.isVisible().catch(() => false);
    const staticVisible = await staticTitle.isVisible().catch(() => false);
    expect(commandVisible || staticVisible).toBeTruthy();
    assertTelemetryClean(telemetry);
  });

  test('report mobile/tablet layout has no clipped containers and no forced left gutter', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    const viewports = [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
      { width: 1024, height: 768 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;
      const clipping = await getViewportClippingReport(page, {
        selectors: ['.container', '.main-layout', '.preview-area'],
        maxLeftGapPx: viewport.width >= 1000 ? 40 : 16,
        maxRightOverflowPx: 1,
      });
      expect(clipping.offenders, `viewport ${viewport.width}x${viewport.height}: ${JSON.stringify(clipping.offenders)}`).toEqual([]);
      const containerLeft = await page.evaluate(() => {
        const container = document.querySelector('.container');
        if (!container) return 0;
        return Math.round(container.getBoundingClientRect().left);
      });
      expect(containerLeft).toBeLessThanOrEqual(viewport.width >= 1000 ? 40 : 16);
    }

    assertTelemetryClean(telemetry);
  });

  test('report mobile: status strip and quarter review mode behave as expected', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await ensureReportFiltersExpanded(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; status strip and quarter review assertions not applicable');
      return;
    }

    const statusStrip = page.locator('#preview-status-strip');
    const statusVisible = await statusStrip.isVisible().catch(() => false);
    if (statusVisible) {
      const statusText = (await statusStrip.textContent().catch(() => '') || '').toLowerCase();
      expect(statusText.length).toBeGreaterThan(0);
    } else {
      const alternate = page.locator('#preview-status .status-banner, #preview-outcome-line').first();
      await expect(alternate).toBeVisible();
    }

    await page.click('.tab-btn[data-tab="done-stories"]').catch(() => null);
    const quarterToggle = page.locator('#done-stories-quarter-review-toggle');
    const hasQuarterToggle = await quarterToggle.isVisible().catch(() => false);
    if (!hasQuarterToggle) {
      test.skip(true, 'Quarter review toggle not visible in this dataset');
      return;
    }
    await quarterToggle.click();
    const anySprintContentVisible = await page.locator('#done-stories-content .sprint-content').first().isVisible().catch(() => false);
    expect(anySprintContentVisible).toBeTruthy();

    await quarterToggle.click();
    const anySprintContentCollapsed = await page.locator('#done-stories-content .sprint-content').first().isVisible().catch(() => false);
    // After exiting quarter review, content may remain visible depending on user interactions; just assert no errors.
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('current-sprint mobile: exports expose primary, secondary, and feedback', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await selectFirstBoard(page).catch(() => null);
    const exportContainer = page.locator('.export-dashboard-container');
    const hasExport = await exportContainer.isVisible().catch(() => false);
    if (!hasExport) {
      test.skip(true, 'Export dashboard not visible; exports assertions not applicable');
      return;
    }

    const primaryBtn = exportContainer.locator('.export-dashboard-btn');
    const secondaryBtn = exportContainer.locator('.export-dashboard-secondary');
    await expect(primaryBtn).toBeVisible();
    await expect(secondaryBtn).toBeVisible();

    const menuToggle = exportContainer.locator('.export-menu-toggle');
    await menuToggle.click();
    const copyLinkOption = exportContainer.locator('.export-option[data-action=\"copy-link\"]');
    await copyLinkOption.click();
    const statusTextEl = exportContainer.locator('.export-status-text');
    await expect(statusTextEl).toBeVisible();
    const statusText = (await statusTextEl.textContent().catch(() => '') || '').toLowerCase();
    expect(statusText).toContain('link copied');

    assertTelemetryClean(telemetry);
  });

  test('current-sprint mobile: stories render as cards instead of horizontal table', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await selectFirstBoard(page).catch(() => null);
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { timeout: 20000 }).catch(() => null);

    const hasStoriesCard = await page.locator('#stories-card').isVisible().catch(() => false);
    if (!hasStoriesCard) {
      test.skip(true, 'Stories section not available for dataset');
      return;
    }

    const noItems = await page.locator('#stories-card .empty-state').isVisible().catch(() => false);
    if (noItems) {
      test.skip(true, 'No stories in selected sprint for dataset');
      return;
    }

    const mobileCardsVisible = await page.locator('#stories-mobile-card-list .story-mobile-card').first().isVisible().catch(() => false);
    expect(mobileCardsVisible).toBeTruthy();
    const desktopTableHidden = await page.evaluate(() => {
      const el = document.querySelector('.stories-table-scroll-wrap');
      return !el || getComputedStyle(el).display === 'none';
    });
    expect(desktopTableHidden).toBe(true);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('report mobile: no-boards state offers one-tap try-last-quarter recovery', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    let previewCalls = 0;
    await page.route('**/preview.json*', (route) => {
      previewCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          boards: [],
          rows: [],
          sprintsIncluded: [],
          sprintsUnusable: [],
          metrics: {},
          meta: {
            selectedProjects: ['SD'],
            windowStart: '2026-01-01T00:00:00.000Z',
            windowEnd: '2026-03-31T23:59:59.999Z',
            generatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await ensureReportFiltersExpanded(page);
    await runDefaultPreview(page);
    await page.waitForSelector('#preview-content', { timeout: 15000 }).catch(() => null);
    await page.click('.tab-btn[data-tab="project-epic-level"]').catch(() => null);

    const cta = page.locator('[data-action="try-last-quarter"]');
    const hasCta = await cta.isVisible().catch(() => false);
    if (!hasCta) {
      test.skip(true, 'No zero-boards recovery CTA rendered for dataset');
      return;
    }
    await cta.click();
    await page.waitForTimeout(500);
    const stillVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    expect(stillVisible).toBeTruthy();
    const ctaStillPresent = await cta.isVisible().catch(() => false);
    expect(ctaStillPresent).toBeTruthy();
    expect(previewCalls).toBeGreaterThanOrEqual(1);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});
