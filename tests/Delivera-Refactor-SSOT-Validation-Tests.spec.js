/**
 * Refactor SSOT Validation Tests
 * Validates: Boards column order, leader-friendly tooltips, capacity columns,
 * CSV/Excel column consistency, and no console errors during preview/export flow.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview, waitForPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

const BOARD_COLUMN_ORDER = [
  'Board', 'Projects', 'Sprints', 'Sprint Days', 'Avg Sprint Days',
  'Done Stories', 'Registered Work Hours', 'Estimated Work Hours', 'Done SP', 'Committed SP', 'Delivered SP', 'SP Estimation %',
  'Stories / Sprint', 'SP / Story', 'Stories / Day', 'SP / Day', 'SP / Sprint', 'SP Variance',
  'Indexed Delivery',
  'On-Time %', 'Planned', 'Ad-hoc', 'Active Assignees', 'Stories / Assignee', 'SP / Assignee',
  'Assumed Capacity (PD)', 'Assumed Waste %', 'Sprint Window', 'Latest End',
];

test.describe('Jira Reporting App - Refactor SSOT Validation Tests', () => {
  const getBoardsTable = (page) => page.locator('#project-epic-level-content table.data-table').first();
  const expandBoardsAdvancedColumns = async (page) => {
    const toggle = page.locator('#boards-columns-toggle');
    const isVisible = await toggle.isVisible().catch(() => false);
    if (!isVisible) return;
    const expanded = await toggle.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await toggle.click();
    }
  };
  const hasBoardsTable = async (page) => {
    const table = getBoardsTable(page);
    return (await table.count()) > 0;
  };

  test.beforeEach(async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.setExtraHTTPHeaders({ 'Accept': 'text/html' });
  });

  test('Boards table headers appear in agreed order when boards exist', async ({ page }) => {
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    const boardsSection = page.locator('#project-epic-level-content');
    await expect(boardsSection).toBeVisible({ timeout: 5000 });
    if (!await hasBoardsTable(page)) {
      await expect(boardsSection).toContainText(/No boards|discovered|date window/i);
      return;
    }
    const firstTable = getBoardsTable(page);
    await expect(firstTable).toBeVisible({ timeout: 5000 });
    const ths = firstTable.locator('thead th');
    const count = await ths.count();
    expect(count).toBeGreaterThanOrEqual(BOARD_COLUMN_ORDER.length);
    const headers = [];
    for (let i = 0; i < count; i++) {
      headers.push((await ths.nth(i).innerText()).trim());
    }
    // Keep SSOT ordering strict for core columns while allowing additive columns.
    let cursor = 0;
    for (const expected of BOARD_COLUMN_ORDER) {
      const foundAt = headers.findIndex((h, idx) => idx >= cursor && h.includes(expected));
      expect(foundAt, `Missing or out-of-order board column: ${expected}`).toBeGreaterThanOrEqual(cursor);
      cursor = foundAt + 1;
    }
  });

  test('Boards table has tooltips on key columns (Board, Planned, Ad-hoc, Latest End)', async ({ page }) => {
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    if (!await hasBoardsTable(page)) {
      test.skip('No boards table (no boards in window)');
      return;
    }
    const table = getBoardsTable(page);
    await expect(table).toBeVisible({ timeout: 5000 });
    const boardTh = table.locator('th').filter({ hasText: /^Board$/ }).first();
    await expect(boardTh).toHaveAttribute('title', /board name/i);
    const plannedTh = table.locator('th').filter({ hasText: 'Planned' }).first();
    await expect(plannedTh).toHaveAttribute('title', /Epic|planned/i);
    const adhocTh = table.locator('th').filter({ hasText: 'Ad-hoc' }).first();
    await expect(adhocTh).toHaveAttribute('title', /without epic|without epic links|unplanned/i);
    const latestEndTh = table.locator('th').filter({ hasText: 'Latest End' }).first();
    await expect(latestEndTh).toHaveAttribute('title', /sprint end|window/i);
  });

  test('Boards table shows capacity proxy columns (Active Assignees, Assumed Capacity, Assumed Waste)', async ({ page }) => {
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    if (!await hasBoardsTable(page)) {
      test.skip('No boards table (no boards in window)');
      return;
    }
    const boardsTable = getBoardsTable(page);
    await expect(boardsTable).toBeVisible({ timeout: 5000 });
    await expandBoardsAdvancedColumns(page);
    await expect(boardsTable.locator('th', { hasText: 'Active Assignees' })).toBeVisible();
    await expect(boardsTable.locator('th', { hasText: 'Assumed Capacity (PD)' })).toBeVisible();
    await expect(boardsTable.locator('th', { hasText: 'Assumed Waste %' })).toBeVisible();
  });

  test('API /api/csv-columns returns columns matching Boards SSOT contract', async ({ request }) => {
    const response = await request.get('/api/csv-columns');
    if (response.status() === 401) {
      test.skip('Auth required');
      return;
    }
    if (response.status() === 404) {
      test.skip('Route /api/csv-columns not found (restart server with latest code)');
      return;
    }
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.columns)).toBe(true);
    expect(body.columns.length).toBeGreaterThan(40);
    expect(body.columns).toContain('issueKey');
    expect(body.columns).toContain('storyPoints');
    expect(body.columns).toContain('epicKey');
  });

  test('Preview and Boards tab render without console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    await page.waitForTimeout(500);
    const relevant = consoleErrors.filter(t => !t.includes('favicon') && !t.includes('404'));
    expect(relevant).toEqual([]);
  });
});
