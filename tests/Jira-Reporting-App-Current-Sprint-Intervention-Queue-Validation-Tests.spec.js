import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { assertTelemetryClean, captureBrowserTelemetry, skipIfRedirectedToLogin } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

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
  test('current sprint shows intervention queue and unified blocker truth', async ({ page }) => {
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
    await expect(page.locator('.sprint-intervention-queue')).toContainText(/Your blockers now/i);
    await expect(page.locator('.sprint-intervention-queue')).toContainText(/Missing estimates/i);
    await expect(page.locator('.sprint-intervention-queue')).toContainText(/Ownership gaps/i);
    await expect(page.locator('body')).toContainText(/Create work from insight/i);
    await expect(page.locator('#blockers-panel')).toContainText(/blocker detected in sprint risk signals|Blocked integration/i);
    assertTelemetryClean(telemetry);
  });
});
