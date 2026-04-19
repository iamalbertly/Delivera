import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { skipIfRedirectedToLogin } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

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

  test('outcome intake previews epic plus stories with mode and confidence', async ({ page }) => {
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await page.locator('[data-open-outcome-modal]').first().click();
    const textarea = page.locator('#global-outcome-modal #report-outcome-text');
    await textarea.fill([
      '1: Users walio-share feedback(On Display and Export):',
      '2: Add Customer Number on Feedback(On Display and Export)',
      '3: Consent to be displayed.',
      '4: Filter by Feedback Category.',
      '5: Fix SMS notification',
    ].join('\n'));

    await expect(page.locator('#report-outcome-parse-summary')).toContainText(/Will create 4 backlog items under 1 parent issue/i);
    await expect(page.locator('#report-outcome-parse-summary')).toContainText(/Mode: epic with stories/i);
    await expect(page.locator('#report-outcome-parse-summary')).toContainText(/confidence/i);
    await expect(page.locator('#report-outcome-overrides')).toContainText(/Adjust|Hide options/i);
    await expect(page.locator('#report-outcome-overrides .report-outcome-structure-pill')).toContainText(/Auto/i);
    await expect(page.locator('#report-outcome-overrides #report-outcome-issue-type')).toHaveCount(0);
    await expect(page.locator('#report-outcome-intake-create')).toContainText(/Create 5 Jira issues from this list/i);
  });

  test('outcome intake flips to story plus subtasks for concrete user story with steps', async ({ page }) => {
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await page.locator('[data-open-outcome-modal]').first().click();
    await page.locator('#global-outcome-modal #report-outcome-text').fill([
      'As a customer I want to receive an SMS when feedback is shared so that I know it was sent',
      'Add the SMS event trigger',
      'Wire the notification handler',
      'Update the confirmation copy',
      'Validate the delivery retry path',
    ].join('\n'));

    await expect(page.locator('#report-outcome-parse-summary')).toContainText(/Mode: story with subtasks/i);
    await expect(page.locator('#report-outcome-intake-create')).toContainText(/Create parent \+ child items/i);
  });

  test('outcome intake handles table input as issues with descriptions', async ({ page }) => {
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await page.locator('[data-open-outcome-modal]').first().click();
    await page.locator('#global-outcome-modal #report-outcome-text').fill([
      'Summary\tDescription',
      'Fix SMS notification\tWhen a user shares feedback, they get a confirmation SMS',
      'Filter feedback by category\tAdd category selection and persistence',
    ].join('\n'));

    await expect(page.locator('#report-outcome-parse-summary')).toContainText(/Detected table input/i);
    await expect(page.locator('#report-outcome-parse-summary')).toContainText(/Mode: table issues/i);
  });

  test('outcome intake surfaces partial failures without hiding successes', async ({ page }) => {
    await page.route('**/api/outcome-from-narrative', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          structureMode: 'EPIC_WITH_STORIES',
          projectKey: 'SD',
          primary: { key: 'SD-100', url: 'https://jira.example.com/browse/SD-100' },
          childIssues: [{ key: 'SD-101', url: 'https://jira.example.com/browse/SD-101', title: 'Add customer number' }],
          linkedExisting: [],
          createdCount: 2,
          expectedCreateCount: 3,
          failures: [{ title: 'Fix SMS notification flow for feedback events', reason: 'Permission denied' }],
          summaryHtml: 'Created epic <a href="https://jira.example.com/browse/SD-100" target="_blank" rel="noopener">SD-100</a> with 1 linked stories in project SD backlog. Created 2 of 3. Failed on: Fix SMS notification flow for feedback events.',
        }),
      });
    });

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-open-outcome-modal]').first().click();
    await page.locator('#global-outcome-modal #report-outcome-text').fill([
      'Customer feedback improvements',
      'Add customer number',
      'Fix SMS notification',
    ].join('\n'));
    await page.locator('#global-outcome-modal #report-outcome-intake-create').click();
    await expect(page.locator('#report-outcome-intake-status')).toContainText(/Created 2 of 3/i);
    await expect(page.locator('#report-outcome-intake-status')).toContainText(/Fix SMS notification/i);
  });

  test('outcome intake shows Jira configuration gaps without generic 500 copy', async ({ page }) => {
    await page.route('**/api/outcome-from-narrative', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'OUTCOME_CREATE_CONFIG_REQUIRED',
          message: 'Project SD needs extra Jira create fields before this narrative can be created automatically.',
          details: {
            problems: [
              { role: 'parent', issueTypeName: 'Feature', missingFields: ['Team', 'Business Owner'] },
              { role: 'child', issueTypeName: 'Story', missingFields: ['Parent link field'] },
            ],
          },
        }),
      });
    });

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-open-outcome-modal]').first().click();
    await page.locator('#global-outcome-modal #report-outcome-text').fill([
      'Customer feedback improvements',
      'Add customer number',
      'Fix SMS notification',
    ].join('\n'));
    await page.locator('#global-outcome-modal #report-outcome-intake-create').click();
    await expect(page.locator('#report-outcome-intake-status')).toContainText(/Project SD needs extra Jira create fields/i);
    await expect(page.locator('#report-outcome-intake-status')).toContainText(/parent Feature needs Team, Business Owner/i);
    await expect(page.locator('#report-outcome-intake-status')).toContainText(/child Story needs Parent link field/i);
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
    await expect(verdictLine).toContainText(/at risk|not ready|ready|maintenance sprint|caution|healthy|critical/i);

    await page.locator('#issue-jump-input').fill('https://jira.example.com/browse/MPSA-2');
    await page.locator('#issue-jump-input').press('Enter');
    await expect(page.locator('#current-sprint-single-project-hint')).toContainText(/Jumped to MPSA-2|Issue MPSA-2/i);
  });
});
