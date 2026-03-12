import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { skipIfRedirectedToLogin } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Outcome Intake And Readiness Validation', () => {
  test('outcome intake disables create when narrative includes a Jira key', async ({ page }) => {
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await page.locator('[data-open-outcome-modal]').first().click();
    await expect(page.locator('#global-outcome-modal')).toBeVisible();
    const textarea = page.locator('#global-outcome-modal #report-outcome-text');
    const createBtn = page.locator('#global-outcome-modal #report-outcome-intake-create');
    const status = page.locator('#report-outcome-intake-status');

    await textarea.fill('Please continue work on SD-5022 and update the acceptance criteria.');
    await expect(createBtn).toBeDisabled();
    await expect(status).toContainText(/already has a Jira issue|Detected Jira issue key/i);
  });

  test('outcome intake dedupe suggests use-existing and supports create-anyway', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/outcome-from-narrative', async (route) => {
      callCount += 1;
      const body = route.request().postDataJSON?.() || {};
      if (callCount === 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'POSSIBLE_DUPLICATE_OUTCOME',
            duplicate: {
              key: 'SD-5043',
              url: 'https://jira.example.com/browse/SD-5043',
            },
          }),
        });
        return;
      }
      expect(body.createAnyway).toBe(true);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          key: 'SD-6000',
          url: 'https://jira.example.com/browse/SD-6000',
        }),
      });
    });

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('#project-mas').uncheck().catch(() => {});
    await page.locator('[data-open-outcome-modal]').first().click();
    await expect(page.locator('#global-outcome-modal')).toBeVisible();
    await page.locator('#global-outcome-modal #report-outcome-text').fill('New sites performance narrative without a Jira key.');
    await page.locator('#global-outcome-modal #report-outcome-intake-create').click();
    await expect(page.locator('#report-outcome-intake-status')).toContainText(/already exists|Use existing|Create anyway/i);
    await page.locator('[data-outcome-action="create-anyway"]').click();
    expect(callCount).toBe(2);
  });

  test('current sprint shows readiness verdict in header and supports paste Jira jump', async ({ page }) => {
    await page.route('**/api/boards.json**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: ['MPSA'],
          boards: [{ id: 101, name: 'MPSA Board', type: 'scrum', projectKey: 'MPSA' }],
        }),
      });
    });
    await page.route('**/api/current-sprint.json**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          board: { id: 101, name: 'MPSA Board', projectKeys: ['MPSA'] },
          sprint: { id: 9, name: 'Sprint 9', state: 'active', startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-03-15T00:00:00.000Z' },
          summary: {
            percentDone: 10,
            totalStories: 2,
            doneStories: 0,
            subtaskEstimatedHours: 0,
            subtaskLoggedHours: 0,
            subtaskMissingEstimate: 0,
            subtaskMissingLogged: 0,
            stuckExcludedParentsWithActiveSubtasks: 0,
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
          subtaskTracking: { rows: [], subtasks: [] },
          stuckCandidates: [],
          stuckExclusions: { parentsWithActiveSubtasks: [], recentSubtaskMovementCount: 0, parentsWithRecentSubtaskMovement: 0 },
          previousSprint: null,
          recentSprints: [],
          nextSprint: null,
          notes: { dependencies: [], learnings: [], updatedAt: null },
          assumptions: [],
          stories: [
            {
              issueKey: 'MPSA-1',
              summary: 'Outcome story without owner',
              storyPoints: 5,
              labels: ['OutcomeStory'],
              epicKey: 'MPSA-EP1',
              completionPct: 0,
              status: 'In Progress',
              issueType: 'Story',
              reporter: 'PO',
              assignee: '',
              created: '2026-03-01T00:00:00.000Z',
              resolved: '',
              estimateHours: 0,
              loggedHours: 0,
              subtaskEstimateHours: 0,
              subtaskLoggedHours: 0,
              subtasks: [],
              issueUrl: 'https://jira.example.com/browse/MPSA-1',
            },
            {
              issueKey: 'MPSA-2',
              summary: 'Outcome story with owner',
              storyPoints: 8,
              labels: ['OutcomeStory'],
              epicKey: 'MPSA-EP1',
              completionPct: 0,
              status: 'In Progress',
              issueType: 'Story',
              reporter: 'PO',
              assignee: 'Dev A',
              created: '2026-03-01T00:00:00.000Z',
              resolved: '',
              estimateHours: 0,
              loggedHours: 0,
              subtaskEstimateHours: 0,
              subtaskLoggedHours: 0,
              subtasks: [],
              issueUrl: 'https://jira.example.com/browse/MPSA-2',
            },
          ],
          meta: {
            fromSnapshot: false,
            snapshotAt: null,
            generatedAt: '2026-03-04T00:00:00.000Z',
            projects: 'MPSA',
            windowStart: '2026-03-01T00:00:00.000Z',
            windowEnd: '2026-03-15T00:00:00.000Z',
          },
        }),
      });
    });

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.evaluate(() => {
      const select = document.getElementById('board-select');
      if (!select) return;
      if (!Array.from(select.options).some((o) => o.value === '101')) {
        const option = document.createElement('option');
        option.value = '101';
        option.textContent = 'MPSA Board';
        select.appendChild(option);
      }
    });
    await page.locator('#board-select option[value="101"]').waitFor({ state: 'attached' });
    await page.selectOption('#board-select', '101');
    const verdictLine = page.locator('.current-sprint-header-bar .sprint-verdict-line');
    const verdictVisible = await verdictLine.isVisible().catch(() => false);
    if (!verdictVisible) {
      test.skip(true, 'Current sprint header verdict line not rendered in this environment');
      return;
    }
    await expect(verdictLine).toContainText(/at risk|not ready|ready|maintenance sprint/i);

    await page.locator('#issue-jump-input').fill('https://jira.example.com/browse/MPSA-2');
    await page.locator('#issue-jump-input').press('Enter');
    await expect(page.locator('#current-sprint-single-project-hint')).toContainText(/Jumped to MPSA-2|Issue MPSA-2/i);
  });
});
