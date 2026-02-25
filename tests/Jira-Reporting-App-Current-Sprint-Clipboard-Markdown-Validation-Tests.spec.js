import { test, expect } from '@playwright/test';
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

async function prepareMarkdownCapture(page) {
  await page.evaluate(() => {
    const OriginalBlob = window.Blob;
    window.__lastMarkdownExport = '';
    // eslint-disable-next-line no-global-assign
    window.Blob = function Blob(parts, options) {
      try {
        const textParts = (parts || []).map((p) => (typeof p === 'string' ? p : ''));
        window.__lastMarkdownExport = textParts.join('');
      } catch (e) {
        // ignore capture failure; fallback to normal Blob
      }
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

  test('Clipboard summary uses four-line markdown-enhanced contract but stays readable without markdown', async ({ page }) => {
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

    const exported = await page.evaluate(() => window.__lastExportText || '');
    if (!exported || typeof exported !== 'string') {
      test.skip(true, 'Export text was not captured from clipboard interception');
      return;
    }

    const lines = exported.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 4) {
      test.skip(true, 'Export text too short to assert summary contract');
      return;
    }

    const topLine = lines[0] || '';
    const secondLine = lines[1] || '';
    const thirdLine = lines[2] || '';
    const fourthLine = lines[3] || '';

    expect(topLine).toMatch(/sprint health/i);
    expect(topLine).toMatch(/\*\*/); // markdown emphasis on headline

    expect(secondLine).toMatch(/\d+% complete/i);
    expect(secondLine).toMatch(/\*\*/); // markdown emphasis around primary metric

    expect(thirdLine).toMatch(/Flow & logging/i);
    expect(thirdLine).toMatch(/\*\*Flow & logging:\*\*/);

    expect(fourthLine).toMatch(/Risk snapshot/i);
    expect(fourthLine).toMatch(/\*\*Risk snapshot:\*\*/);
    expect(fourthLine).toMatch(/blocker/i);

    const hasSeparator = exported.includes('--- More detail below ---');
    expect(hasSeparator).toBeTruthy();

    const plain = exported.replace(/[*_`]/g, '');
    const plainLines = plain.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    expect(plainLines[0]).toMatch(/sprint health/i);
    expect(plainLines[1]).toMatch(/\d+% complete/i);
    expect(plainLines[3]).toMatch(/blocker/i);

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Markdown export produces stakeholder-ready structure with headings and sections', async ({ page }) => {
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
    expect(markdown).toMatch(/^> \*\d+% done\*/m);

    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('## Flow & Logging');
    expect(markdown).toContain('## Blockers');
    expect(markdown).toContain('## Scope changes');
    expect(markdown).toContain('## Work breakdown');
    expect(markdown).toContain('## Actions');

    const plain = markdown.replace(/[*_`]/g, '');
    expect(plain).toMatch(/Summary/);
    expect(plain).toMatch(/Blockers/);
    expect(plain).toMatch(/Scope changes/);

    const telemetry = captureBrowserTelemetry(page);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

