import { test, expect } from '@playwright/test';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

async function skipIfNoActiveSprint(page, testCtx) {
  const hasCommandCenter = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
  if (hasCommandCenter) return false;
  const noSprintState = page.locator('.empty-state, #current-sprint-content');
  const noSprintText = ((await noSprintState.first().textContent().catch(() => '')) || '').toLowerCase();
  if (noSprintText.includes('no active sprint')) {
    testCtx.skip(true, 'No active sprint for this board/dataset');
    return true;
  }
  return false;
}

test.describe('Current Sprint - Work risks hierarchy and blockers semantics', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const telemetry = captureBrowserTelemetry(page);
    testInfo.attach('telemetry', { body: JSON.stringify(telemetry), contentType: 'application/json' }).catch?.(() => {});

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const errorVisible = await page.locator('#current-sprint-error').isVisible().catch(() => false);
    if (errorVisible) {
      const txt = (await page.locator('#current-sprint-error').textContent().catch(() => '')) || '';
      testInfo.skip(`Current sprint unavailable for dataset: ${txt}`);
    }
  });

  test('Work risks table groups parents and subtasks by parent key', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const table = page.locator('#work-risks-table');
    const visible = await table.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Work risks table hidden for dataset');
      return;
    }

    const parentRows = table.locator('tbody tr.work-risk-parent-row');
    const parentCount = await parentRows.count();
    if (parentCount === 0) {
      test.skip(true, 'No parent rows rendered in Work risks table for dataset');
      return;
    }

    let parentWithChildren = null;
    let childrenForParent = null;
    for (let i = 0; i < parentCount; i++) {
      const row = parentRows.nth(i);
      const key = (await row.getAttribute('data-parent-key')) || '';
      if (!key) continue;
      const childRows = table.locator(`tbody tr.work-risk-subtask-row[data-parent-key="${key}"]`);
      const childCount = await childRows.count();
      if (childCount > 0) {
        parentWithChildren = row;
        childrenForParent = childRows;
        break;
      }
    }

    if (!parentWithChildren || !childrenForParent) {
      test.skip(true, 'No parent row with nested subtask rows found for dataset');
      return;
    }

    const ariaExpanded = await parentWithChildren.getAttribute('aria-expanded');
    expect(ariaExpanded === null || ariaExpanded === 'true').toBeTruthy();

    const parentSource = await parentWithChildren.locator('td').nth(0).textContent().catch(() => '');
    expect((parentSource || '').toLowerCase()).not.toContain('subtask');

    const childCount = await childrenForParent.count();
    expect(childCount).toBeGreaterThan(0);
    const firstChild = childrenForParent.first();
    const childSource = await firstChild.locator('td').nth(0).textContent().catch(() => '');
    expect((childSource || '').toLowerCase()).toContain('subtask');

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Accordion toggle hides and shows nested subtask rows', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const table = page.locator('#work-risks-table');
    const visible = await table.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Work risks table hidden for dataset');
      return;
    }

    const parentRows = table.locator('tbody tr.work-risk-parent-row.work-risk-parent-has-children');
    const parentCount = await parentRows.count();
    if (parentCount === 0) {
      test.skip(true, 'No expandable parent rows in Work risks table for dataset');
      return;
    }

    const parentRow = parentRows.first();
    const parentKey = (await parentRow.getAttribute('data-parent-key')) || '';
    if (!parentKey) {
      test.skip(true, 'Expandable parent row missing data-parent-key attribute');
      return;
    }

    const childRows = table.locator(`tbody tr.work-risk-subtask-row[data-parent-key="${parentKey}"]`);
    const childCount = await childRows.count();
    if (childCount === 0) {
      test.skip(true, 'Expandable parent row has no matching subtask rows');
      return;
    }

    const toggle = parentRow.locator('.work-risks-toggle').first();
    const hasToggle = await toggle.isVisible().catch(() => false);
    if (!hasToggle) {
      test.skip(true, 'Expandable parent row missing toggle button');
      return;
    }

    // Initial state: children should be visible.
    const initiallyVisible = await childRows.first().isVisible().catch(() => false);
    expect(initiallyVisible).toBeTruthy();

    await toggle.click();
    const collapsedAria = await parentRow.getAttribute('aria-expanded');
    expect(collapsedAria).toBe('false');

    const anyChildVisibleCollapsed = await childRows.first().isVisible().catch(() => false);
    expect(anyChildVisibleCollapsed).toBeFalsy();

    await toggle.click();
    const expandedAria = await parentRow.getAttribute('aria-expanded');
    expect(expandedAria).toBe('true');
    const childVisibleExpanded = await childRows.first().isVisible().catch(() => false);
    expect(childVisibleExpanded).toBeTruthy();

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Blocker header metric matches unique Stuck >24h issues in Work risks table', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const headerBlockersMetric = page.locator('.header-bar-center .header-metric-link .metric-label', { hasText: 'Blockers' })
      .first()
      .locator('..')
      .locator('.metric-value')
      .first();

    const hasHeaderMetric = await headerBlockersMetric.isVisible().catch(() => false);
    const table = page.locator('#work-risks-table');
    const hasTable = await table.isVisible().catch(() => false);

    if (!hasHeaderMetric || !hasTable) {
      test.skip(true, 'Blocker header metric or Work risks table not visible for dataset');
      return;
    }

    const headerText = (await headerBlockersMetric.textContent().catch(() => '') || '').trim();
    const headerCount = parseInt(headerText.replace(/[^0-9]/g, ''), 10) || 0;

    const blockerRows = table.locator('tbody tr').filter({ hasText: 'Stuck >24h' });
    const blockerRowCount = await blockerRows.count();
    if (blockerRowCount === 0) {
      test.skip(true, 'No Stuck >24h rows in Work risks table for dataset');
      return;
    }

    const uniqueKeys = new Set();
    for (let i = 0; i < blockerRowCount; i++) {
      const row = blockerRows.nth(i);
      const issueCellText = (await row.locator('td').nth(2).textContent().catch(() => '') || '').trim();
      const keyMatch = issueCellText.match(/[A-Z]+-\d+/i);
      if (keyMatch) {
        uniqueKeys.add(keyMatch[0].toUpperCase());
      }
    }

    expect(uniqueKeys.size).toBe(headerCount);

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

