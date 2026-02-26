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

test.describe('Current Sprint - Blockers Trust Validation', () => {
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

  test('header blocker verdict pill count matches Work risks table when visible', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const headerBlockerPill = page.locator('.sprint-verdict-line .verdict-pill[data-risk-tags="blocker"]').first();

    const hasHeaderMetric = await headerBlockerPill.isVisible().catch(() => false);
    const blockerStrip = page.locator('#stuck-card .work-risk-blocker-strip').first();
    const hasStrip = await blockerStrip.isVisible().catch(() => false);

    if (!hasHeaderMetric || !hasStrip) {
      test.skip(true, 'Blocker verdict pill or Work risks blocker strip not visible for dataset');
      return;
    }

    const headerText = (await headerBlockerPill.textContent().catch(() => '') || '').trim();
    const headerCount = parseInt(headerText.replace(/[^0-9]/g, ''), 10) || 0;

    await expect(blockerStrip.locator('strong').first()).toContainText(/Blocker issues/i);
    const table = page.locator('#work-risks-table');
    const tableVisible = await table.isVisible().catch(() => false);
    if (!tableVisible) {
      expect(headerCount).toBeGreaterThanOrEqual(0);
      const telemetry = captureBrowserTelemetry(page);
      assertTelemetryClean(telemetry, { excludePreviewAbort: true });
      return;
    }
    const showMore = page.locator('.work-risks-show-more').first();
    if (await showMore.isVisible().catch(() => false)) {
      await showMore.click();
    }
    const blockerRows = table.locator('tbody tr').filter({ hasText: 'Stuck >24h' });
    const blockerRowCount = await blockerRows.count();
    const uniqueKeys = new Set();
    for (let i = 0; i < blockerRowCount; i++) {
      const row = blockerRows.nth(i);
      const issueCellText = (await row.locator('td').nth(2).textContent().catch(() => '') || '').trim();
      const keyMatch = issueCellText.match(/[A-Z]+-\d+/i);
      if (keyMatch) uniqueKeys.add(keyMatch[0].toUpperCase());
    }
    expect(headerCount).toBe(uniqueKeys.size);

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Work risks table marks parent vs subtask blockers in Risk column', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const table = page.locator('#work-risks-table');
    const visible = await table.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Work risks table hidden for dataset');
      return;
    }

    const parentRow = table.locator('tbody tr').filter({ hasText: 'Stuck >24h (Parent)' }).first();
    const hasParentRow = await parentRow.isVisible().catch(() => false);
    const subtaskRow = table.locator('tbody tr').filter({ hasText: 'Stuck >24h (Subtask)' }).first();
    const hasSubtaskRow = await subtaskRow.isVisible().catch(() => false);

    if (!hasParentRow && !hasSubtaskRow) {
      test.skip(true, 'No explicit parent/subtask blocker rows in dataset');
      return;
    }

    if (hasParentRow) {
      const parentSource = await parentRow.locator('td').nth(0).textContent().catch(() => '');
      const parentRisk = await parentRow.locator('td').nth(1).textContent().catch(() => '');
      expect((parentSource || '').toLowerCase()).toContain('flow');
      expect(parentRisk || '').toContain('Parent');
    }

    if (hasSubtaskRow) {
      const subtaskSource = await subtaskRow.locator('td').nth(0).textContent().catch(() => '');
      const subtaskRisk = await subtaskRow.locator('td').nth(1).textContent().catch(() => '');
      expect((subtaskSource || '').toLowerCase()).toContain('subtask');
      expect(subtaskRisk || '').toContain('Subtask');
    }

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Excluded parent stories message is shown when present', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const excludedLine = page.locator('#stuck-card .meta-row').filter({ hasText: 'flowing via subtasks and are not counted as blockers' }).first();
    const visible = await excludedLine.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'No excluded parent blockers message for dataset');
      return;
    }

    const text = (await excludedLine.textContent().catch(() => '') || '').trim();
    expect(text.toLowerCase()).toContain('not counted as blockers');

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});
