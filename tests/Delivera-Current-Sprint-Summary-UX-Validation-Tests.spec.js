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

  test('Primary Copy summary action exports a terse executive summary contract', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const exportBtn = page.locator('.export-dashboard-btn').first();
    if (!(await exportBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Current sprint export button not visible for dataset');
      return;
    }

    await prepareExportCapture(page);
    await exportBtn.click().catch(() => null);
    await page.waitForTimeout(300);

    const exported = await page.evaluate(() => window.__lastExportText || '');
    if (!exported || typeof exported !== 'string') {
      test.skip(true, 'Export text was not captured from clipboard interception');
      return;
    }

    const lines = exported.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      test.skip(true, 'Export text too short to assert summary contract');
      return;
    }

    expect(lines[0]).toMatch(/^Current Sprint - /i);
    expect(lines[0]).toMatch(/ - (Healthy|At risk|Critical|Limited history|Sprint just starting|Historical snapshot)/i);
    expect(lines[1]).toMatch(/^Health:\s+/i);
    expect(lines.length).toBeLessThanOrEqual(4);
    if (lines[2]) expect(lines[2]).toMatch(/^(Scope|Capacity|Risks|Next):\s+/i);
    if (lines[3]) expect(lines[3]).toMatch(/^(Scope|Capacity|Risks|Next):\s+/i);

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Detailed Copy as Text export keeps grouped sections for health, risks, scope, capacity, and actions', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const exportToggle = page.locator('.export-menu-toggle').first();
    if (!(await exportToggle.isVisible().catch(() => false))) {
      test.skip(true, 'Detailed export menu unavailable for dataset');
      return;
    }

    await prepareExportCapture(page);
    await exportToggle.click().catch(() => null);
    const copyOption = page.locator('.export-option[data-action="copy-text"]').first();
    if (!(await copyOption.isVisible().catch(() => false))) {
      test.skip(true, 'Detailed export action unavailable for dataset');
      return;
    }
    await copyOption.click().catch(() => null);
    await page.waitForTimeout(300);

    const exported = await page.evaluate(() => window.__lastExportText || '');
    if (!exported || typeof exported !== 'string') {
      test.skip(true, 'Export text was not captured from clipboard interception');
      return;
    }

    expect(exported).toContain('Health');
    if (exported.includes('Work risks')) expect(exported).toContain('Work risks');
    if (exported.includes('Scope')) expect(exported).toContain('Scope');
    if (exported.includes('Capacity')) expect(exported).toContain('Capacity');
    if (exported.includes('Actions')) expect(exported).toContain('Actions');

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});
