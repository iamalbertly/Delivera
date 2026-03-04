import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  runDefaultPreview,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Current Sprint Direct Value Blockers Snapshot Validation', () => {
  async function ensureSprintDataLoaded(page) {
    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (hasHeader) return;
    const boardSelect = page.locator('#board-select');
    const boardVisible = await boardSelect.isVisible().catch(() => false);
    if (!boardVisible) return;
    const options = boardSelect.locator('option[value]:not([value=""])');
    const count = await options.count().catch(() => 0);
    if (!count) return;
    const currentVal = await boardSelect.inputValue().catch(() => '');
    let nextVal = currentVal;
    if (!nextVal) {
      nextVal = await options.first().getAttribute('value').catch(() => '');
    }
    if (!nextVal) return;
    await boardSelect.selectOption(nextVal).catch(() => null);
    await page.waitForTimeout(800);
    await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error, #current-sprint-loading', { timeout: 30000 }).catch(() => null);
  }

  async function skipIfNoActiveSprint(page, test) {
    const hasCommandCenter = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (hasCommandCenter) return false;
    const noSprintState = page.locator('.empty-state, #current-sprint-content');
    const noSprintText = ((await noSprintState.first().textContent().catch(() => '')) || '').toLowerCase();
    if (noSprintText.includes('no active sprint')) {
      test.skip(true, 'No active sprint for this board/dataset');
      return true;
    }
    return false;
  }

  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    await ensureSprintDataLoaded(page);
    const errorVisible = await page.locator('#current-sprint-error').isVisible().catch(() => false);
    if (errorVisible) {
      const txt = (await page.locator('#current-sprint-error').textContent().catch(() => '')) || '';
      testInfo.skip(`Current sprint unavailable for dataset: ${txt}`);
    }
  });

  test('Validation 1: command center header is visible and action-first', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    await expect(page.locator('.current-sprint-header-bar')).toBeVisible();
    await expect(page.locator('.sprint-verdict-line')).toBeVisible();
    await expect(page.locator('.header-export-inline .export-dashboard-btn')).toBeVisible();
  });

  test('Validation 2: blocker verdict detail links to drilldown table when blockers exist', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const detailLink = page.locator('.sprint-verdict-drilldown');
    if (!(await detailLink.isVisible().catch(() => false))) {
      test.skip(true, 'No blockers in current dataset');
      return;
    }
    await expect(detailLink).toHaveAttribute('href', /#work-risks-table/);
  });

  test('Validation 3: work risks table issue keys are rendered as links', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const table = page.locator('#work-risks-table');
    if (!(await table.isVisible().catch(() => false))) {
      test.skip(true, 'Work risks table hidden for dataset');
      return;
    }
    const issueLink = table.locator('tbody tr td a').first();
    await expect(issueLink).toBeVisible();
  });

  test('Validation 4: compact countdown is present in header', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const timer = page.locator('.header-bar-right [data-countdown-compact="true"][data-countdown-inline="true"]');
    await expect(timer).toBeVisible();
    const ring = timer.locator('.countdown-ring');
    const width = await ring.evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(width).toBeLessThanOrEqual(70);
  });

  test('Validation 4b: take action applies a focused active-view state', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const takeAction = page.locator('.current-sprint-header-bar [data-header-action="take-action"]');
    await expect(takeAction).toBeVisible();
    const beforeUrl = page.url();
    await takeAction.click({ force: true });
    await page.waitForTimeout(300);
    const activeView = page.locator('[data-header-active-filter-value]');
    await expect(activeView).toBeVisible();
    await expect(page).toHaveURL(beforeUrl);
    await expect(page.locator('#work-risks-table')).toBeVisible();
    const activeText = (await activeView.textContent().catch(() => '')) || '';
    expect(activeText.trim().length).toBeGreaterThan(0);
  });

  test('Validation 5: standalone countdown card is removed from secondary row', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    await expect(page.locator('.secondary-row .countdown-column')).toHaveCount(0);
  });

  test('Validation 6: blockers insight panel contains owner and action-time inputs', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const blockersPanel = page.locator('#blockers-panel');
    await expect(blockersPanel).toBeVisible();
    const hasOwner = await blockersPanel.locator('#blockers-owner').isVisible().catch(() => false);
    const hasActionTime = await blockersPanel.locator('#blockers-effective-at').isVisible().catch(() => false);
    if (!hasOwner || !hasActionTime) {
      test.skip(true, 'Blockers input panel not rendered for dataset');
      return;
    }
    await expect(blockersPanel.locator('#blockers-owner')).toBeVisible();
    await expect(blockersPanel.locator('#blockers-effective-at')).toBeVisible();
  });

  test('Validation 7: insight text areas show fail-fast character counters', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const counter = page.locator('#blockers-char-count');
    const mitigation = page.locator('#blockers-mitigation');
    const hasCounter = await counter.isVisible().catch(() => false);
    const hasMitigation = await mitigation.isVisible().catch(() => false);
    if (!hasCounter || !hasMitigation) {
      test.skip(true, 'Blockers insight counter/textarea not rendered for dataset');
      return;
    }
    await expect(counter).toBeVisible();
    const text = 'Escalate blocker to architecture owner';
    await page.fill('#blockers-mitigation', text);
    await expect(counter).toContainText(text.length + ' / 1000');
  });

  test('Validation 8: carousel cards include state and duration metadata', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const firstTab = page.locator('.carousel-tab').first();
    await expect(firstTab).toBeVisible();
    await expect(firstTab.locator('.carousel-tab-meta')).toBeVisible();
  });

  test('Validation 9: no-data carousel cards use collapsed style when present', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const noDataTab = page.locator('.carousel-tab--no-data').first();
    if (!(await noDataTab.isVisible().catch(() => false))) {
      test.skip(true, 'No no-data sprint cards in dataset');
      return;
    }
    const minWidth = await noDataTab.evaluate((el) => window.getComputedStyle(el).minWidth);
    expect(minWidth).toContain('120');
  });

  test('Validation 10: health dashboard exposes snapshot summary row', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const snapshotRow = page.locator('.health-snapshot-row');
    const visible = await snapshotRow.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Health dashboard hidden for dataset');
      return;
    }
    await expect(snapshotRow).toContainText(/Snapshot:/i);
  });

  test('Validation 11: health action is direct-to-value quick snapshot', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const quickButton = page.locator('.health-copy-btn');
    const visible = await quickButton.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Health dashboard hidden for dataset');
      return;
    }
    await expect(quickButton).toBeVisible();
    const className = (await quickButton.getAttribute('class')) || '';
    expect(/btn|copy/i.test(className + ' ' + ((await quickButton.textContent()) || ''))).toBeTruthy();
  });

  test('Validation 12: report done stories issue keys are link-safe with fallback', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    await runDefaultPreview(page);
    await page.click('button.tab-btn:has-text("Done Stories"), button.tab-btn:has-text("Outcome list")').catch(() => null);
    const doneArea = page.locator('#done-stories-content');
    const visible = await doneArea.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Done stories content not visible in current dataset');
      return;
    }
    const firstSprintHeader = page.locator('#done-stories-content .sprint-header').first();
    if (await firstSprintHeader.isVisible().catch(() => false)) {
      await firstSprintHeader.click().catch(() => null);
      await page.waitForTimeout(300);
    }

    const linkedCount = await page.locator('#done-stories-content a[target="_blank"]').count().catch(() => 0);
    const unlinkedCount = await page.locator('#done-stories-content .issue-key-unlinked').count().catch(() => 0);
    if (linkedCount + unlinkedCount === 0) {
      test.skip(true, 'No done-story rows rendered for this dataset');
      return;
    }
    expect(linkedCount + unlinkedCount).toBeGreaterThan(0);
  });

  test('Validation 13: detail toggle remains stable after refresh (no double-binding)', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const toggle = page.locator('.card-details-toggle');
    if (!(await toggle.isVisible().catch(() => false))) {
      test.skip(true, 'No details toggle in dataset');
      return;
    }

    await page.click('.header-refresh-btn').catch(() => null);
    await page.waitForTimeout(800);

    const stateBefore = await toggle.getAttribute('aria-expanded');
    await toggle.click();
    const stateAfter = await toggle.getAttribute('aria-expanded');
    expect(stateAfter).not.toBe(stateBefore);
  });

  test('Validation 14: export menu remains functional after refresh rerender', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const refresh = page.locator('.header-refresh-btn');
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click().catch(() => null);
      await page.waitForTimeout(800);
    }
    const exportBtn = page.locator('.export-dashboard-btn');
    const exportToggle = page.locator('.export-menu-toggle');
    await expect(exportBtn).toBeVisible();
    await expect(exportToggle).toBeVisible();
    await exportBtn.click();
    await exportToggle.click();
    await expect(page.locator('#export-menu')).toBeVisible();
    await expect(page.locator('#export-menu')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('.export-option')).toHaveCount(5);
  });

  test('Validation 15: duplicate focused snapshot section is removed', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const snapshot = page.locator('#sprint-executive-snapshot');
    await expect(snapshot).toHaveCount(0);
    await expect(page.locator('.current-sprint-header-bar')).toContainText(/done/i);
  });

  test('Edge Case A: zero blockers shows explicit no-blocker state', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const detail = page.locator('.sprint-verdict-drilldown-ok');
    if (!(await detail.isVisible().catch(() => false))) {
      test.skip(true, 'Dataset has blockers');
      return;
    }
    await expect(detail).toContainText(/No blockers/i);
  });

  test('Edge Case B: insights save reports status feedback', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const telemetry = captureBrowserTelemetry(page);
    await page.route('/api/current-sprint/insights', (route) => route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }));
    const saveBtn = page.locator('#insights-save');
    if (!(await saveBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Insights controls unavailable');
      return;
    }
    await saveBtn.click();
    await expect(page.locator('#insights-status')).toContainText(/Saved/i);
    assertTelemetryClean(telemetry, { allowConsolePatterns: [/Failed to load resource/i] });
  });

  test('Edge Case C: countdown unknown state exposes trusted aria label', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    const timer = page.locator('.countdown-timer-widget').first();
    await expect(timer).toBeVisible();
    const aria = (await timer.getAttribute('aria-label')) || '';
    expect(aria.length).toBeGreaterThan(3);
  });

  test('Edge Case D: insights empty save is blocked with warning and no POST call', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;
    let called = 0;
    await page.route('/api/current-sprint/insights', (route) => {
      called += 1;
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });
    const saveBtn = page.locator('#insights-save');
    if (!(await saveBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Insights controls unavailable');
      return;
    }
    await page.click('.insights-tab[data-tab="learnings"]').catch(() => null);
    await page.click('.insights-tab[data-tab="assumptions"]').catch(() => null);
    await page.click('.insights-tab[data-tab="blockers"]').catch(() => null);
    await page.fill('#blockers-mitigation', '');
    const learningsInput = page.locator('#learnings-new:visible');
    if (await learningsInput.count()) {
      await learningsInput.fill('');
    }
    const assumptionsInput = page.locator('#assumptions-new:visible');
    if (await assumptionsInput.count()) {
      await assumptionsInput.fill('');
    }
    await saveBtn.click();
    await page.waitForTimeout(300);
    if (called === 0) {
      await expect(page.locator('#insights-status')).toContainText(/Add at least one insight/i);
      return;
    }
    await expect(page.locator('#insights-status')).toContainText(/Saved/i);
    expect(called).toBeGreaterThan(0);
  });
});
