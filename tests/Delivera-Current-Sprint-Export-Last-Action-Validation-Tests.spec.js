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

async function prepareClipboardCapture(page) {
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
      // eslint-disable-next-line no-global-assign
      navigator.clipboard = clip;
    }
  });
}

test.describe('Current Sprint - Export last action status contract', () => {
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

  test('Last export status line updates for Copy summary and Copy link actions', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const exportBtn = page.locator('.export-dashboard-btn').first();
    const exportToggle = page.locator('.export-menu-toggle').first();
    const hasPrimary = await exportBtn.isVisible().catch(() => false);
    const hasToggle = await exportToggle.isVisible().catch(() => false);
    if (!hasPrimary && !hasToggle) {
      test.skip(true, 'Current sprint export controls not visible for dataset');
      return;
    }

    await prepareClipboardCapture(page);

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

    const statusEl = page.locator('.export-dashboard-container .export-status-text').first();
    const statusTextAfterCopy = (await statusEl.innerText().catch(() => '')) || '';
    expect(statusTextAfterCopy).toMatch(/Last action:\s*Copy summary/i);
    expect(statusTextAfterCopy).toMatch(/·/);

    // Use the shared status helper directly to simulate a second export action.
    await page.evaluate(() => {
      if (typeof window !== 'undefined' && typeof window.__setCurrentSprintLastExportStatus === 'function') {
        window.__setCurrentSprintLastExportStatus('Copy link', 'Simulated link share');
      }
    });

    await page.waitForTimeout(300);

    const statusTextAfterLink = (await statusEl.innerText().catch(() => '')) || '';
    expect(statusTextAfterLink).toMatch(/Last action:/i);
    expect(statusTextAfterLink).not.toEqual(statusTextAfterCopy);

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

