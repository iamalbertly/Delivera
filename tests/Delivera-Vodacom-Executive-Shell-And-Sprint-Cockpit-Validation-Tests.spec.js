import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { assertTelemetryClean, captureBrowserTelemetry } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

function buildStubSprintPayload(overrides = {}) {
  const base = {
    board: { id: 101, name: 'DMS Board', projectKeys: ['SD'] },
    sprint: {
      id: 301,
      name: 'FY26DMS21',
      state: 'active',
      startDate: '2026-04-13T00:00:00.000Z',
      endDate: '2026-04-24T00:00:00.000Z',
    },
    summary: {
      totalStories: 12,
      doneStories: 5,
      totalSP: 176,
      doneSP: 110,
      percentDone: 62,
      subtaskEstimatedHours: 80,
      subtaskLoggedHours: 18,
      subtaskMissingEstimate: 3,
      subtaskMissingLogged: 2,
      storyPointsFieldWarning: false,
    },
    daysMeta: {
      daysRemainingWorking: 12,
      daysRemainingCalendar: 12,
    },
    dailyCompletions: {
      stories: [
        { date: '2026-04-20', count: 2, spCompleted: 21 },
        { date: '2026-04-21', count: 1, spCompleted: 12 },
        { date: '2026-04-22', count: 0, spCompleted: 0 },
        { date: '2026-04-23', count: 2, spCompleted: 24 },
      ],
      subtasks: [],
    },
    remainingWorkByDay: [
      { date: '2026-04-20', remainingSP: 66 },
      { date: '2026-04-21', remainingSP: 54 },
      { date: '2026-04-22', remainingSP: 54 },
      { date: '2026-04-23', remainingSP: 42 },
    ],
    idealBurndown: [
      { date: '2026-04-20', remainingSP: 70 },
      { date: '2026-04-21', remainingSP: 58 },
      { date: '2026-04-22', remainingSP: 46 },
      { date: '2026-04-23', remainingSP: 34 },
    ],
    scopeChanges: [
      {
        date: '2026-04-21T09:00:00.000Z',
        issueKey: 'SD-5115',
        summary: 'DEVSECOPS',
        status: 'To Do',
        issueType: 'Story',
        storyPoints: 8,
        issueUrl: 'https://jira.example.com/browse/SD-5115',
      },
    ],
    stuckCandidates: [
      {
        issueKey: 'SD-5139',
        summary: 'Enhance Site Details FetchJob',
        status: 'Done',
        issueType: 'Story',
        assignee: '',
        hoursInStatus: 284,
        issueUrl: 'https://jira.example.com/browse/SD-5139',
      },
    ],
    recentSprints: [],
    nextSprint: null,
    previousSprint: { id: 300, name: 'FY26DMS20', doneSP: 96, doneStories: 9 },
    notes: { dependencies: ['SD-5139 waiting on assignment'], learnings: ['Late scope shifted focus'], updatedAt: null },
    assumptions: ['Completion anchored to resolution date.'],
    stories: [
      {
        issueKey: 'SD-5139',
        summary: 'Enhance Site Details FetchJob',
        status: 'In Progress',
        completionPct: 0,
        issueType: 'Story',
        assignee: '',
        reporter: 'Amani',
        storyPoints: 13,
        subtaskEstimateHours: 10,
        subtaskLoggedHours: 0,
        issueUrl: 'https://jira.example.com/browse/SD-5139',
        subtasks: [],
      },
      {
        issueKey: 'SD-5115',
        summary: 'DEVSECOPS',
        status: 'To Do',
        completionPct: 0,
        issueType: 'Story',
        assignee: 'Delivery Owner',
        reporter: 'Amani',
        storyPoints: 0,
        subtaskEstimateHours: 0,
        subtaskLoggedHours: 0,
        issueUrl: 'https://jira.example.com/browse/SD-5115',
        subtasks: [],
      },
      {
        issueKey: 'SD-5129',
        summary: 'TM daily reports',
        status: 'To Do',
        completionPct: 0,
        issueType: 'Story',
        assignee: 'Delivery Owner',
        reporter: 'Amani',
        storyPoints: 5,
        subtaskEstimateHours: 8,
        subtaskLoggedHours: 0,
        issueUrl: 'https://jira.example.com/browse/SD-5129',
        subtasks: [],
      },
    ],
    decisionCockpit: {
      health: {
        status: 'On Track',
        tone: 'positive',
        message: 'Good sprint momentum with no dominant execution risk. 8.0 SP was added after sprint start.',
      },
      nextBestAction: {
        issueKey: 'SD-5139',
        summary: 'Enhance Site Details FetchJob',
        reason: 'The item has been stale for 284h and is likely blocking sprint flow.',
        issueUrl: 'https://jira.example.com/browse/SD-5139',
        ctaLabel: 'Take Action',
        riskTags: ['blocker'],
      },
      keySignals: {
        completedRecent: { count: 2, storyPoints: 24 },
        blockers: 1,
        scopeChanges: 1,
        inactivity: false,
      },
      metrics: {
        progressPct: { value: 62, deltaVsPrior: 14 },
        storyPoints: { completed: 110, planned: 176, variance: -14 },
        workItems: { done: 5, total: 12, remaining: 7 },
        timeLogged: { logged: 18, estimated: 80, ratioPct: 23 },
        scopeDelta: { storyPoints: 13, count: 1, percent: 20 },
        daysRemaining: 12,
      },
      topRisks: [
        {
          issueKey: 'SD-5139',
          summary: 'Enhance Site Details FetchJob',
          status: 'Done',
          assignee: '',
          issueUrl: 'https://jira.example.com/browse/SD-5139',
          severity: 'High',
          reason: 'The item has been stale for 284h and is likely blocking sprint flow.',
          tags: ['No assignee', 'No movement 24h'],
          riskTags: ['blocker', 'unassigned'],
        },
        {
          issueKey: 'SD-5115',
          summary: 'DEVSECOPS',
          status: 'To Do',
          assignee: 'Delivery Owner',
          issueUrl: 'https://jira.example.com/browse/SD-5115',
          severity: 'Medium',
          reason: 'Sizing is missing, so predictability is weak.',
          tags: ['No estimate', 'Scope change'],
          riskTags: ['missing-estimate', 'scope'],
        },
      ],
      quickActions: [
        { id: 'unblock', label: 'Unblock issues', count: 1, riskTags: ['blocker'] },
        { id: 'estimate', label: 'Add estimates', count: 3, riskTags: ['missing-estimate'] },
        { id: 'scope', label: 'Review scope changes', count: 1, riskTags: ['scope'] },
        { id: 'ownership', label: 'Assign owners', count: 1, riskTags: ['unassigned'] },
      ],
      insights: {
        completionClustering: {
          value: 70,
          tone: 'warning',
          interpretation: '70% of completion landed in the last 2 checkpoints. Delivery is bunching late.',
          trend: [2, 5, 3, 8, 13],
        },
        scopeImpact: {
          value: 13,
          tone: 'warning',
          interpretation: '13.0 SP (20%) was added after sprint start.',
          trend: [0, 0, 5, 8, 13],
        },
        plannedActualVariance: {
          value: -14,
          tone: 'critical',
          interpretation: 'Behind by 14.0 SP against the ideal line.',
          trend: [-1, -4, -6, -10, -14],
        },
        confidence: {
          value: 'Medium',
          tone: 'warning',
          interpretation: 'Confidence is moderated because sizing evidence is incomplete.',
          trend: [3, 3, 2, 2, 2],
        },
      },
      workMovementAnnotations: [
        { type: 'scope-change', date: '2026-04-21', label: 'Scope change +13.0 SP', detail: '13.0 SP entered after sprint start.' },
        { type: 'inactivity', date: '2026-04-22', label: 'Inactivity', detail: 'No recent sprint movement is visible in the last 24h.' },
      ],
    },
    meta: {
      generatedAt: '2026-04-21T09:15:00.000Z',
      projects: 'SD',
      jiraHostResolved: 'https://jira.example.com',
      activeSprintCount: 1,
      partialPermissions: false,
    },
  };
  return {
    ...base,
    ...overrides,
    meta: { ...base.meta, ...(overrides.meta || {}) },
    summary: { ...base.summary, ...(overrides.summary || {}) },
    decisionCockpit: { ...base.decisionCockpit, ...(overrides.decisionCockpit || {}) },
  };
}

async function stubSprintPage(page, payload) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch (_) {}
    try { window.sessionStorage.clear(); } catch (_) {}
  });
  await page.route('**/api/boards.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: ['SD'],
        boards: [{ id: 101, name: 'DMS Board', projectKey: 'SD' }],
      }),
    });
  });
  await page.route('**/api/current-sprint.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

test.describe('Vodacom executive shell and sprint cockpit', () => {
  test('home page exposes the full executive navigation shell', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/dashboard');
    if (page.url().includes('/login')) test.skip(true, 'Auth redirect active');
    await expect(page.locator('.app-sidebar')).toBeVisible();
    const nav = page.locator('.app-sidebar .sidebar-link');
    await expect(nav).toHaveCount(9);
    await expect(page.locator('.app-sidebar')).toContainText(/Dashboard|Program Increment \(PI\)|Sprints|Value Delivery|Risks & Blockers|Teams|Reports|Settings/i);
    await expect(page.locator('.sidebar-brand-tagline')).toContainText(/Grow my Impact/i);
    await expect(page.locator('h1')).toContainText(/Delivery intelligence dashboard/i);
    assertTelemetryClean(telemetry);
  });

  test('executive placeholder pages are live and decision-oriented', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    for (const path of ['/program-increment', '/value-delivery', '/risks-blockers', '/teams', '/settings']) {
      await page.goto(path);
      if (page.url().includes('/login')) test.skip(true, 'Auth redirect active');
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.surface-hero-card')).toBeVisible();
      await expect(page.locator('.surface-context-strip').first()).toBeVisible();
    }
    assertTelemetryClean(telemetry);
  });

  test('current sprint renders the executive cockpit with health, action, signals, metrics, risks, and insights', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await stubSprintPage(page, buildStubSprintPayload());
    await page.goto('/current-sprint');
    await page.waitForSelector('.decision-cockpit-shell', { timeout: 30000 });
    await expect(page.locator('.decision-summary-strip')).toContainText(/Delivery score|Business impact|Risk/i);
    await expect(page.locator('.decision-health-card')).toContainText(/On Track/i);
    await expect(page.locator('.decision-action-card')).toContainText(/SD-5139/i);
    await expect(page.locator('.decision-signals-card')).toContainText(/Blockers|Scope changes|Recent completion/i);
    await expect(page.locator('.decision-metrics-row .decision-metric-card')).toHaveCount(5);
    await expect(page.locator('.decision-rail-card')).toHaveCount(3);
    await expect(page.locator('.decision-insights-row .decision-insight-card')).toHaveCount(4);
    await expect(page.locator('#stories-card')).toContainText(/Value Delivery|Enablers|Blocked \/ At Risk|What Was Delivered This Sprint|Blockers Panel/i);
    assertTelemetryClean(telemetry);
  });

  test('report and leadership first views stay business-oriented instead of tool-oriented', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (page.url().includes('/login')) test.skip(true, 'Auth redirect active');
    await expect(page.locator('h1')).toContainText(/Reports/i);
    await expect(page.locator('#tab-btn-trends')).toContainText(/Leadership/i);
    await expect(page.locator('#tab-btn-sprints')).toContainText(/Sprint delivery/i);
    await expect(page.locator('#tab-btn-done-stories')).toContainText(/Value delivery/i);
    await page.goto('/leadership');
    await expect(page.locator('.hud-title')).toContainText(/Leadership/i);
    await expect(page.locator('#leadership-summary')).toContainText(/Loading the portfolio story|Risk index|delivery/i);
    assertTelemetryClean(telemetry);
  });

  test('next best action applies the matching sprint filter instead of acting like a dead CTA', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await stubSprintPage(page, buildStubSprintPayload());
    await page.goto('/current-sprint');
    await page.waitForSelector('.decision-cockpit-shell', { timeout: 30000 });
    await page.locator('.decision-action-card .btn.btn-primary').click();
    await expect(page.locator('[data-header-active-filter-value]')).toContainText(/blocker/i);
    assertTelemetryClean(telemetry);
  });

  test('top risk cards surface severity and link back into the work list', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await stubSprintPage(page, buildStubSprintPayload());
    await page.goto('/current-sprint');
    const firstRisk = page.locator('.decision-risk-card').first();
    await expect(firstRisk).toContainText(/High|No assignee|No movement 24h/i);
    await firstRisk.locator('button').click();
    await expect(page.locator('#stories-card')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('work movement chart carries scope and inactivity annotations for direct-value storytelling', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await stubSprintPage(page, buildStubSprintPayload());
    await page.goto('/current-sprint');
    await expect(page.locator('.decision-workmovement-chart')).toBeVisible();
    const chartText = await page.locator('.decision-workmovement-card').textContent();
    expect(chartText || '').toMatch(/Scope change|Inactivity/i);
    assertTelemetryClean(telemetry);
  });

  test('edge case: fallback next action still gives a valid review path when no risk item exists', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    const payload = buildStubSprintPayload({
      stuckCandidates: [],
      scopeChanges: [],
      decisionCockpit: {
        nextBestAction: {
          issueKey: '',
          summary: 'No critical Jira issue needs intervention right now.',
          reason: 'Protect the sprint by keeping current work moving and watching for late scope or ownership drift.',
          issueUrl: '',
          ctaLabel: 'Review Work',
          riskTags: [],
        },
        topRisks: [],
      },
    });
    await stubSprintPage(page, payload);
    await page.goto('/current-sprint');
    await expect(page.locator('.decision-action-card')).toContainText(/No critical Jira issue/i);
    await page.locator('.decision-action-card .btn.btn-primary').click();
    await expect(page.locator('#stories-card')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('edge case: sparse sprint evidence still renders a readable chart and confidence narrative', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    const payload = buildStubSprintPayload({
      dailyCompletions: { stories: [], subtasks: [] },
      remainingWorkByDay: [],
      idealBurndown: [],
      decisionCockpit: {
        insights: {
          completionClustering: { value: 0, tone: 'positive', interpretation: 'No clustered completion yet.', trend: [0] },
          scopeImpact: { value: 0, tone: 'positive', interpretation: 'No material mid-sprint scope increase is visible.', trend: [0] },
          plannedActualVariance: { value: 0, tone: 'positive', interpretation: 'No variance yet.', trend: [0] },
          confidence: { value: 'Medium', tone: 'warning', interpretation: 'Confidence is moderated because sizing evidence is incomplete.', trend: [2, 2, 2] },
        },
      },
    });
    await stubSprintPage(page, payload);
    await page.goto('/current-sprint');
    const emptyVisible = await page.locator('.decision-workmovement-empty').isVisible().catch(() => false);
    const chartVisible = await page.locator('.decision-workmovement-chart').isVisible().catch(() => false);
    expect(emptyVisible || chartVisible).toBe(true);
    await expect(page.locator('.decision-insights-row')).toContainText(/Confidence/i);
    assertTelemetryClean(telemetry);
  });

  test('edge case: partial permission ribbons remain explicit while the cockpit still renders', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    const payload = buildStubSprintPayload({
      meta: { partialPermissions: true },
      decisionCockpit: {
        health: {
          status: 'Limited View',
          tone: 'warning',
          message: 'Some Jira fields are hidden, so the view is conservative.',
        },
      },
    });
    await stubSprintPage(page, payload);
    await page.goto('/current-sprint');
    await expect(page.locator('.decision-health-card')).toContainText(/Limited View/i);
    await expect(page.locator('.current-sprint-header-bar')).toBeVisible();
    assertTelemetryClean(telemetry);
  });
});
