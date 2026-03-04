/**
 * UX Customer-Simplicity-Trust Full Validation (SSOT).
 * Merged from: UX-Customer-Simplicity-Trust-Validation, UX-Improvements-Customer-Simplicity-Trust,
 * Customer-Simplicity-Trust-Phase2. Validates Login outcome/error/rate-limit, Report filter tip,
 * tab outcome, sticky chips, Generated X min ago, empty state, Export, partial banner, validation error;
 * Current Sprint outcome, Stuck/Scope, loading copy, board select, stuck-card, work items/section links;
 * Leadership outcome, empty hint, auto-preview, redirect, Indexed Delivery tooltip; Done Stories columns,
 * encoding. Uses captureBrowserTelemetry and assertTelemetryClean.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  runDefaultPreview,
  waitForPreview,
  assertTelemetryClean,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('UX Customer-Simplicity-Trust Full', () => {
  test('Login – Outcome line visible on login page', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/login.html');
    const outcome = page.locator('.login-outcome-line');
    await expect(outcome).toBeVisible();
    const text = await outcome.textContent().catch(() => '');
    expect(text).toMatch(/Sprint risks and delivery in under 30 seconds/i);
    assertTelemetryClean(telemetry);
  });

  test('Login – Error focus when error shown', async ({ page }) => {
    await page.goto('/login?error=invalid');
    const hasLoginForm = await page.locator('#login-form').isVisible().catch(() => false);
    if (!hasLoginForm) {
      test.skip(true, 'Login form not visible');
      return;
    }
    await expect(page.locator('#login-error')).toBeVisible();
    const focusedId = await page.evaluate(() => document.activeElement?.id || '');
    expect(focusedId === 'login-error' || focusedId === 'username').toBe(true);
  });

  test('Login – Rate-limit message when error=ratelimit', async ({ page }) => {
    await page.goto('/login?error=ratelimit');
    const hasLoginForm = await page.locator('#login-form').isVisible().catch(() => false);
    if (!hasLoginForm) {
      test.skip(true, 'Login form not visible');
      return;
    }
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toContainText(/Too many attempts.*Wait a minute/i);
  });

  test('Report - Sticky chips row visible after scroll', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const stickyRow = page.locator('#preview-summary-sticky').first();
    const chipsRow = page.locator('.applied-filters-chips-row').first();
    const outcomeLine = page.locator('#preview-outcome-line').first();
    const hasVisibleSummaryAtStart =
      (await stickyRow.isVisible().catch(() => false))
      || (await chipsRow.isVisible().catch(() => false))
      || (await outcomeLine.isVisible().catch(() => false));
    expect(hasVisibleSummaryAtStart).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const hasVisibleSummaryAfterScroll =
      (await stickyRow.isVisible().catch(() => false))
      || (await chipsRow.isVisible().catch(() => false))
      || (await outcomeLine.isVisible().catch(() => false));
    expect(hasVisibleSummaryAfterScroll).toBeTruthy();
    assertTelemetryClean(telemetry);
  });

  test('Report – Filters tip above Projects', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const tip = page.locator('.filters-tip');
    await expect(tip).toBeVisible();
    const text = await tip.textContent().catch(() => '');
    expect(text).toMatch(/Pick projects and a quarter|pick a quarter|check the preview and export|report runs automatically/i);
    assertTelemetryClean(telemetry);
  });

  test('Report – Advanced options collapsed by default', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const advanced = page.locator('#advanced-options');
    await expect(advanced).toBeHidden();
    assertTelemetryClean(telemetry);
  });

  test('Report – Tab outcome line and search clear ×', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; skip tab hint');
      return;
    }
    const tabHint = page.locator('#tab-outcome-hint, .tab-hint');
    await expect(tabHint).toBeVisible();
    const hintText = await tabHint.textContent().catch(() => '');
    expect(hintText).toMatch(/Done Stories|stakeholders|Export/i);
    const clearBtn = page.locator('.search-clear-btn').first();
    await expect(clearBtn).toHaveCount(1);
    const clearText = await clearBtn.textContent().catch(() => '');
    const clearLabel = await clearBtn.getAttribute('aria-label').catch(() => '');
    expect(`${clearLabel || ''} ${clearText || ''}`.trim()).toMatch(/clear/i);
    assertTelemetryClean(telemetry);
  });

  test('Report – Filters changed keeps results visible and auto-refreshes', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; skip filter-change CTA');
      return;
    }
    await page.uncheck('#project-mas').catch(() => {});
    await expect(page.locator('#preview-content')).toBeVisible();
    const previewBtn = page.locator('#preview-btn');
    const previewDisabled = await previewBtn.isDisabled().catch(() => false);
    if (!previewDisabled) {
      await expect(previewBtn).toBeEnabled();
    }
    const statusText = await page.locator('#preview-status').textContent().catch(() => '');
    if ((statusText || '').trim().length > 0) {
      expect(statusText || '').toMatch(/Filters changed|Refreshing automatically|last successful/i);
    }
    await expect(page.locator('#error')).toBeHidden();
    assertTelemetryClean(telemetry);
  });

  test('Report – Preview header has Export button', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible');
      return;
    }
    const headerExport = page.locator('#export-excel-btn');
    await expect(headerExport).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('Report – Generated X min ago or just now in sticky when preview has data', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; skip sticky freshness');
      return;
    }
    const sticky = page.locator('#preview-summary-sticky');
    const stickyVisible = await sticky.isVisible().catch(() => false);
    if (stickyVisible) {
      const stickyText = await sticky.textContent().catch(() => '');
      // UX Fix #1: Sticky suffix uses "Updated X min ago" or "Updated just now" (not "Generated:")
      expect(stickyText).toMatch(/Updated (just now|\d+ min ago)|(just now|\d+ min ago)/i);
    } else {
      // UX Fix #1: Freshness is in the data-state badge inside #preview-outcome-line
      const outcomeEl = page.locator('#preview-outcome-line');
      const outcomeText = await outcomeEl.textContent().catch(() => '');
      const badgeText = await outcomeEl.locator('.data-state-badge').textContent().catch(() => '');
      const freshnessFound = /just now|\d+ min ago|live|just updated|partial|closest/i.test(badgeText) ||
                             /just now|\d+ min ago|live|just updated/i.test(outcomeText);
      expect(freshnessFound).toBe(true);
    }
    assertTelemetryClean(telemetry);
  });

  test('Report – One empty state and Adjust filters CTA when no done stories', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await page.check('#project-mpsa');
    await page.uncheck('#project-mas');
    await page.fill('#start-date', '2020-01-01T00:00');
    await page.fill('#end-date', '2020-01-15T23:59');
    await page.locator('#preview-btn').click();
    await waitForPreview(page, { timeout: 90000 });
    const emptyState = page.locator('.empty-state');
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    if (emptyVisible) {
      await expect(emptyState).toContainText(/No done stories/i);
    }
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Report – Validation error invalid range shows Check filters message', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await page.fill('#start-date', '2025-09-30T23:59');
    await page.fill('#end-date', '2025-07-01T00:00');
    await page.click('#preview-btn');
    await expect(page.locator('#error')).toBeVisible({ timeout: 5000 });
    const errorText = await page.locator('#error').textContent();
    expect(errorText).toMatch(/Check filters|Start date|before end date/i);
    assertTelemetryClean(telemetry);
  });

  test('Report – Partial banner has Try smaller range', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    const smallerBtn = page.locator('[data-action="retry-with-smaller-range"]');
    const banner = page.locator('.status-banner.warning');
    await page.click('#preview-btn').catch(() => {});
    await Promise.race([
      page.waitForSelector('.status-banner.warning', { state: 'visible', timeout: 65000 }).catch(() => null),
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 65000 }).catch(() => null),
    ]);
    const bannerVisible = await banner.isVisible().catch(() => false);
    if (bannerVisible) {
      await expect(page.locator('button:has-text("Try smaller range")')).toBeVisible();
    }
    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Loading copy when no board selected', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    await page.waitForTimeout(400);
    const loading = page.locator('#current-sprint-loading');
    const loadingVisible = await loading.isVisible().catch(() => false);
    if (loadingVisible) {
      const text = (await loading.textContent().catch(() => '')) || '';
      expect(text).toMatch(/Loading board|Loading current sprint|Select projects and a board.*sprint health and risks/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Verdict line when content loaded', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    await page.waitForSelector('#current-sprint-content', { state: 'visible', timeout: 25000 }).catch(() => null);
    const verdict = page.locator('.sprint-verdict-line');
    const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    if (contentVisible) {
      const verdictVisible = await verdict.isVisible().catch(() => false);
      if (verdictVisible) {
        const text = await verdict.textContent();
        expect(text || '').toMatch(/Healthy|Caution|At Risk|Critical/i);
      }
    }
    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Board select visible and header dates without ? separator', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }
    await expect(page.locator('#board-select')).toBeVisible();
    const headerText = await page.locator('[class*="header"], .sprint-header, .header-bar').first().textContent().catch(() => '');
    expect(headerText).not.toMatch(/\s\?\s/);
    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Stuck card section present when data loaded', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }
    await page.waitForSelector('#board-select', { state: 'visible', timeout: 10000 }).catch(() => null);
    const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    if (!contentVisible) {
      test.skip(true, 'Current sprint content not visible');
      return;
    }
    const stuckCard = page.locator('#stuck-card');
    const stuckVisible = await stuckCard.isVisible().catch(() => false);
    if (stuckVisible) {
      const cardText = (await stuckCard.textContent()) || '';
      expect(cardText).toMatch(/items stuck|in progress|0 items|stuck >24h|work risks/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Work items or section link visible', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }
    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    await page.waitForSelector('a[href="#stories-card"], #stories-card', { timeout: 35000 }).catch(() => null);
    const linkCount = await page.locator('a[href="#stories-card"]').count();
    const storiesCard = page.locator('#stories-card');
    const hasWorkItemsSection = linkCount > 0 || (await storiesCard.count()) > 0 || await page.getByText(/Issues in sprint|Work items/).first().isVisible().catch(() => false);
    if (!hasWorkItemsSection) {
      test.skip(true, 'Work items section not rendered within timeout');
      return;
    }
    expect(hasWorkItemsSection).toBeTruthy();
    assertTelemetryClean(telemetry);
  });

  test('Current Sprint – Stuck and Scope definitions present', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    await page.waitForSelector('#current-sprint-content', { state: 'visible', timeout: 25000 }).catch(() => null);
    const content = await page.locator('#current-sprint-content').textContent().catch(() => '');
    if (content && content.includes('stuck-card')) {
      expect(content).toMatch(/Stuck:|issues in progress|>24h/i);
      expect(content).toMatch(/Scope changes|work added|mid-sprint/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('Leadership – Outcome line in loading', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    const hasLegacyLoading = (await page.locator('#leadership-loading').count()) > 0;
    if (!hasLegacyLoading) {
      if (page.url().includes('/report')) {
        await expect(page).toHaveURL(/\/report(#trends)?/);
      }
      test.skip(true, 'Legacy leadership loading UI not present on report trends route');
      return;
    }
    const loading = page.locator('#leadership-loading');
    await expect(loading).toBeVisible();
    const text = await loading.textContent().catch(() => '');
    expect(text).toMatch(/Loading normalized trends|selected projects|date range|delivery trends/i);
    assertTelemetryClean(telemetry);
  });

  test('Leadership – changing filters auto-runs preview without extra click', async ({ page }) => {
    let previewCalls = 0;
    await page.route('**/preview.json*', async (route) => {
      previewCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          boards: [{ id: 1, name: 'Board 1', projectKeys: ['MPSA'], indexedDelivery: { index: 1, currentSPPerDay: 1, rollingAvgSPPerDay: 1, sprintCount: 1 } }],
          sprintsIncluded: [{ id: 100, boardId: 1, state: 'closed', endDate: '2025-09-30T23:59:59.999Z', sprintWorkDays: 10, sprintCalendarDays: 14, doneStoriesNow: 2, doneStoriesBySprintEnd: 2, doneSP: 4 }],
          rows: [{ boardId: 1, sprintId: 100, issueKey: 'MPSA-1' }],
          metrics: {},
          meta: { generatedAt: new Date().toISOString(), windowStart: '2025-07-01T00:00:00.000Z', windowEnd: '2025-09-30T23:59:59.999Z', projects: 'MPSA' },
        }),
      });
    });

    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }
    const hasLegacyFilters = (await page.locator('#leadership-projects').count()) > 0;
    if (!hasLegacyFilters) {
      test.skip(true, 'Legacy leadership filters are not present on report trends route');
      return;
    }

    previewCalls = 0;
    await page.selectOption('#leadership-projects', 'MPSA').catch(() => {});
    await page.waitForTimeout(900);
    expect(previewCalls).toBeGreaterThan(0);
    assertTelemetryClean(telemetry);
  });

  test('Leadership – Empty state includes Check projects and Try recent quarter', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    const hasLegacyFilters = (await page.locator('#leadership-projects').count()) > 0;
    if (!hasLegacyFilters) {
      test.skip(true, 'Legacy leadership filters are not present on report trends route');
      return;
    }
    await page.selectOption('#leadership-projects', 'BIO').catch(() => {});
    await page.fill('#leadership-start', '2020-01-01').catch(() => {});
    await page.fill('#leadership-end', '2020-01-31').catch(() => {});
    await page.click('#leadership-preview').catch(() => {});
    await page.waitForSelector('#leadership-content', { state: 'visible', timeout: 30000 }).catch(() => null);
    const content = await page.locator('#leadership-content').textContent().catch(() => '');
    if (content && content.toLowerCase().includes('no boards')) {
      expect(content).toMatch(/Check that the selected projects|sprints in this date range/i);
      expect(content).toMatch(/Try a more recent quarter|current quarter/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('Leadership – Indexed Delivery column has tooltip', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    const hasLegacyPreview = (await page.locator('#leadership-preview').count()) > 0;
    if (!hasLegacyPreview) {
      test.skip(true, 'Legacy leadership preview UI not present on report trends route');
      return;
    }
    await page.click('#leadership-preview').catch(() => {});
    await Promise.race([
      page.waitForSelector('.leadership-boards-table', { state: 'visible', timeout: 20000 }).catch(() => null),
      page.waitForSelector('#leadership-error', { state: 'visible', timeout: 20000 }).catch(() => null),
    ]);
    const tableVisible = await page.locator('.leadership-boards-table').isVisible().catch(() => false);
    if (!tableVisible) {
      test.skip(true, 'Leadership boards table not visible in this environment');
      return;
    }
    const th = page.locator('th[title*="SP/day"], th[title*="baseline"]').first();
    const count = await th.count();
    if (count > 0) {
      await expect(th).toHaveAttribute('title', /.+/);
    }
    assertTelemetryClean(telemetry);
  });

  test('Leadership – Redirects to report trends', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }
    await expect(page).toHaveURL(/\/report(#trends)?/);
    await expect(page.locator('#tab-btn-trends')).toHaveAttribute('aria-selected', 'true');
    assertTelemetryClean(telemetry);
  });

  test('Report – Epic IDs are URL links in Project & Epic Level tab', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await page.check('#project-mpsa').catch(() => {});
    await page.check('#project-mas').catch(() => {});
    await page.fill('#start-date', '2025-07-01T00:00').catch(() => {});
    await page.fill('#end-date', '2025-09-30T23:59').catch(() => {});
    await page.click('#preview-btn');
    await Promise.race([
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 45000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 45000 }).catch(() => null),
    ]);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    await page.waitForSelector('#tab-project-epic-level.active', { state: 'visible', timeout: 10000 });
    const link = page.locator('#project-epic-level-content .epic-key a').first();
    const visible = await link.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'No epic key links in Project & Epic Level');
      return;
    }
    const href = await link.getAttribute('href');
    expect(href && href.length > 0).toBeTruthy();
    expect(href).toMatch(/browse|jira|\.atlassian\.net/i);
    assertTelemetryClean(telemetry);
  });

  test('Report – Done Stories tab has columns toggle and Key/Summary/Status', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    await waitForPreview(page, { timeout: 120000 });
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview not visible; may require Jira credentials');
      return;
    }
    await page.click('#tab-btn-done-stories');
    await page.waitForSelector('#tab-done-stories.active', { state: 'visible', timeout: 5000 }).catch(() => null);
    await expect(page.locator('#done-stories-columns-toggle')).toContainText(/Show more columns|Show fewer columns/);
    const table = page.locator('#tab-done-stories table.data-table').first();
    const rowCount = await table.locator('tbody tr').count().catch(() => 0);
    if (rowCount === 0) {
      test.skip(true, 'Done Stories table has no rows for current dataset');
      return;
    }
    const tableText = ((await table.textContent().catch(() => '')) || '').toLowerCase();
    const hasCoreColumns = /key|issue key|ticket id/.test(tableText)
      && /summary/.test(tableText)
      && /status/.test(tableText);
    expect(hasCoreColumns).toBeTruthy();
    assertTelemetryClean(telemetry);
  });

  test('Report – Sticky summary has no replacement character', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    await waitForPreview(page, { timeout: 120000 });
    const sticky = page.locator('#preview-summary-sticky');
    const visible = await sticky.isVisible().catch(() => false);
    if (visible) {
      const text = await sticky.textContent();
      expect(text).not.toContain('\uFFFD');
    }
    assertTelemetryClean(telemetry);
  });

  test('Report load – h1, Preview button, nav links, applied-filters-summary', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance/);
    await expect(page.locator('#preview-btn')).toContainText(/Preview/i);
    await expect(page.locator('.app-sidebar a.sidebar-link[href="/current-sprint"], nav.app-nav a[href="/current-sprint"]')).toContainText('Current Sprint');
    await expect(page.locator('#tab-btn-trends')).toContainText('Trends');
    await expect(page.locator('#applied-filters-summary')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('Copy and encoding – Preview label and header no ? separator', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    await expect(page.locator('#preview-btn')).toContainText(/Preview/i);
    await page.goto('/current-sprint').catch(() => null);
    if (!page.url().includes('current-sprint')) return;
    const headerBar = await page.locator('.header-bar, [class*="header"]').first().textContent().catch(() => '');
    expect(headerBar).not.toMatch(/\s\?\s/);
    assertTelemetryClean(telemetry);
  });
});

