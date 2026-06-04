import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SPRINT_PAGE = `${BASE_URL}/current-sprint`;

function baseBoardRoutes(page) {
  return page.route('**/api/boards.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: ['MPSA'],
        boards: [{ id: 101, name: 'Main Board', projectKey: 'MPSA' }],
      }),
    });
  });
}

async function loadMockSprint(page, sprintBody) {
  await baseBoardRoutes(page);
  await page.route('**/api/current-sprint.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sprintBody),
    });
  });
  await page.goto(SPRINT_PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#board-select', { timeout: 30000, state: 'attached' });
  await page.waitForSelector('#board-select option[value="101"]', { timeout: 30000, state: 'attached' });
  await page.locator('#board-select').selectOption('101');
  await page.waitForSelector('.current-sprint-header-bar', { timeout: 30000 });
}

const ACTIVE_SPRINT = {
  id: 301,
  name: 'Sprint 301',
  state: 'active',
  startDate: '2026-03-01T00:00:00.000Z',
  endDate: '2026-03-15T00:00:00.000Z',
};

test.describe('Current Sprint header declutter — edge states and viewport', () => {
  test.describe.configure({ retries: 0 });

  test('just-started edge state shows calm copy when work exists with zero risk signals', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await loadMockSprint(page, {
      board: { id: 101, name: 'Main Board', projectKeys: ['MPSA'] },
      sprint: ACTIVE_SPRINT,
      stories: [
        {
          key: 'MPSA-1',
          summary: 'Story 1',
          statusCategory: 'In Progress',
          issueType: 'Story',
          assignee: { displayName: 'Sam Example' },
          subtasks: [{ key: 'MPSA-2', summary: 'Sub', statusCategory: 'In Progress', timeSpentHours: 1, originalEstimateHours: 2 }],
        },
      ],
      summary: { totalStories: 1, doneStories: 0, totalSP: 3, doneSP: 0, percentDone: 0, subtaskMissingEstimate: 0, subtaskMissingLogged: 0 },
      previousSprint: { name: 'Sprint 200', id: 200, doneSP: 5, doneStories: 2 },
      daysMeta: { daysRemainingWorking: 10 },
      recentSprints: [
        { id: 200, name: 'Sprint 200', state: 'closed' },
        { id: 199, name: 'Sprint 199', state: 'closed' },
        { id: 198, name: 'Sprint 198', state: 'closed' },
      ],
      meta: { projects: 'MPSA', generatedAt: '2026-03-20T09:15:00.000Z' },
    });
    const header = page.locator('.current-sprint-header-bar').first();
    await expect(header).toHaveAttribute('data-edge-state', 'just-started');
    await expect(header).toHaveAttribute('data-viewport-lean', 'true');
    await expect(header.locator('.sprint-verdict-explain')).toContainText(/just started/i);
    assertTelemetryClean(telemetry);
  });

  test('empty edge state when sprint has no trackable stories', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await loadMockSprint(page, {
      board: { id: 101, name: 'Main Board', projectKeys: ['MPSA'] },
      sprint: ACTIVE_SPRINT,
      stories: [],
      summary: { totalStories: 0, doneStories: 0, totalSP: 0, doneSP: 0, percentDone: 0 },
      daysMeta: { daysRemainingWorking: 10 },
      recentSprints: [],
      meta: { projects: 'MPSA', generatedAt: '2026-03-20T09:15:00.000Z' },
    });
    const header = page.locator('.current-sprint-header-bar').first();
    await expect(header).toHaveAttribute('data-edge-state', 'empty');
    await expect(header.locator('.sprint-verdict-explain')).toContainText(/no trackable work/i);
    assertTelemetryClean(telemetry);
  });

  test('low-confidence edge state when fewer than three closed sprints in history', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await loadMockSprint(page, {
      board: { id: 101, name: 'Main Board', projectKeys: ['MPSA'] },
      sprint: ACTIVE_SPRINT,
      stories: [
        { key: 'MPSA-1', summary: 'Story 1', statusCategory: 'In Progress', issueType: 'Story', assignee: { displayName: 'Sam' }, subtasks: [] },
        { key: 'MPSA-2', summary: 'Story 2', statusCategory: 'To Do', issueType: 'Story', assignee: { displayName: 'Alex' }, subtasks: [] },
      ],
      summary: { totalStories: 2, doneStories: 1, totalSP: 5, doneSP: 2, percentDone: 40 },
      previousSprint: { name: 'Sprint 200', id: 200, doneSP: 4, doneStories: 2 },
      daysMeta: { daysRemainingWorking: 6 },
      recentSprints: [{ id: 200, name: 'Sprint 200', state: 'closed' }],
      meta: { projects: 'MPSA', generatedAt: '2026-03-20T09:15:00.000Z' },
    });
    const header = page.locator('.current-sprint-header-bar').first();
    await expect(header).toHaveAttribute('data-edge-state', 'low-confidence');
    await expect(header.locator('.sprint-verdict-explain')).toContainText(/low confidence/i);
    assertTelemetryClean(telemetry);
  });

  test('desktop scroll enables mini-header with verdict strip only', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const stories = Array.from({ length: 24 }, (_, i) => ({
      key: `MPSA-${i + 1}`,
      summary: `Story ${i + 1}`,
      statusCategory: i % 3 === 0 ? 'Done' : 'In Progress',
      issueType: 'Story',
      assignee: { displayName: 'Sam Example' },
      subtasks: [],
    }));
    await loadMockSprint(page, {
      board: { id: 101, name: 'Main Board', projectKeys: ['MPSA'] },
      sprint: ACTIVE_SPRINT,
      stories,
      summary: { totalStories: stories.length, doneStories: 8, totalSP: 40, doneSP: 12, percentDone: 20 },
      daysMeta: { daysRemainingWorking: 5 },
      recentSprints: [],
      meta: { projects: 'MPSA', generatedAt: '2026-03-20T09:15:00.000Z' },
    });
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(250);
    const header = page.locator('.current-sprint-header-bar').first();
    await expect(header).toHaveClass(/header-mini-mode/);
    await expect(header.locator('.header-mini-strip')).toBeVisible();
    await expect(header.locator('.header-identity-metrics')).toBeHidden();
    assertTelemetryClean(telemetry);
  });

  test('mobile viewport keeps full header without mini-mode', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const stories = Array.from({ length: 20 }, (_, i) => ({
      key: `MPSA-${i + 1}`,
      summary: `Story ${i + 1}`,
      statusCategory: 'In Progress',
      issueType: 'Story',
      assignee: { displayName: 'Sam Example' },
      subtasks: [{ key: `MPSA-${i + 1}-1`, summary: 'Sub', statusCategory: 'In Progress', timeSpentHours: 1, originalEstimateHours: 2 }],
    }));
    await loadMockSprint(page, {
      board: { id: 101, name: 'Main Board', projectKeys: ['MPSA'] },
      sprint: ACTIVE_SPRINT,
      stories,
      summary: { totalStories: stories.length, doneStories: 0, totalSP: 30, doneSP: 0, percentDone: 0 },
      daysMeta: { daysRemainingWorking: 4 },
      recentSprints: [],
      meta: { projects: 'MPSA', generatedAt: '2026-03-20T09:15:00.000Z' },
    });
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(250);
    const header = page.locator('.current-sprint-header-bar').first();
    await expect(header).not.toHaveClass(/header-mini-mode/);
    assertTelemetryClean(telemetry);
  });
});
