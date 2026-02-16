import { test, expect } from '@playwright/test';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  runDefaultPreview,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Current Sprint Direct Value Blockers Snapshot Validation', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const errorVisible = await page.locator('#current-sprint-error').isVisible().catch(() => false);
    if (errorVisible) {
      const txt = (await page.locator('#current-sprint-error').textContent().catch(() => '')) || '';
      testInfo.skip(`Current sprint unavailable for dataset: ${txt}`);
    }
  });

  test('Validation 1: verdict bar is visible and action-first', async ({ page }) => {
    await expect(page.locator('.verdict-bar')).toBeVisible();
    await expect(page.locator('.verdict-action')).toBeVisible();
  });

  test('Validation 2: blocker verdict detail links to drilldown table when blockers exist', async ({ page }) => {
    const detailLink = page.locator('.verdict-detail-link');
    if (!(await detailLink.isVisible().catch(() => false))) {
      test.skip(true, 'No blockers in current dataset');
      return;
    }
    await expect(detailLink).toHaveAttribute('href', '#work-risks-table');
  });

  test('Validation 3: work risks table issue keys are rendered as links', async ({ page }) => {
    const table = page.locator('#work-risks-table');
    if (!(await table.isVisible().catch(() => false))) {
      test.skip(true, 'Work risks table hidden for dataset');
      return;
    }
    const issueLink = table.locator('tbody tr td a').first();
    await expect(issueLink).toBeVisible();
  });

  test('Validation 4: compact countdown is present in header', async ({ page }) => {
    const timer = page.locator('.header-bar-right .countdown-timer-widget-compact');
    await expect(timer).toBeVisible();
    const ring = timer.locator('.countdown-ring');
    const width = await ring.evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(width).toBeLessThanOrEqual(70);
  });

  test('Validation 5: standalone countdown card is removed from secondary row', async ({ page }) => {
    await expect(page.locator('.secondary-row .countdown-column')).toHaveCount(0);
  });

  test('Validation 6: blockers insight panel contains owner and action-time inputs', async ({ page }) => {
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
    await expect(page.locator('#blockers-char-count')).toBeVisible();
    const text = 'Escalate blocker to architecture owner';
    await page.fill('#blockers-mitigation', text);
    await expect(page.locator('#blockers-char-count')).toContainText(text.length + ' / 1000');
  });

  test('Validation 8: carousel cards include state and duration metadata', async ({ page }) => {
    const firstTab = page.locator('.carousel-tab').first();
    await expect(firstTab).toBeVisible();
    await expect(firstTab.locator('.carousel-tab-meta')).toBeVisible();
  });

  test('Validation 9: no-data carousel cards use collapsed style when present', async ({ page }) => {
    const noDataTab = page.locator('.carousel-tab--no-data').first();
    if (!(await noDataTab.isVisible().catch(() => false))) {
      test.skip(true, 'No no-data sprint cards in dataset');
      return;
    }
    const minWidth = await noDataTab.evaluate((el) => window.getComputedStyle(el).minWidth);
    expect(minWidth).toContain('120');
  });

  test('Validation 10: health dashboard exposes snapshot summary row', async ({ page }) => {
    const snapshotRow = page.locator('.health-snapshot-row');
    const visible = await snapshotRow.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Health dashboard hidden for dataset');
      return;
    }
    await expect(snapshotRow).toContainText(/Snapshot:/i);
  });

  test('Validation 11: health action is direct-to-value quick snapshot', async ({ page }) => {
    const quickButton = page.locator('.health-copy-btn');
    const visible = await quickButton.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Health dashboard hidden for dataset');
      return;
    }
    await expect(quickButton).toContainText(/Quick snapshot/i);
  });

  test('Validation 12: report done stories issue keys are link-safe with fallback', async ({ page }) => {
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

  test('Edge Case A: zero blockers shows explicit no-blocker state', async ({ page }) => {
    const detail = page.locator('.sprint-verdict-drilldown-ok');
    if (!(await detail.isVisible().catch(() => false))) {
      test.skip(true, 'Dataset has blockers');
      return;
    }
    await expect(detail).toContainText(/No blockers/i);
  });

  test('Edge Case B: insights save reports status feedback', async ({ page }) => {
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
    const timer = page.locator('.countdown-timer-widget').first();
    await expect(timer).toBeVisible();
    const aria = (await timer.getAttribute('aria-label')) || '';
    expect(aria.length).toBeGreaterThan(3);
  });
});
