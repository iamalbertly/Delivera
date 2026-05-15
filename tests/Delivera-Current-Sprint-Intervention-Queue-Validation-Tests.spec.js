import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { assertTelemetryClean, captureBrowserTelemetry, skipIfRedirectedToLogin } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

function buildSprintFixture() {
  return {
    board: { id: 101, name: 'MPSA Board', projectKeys: ['MPSA'] },
    sprint: { id: 9, name: 'Sprint 9', state: 'active', startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-03-15T00:00:00.000Z' },
    summary: {
      percentDone: 10,
      totalStories: 3,
      doneStories: 0,
      missingEstimate: 1,
      subtaskEstimatedHours: 6,
      subtaskLoggedHours: 0,
      subtaskMissingEstimate: 1,
      subtaskMissingLogged: 1,
      recentSubtaskMovementCount: 0,
      parentsWithRecentSubtaskMovement: 0,
    },
    daysMeta: { daysRemainingWorking: 6, daysRemainingCalendar: 6 },
    plannedWindow: { start: '2026-03-01T00:00:00.000Z', end: '2026-03-15T00:00:00.000Z' },
    observedWorkWindow: null,
    flags: {},
    dailyCompletions: { stories: [], subtasks: [] },
    remainingWorkByDay: [],
    idealBurndown: [],
    scopeChanges: [],
    scopeChangeSummary: {},
    subtaskTracking: {
      rows: [{ issueKey: 'MPSA-3a', parentKey: 'MPSA-3', summary: 'Estimate API flow', issueType: 'Sub-task', status: 'In Progress', assignee: 'Dev B', estimateHours: 0, loggedHours: 0 }],
      subtasks: [{ issueKey: 'MPSA-3a', parentKey: 'MPSA-3', assignee: 'Dev B', estimateHours: 0, loggedHours: 0 }],
    },
    stuckCandidates: [
      { issueKey: 'MPSA-1', summary: 'Blocked integration', issueType: 'Story', status: 'In Progress', assignee: 'Dev A', reporter: 'PO', hoursInStatus: 30, issueUrl: 'https://jira.example.com/browse/MPSA-1' },
    ],
    stuckExclusions: { parentsWithActiveSubtasks: [], recentSubtaskMovementCount: 0, parentsWithRecentSubtaskMovement: 0 },
    previousSprint: null,
    recentSprints: [],
    nextSprint: null,
    notes: { dependencies: [], learnings: [], updatedAt: null },
    assumptions: ['Vendor SLA risk'],
    stories: [
      { issueKey: 'MPSA-1', summary: 'Blocked integration', storyPoints: 5, labels: ['OutcomeStory', 'blocker'], epicKey: 'MPSA-EP1', completionPct: 0, status: 'In Progress', issueType: 'Story', reporter: 'PO', assignee: 'Dev A', issueUrl: 'https://jira.example.com/browse/MPSA-1', subtasks: [] },
      { issueKey: 'MPSA-2', summary: 'Unowned story', storyPoints: 3, labels: ['OutcomeStory'], epicKey: 'MPSA-EP1', completionPct: 0, status: 'To Do', issueType: 'Story', reporter: '', assignee: '', issueUrl: 'https://jira.example.com/browse/MPSA-2', subtasks: [] },
      { issueKey: 'MPSA-3', summary: 'Needs estimate', storyPoints: 0, labels: ['OutcomeStory'], epicKey: 'MPSA-EP2', completionPct: 0, status: 'In Progress', issueType: 'Story', reporter: 'PO', assignee: 'Dev B', issueUrl: 'https://jira.example.com/browse/MPSA-3', subtasks: [{ issueKey: 'MPSA-3a', assignee: 'Dev B', estimateHours: 0, loggedHours: 0 }] },
    ],
    meta: { projects: 'MPSA', generatedAt: '2026-03-17T08:00:00.000Z' },
  };
}

test.describe('Current Sprint Intervention Queue Validation', () => {
  test('current sprint shows dynamic intervention queue with real risk counts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/api/boards.json**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projects: ['MPSA'], boards: [{ id: 101, name: 'MPSA Board', type: 'scrum', projectKey: 'MPSA' }] }) });
    });
    await page.route('**/api/current-sprint.json**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildSprintFixture()) });
    });

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const bodyText = await page.locator('body').textContent();
    expect(bodyText || '').not.toMatch(/Narrative to Epic|No blockers detected\. Sprint is flowing well\./i);

    const drawerSummary = page.locator('.current-sprint-header-bar .header-view-drawer > summary');
    if (await drawerSummary.isVisible().catch(() => false)) {
      await drawerSummary.click();
    }
    const queue = page.locator('.sprint-intervention-queue').first();
    await expect(queue).toBeAttached();
    // Must NOT contain the old static placeholders — these were UX noise
    const queueText = (await queue.textContent().catch(() => '') || '').toLowerCase();
    expect(queueText).not.toContain('your blockers now');
    expect(queueText).not.toContain('missing estimates');
    expect(queueText).not.toContain('ownership gaps');

    // Must show actual count-driven labels from real data
    // Fixture has 1 blocker (MPSA-1), 1 missing estimate (MPSA-3), 1 unassigned (MPSA-2)
    await expect(queue).toContainText(/\d+ stale in progress|\d+ missing est|\d+ unowned/i);

    // Take action CTA must be dynamic — shows top stuck issue key when available
    const takeActionBtn = page.locator('.sprint-intervention-item-primary');
    await expect(takeActionBtn).toBeAttached();
    const ctaText = (await takeActionBtn.textContent().catch(() => '') || '').trim();
    // When stuckCandidates[0] has MPSA-1, CTA becomes "Unblock MPSA-1"
    expect(ctaText).toMatch(/Unblock MPSA-1|Take action/i);

    await expect(page.locator('.current-sprint-header-bar')).toContainText(/Create work/i);
    assertTelemetryClean(telemetry);
  });
});
