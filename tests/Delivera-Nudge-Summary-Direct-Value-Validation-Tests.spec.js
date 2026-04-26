import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview, skipIfRedirectedToLogin } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera - Nudge and Summary direct-value bridge', () => {
  test('summary context model derives actionable fields and preserves trust-safe fallbacks', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const result = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const context = mod.buildSummaryContext({
        summaryText: [
          'Current Sprint - DMS board - FY26DMS21 - Apr 13, 2026-Apr 24, 2026 - At risk',
          'Health: Risk rising due to stale blockers',
          'Capacity: 0.0h / 0.0h logged',
          'Risks: SD-4768 stale 283h [Unassigned]',
          'Next: Assign owner and update Jira today',
        ].join('\n'),
        modelMeta: { boardName: 'DMS board', sprintName: 'FY26DMS21' },
        primaryAction: 'Fallback action',
      });
      const nudge = mod.buildGuidedNudgeText({
        issueKey: 'SD-4768',
        issueSummary: 'Track KPI trend immediately after action',
        issueStatus: 'To Do',
        issueUrl: 'https://jira.example/browse/SD-4768',
        summaryContext: context,
      });
      return { context, nudge };
    });

    expect(result.context.header).toContain('Current Sprint - DMS board');
    expect(result.context.health).toContain('Risk rising');
    expect(result.context.risks).toContain('SD-4768');
    expect(result.context.capacity).toContain('0.0h');
    expect(result.context.topAction).toContain('Assign owner');
    expect(result.context.boardName).toBe('DMS board');
    expect(result.context.sprintName).toBe('FY26DMS21');
    expect(result.nudge).toContain('[System guided nudge]');
    expect(result.nudge).toContain('SD-4768');
    expect(result.nudge).toContain('Health signal');
    expect(result.nudge).toContain('Risk signal');
    expect(result.nudge).toContain('Recommended action now');
    expect(result.nudge).toContain('https://jira.example/browse/SD-4768');
  });

  test('edge cases: summary bridge handles missing and noisy values without breaking output', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const result = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const context = mod.buildSummaryContext({
        summaryText: 'Current Sprint - Minimal',
        modelMeta: {},
      });
      const fallbackNudge = mod.buildGuidedNudgeText({
        issueKey: '',
        issueSummary: '',
        issueStatus: '',
        issueUrl: '',
        summaryContext: context,
      });
      return { context, fallbackNudge };
    });

    expect(result.context.header).toBe('Current Sprint - Minimal');
    expect(result.context.health).toBe('');
    expect(result.context.risks).toBe('');
    expect(result.context.scope).toBe('');
    expect(result.context.capacity).toBe('');
    expect(result.context.topAction.length).toBeGreaterThan(5);
    expect(result.fallbackNudge).toContain('[System guided nudge]');
    expect(result.fallbackNudge).toContain('Please review');
    expect(result.fallbackNudge).toContain('status unknown');
  });

  test('summary context persists and round-trips in session storage for journey continuity', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const persisted = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Action-Bridge.js');
      const context = mod.buildSummaryContext({
        summaryText: 'Current Sprint - Persist check\nHealth: Stable\nRisks: none\nNext: Keep flow healthy',
      });
      mod.persistCurrentSprintSummaryContext(context);
      const fetched = mod.getCurrentSprintSummaryContext();
      return { context, fetched };
    });

    expect(persisted.fetched).toBeTruthy();
    expect(persisted.fetched.header).toBe(persisted.context.header);
    expect(persisted.fetched.health).toBe(persisted.context.health);
    expect(persisted.fetched.topAction).toContain('Keep flow healthy');
    expect(typeof persisted.fetched.generatedAt).toBe('string');
  });

  test('current sprint view surfaces direct-value shortcuts and guided nudge controls', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });

    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (!hasHeader) {
      test.skip(true, 'No active sprint header for this dataset');
      return;
    }

    const shortcutStrip = page.locator('#stories-card .work-risks-direct-value-strip').first();
    await expect(shortcutStrip).toBeVisible();
    const shortcutButtons = shortcutStrip.locator('button.stories-risk-chip');
    await expect(shortcutButtons).toHaveCount(5);
    await expect(shortcutButtons.nth(0)).toContainText(/Unblock now \(\d+\)/);
    await expect(shortcutButtons.nth(1)).toContainText(/Logging gaps \(\d+\)/);
    await expect(shortcutButtons.nth(2)).toContainText(/Estimate gaps \(\d+\)/);
    await expect(shortcutButtons.nth(3)).toContainText(/Ownership gaps \(\d+\)/);
    await expect(shortcutButtons.nth(4)).toContainText(/Scope changes \(\d+\)/);

    const firstRiskRow = page.locator('#work-risks-table tbody tr').first();
    if (!(await firstRiskRow.isVisible().catch(() => false))) {
      test.skip(true, 'No risk rows visible to open issue preview');
      return;
    }
    await firstRiskRow.click();
    const drawer = page.locator('#current-sprint-issue-preview.issue-preview-open');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-issue-preview-action="copy-guided-nudge"]')).toBeVisible();
    await expect(drawer.locator('[data-issue-preview-action="copy-nudge"]')).toContainText('Copy basic nudge');
  });

  test('report preview strip keeps direct sprint action continuity', async ({ page }) => {
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test, { report: true })) return;
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Report preview unavailable in this dataset');
      return;
    }
    const strip = page.locator('#preview-status-strip');
    const stripText = ((await strip.textContent().catch(() => '')) || '').trim();
    expect(stripText.length).toBeGreaterThan(0);
    expect(stripText).toMatch(/Results:|updated|snapshot|sync/i);
    const linkCount = await strip.locator('a.preview-status-inline-link').count();
    if (linkCount > 0) {
      const link = strip.locator('a.preview-status-inline-link').first();
      await expect(link).toHaveAttribute('href', '/current-sprint');
    } else {
      expect(stripText).toMatch(/sync|updated|snapshot/i);
    }
  });
});
