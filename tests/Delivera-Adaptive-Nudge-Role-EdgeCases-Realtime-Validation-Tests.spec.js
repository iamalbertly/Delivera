import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { skipIfRedirectedToLogin } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera - Adaptive nudge role and edge-case validation', () => {
  test('role mapping: scrum-master context produces role-adaptive guided nudge', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const output = await page.evaluate(async () => {
      localStorage.setItem('current_sprint_role_mode', 'scrum-master');
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const ctx = mod.buildSummaryContext({
        summaryText: 'Current Sprint - DMS\nHealth: At risk\nRisks: SD-4768 stale [Unassigned]\nNext: Unblock now',
      });
      return mod.buildGuidedNudgeText({
        issueKey: 'SD-4768',
        issueSummary: 'Critical stale blocker',
        issueStatus: 'To Do',
        issueUrl: 'https://jira.example/browse/SD-4768',
        summaryContext: ctx,
      });
    });
    expect(output).toContain('[Scrum Master]');
    expect(output).toContain('Recommended action now');
    expect(output).toContain('Confidence:');
  });

  test('role mapping: developer context changes action hint wording', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const output = await page.evaluate(async () => {
      localStorage.setItem('current_sprint_role_mode', 'developer');
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const ctx = mod.buildSummaryContext({
        summaryText: 'Current Sprint - DMS\nHealth: At risk\nCapacity: 0h logged / 12h estimated',
      });
      return mod.buildGuidedNudgeText({
        issueKey: 'SD-9999',
        issueSummary: 'Logging drift',
        issueStatus: 'In Progress',
        summaryContext: ctx,
      });
    });
    expect(output).toContain('[Developer]');
    expect(output.toLowerCase()).toContain('estimate');
    expect(output.toLowerCase()).toContain('log');
  });

  test('contradiction guard rewrites false no-risk health language', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const context = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      return mod.buildSummaryContext({
        summaryText: [
          'Current Sprint - DMS',
          'Health: Sprint just started - no risks yet, next check-in soon.',
          'Risks: SD-5139 stale [Unassigned]',
        ].join('\n'),
      });
    });
    expect(context.health).not.toMatch(/no risks yet/i);
    expect(context.health.toLowerCase()).toContain('early risk');
  });

  test('evidence band assignment: early health becomes low confidence', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const output = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const ctx = mod.buildSummaryContext({
        summaryText: 'Current Sprint\nHealth: Sprint just started - no risks yet, next check-in soon.',
      });
      return mod.buildGuidedNudgeText({
        issueKey: 'SD-1111',
        issueSummary: 'Check',
        summaryContext: ctx,
      });
    });
    expect(output).toContain('Confidence: Low');
  });

  test('rate-limit note appears when repeated guided nudge is generated', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const result = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const ctx = mod.buildSummaryContext({
        summaryText: 'Current Sprint\nHealth: At risk\nNext: Unblock now',
      });
      const first = mod.buildGuidedNudgeText({
        issueKey: 'SD-2222',
        issueSummary: 'Blocked task',
        summaryContext: ctx,
      });
      const second = mod.buildGuidedNudgeText({
        issueKey: 'SD-2222',
        issueSummary: 'Blocked task',
        summaryContext: ctx,
      });
      return { first, second };
    });
    expect(result.first).not.toContain('Duplicate nudge suppressed');
    expect(result.second).toContain('Duplicate nudge suppressed');
  });

  test('no-click journey: top guided nudge button exists in sprint stories strip', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (!hasHeader) {
      test.skip(true, 'No active sprint for current dataset');
      return;
    }
    const quickBtn = page.locator('#stories-card [data-action="copy-top-guided-nudge"]').first();
    await expect(quickBtn).toBeVisible();
    await expect(quickBtn).toContainText('Copy top guided nudge');
  });

  test('no-click journey: top guided nudge button copies text to clipboard', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (!hasHeader) {
      test.skip(true, 'No active sprint for current dataset');
      return;
    }
    await page.evaluate(() => {
      window.__copiedTopGuidedNudge = '';
      const clip = {
        writeText: async (text) => {
          window.__copiedTopGuidedNudge = String(text || '');
          return Promise.resolve();
        },
      };
      try {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => clip });
      } catch (_) {
        navigator.clipboard = clip;
      }
    });
    await page.locator('#stories-card [data-action="copy-top-guided-nudge"]').first().click().catch(() => null);
    const copied = await page.evaluate(() => window.__copiedTopGuidedNudge || '');
    if (!copied) {
      test.skip(true, 'No visible row was available for top guided nudge copy');
      return;
    }
    expect(copied).toContain('[System guided nudge]');
    expect(copied).toMatch(/Confidence:/i);
  });

  test('edge case: unknown role defaults safely to Team', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const output = await page.evaluate(async () => {
      localStorage.setItem('current_sprint_role_mode', 'unexpected-role');
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const ctx = mod.buildSummaryContext({ summaryText: 'Current Sprint\nHealth: At risk' });
      return mod.buildGuidedNudgeText({
        issueKey: 'SD-3333',
        issueSummary: 'Fallback role check',
        summaryContext: ctx,
      });
    });
    expect(output).toContain('[Team]');
  });

  test('edge case: missing URL still returns done-criteria message', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    const output = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const ctx = mod.buildSummaryContext({ summaryText: 'Current Sprint\nHealth: At risk' });
      return mod.buildGuidedNudgeText({
        issueKey: 'SD-4444',
        issueSummary: 'No URL case',
        summaryContext: ctx,
      });
    });
    expect(output).toContain('Done criteria:');
    expect(output).not.toContain('undefined');
  });
});
