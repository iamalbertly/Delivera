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

test.describe('Current Sprint - Burndown truthfulness and SP configuration', () => {
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

  test('Burndown card uses precise copy for SP configuration states', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const card = page.locator('#burndown-card');
    const visible = await card.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Burndown card hidden for dataset');
      return;
    }

    const text = ((await card.textContent().catch(() => '')) || '').toLowerCase();

    // Legacy misleading copy should never appear.
    expect(text).not.toContain('story points are not configured');

    // If we are in "field not configured" mode, the new copy must be present.
    if (text.includes('field is not configured for this board')) {
      expect(text).toContain('burndown by story count');
      expect(text).not.toContain('remaining sp');
    }

    // If we are in "0 SP in this sprint" mode, the new copy must be present.
    if (text.includes('this sprint’s stories currently total 0 sp') || text.includes("this sprint's stories currently total 0 sp")) {
      expect(text).toContain('burndown by story count');
    }

    // If we are in "no story points completed yet" mode, ensure message is aligned.
    if (text.includes('no story points completed in this sprint yet')) {
      expect(text).toContain('this sprint currently totals 0 sp');
    }

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('SP burndown path shows SP-focused copy without story-count fallback text', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const card = page.locator('#burndown-card');
    const visible = await card.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Burndown card hidden for dataset');
      return;
    }

    const text = ((await card.textContent().catch(() => '')) || '').toLowerCase();

    const hasSpChart = text.includes('remaining sp');
    if (!hasSpChart) {
      test.skip(true, 'Dataset does not expose SP burndown path for this sprint');
      return;
    }

    expect(text).not.toContain('burndown by story count');

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

