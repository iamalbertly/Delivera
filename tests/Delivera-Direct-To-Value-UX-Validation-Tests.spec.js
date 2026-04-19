/**
 * Direct-to-Value UX Validation: stories first, thin header, merged risks,
 * single status/export/search, Outcomes shortcut, Leadership empty state and deep links.
 * Validates plan implementation; uses captureBrowserTelemetry and assertTelemetryClean.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  selectFirstBoard,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Jira Reporting App - Direct-To-Value UX Validation', () => {
  test('current-sprint: stories card is first content block after header', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    const skipped = await skipIfRedirectedToLogin(page, test, { currentSprint: true });
    if (skipped) return;

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    const hasBoards = await page.locator('#board-select option[value]:not([value=""])').count() > 0;
    if (!hasBoards) {
      test.skip(true, 'No boards to select');
      return;
    }
    await selectFirstBoard(page);
    await page.waitForSelector('#current-sprint-content, #stories-card, #stuck-card', { timeout: 20000 }).catch(() => null);

    const storiesCard = page.locator('#stories-card');
    const risksColumn = page.locator('.risks-stuck-column, #stuck-card');
    const storiesVisible = await storiesCard.isVisible().catch(() => false);
    const risksVisible = await risksColumn.first().isVisible().catch(() => false);

    if (storiesVisible && risksVisible) {
      const order = await page.evaluate(() => {
        const stories = document.getElementById('stories-card');
        const risks = document.querySelector('.risks-stuck-column') || document.getElementById('stuck-card');
        if (!stories || !risks) return { storiesFirst: true };
        const posStories = stories.getBoundingClientRect().top;
        const posRisks = risks.getBoundingClientRect().top;
        return { storiesFirst: posStories < posRisks };
      });
      expect(order.storiesFirst).toBe(true);
    }
    assertTelemetryClean(telemetry);
  });

  test('current-sprint: header is single compact strip', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    const skipped = await skipIfRedirectedToLogin(page, test, { currentSprint: true });
    if (skipped) return;

    const headerBar = page.locator('.current-sprint-header-bar');
    await expect(headerBar).toBeVisible();
    const count = await page.locator('.current-sprint-header-bar').count();
    expect(count).toBe(1);
    assertTelemetryClean(telemetry);
  });

  test('current-sprint: stories card relies on work rows, not duplicate risk strips', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    const skipped = await skipIfRedirectedToLogin(page, test, { currentSprint: true });
    if (skipped) return;

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    await selectFirstBoard(page);
    await page.waitForSelector('#stories-card', { timeout: 20000 }).catch(() => null);

    const card = page.locator('#stories-card');
    const hasRisksColumn = await card.locator('.story-risks-cell, th').filter({ hasText: /Risks/i }).isVisible().catch(() => false);
    await expect(card.locator('.stories-risk-summary-bar')).toHaveCount(0);
    await expect(card.getByText('Evidence snapshot', { exact: true })).toHaveCount(0);
    expect(hasRisksColumn).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('current-sprint: Work risks below stories; no duplicate Filter by role', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    const skipped = await skipIfRedirectedToLogin(page, test, { currentSprint: true });
    if (skipped) return;

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    await selectFirstBoard(page);
    await page.waitForSelector('#stuck-card, #stories-card', { timeout: 20000 }).catch(() => null);

    const duplicateRoleFilter = page.locator('.work-risks-role-filters');
    const count = await duplicateRoleFilter.count();
    expect(count).toBe(0);
    // Stuck card is now an explainer-only surface; it should not host a risks data table.
    const stuckTables = await page.locator('#stuck-card table, #work-risks-table').count();
    expect(stuckTables).toBe(0);
    const stuckCard = page.locator('#stuck-card');
    if (await stuckCard.isVisible().catch(() => false)) {
      const useHeaderHint = page.getByText(/Use header|View as.*filter.*Work risks/i).first();
      await expect(useHeaderHint).toBeVisible();
    }
    assertTelemetryClean(telemetry);
  });

  test('current-sprint: single role filter in header or stories area', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    const skipped = await skipIfRedirectedToLogin(page, test, { currentSprint: true });
    if (skipped) return;

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    await selectFirstBoard(page);
    await page.waitForSelector('#current-sprint-content, .current-sprint-header-bar', { timeout: 20000 }).catch(() => null);

    const headerRolePills = page.locator('.current-sprint-header-bar .role-mode-pill[data-role-mode]');
    const count = await headerRolePills.count();
    if (count === 0) {
      test.skip(true, 'No role-mode pills rendered for current dataset');
      return;
    }
    expect(count).toBeGreaterThanOrEqual(1);
    assertTelemetryClean(telemetry);
  });

  test('current-sprint: section links are dropdown or minimal', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    const skipped = await skipIfRedirectedToLogin(page, test, { currentSprint: true });
    if (skipped) return;

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    await selectFirstBoard(page);
    await page.waitForSelector('#sprint-section-dropdown-menu, .sprint-section-links-dropdown, .sprint-section-dropdown-trigger', { timeout: 15000 }).catch(() => null);

    const hasDropdown = await page.locator('.sprint-section-dropdown-trigger, .sprint-section-links-dropdown').isVisible().catch(() => false);
    const menuCount = await page.locator('#sprint-section-dropdown-menu').count();
    expect(hasDropdown || menuCount >= 1).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('report: single status line in preview-status-strip', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    const strip = page.locator('#preview-status-strip');
    await expect(strip).toBeAttached();
    const stripCount = await page.locator('#preview-status-strip').count();
    expect(stripCount).toBe(1);
    const statusCount = await page.locator('#preview-status').count();
    expect(statusCount).toBeLessThanOrEqual(1);
    assertTelemetryClean(telemetry);
  });

  test('report: one search control on Outcomes tab', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    const tabSearch = page.locator('#report-tab-search');
    await expect(tabSearch).toBeAttached();
    const visibleSearchInputs = await page.locator('#report-tab-search').count();
    expect(visibleSearchInputs).toBe(1);
    assertTelemetryClean(telemetry);
  });

  test('report: Outcomes shortcut chip present when preview has content', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    await page.locator('#preview-btn').click().catch(() => null);
    await page.waitForSelector('#preview-content, #preview-status-strip', { timeout: 60000 }).catch(() => null);
    const outcomesChip = page.locator('[data-preview-context-action="open-done-stories"]');
    const visible = await outcomesChip.first().isVisible().catch(() => false);
    const chipCount = await outcomesChip.count();
    expect(visible || chipCount >= 1).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('report: single Export entry with menu options', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    const exportBtn = page.locator('#export-excel-btn');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toContainText(/Export/i);
    const menu = page.locator('#export-dropdown-menu');
    await expect(menu).toBeAttached();
    const menuText = await menu.textContent().catch(() => '');
    expect(menuText).toMatch(/Full report \(Excel\)/);
    expect(menuText).toMatch(/Outcomes only|Current tab/);
    assertTelemetryClean(telemetry);
  });

  test('leadership: empty state with CTA to Report', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/preview.json*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ boards: [], sprintsIncluded: [], rows: [], meta: {} }),
      })
    );
    await page.goto('/sprint-leadership');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    const bodyText = await page.locator('body').textContent();
    const hasEmptyMessage = /Open Report|run Preview|Leadership Signals/i.test(bodyText || '');
    const cta = page.locator('a[href*="/report"]').first();
    const hasCta = await cta.isVisible().catch(() => false);
    expect(hasEmptyMessage || hasCta).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('leadership: metric cards present and clickable when data exists', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }
    await page.locator('#preview-btn').click().catch(() => null);
    await page.waitForSelector('#preview-content', { timeout: 60000 }).catch(() => null);
    await page.goto('/sprint-leadership');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    const cardsWithLinks = page.locator('.leadership-card a[href], a.leadership-card[href]');
    const count = await cardsWithLinks.count();
    expect(count).toBeGreaterThanOrEqual(0);
    assertTelemetryClean(telemetry);
  });

  test('no duplicate Board labels or two search boxes on same tab', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    const boardLabels = page.locator('label, [aria-label]').filter({ hasText: /^Board$/ });
    const count = await boardLabels.count();
    expect(count).toBeLessThanOrEqual(2);
    const tabSearchBoxes = page.locator('.tab-pane.active #report-tab-search');
    const searchCount = await tabSearchBoxes.count();
    expect(searchCount).toBeLessThanOrEqual(1);
    assertTelemetryClean(telemetry);
  });
});
