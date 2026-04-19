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

test.describe('Current Sprint - Edge semantics and context trust', () => {
  test('Report context line shows stale badge when filters change without rerun', async ({ page }, testInfo) => {
    const telemetry = captureBrowserTelemetry(page);
    testInfo.attach('telemetry', { body: JSON.stringify(telemetry), contentType: 'application/json' }).catch?.(() => {});

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test, { report: true })) return;

    await page.waitForSelector('#report-context-line', { state: 'attached', timeout: 30000 });
    const contextLine = page.locator('#report-context-line');
    const initialText = ((await contextLine.textContent().catch(() => '')) || '').toLowerCase();

    const firstProjectCheckbox = page.locator('.project-checkbox').first();
    const hasProjectCheckbox = await firstProjectCheckbox.isVisible().catch(() => false);
    if (!hasProjectCheckbox) {
      test.skip(true, 'No project filters available on report page for dataset');
      return;
    }

    await firstProjectCheckbox.click();
    await page.waitForTimeout(500);

    const updatedTextRaw = (await contextLine.textContent().catch(() => '')) || '';
    const updatedText = updatedTextRaw.toLowerCase();
    if (!updatedText.trim()) {
      test.skip(true, 'Context line has no visible text after filter change for this dataset');
      return;
    }
    expect(updatedText).toContain('filters changed; context from last run');

    const telemetryFinal = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetryFinal, { excludePreviewAbort: true });
  });

  test('Work risks excluded-parents message stays non-blocking for high excluded count', async ({ page }, testInfo) => {
    const telemetry = captureBrowserTelemetry(page);
    testInfo.attach('telemetry', { body: JSON.stringify(telemetry), contentType: 'application/json' }).catch?.(() => {});

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    if (await skipIfNoActiveSprint(page, test)) return;

    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });

    const excludedMessage = page.locator('#stuck-card').filter({ hasText: /flowing via subtasks|not counted as (blocked|blockers)/i });
    const visible = await excludedMessage.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'No excluded parent blockers message for dataset');
      return;
    }

    const text = ((await page.locator('#stuck-card').textContent().catch(() => '')) || '').toLowerCase();
    expect(text).toMatch(/not counted as (blocked|blockers)/);

    const telemetryFinal = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetryFinal, { excludePreviewAbort: true });
  });
});

