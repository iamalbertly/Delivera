import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
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

test.describe('Current Sprint - Blockers Edge Cases Validation', () => {
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

  test('Edge: many excluded parents and few blockers keep verdict at Healthy/Caution, not Critical', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const headerBlockersMetric = page.locator('.header-bar-center .header-metric-link .metric-label', { hasText: 'Blockers' })
      .first()
      .locator('..')
      .locator('.metric-value')
      .first();
    const hasHeaderMetric = await headerBlockersMetric.isVisible().catch(() => false);
    if (!hasHeaderMetric) {
      test.skip(true, 'Blockers metric not visible');
      return;
    }

    const headerText = (await headerBlockersMetric.textContent().catch(() => '') || '').trim();
    const headerCount = parseInt(headerText.replace(/[^0-9]/g, ''), 10) || 0;

    const excludedLine = page.locator('#stuck-card .meta-row').filter({ hasText: 'flowing via subtasks and are not counted as blockers' }).first();
    const excludedVisible = await excludedLine.isVisible().catch(() => false);
    if (!(excludedVisible && headerCount > 0 && headerCount <= 2)) {
      test.skip(true, 'Dataset does not represent \"few blockers, many excluded parents\" scenario');
      return;
    }

    const verdictLine = page.locator('.sprint-verdict-line').first();
    const verdictText = (await verdictLine.textContent().catch(() => '') || '').toLowerCase();
    expect(verdictText).not.toContain('critical');

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Edge: zero blockers but excluded parents still show positive state', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const headerBlockersMetric = page.locator('.header-bar-center .header-metric-link .metric-label', { hasText: 'Blockers' })
      .first()
      .locator('..')
      .locator('.metric-value')
      .first();
    const hasHeaderMetric = await headerBlockersMetric.isVisible().catch(() => false);
    if (!hasHeaderMetric) {
      test.skip(true, 'Blockers metric not visible');
      return;
    }

    const headerText = (await headerBlockersMetric.textContent().catch(() => '') || '').trim();
    const headerCount = parseInt(headerText.replace(/[^0-9]/g, ''), 10) || 0;

    const excludedLine = page.locator('#stuck-card .meta-row').filter({ hasText: 'flowing via subtasks and are not counted as blockers' }).first();
    const excludedVisible = await excludedLine.isVisible().catch(() => false);

    if (!(excludedVisible && headerCount === 0)) {
      test.skip(true, 'Dataset does not represent \"zero blockers with excluded parents\" scenario');
      return;
    }

    const noBlockersDetail = page.locator('.sprint-verdict-drilldown-ok');
    await expect(noBlockersDetail).toBeVisible();
    await expect(noBlockersDetail).toContainText(/No blockers/i);

    const verdictLine = page.locator('.sprint-verdict-line').first();
    const verdictText = (await verdictLine.textContent().catch(() => '') || '').toLowerCase();
    expect(verdictText).not.toContain('critical');

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Edge: only stuck subtasks still counted as blockers', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const table = page.locator('#work-risks-table');
    const visible = await table.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Work risks table hidden for dataset');
      return;
    }

    const parentRows = await table.locator('tbody tr').filter({ hasText: 'Stuck >24h (Parent)' }).count().catch(() => 0);
    const subtaskRows = await table.locator('tbody tr').filter({ hasText: 'Stuck >24h (Subtask)' }).count().catch(() => 0);

    if (!(subtaskRows > 0 && parentRows === 0)) {
      test.skip(true, 'Dataset does not represent \"only stuck subtasks\" scenario');
      return;
    }

    const headerBlockersMetric = page.locator('.header-bar-center .header-metric-link .metric-label', { hasText: 'Blockers' })
      .first()
      .locator('..')
      .locator('.metric-value')
      .first();
    const hasHeaderMetric = await headerBlockersMetric.isVisible().catch(() => false);
    if (!hasHeaderMetric) {
      test.skip(true, 'Blockers metric not visible');
      return;
    }

    const headerText = (await headerBlockersMetric.textContent().catch(() => '') || '').trim();
    const headerCount = parseInt(headerText.replace(/[^0-9]/g, ''), 10) || 0;

    expect(headerCount).toBeGreaterThan(0);
    expect(subtaskRows).toBeGreaterThan(0);

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

