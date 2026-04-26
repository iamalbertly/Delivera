import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  ensureReportFiltersVisible,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

function sprintPayload() {
  return {
    board: { id: 101, name: 'DMS Board', projectKeys: ['SD'] },
    sprint: { id: 301, name: 'FY26DMS21', state: 'active', startDate: '2026-04-13T00:00:00.000Z', endDate: '2026-04-24T00:00:00.000Z' },
    summary: { totalStories: 10, doneStories: 6, totalSP: 110, doneSP: 68, percentDone: 60, subtaskEstimatedHours: 80, subtaskLoggedHours: 18 },
    daysMeta: { daysRemainingWorking: 4, daysRemainingCalendar: 4 },
    dailyCompletions: { stories: [{ date: '2026-04-21', count: 2, spCompleted: 13 }, { date: '2026-04-22', count: 1, spCompleted: 8 }], subtasks: [] },
    remainingWorkByDay: [{ date: '2026-04-21', remainingSP: 42 }, { date: '2026-04-22', remainingSP: 34 }],
    scopeChanges: [{ date: '2026-04-21T09:00:00.000Z', issueKey: 'SD-5115', summary: 'DEVSECOPS', status: 'To Do', storyPoints: 8 }],
    stories: [
      { issueKey: 'SD-5139', summary: 'Enhance Site Details FetchJob', status: 'In Progress', issueType: 'Story', assignee: '', reporter: 'Amani', storyPoints: 13, subtaskEstimateHours: 10, subtaskLoggedHours: 0 },
      { issueKey: 'SD-5115', summary: 'DEVSECOPS', status: 'To Do', issueType: 'Story', assignee: 'Delivery Owner', reporter: 'Amani', storyPoints: 0, subtaskEstimateHours: 0, subtaskLoggedHours: 0 },
      { issueKey: 'SD-5129', summary: 'TM daily reports', status: 'Done', issueType: 'Story', assignee: 'Delivery Owner', reporter: 'Amani', storyPoints: 5, subtaskEstimateHours: 8, subtaskLoggedHours: 6 },
    ],
    decisionCockpit: {
      health: { status: 'Needs attention', tone: 'warning', message: 'Customer impact is visible, but ownership and added work need action.' },
      nextBestAction: { issueKey: 'SD-5139', summary: 'Enhance Site Details FetchJob', reason: 'No owner and stale movement can block sprint value.', ctaLabel: 'Review work', riskTags: ['blocker', 'unassigned'] },
      keySignals: { completedRecent: { count: 3, storyPoints: 21 }, blockers: 1, scopeChanges: 1, inactivity: false },
      metrics: {
        progressPct: { value: 60 },
        workItems: { done: 6, total: 10, remaining: 4 },
        timeLogged: { logged: 18, estimated: 80, ratioPct: 23 },
        daysRemaining: 4,
      },
      topRisks: [
        { issueKey: 'SD-5139', summary: 'Enhance Site Details FetchJob', severity: 'High', reason: 'No owner and stale movement.', tags: ['Need owner', 'Late'], riskTags: ['blocker', 'unassigned'] },
      ],
      quickActions: [
        { label: 'Unblock issues', count: 1, riskTags: ['blocker'] },
        { label: 'Add estimates', count: 2, riskTags: ['missing-estimate'] },
        { label: 'Review scope changes', count: 1, riskTags: ['scope'] },
        { label: 'Assign owners', count: 1, riskTags: ['unassigned'] },
      ],
      insights: {
        completionClustering: { value: 40, tone: 'warning', interpretation: 'Delivery is landing late.', trend: [1, 2, 5] },
        scopeImpact: { value: 8, tone: 'warning', interpretation: 'Added work needs review.', trend: [0, 8] },
        plannedActualVariance: { value: -14, tone: 'critical', interpretation: 'Behind by 14 SP.', trend: [-2, -8, -14] },
        confidence: { value: 'Medium', tone: 'warning', interpretation: 'Evidence is usable but incomplete.', trend: [2, 2, 3] },
      },
      workMovementAnnotations: [{ type: 'scope-change', date: '2026-04-21', label: 'Added work +8 SP' }],
    },
    meta: { projects: 'SD', generatedAt: new Date().toISOString(), partialPermissions: false },
  };
}

function previewBody() {
  return {
    meta: {
      selectedProjects: ['MPSA', 'MAS'],
      windowStart: '2026-04-01T00:00:00.000Z',
      windowEnd: '2026-07-02T23:59:59.999Z',
      generatedAt: new Date().toISOString(),
      fromCache: false,
      partial: false,
      discoveredFields: { storyPointsFieldId: 'customfield_10016', epicLinkFieldId: 'customfield_10014' },
    },
    boards: [{ id: 42, name: 'DMS board' }],
    rows: [
      { issueKey: 'MPSA-101', issueSummary: 'NBA alerts active for CSS', issueStatus: 'Done', sprintId: '111', boardId: 42 },
      { issueKey: 'MPSA-102', issueSummary: 'TM daily performance reports', issueStatus: 'In Progress', sprintId: '111', boardId: 42, assignee: '' },
    ],
    sprintsIncluded: [{ id: 111, name: 'Sprint 1', boardId: 42, state: 'closed', doneSP: 21, sprintWorkDays: 10 }],
    sprintsUnusable: [],
    metrics: { predictability: { perSprint: {} }, epicTTM: [] },
    kpis: null,
  };
}

async function stubSprint(page) {
  await page.route('**/api/boards.json*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ projects: ['SD'], boards: [{ id: 101, name: 'DMS Board', projectKey: 'SD' }] }),
  }));
  await page.route('**/api/current-sprint.json*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(sprintPayload()),
  }));
}

async function stubLeadership(page) {
  await page.route('**/api/leadership-summary.json*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      projects: ['MPSA'],
      projectContext: 'MPSA',
      windowStart: '2026-04-01T00:00:00.000Z',
      windowEnd: '2026-07-02T23:59:59.999Z',
      generatedAt: new Date().toISOString(),
      velocity: { avg: 45, trend: 12 },
      risk: { score: 22, deliveryRisk: 40, dataQualityRisk: 8, blockersOwned: 4, unownedOutcomes: 1 },
      quality: { reworkPct: 7, trend: -2 },
      predictability: { avg: 81, trend: 6 },
    }),
  }));
  await page.route('**/api/quarterly-kpi-summary.json*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      projectKPIs: { MPSA: { utilizationPct: 87, dataQuality: { trustBand: 'Mixed' } } },
      dataQuality: { trustBand: 'Mixed', spCoverage: 0.88, dateCoverage: 0.92, timesheetCoverage: 0.7 },
      outlierEpics: [],
      outlierSprints: [],
    }),
  }));
}

async function foldInteractiveCount(page, rootSelector = 'body') {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector) || document.body;
    return [...root.querySelectorAll('button,a,summary,input,select,[role="button"]')]
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0
        && style.display !== 'none' && style.visibility !== 'hidden';
    }).length;
  }, rootSelector);
}

test.describe('Outcome cockpit direct value realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('Current Sprint shows value, risk, and next action without control clutter', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await stubSprint(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;
    await expect(page.locator('.decision-cockpit-shell')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.decision-summary-strip')).toContainText(/Value answer|Customer impact|Risk/i);
    await expect(page.locator('.decision-metrics-row .decision-metric-card')).toHaveCount(4);
    await expect(page.locator('.decision-rail-card').first()).toContainText(/Risk queue|No hidden blockers/i);
    await expect(page.locator('.decision-action-queue')).toContainText(/Need unblock|Need estimate|Need owner/i);
    await expect(page.locator('body.current-sprint-has-live-content header')).toBeHidden();
    await expect(page.locator('.decision-cockpit-shell')).not.toContainText(/Quick Actions|Focus in work list|Take Action/i);
    expect(await foldInteractiveCount(page)).toBeLessThanOrEqual(14);
    assertTelemetryClean(telemetry);
  });

  test('Reports opens on value and trust language after a stubbed preview', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route(/\/preview\.json(\?|$)/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(previewBody()),
    }));
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('h1')).toContainText(/Delivery/i);
    await ensureReportFiltersVisible(page);
    await page.click('#preview-btn');
    await expect(page.locator('#preview-content')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#preview-meta')).toContainText(/Value done|Customer impact|Value view|Trust details/i);
    await expect(page.locator('.tabs')).toContainText(/Value|Leaders|Flow|Outcomes|Trust/i);
    await expect(page.locator('#preview-meta')).not.toContainText(/Performance history/i);
    assertTelemetryClean(telemetry);
  });

  test('Leadership gives an executive answer before evidence cards', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await stubLeadership(page);
    await page.goto('/leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.hud-answer-row')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.hud-answer-row')).toContainText(/Portfolio answer|Risk|Trust/i);
    await expect(page.locator('#leadership-header-actions')).toContainText(/Refresh|Open sprint risk|More/i);
    expect(await foldInteractiveCount(page, '.hud-shell')).toBeLessThanOrEqual(10);
    assertTelemetryClean(telemetry);
  });
});
