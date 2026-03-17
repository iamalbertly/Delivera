import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  runDefaultPreview,
  selectFirstBoard,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Mission strip compression contracts', () => {
  test('current sprint keeps context, intervention, and attention inside one header shell', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error', { timeout: 45000 }).catch(() => null);
    await expect(page.locator('.current-sprint-header-bar')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .mission-context-ribbon')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .attention-queue--compact')).toHaveCount(0);
    await expect(page.locator('.current-sprint-header-bar .sprint-intervention-queue')).toBeVisible();
    await expect(page.locator('.current-sprint-header-bar .header-view-drawer')).toBeVisible();
    await expect(page.locator('.sprint-jump-rail')).toHaveCount(0);
    await expect(page.locator('.current-sprint-header-bar + .context-summary-strip')).toHaveCount(0);
    await expect(page.locator('.current-sprint-header-bar + .attention-queue')).toHaveCount(0);

    const viewport = await page.locator('.current-sprint-header-bar').evaluate((node) => node.getBoundingClientRect().height);
    expect(viewport).toBeLessThan(226);

    assertTelemetryClean(telemetry);
  });

  test('current sprint story table stays terse and defers deep evidence to the drawer', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await page.waitForSelector('#stories-card, #current-sprint-error', { timeout: 45000 }).catch(() => null);
    const stories = page.locator('#stories-table');
    const storiesVisible = await stories.isVisible().catch(() => false);
    if (!storiesVisible) {
      test.skip(true, 'Stories table unavailable for current dataset');
      return;
    }

    const subtaskSummaryDisplay = await page.locator('.story-subtask-summary').first().evaluate((node) => getComputedStyle(node).display).catch(() => 'none');
    expect(subtaskSummaryDisplay).toBe('none');
    const hiddenReporter = await page.locator('#stories-table th:nth-child(5)').evaluate((node) => getComputedStyle(node).display).catch(() => '');
    expect(hiddenReporter).toBe('none');

    const firstIssue = page.locator('#stories-table tbody tr a[href*="/browse/"]').first();
    await firstIssue.click({ force: true }).catch(() => null);
    await expect(page.locator('#current-sprint-issue-preview')).toHaveClass(/issue-preview-open/);
    await expect(page.locator('#current-sprint-issue-preview .issue-preview-summary')).not.toHaveText(/^$/);

    assertTelemetryClean(telemetry);
  });

  test('report preview stays compressed without a second attention tower after preview', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview unavailable for current dataset');
      return;
    }

    await expect(page.locator('#preview-meta .attention-queue')).toBeVisible();
    const attentionHeight = await page.locator('#preview-meta .attention-queue').evaluate((node) => node.getBoundingClientRect().height);
    expect(attentionHeight).toBeLessThan(120);

    assertTelemetryClean(telemetry);
  });

  test('leadership keeps attention and context in the compact top stack', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/leadership');
    if (page.url().includes('/report#trends')) {
      await page.goto('/leadership.html');
    }
    if (await skipIfRedirectedToLogin(page, test)) return;

    await page.waitForTimeout(3000);
    const content = page.locator('#leadership-content');
    if (!(await content.isVisible().catch(() => false))) {
      test.skip(true, 'Leadership content unavailable in this environment');
      return;
    }

    await expect(page.locator('.leadership-context-sticky .context-summary-strip')).toBeVisible();
    await expect(page.locator('#leadership-content .attention-queue')).toBeVisible();
    const duplicateQueues = await page.locator('#leadership-content .attention-queue').count();
    expect(duplicateQueues).toBe(1);

    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/Quarterly KPI summary request failed/i],
    });
  });

  test('current sprint treats mixed peer work types as first-class work items', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);

    await page.route('**/api/boards.json*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: ['OPS'],
          boards: [{ id: 501, name: 'Service Board', projectKey: 'OPS' }],
        }),
      });
    });

    await page.route('**/api/current-sprint.json*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          board: { id: 501, name: 'Service Board', projectKeys: ['OPS'] },
          sprint: { id: 901, name: 'Sprint 901', state: 'active', startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-03-15T00:00:00.000Z' },
          daysMeta: { daysRemainingWorking: 4 },
          summary: { totalStories: 6, doneStories: 3, totalSP: 13, doneSP: 8, percentDone: 50 },
          dailyCompletions: { stories: [], subtasks: [] },
          remainingWorkByDay: [],
          idealBurndown: [],
          scopeChanges: [],
          stuckCandidates: [],
          recentSprints: [],
          notes: { dependencies: [], learnings: [], updatedAt: null },
          assumptions: [],
          meta: { projects: 'OPS', fromSnapshot: false, generatedAt: new Date().toISOString() },
          stories: [
            {
              issueKey: 'OPS-101',
              key: 'OPS-101',
              summary: 'Improve incident triage workflow',
              status: 'In Progress',
              issueType: 'Service Request',
              assignee: 'Ops Lead',
              reporter: 'Ops Lead',
              storyPoints: 3,
              subtaskEstimateHours: 0,
              subtaskLoggedHours: 0,
              labels: [],
              subtasks: [],
              issueUrl: 'https://jira.example.com/browse/OPS-101',
            },
            {
              issueKey: 'OPS-102',
              key: 'OPS-102',
              summary: 'Resolve customer consent export bug',
              status: 'Done',
              issueType: 'Bug',
              assignee: 'Ops Lead',
              reporter: 'Ops Lead',
              storyPoints: 2,
              subtaskEstimateHours: 0,
              subtaskLoggedHours: 0,
              labels: [],
              subtasks: [],
              issueUrl: 'https://jira.example.com/browse/OPS-102',
            },
            {
              issueKey: 'OPS-103',
              key: 'OPS-103',
              summary: 'Customer territory KPI request',
              status: 'In Progress',
              issueType: 'Task',
              assignee: 'Ops Lead',
              reporter: 'Ops Lead',
              storyPoints: 3,
              subtaskEstimateHours: 0,
              subtaskLoggedHours: 0,
              labels: [],
              subtasks: [],
              issueUrl: 'https://jira.example.com/browse/OPS-103',
            },
            {
              issueKey: 'OPS-104',
              key: 'OPS-104',
              summary: 'Modernize feedback categorization flow',
              status: 'Done',
              issueType: 'Improvement',
              assignee: 'Ops Lead',
              reporter: 'Ops Lead',
              storyPoints: 2,
              subtaskEstimateHours: 0,
              subtaskLoggedHours: 0,
              labels: [],
              subtasks: [],
              issueUrl: 'https://jira.example.com/browse/OPS-104',
            },
            {
              issueKey: 'OPS-105',
              key: 'OPS-105',
              summary: 'Service onboarding request',
              status: 'Done',
              issueType: 'Change',
              assignee: 'Ops Lead',
              reporter: 'Ops Lead',
              storyPoints: 1,
              subtaskEstimateHours: 0,
              subtaskLoggedHours: 0,
              labels: [],
              subtasks: [],
              issueUrl: 'https://jira.example.com/browse/OPS-105',
            },
            {
              issueKey: 'OPS-106',
              key: 'OPS-106',
              summary: 'Feedback filter enhancement',
              status: 'In Progress',
              issueType: 'Service Request',
              assignee: 'Ops Lead',
              reporter: 'Ops Lead',
              storyPoints: 2,
              subtaskEstimateHours: 0,
              subtaskLoggedHours: 0,
              labels: [],
              subtasks: [],
              issueUrl: 'https://jira.example.com/browse/OPS-106',
            },
          ],
        }),
      });
    });

    await page.goto('/current-sprint');
    await page.waitForSelector('.current-sprint-header-bar, #stories-card', { timeout: 30000 }).catch(() => null);
    await expect(page.locator('.current-sprint-header-bar')).toContainText(/Issues\s*6/i);
    await expect(page.locator('#stories-card')).toContainText(/6 issues/i);
    await expect(page.locator('#stories-table')).toContainText(/Service Request/i);
    await expect(page.locator('#stories-table')).toContainText(/Bug/i);
    await expect(page.locator('#stories-table')).toContainText(/Task/i);
    await expect(page.locator('#stories-table')).toContainText(/Improvement/i);
    await expect(page.locator('#stories-table')).toContainText(/Change/i);
    assertTelemetryClean(telemetry);
  });
});
