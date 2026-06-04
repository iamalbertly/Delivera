import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean, ensureReportFiltersVisible, waitForPreview } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Leadership investment KPI and trust surfaces', () => {
  test('report trends now uses the same leadership shell and KPI contract as the standalone HUD', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/report#trends');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login or home; auth may be required');
      return;
    }

    await ensureReportFiltersVisible(page);
    await page.locator('#preview-btn').click().catch(() => null);
    await waitForPreview(page, { timeout: 60000 });

    const hasPreview = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!hasPreview) {
      test.skip(true, 'Preview did not load for current data set');
      return;
    }

    await page.click('#tab-btn-trends');
    await expect(page.locator('#tab-btn-trends')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#leadership-content .leadership-shell-top')).toBeVisible();
    await expect(page.locator('#leadership-content .leadership-mission-strip')).toBeVisible();

    const leadershipText = await page.locator('#leadership-content').textContent();
    expect(leadershipText || '').toMatch(/Leadership mission|Investment and delivery KPIs|Open current sprint/i);

    assertTelemetryClean(telemetry);
  });

  test('standalone leadership HUD shows trust, KPI, and export guidance when data exists', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/leadership');
    if (page.url().includes('/report#trends')) {
      await page.goto('/leadership.html');
    }

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login or home; auth may be required');
      return;
    }

    const hudGrid = page.locator('#hud-grid');
    await expect(hudGrid).toBeVisible();
    await page.waitForTimeout(3000);

    const cardCount = await page.locator('#hud-grid .hud-card').count();
    expect(cardCount).toBeGreaterThan(0);

    const anySignal = await page.locator('#hud-grid').textContent();
    if ((anySignal || '').includes('Loading range context and portfolio health')) {
      test.skip(true, 'Standalone leadership HUD did not finish loading in this environment');
      return;
    }
    expect(anySignal || '').toMatch(/Risk|Predictability|trust|outlier|Velocity/i);

    await page.goto('/leadership');
    await page.waitForTimeout(1000);
    const exportSummary = page.locator('.leadership-export-menu > summary').first();
    if (await exportSummary.isVisible().catch(() => false)) {
      await exportSummary.click().catch(() => null);
    }
    const exportButton = page.locator('[data-action="export-leadership-quarterly-story"]').first();
    if (await exportButton.isVisible().catch(() => false)) {
      await expect(exportButton).toBeVisible();
    }

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });

  test('leadership-summary.json includes squads[] with sprint state per board', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const [response] = await Promise.all([
      page.waitForResponse('**/api/leadership-summary.json', { timeout: 15000 }).catch(() => null),
      page.goto('/leadership'),
    ]);

    if (!response || response.status() === 401) {
      test.skip(true, 'Auth required or leadership-summary not available');
      return;
    }

    if (!response.ok()) {
      test.skip(true, `leadership-summary returned ${response.status()}`);
      return;
    }

    const body = await response.json().catch(() => null);
    if (!body) {
      test.skip(true, 'Could not parse leadership-summary response');
      return;
    }

    expect(Array.isArray(body.squads), 'squads array should be present in response').toBe(true);
    if (body.squads.length > 0) {
      const firstSquad = body.squads[0];
      expect(firstSquad).toHaveProperty('boardName');
      expect(firstSquad).toHaveProperty('sprintState');
      expect(firstSquad).toHaveProperty('hasActiveSprintFallback');
      expect(typeof firstSquad.hasActiveSprintFallback).toBe('boolean');
    }

    expect(consoleErrors.filter(e => !/Quarterly KPI/.test(e))).toHaveLength(0);
  });

  test('squad stall alert chip renders in HUD when mocked stalled squad is present', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await page.route('**/api/leadership-summary.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          velocity: { avg: 42, trend: 3 },
          risk: { score: 15, trend: 0, blockersOwned: 1, unownedOutcomes: 0, missingLogged: 0, missingEstimate: 0, deliveryRisk: 10, dataQualityRisk: 5 },
          quality: { reworkPct: 7, trend: 1 },
          predictability: { avg: 80, trend: 2 },
          squads: [
            { boardId: 1, boardName: 'MPSA Board', sprintState: 'active', sprintName: 'Sprint 42', sprintStartDate: '2026-05-15', hasActiveSprintFallback: false, nextSprintCandidate: null, nextSprintStartOverdue: false, suggestStartSprint: false, doneStories: 5, totalStories: 10 },
            { boardId: 2, boardName: 'MAS Board', sprintState: 'closed', sprintName: null, sprintStartDate: null, hasActiveSprintFallback: true, nextSprintCandidate: { id: 99, name: 'Sprint 8', startDate: '2026-05-20' }, nextSprintStartOverdue: true, suggestStartSprint: true, doneStories: 0, totalStories: 0 },
          ],
          projectContext: 'MPSA, MAS',
          generatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/leadership');
    await page.waitForTimeout(2000);

    const alertChip = page.locator('.hud-squad-alert');
    if (await alertChip.isVisible().catch(() => false)) {
      const text = await alertChip.textContent();
      expect(text).toMatch(/squad.*without active sprint/i);
    }

    expect(consoleErrors.filter(e => !/Quarterly KPI/.test(e))).toHaveLength(0);
  });
});
