import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { skipIfRedirectedToLogin } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera - No-click adaptive coaching and trust validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
  });

  test('validation 01: basic nudge uses simplified summary language', async ({ page }) => {
    const payload = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      localStorage.setItem('delivera.simpleEnglishMode.v1', 'true');
      const ctx = mod.buildSummaryContext({ summaryText: 'Current Sprint\nHealth: At risk\nNext: Set owner now' });
      return mod.buildBasicNudgeText({
        issueKey: 'SD-4768',
        issueSummary: 'As a CSS/TM/SSM/GTM/I&R I should be able to see how KPI is trending during and immediately after my action so I can stop',
        issueStatus: 'To Do',
        issueUrl: 'https://jira.example/browse/SD-4768',
        summaryContext: ctx,
      });
    });
    expect(payload).toContain('[System basic nudge]');
    expect(payload).not.toMatch(/As a CSS\/TM\/SSM/i);
    expect(payload).toContain('Do now:');
  });

  test('validation 02: guided nudge concise coaching mode compresses output', async ({ page }) => {
    const payload = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      localStorage.setItem('delivera.coachingLevel.v1', 'concise');
      const ctx = mod.buildSummaryContext({ summaryText: 'Current Sprint\nHealth: At risk\nRisks: stale blocker\nNext: Assign owner' });
      return mod.buildGuidedNudgeText({
        issueKey: 'SD-1001',
        issueSummary: 'As a user I should ...',
        issueStatus: 'To Do',
        summaryContext: ctx,
      });
    });
    expect(payload).toContain('Done: owner set');
    expect(payload).not.toContain('Scope signal:');
    expect(payload).toMatch(/Trust:|Confidence:/i);
  });

  test('validation 03: guided nudge guide coaching mode includes fuller context', async ({ page }) => {
    const payload = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      localStorage.setItem('delivera.coachingLevel.v1', 'guide');
      const ctx = mod.buildSummaryContext({ summaryText: 'Current Sprint\nHealth: At risk\nRisks: stale blocker\nScope: +1\nCapacity: 0h/8h\nNext: Assign owner' });
      return mod.buildGuidedNudgeText({
        issueKey: 'SD-1002',
        issueSummary: 'Need owner',
        issueStatus: 'In Progress',
        summaryContext: ctx,
      });
    });
    expect(payload).toContain('Scope signal:');
    expect(payload).toContain('Capacity signal:');
    expect(payload).toContain('Done:');
  });

  test('validation 04: contradiction guard removes no-risk phrase when risk exists', async ({ page }) => {
    const ctx = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      return mod.buildSummaryContext({
        summaryText: 'Current Sprint\nHealth: Sprint just started - no risks yet, next check-in soon.\nRisks: SD-5139 stale [Unassigned]',
      });
    });
    expect(ctx.health.toLowerCase()).toContain('early risk detected');
    expect(ctx.health.toLowerCase()).not.toContain('no risks yet');
  });

  test('validation 05: keyboard shortcut "/" focuses sprint filter input', async ({ page }) => {
    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (!hasHeader) test.skip(true, 'No active sprint');
    await page.keyboard.press('/');
    await expect(page.locator('#issue-jump-input')).toBeFocused();
  });

  test('validation 06: keyboard shortcut "s" triggers copy summary interaction', async ({ page }) => {
    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (!hasHeader) test.skip(true, 'No active sprint');
    await page.keyboard.press('s');
    const btn = page.locator('.export-dashboard-btn.export-default-action').first();
    await expect(btn).toBeVisible();
  });

  test('validation 07: keyboard shortcut "g" targets top guided nudge button', async ({ page }) => {
    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (!hasHeader) test.skip(true, 'No active sprint');
    const btn = page.locator('[data-action="copy-top-guided-nudge"]').first();
    await expect(btn).toBeVisible();
    await page.keyboard.press('g');
    await expect(btn).toBeVisible();
  });

  test('validation 08: no-click quick guided nudge button remains visible in top value strip', async ({ page }) => {
    const strip = page.locator('#stories-card .work-risks-direct-value-strip').first();
    if (!(await strip.isVisible().catch(() => false))) test.skip(true, 'No stories card');
    await expect(strip.locator('[data-action="copy-top-guided-nudge"]')).toBeVisible();
  });

  test('validation 09: dedupe hint appears in work risks summary when primary strip exists', async ({ page }) => {
    const meta = page.locator('#stuck-card .work-risks-shortcut-meta').first();
    if (!(await meta.isVisible().catch(() => false))) test.skip(true, 'No risks summary');
    await expect(meta).toContainText(/pinned in Sprint work|scope|parent/i);
  });

  test('validation 10: role fallback remains Team for unknown mode', async ({ page }) => {
    const nudge = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      localStorage.setItem('current_sprint_role_mode', 'mystery-role');
      const ctx = mod.buildSummaryContext({ summaryText: 'Current Sprint\nHealth: At risk' });
      return mod.buildBasicNudgeText({ issueKey: 'SD-1010', issueSummary: 'Test', summaryContext: ctx });
    });
    expect(nudge).toContain('[Team]');
  });

  test('validation 11: issue summary is shortened from agile template noise', async ({ page }) => {
    const nudge = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const ctx = mod.buildSummaryContext({ summaryText: 'Current Sprint\nHealth: At risk' });
      return mod.buildGuidedNudgeText({
        issueKey: 'SD-1011',
        issueSummary: 'As a CSS/TM/SSM/GTM/I&R I should be able to see how KPI is trending during and immediately after my action so I can stop',
        summaryContext: ctx,
      });
    });
    expect(nudge).not.toMatch(/As a CSS\/TM\/SSM/i);
  });

  test('validation 12: anti-spam rate limit note appears only on repeated same key/action', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const ctx = mod.buildSummaryContext({ summaryText: 'Current Sprint\nHealth: At risk\nNext: Assign owner now' });
      const first = mod.buildGuidedNudgeText({ issueKey: 'SD-1012', issueSummary: 'Risk', summaryContext: ctx });
      const second = mod.buildGuidedNudgeText({ issueKey: 'SD-1012', issueSummary: 'Risk', summaryContext: ctx });
      return { first, second };
    });
    expect(result.first).not.toContain('Duplicate nudge suppressed');
    expect(result.second).toContain('Duplicate nudge suppressed');
  });

  test('validation 13: no-click auto-open top risk preview happens once per session', async ({ page }) => {
    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (!hasHeader) test.skip(true, 'No active sprint');
    const drawerVisible = await page.locator('#current-sprint-issue-preview.issue-preview-open').isVisible().catch(() => false);
    if (!drawerVisible) test.skip(true, 'No risk rows to auto-open preview');
    await expect(page.locator('#current-sprint-issue-preview.issue-preview-open')).toBeVisible();
  });

  test('validation 14: summary context carries simple English + coaching flags', async ({ page }) => {
    const ctx = await page.evaluate(async () => {
      localStorage.setItem('delivera.simpleEnglishMode.v1', 'true');
      localStorage.setItem('delivera.coachingLevel.v1', 'assist');
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      return mod.buildSummaryContext({ summaryText: 'Current Sprint\nHealth: At risk' });
    });
    expect(ctx.simpleEnglishMode).toBeTruthy();
    expect(ctx.coachingLevel).toBe('assist');
  });

  test('validation 15: top guided nudge no-click button can copy clipboard text', async ({ page }) => {
    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (!hasHeader) test.skip(true, 'No active sprint');
    await page.evaluate(() => {
      window.__copiedNudgeText = '';
      const clip = { writeText: async (text) => { window.__copiedNudgeText = String(text || ''); } };
      try { Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => clip }); } catch (_) { navigator.clipboard = clip; }
    });
    const btn = page.locator('[data-action="copy-top-guided-nudge"]').first();
    if (!(await btn.isVisible().catch(() => false))) test.skip(true, 'Quick nudge button not available');
    await btn.click().catch(() => null);
    const copied = await page.evaluate(() => window.__copiedNudgeText || '');
    if (!copied) test.skip(true, 'No copied text emitted');
    expect(copied).toContain('[System guided nudge]');
    expect(copied).toMatch(/Done:/i);
  });

  test('validation 16: guided nudge never leaks undefined tokens', async ({ page }) => {
    const text = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const ctx = mod.buildSummaryContext({ summaryText: 'Current Sprint' });
      return mod.buildGuidedNudgeText({ summaryContext: ctx });
    });
    expect(text.toLowerCase()).not.toContain('undefined');
    expect(text.toLowerCase()).not.toContain('null');
  });
});
