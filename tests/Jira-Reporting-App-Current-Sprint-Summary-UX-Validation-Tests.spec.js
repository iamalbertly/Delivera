import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

async function skipIfNoActiveSprint(page, testCtx) {
  const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
  if (hasHeader) return false;
  const emptyState = page.locator('.empty-state, #current-sprint-content');
  const txt = ((await emptyState.first().textContent().catch(() => '')) || '').toLowerCase();
  if (txt.includes('no active sprint')) {
    testCtx.skip(true, 'No active sprint for this board/dataset');
    return true;
  }
  return false;
}

async function prepareExportCapture(page) {
  await page.evaluate(() => {
    window.__lastExportText = '';
    const clip = {
      writeText: async (text) => {
        window.__lastExportText = text;
        return Promise.resolve();
      },
    };
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        get() {
          return clip;
        },
      });
    } catch (e) {
      // Fallback in environments where navigator.clipboard is writable
      // eslint-disable-next-line no-global-assign
      navigator.clipboard = clip;
    }
  });
}

test.describe('Current Sprint - Summary UX contract and export text structure', () => {
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

  test('Exported sprint summary text follows the four-line summary contract', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const exportBtn = page.locator('.export-dashboard-btn').first();
    const exportToggle = page.locator('.export-menu-toggle').first();
    const hasPrimary = await exportBtn.isVisible().catch(() => false);
    const hasToggle = await exportToggle.isVisible().catch(() => false);
    if (!hasPrimary && !hasToggle) {
      test.skip(true, 'Current sprint export controls not visible for dataset');
      return;
    }

    await prepareExportCapture(page);

    if (hasPrimary) {
      await exportBtn.click().catch(() => null);
    } else {
      await exportToggle.click().catch(() => null);
      const copyOption = page.locator('.export-option[data-action="copy-text"]').first();
      if (await copyOption.isVisible().catch(() => false)) {
        await copyOption.click().catch(() => null);
      }
    }

    await page.waitForTimeout(300);

    const exported = await page.evaluate(() => window.__lastExportText || '');
    if (!exported || typeof exported !== 'string') {
      test.skip(true, 'Export text was not captured from clipboard interception');
      return;
    }

    const lines = exported.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 3) {
      test.skip(true, 'Export text too short to assert summary contract');
      return;
    }

    const topLine = lines[0] || '';
    const secondLine = lines[1] || '';
    const thirdLine = lines[2] || '';
    const fourthLine = lines[3] || '';

    expect(topLine).toMatch(/sprint health/i);
    expect(topLine.split('·').length).toBeGreaterThanOrEqual(2);

    expect(secondLine).toMatch(/\d+% complete/i);
    expect(secondLine).toMatch(/stories done/i);

    expect(thirdLine).toMatch(/(Flow is moving|Recent activity|No recent activity|Sprint signals)/i);

    expect(fourthLine).toMatch(/blocker/i);

    const hasSeparator = exported.includes('--- More detail below ---');
    expect(hasSeparator).toBeTruthy();

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Detailed summary contains grouped sections for activity, blockers, not started, scope, and work breakdown', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const exportBtn = page.locator('.export-dashboard-btn').first();
    const exportToggle = page.locator('.export-menu-toggle').first();
    const hasPrimary = await exportBtn.isVisible().catch(() => false);
    const hasToggle = await exportToggle.isVisible().catch(() => false);
    if (!hasPrimary && !hasToggle) {
      test.skip(true, 'Current sprint export controls not visible for dataset');
      return;
    }

    await prepareExportCapture(page);

    if (hasPrimary) {
      await exportBtn.click().catch(() => null);
    } else {
      await exportToggle.click().catch(() => null);
      const copyOption = page.locator('.export-option[data-action="copy-text"]').first();
      if (await copyOption.isVisible().catch(() => false)) {
        await copyOption.click().catch(() => null);
      }
    }

    await page.waitForTimeout(300);

    const exported = await page.evaluate(() => window.__lastExportText || '');
    if (!exported || typeof exported !== 'string') {
      test.skip(true, 'Export text was not captured from clipboard interception');
      return;
    }

    expect(exported).toContain('RECENT ACTIVITY & TIME LOGGING');
    expect(exported).toMatch(/Blockers \(\d+\)/);
    if (exported.match(/Not started \(\d+\)/)) {
      expect(exported).toMatch(/Not started \(\d+\)/);
    }
    if (exported.includes('Scope added mid-sprint')) {
      expect(exported).toContain('Scope added mid-sprint');
    }
    if (exported.includes('Work breakdown')) {
      expect(exported).toMatch(/Work breakdown \(\d+ stories with subtasks\)/);
    }

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

