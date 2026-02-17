import { test, expect } from '@playwright/test';
import { captureBrowserTelemetry, assertTelemetryClean, skipIfRedirectedToLogin } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Current Sprint Health & SSOT UX Validation', () => {
  test('current sprint loading copy when no board selected', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const loading = page.locator('#current-sprint-loading');
    await page.waitForTimeout(300);
    const loadingVisible = await loading.isVisible().catch(() => false);
    if (loadingVisible) {
      const text = await loading.textContent().catch(() => '') || '';
      expect(text).toMatch(/Loading (board|current sprint|boards)|Choose (one )?project.*boards load.*pick a board/i);
    }
  });

  test('current sprint header shows health outcome line', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await expect(page.locator('h1')).toContainText('Current Sprint');
    const verdict = page.locator('.sprint-verdict-line');
    const hasVerdict = await verdict.isVisible().catch(() => false);
    if (!hasVerdict) {
      test.skip(true, 'Sprint verdict line not visible for current data set');
      return;
    }
    const text = await verdict.textContent();
    expect(text || '').toMatch(/Healthy|Caution|At Risk|Critical/i);

    assertTelemetryClean(telemetry);
  });

  test('current sprint no-boards error includes hint when shown', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const errorEl = page.locator('#current-sprint-error');
    const errorVisible = await errorEl.isVisible().catch(() => false);
    if (errorVisible) {
      const text = await errorEl.textContent().catch(() => '');
      if ((text || '').includes('No boards found')) {
        expect(text).toMatch(/Check project selection|try Report to refresh/i);
      }
    }
  });

  test('no-active-sprint empty state, when present, explains next steps', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const bodyText = (await page.locator('body').textContent()) || '';
    if (!/No active sprint on this board/i.test(bodyText)) {
      test.skip(true, 'No "No active sprint" empty state visible for current data set');
      return;
    }

    expect(bodyText).toMatch(/Try the previous sprint tab/i);
  });

  test('projects SSOT sync applies silently and normalizes to one project for current sprint', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    // Simulate Report updating the shared projects SSOT key
    await page.evaluate(() => {
      const key = 'vodaAgileBoard_selectedProjects';
      localStorage.setItem(key, 'MPSA,MAS');
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: 'MPSA,MAS' }));
    });

    await expect(page.locator('#current-sprint-projects')).toHaveValue('MPSA');
    await expect(page.locator('#board-select')).toBeVisible();
  });

  test('sprint header bar stays visible when scrolling', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const headerBar = page.locator('.current-sprint-header-bar');
    const hasHeader = await headerBar.isVisible().catch(() => false);
    if (!hasHeader) {
      test.skip(true, 'Sprint header bar not visible for current data set');
      return;
    }

    // Scroll to bottom to simulate deep inspection of cards/tables
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const box = await headerBar.boundingBox();
    if (!box) {
      test.skip(true, 'Could not measure header bar position');
      return;
    }

    // Sticky header bar should remain within the top portion of the viewport
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeLessThan(200);
  });

  test('work risks table when present has Summary column and displays row data', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const table = page.locator('#work-risks-table');
    const tableVisible = await table.isVisible().catch(() => false);
    if (!tableVisible) {
      test.skip(true, 'Work risks table not visible for current data set');
      return;
    }
    await expect(table.locator('th:has-text("Summary")')).toBeVisible();
    const rows = table.locator('tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip(true, 'Work risks table has no rows');
      return;
    }
    const firstRow = rows.first();
    const summaryCell = firstRow.locator('td.cell-wrap[data-label="Summary"]').or(firstRow.locator('td:nth-child(4)'));
    await expect(summaryCell).toBeVisible();
  });

  test('current sprint data-availability summary appears when sections are suppressed', async ({ page }) => {
    await page.goto('/current-sprint');
    await page.waitForTimeout(800);
    const summary = page.locator('.data-availability-summary');
    const visible = await summary.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'No suppressed sections for this sprint dataset');
      return;
    }
    await expect(summary).toContainText(/Hidden sections|Data availability summary/i);
    await expect(summary.locator('.data-availability-chip').first()).toBeVisible();
    await expect(summary.locator('.data-availability-source').first()).toBeVisible();
  });
});

