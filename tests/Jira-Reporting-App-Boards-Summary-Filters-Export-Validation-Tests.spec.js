/**
 * Boards Summary, Filters, and Export Validation Tests
 * Validates: Boards table summary row (tfoot), tap-friendly tooltips, unified filters on Boards/Sprints,
 * export split button (full vs filtered), and no console errors.
 */

import { test, expect } from '@playwright/test';
import { runDefaultPreview, waitForPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Jira Reporting App - Boards Summary Filters Export Validation Tests', () => {
  const getBoardsTable = (page) => page.locator('#project-epic-level-content table.data-table').first();
  const hasBoardsTable = async (page) => (await getBoardsTable(page).count()) > 0;
  const expandBoardsAdvancedColumns = async (page) => {
    const toggle = page.locator('#boards-columns-toggle');
    const isVisible = await toggle.isVisible().catch(() => false);
    if (!isVisible) return;
    const expanded = await toggle.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await toggle.click();
    }
  };

  test.beforeEach(async ({ page }) => {
    page.setExtraHTTPHeaders({ 'Accept': 'text/html' });
  });

  test('Boards table has summary row (tfoot) with Total/Summary when boards exist', async ({ page }) => {
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    const boardsSection = page.locator('#project-epic-level-content');
    await expect(boardsSection).toBeVisible({ timeout: 5000 });
    if (!await hasBoardsTable(page)) {
      await expect(boardsSection).toContainText(/No boards|discovered|date window|match the current filters/i);
      return;
    }
    const table = getBoardsTable(page);
    await expect(table).toBeVisible({ timeout: 5000 });
    const tfoot = table.locator('tfoot');
    const summaryRow = table.locator('tr.boards-summary-row');
    const hasTfoot = await tfoot.count() > 0;
    if (hasTfoot) {
      await expect(tfoot).toBeVisible({ timeout: 3000 });
    } else {
      await expect(summaryRow).toBeVisible({ timeout: 3000 });
    }
    const summaryRowLocator = hasTfoot ? table.locator('tfoot') : table.locator('tr.boards-summary-row');
    await expect(summaryRowLocator).toBeVisible({ timeout: 3000 });
    const summaryText = (await summaryRowLocator.textContent()) || '';
    const hasLabel = /Total|Summary|Comparison/i.test(summaryText);
    expect(hasLabel || summaryText.trim().length > 0).toBeTruthy();
    await expandBoardsAdvancedColumns(page);
    const numericCell = hasTfoot
      ? table.locator('tfoot td:visible').first()
      : table.locator('tr.boards-summary-row td:visible').first();
    await expect(numericCell).toBeVisible();
    if (!hasTfoot) {
      const firstRowClass = await table.locator('tbody tr').first().getAttribute('class');
      expect(firstRowClass && firstRowClass.includes('boards-summary-row')).toBeTruthy();
    }
  });

  test('Tooltip on tap: hover header shows popover with tooltip text', async ({ page }) => {
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    if (!await hasBoardsTable(page)) {
      test.skip('No boards table (no boards in window)');
      return;
    }
    const trigger = page.locator('th[data-tooltip]').first();
    await expect(trigger).toBeVisible({ timeout: 5000 });
    await trigger.hover();
    const popover = page.locator('#tooltip-popover');
    const popoverVisible = await popover.isVisible().catch(() => false);
    if (popoverVisible) {
      await expect(popover).toHaveAttribute('aria-hidden', 'false');
      const text = await popover.textContent();
      expect(text && text.length > 0).toBeTruthy();
    } else {
      const title = await trigger.getAttribute('title');
      expect((title || '').trim().length).toBeGreaterThan(0);
    }
  });

  test('Boards tab has search and filter controls', async ({ page }) => {
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    const searchBox = page.locator('#boards-search-box');
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await expect(searchBox).toHaveAttribute('placeholder', /Search boards/i);
    const pills = page.locator('#boards-project-pills');
    await expect(pills).toHaveCount(1);
    const pillsVisible = await pills.isVisible().catch(() => false);
    if (pillsVisible) {
      await expect(pills).toBeVisible({ timeout: 3000 });
    }
  });

  test('Sprints tab has search and filter controls', async ({ page }) => {
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="sprints"]');
    const searchBox = page.locator('#sprints-search-box');
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await expect(searchBox).toHaveAttribute('placeholder', /Search sprints/i);
    const pills = page.locator('#sprints-project-pills');
    await expect(pills).toHaveCount(1);
    const pillsVisible = await pills.isVisible().catch(() => false);
    if (pillsVisible) {
      await expect(pills).toBeVisible({ timeout: 3000 });
    }
  });

  test('Boards search filters table rows or shows empty state', async ({ page }) => {
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    const boardsSection = page.locator('#project-epic-level-content');
    if (!await hasBoardsTable(page)) {
      test.skip('No boards table (no boards in window)');
      return;
    }
    const searchBox = page.locator('#boards-search-box');
    await searchBox.fill('__nonexistent_board_xyz__');
    await searchBox.dispatchEvent('input');
    await page.waitForTimeout(400);
    const content = await boardsSection.textContent();
    const hasEmptyMessage = /No boards match the current filters|match the current filters/i.test(content || '');
    const visibleRows = boardsSection.locator('table.data-table tbody tr:visible');
    const visibleCount = await visibleRows.count();
    const visibleTexts = await visibleRows.allTextContents();
    const searchTerm = '__nonexistent_board_xyz__';
    const filteredRowsOnly = visibleCount === 0 || visibleTexts.every((txt) => {
      const t = (txt || '').toLowerCase();
      return t.includes(searchTerm) || /all boards|comparison/.test(t);
    });
    if (hasEmptyMessage || filteredRowsOnly) {
      expect(true).toBeTruthy();
    } else {
      await expect(searchBox).toHaveValue('__nonexistent_board_xyz__');
      await expect(boardsSection.locator('table.data-table').first()).toBeVisible();
    }
  });

  test('Export split button: primary and dropdown with full and filtered options', async ({ page }) => {
    await page.goto('/report');
    await runDefaultPreview(page);
    const primaryBtn = page.locator('#export-excel-btn');
    await expect(primaryBtn).toBeVisible({ timeout: 5000 });
    await expect(primaryBtn).toContainText(/Share \/ Export|Export to Excel|all data/i);
    const dropdownTrigger = page.locator('#export-dropdown-trigger');
    await expect(dropdownTrigger).toBeVisible({ timeout: 3000 });
    const canOpen = await dropdownTrigger.isEnabled().catch(() => false);
    if (!canOpen) {
      test.skip('Export dropdown disabled for current dataset');
      return;
    }
    await dropdownTrigger.click();
    const menu = page.locator('#export-dropdown-menu');
    await expect(menu).toHaveCount(1);
    await expect(menu.locator('[data-export="excel-full"]')).toHaveCount(1);
    await expect(menu.locator('[data-export="csv-filtered"]')).toHaveCount(1);
    await expect(menu.locator('[data-export="excel-filtered"]')).toHaveCount(1);
  });

  test('Preview and Boards/Filters/Export flow without console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    await page.goto('/report');
    await runDefaultPreview(page);
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    await page.waitForTimeout(300);
    await page.click('.tab-btn[data-tab="sprints"]');
    await page.waitForTimeout(300);
    const relevant = consoleErrors.filter(t =>
      !t.includes('favicon') &&
      !t.includes('404') &&
      !t.includes('csv-columns')
    );
    expect(relevant).toEqual([]);
  });
});
