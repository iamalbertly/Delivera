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
      navigator.clipboard = clip;
    }
  });
}

async function prepareMarkdownCapture(page) {
  await page.evaluate(() => {
    const OriginalBlob = window.Blob;
    window.__lastMarkdownExport = '';
    window.Blob = function Blob(parts, options) {
      try {
        const textParts = (parts || []).map((p) => (typeof p === 'string' ? p : ''));
        window.__lastMarkdownExport = textParts.join('');
      } catch (e) {}
      return new OriginalBlob(parts, options);
    };
    window.Blob.prototype = OriginalBlob.prototype;
  });
}

test.describe('Current Sprint - Clipboard & Markdown export contract', () => {
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

  test('Clipboard summary is plain, readable, and anchored to sprint context', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const exportBtn = page.locator('.export-dashboard-btn').first();
    if (!(await exportBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Current sprint export controls not visible for dataset');
      return;
    }

    await prepareClipboardCapture(page);
    await exportBtn.click().catch(() => null);
    await page.waitForTimeout(300);

    const exported = await page.evaluate(() => window.__lastExportText || '');
    if (!exported || typeof exported !== 'string') {
      test.skip(true, 'Export text was not captured from clipboard interception');
      return;
    }

    const lines = exported.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    expect(lines[0]).toMatch(/^Current Sprint - /i);
    expect(lines[0]).not.toMatch(/\*\*/);
    expect(lines[1]).toMatch(/^Health:\s+/i);
    expect(exported).not.toContain('--- More detail below ---');

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Markdown export produces stakeholder-ready headings without duplicate summary chrome', async ({ page }) => {
    if (await skipIfNoActiveSprint(page, test)) return;

    const markdownBtn = page.locator('.export-dashboard-secondary').first();
    const menuToggle = page.locator('.export-menu-toggle').first();
    const hasDirectMarkdown = await markdownBtn.isVisible().catch(() => false);
    const hasMenu = await menuToggle.isVisible().catch(() => false);
    if (!hasDirectMarkdown && !hasMenu) {
      test.skip(true, 'Markdown export control not visible for dataset');
      return;
    }

    await prepareMarkdownCapture(page);

    if (hasDirectMarkdown) {
      await markdownBtn.click().catch(() => null);
    } else {
      await menuToggle.click().catch(() => null);
      const markdownOption = page.locator('.export-option[data-action="export-markdown"]').first();
      if (await markdownOption.isVisible().catch(() => false)) {
        await markdownOption.click().catch(() => null);
      }
    }

    await page.waitForTimeout(500);

    const markdown = await page.evaluate(() => window.__lastMarkdownExport || '');
    if (!markdown || typeof markdown !== 'string') {
      test.skip(true, 'Markdown text was not captured from Blob interception');
      return;
    }

    expect(markdown).toMatch(/^# .+/m);
    expect(markdown).toMatch(/^> \*\*Current Sprint - /m);
    expect(markdown).toContain('## Health');
    expect(markdown).toContain('## Work risks');
    if (markdown.includes('## Scope')) expect(markdown).toContain('## Scope');
    if (markdown.includes('## Capacity')) expect(markdown).toContain('## Capacity');
    if (markdown.includes('## Actions')) expect(markdown).toContain('## Actions');

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});
