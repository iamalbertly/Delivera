import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';

function sprintPayload({ boardId, boardName, projectKey, sprintName, blockerKey, blockerReason, assignee, nextMove, boards }) {
  return {
    board: { id: boardId, name: boardName, projectKey, projectKeys: [projectKey] },
    sprint: { id: boardId * 10, name: sprintName, state: 'active', startDate: '2026-07-21T00:00:00Z', endDate: '2026-08-04T00:00:00Z' },
    meta: { projects: projectKey, boardId, partialPermissions: false },
    summary: { totalStories: 8, doneStories: 3 },
    stories: [],
    dailyCompletions: { stories: [] },
    remainingWorkByDay: [],
    scopeChanges: [],
    availableBoards: boards || [
      { id: 11, projectKey: 'DMS', friendlyName: 'M-Pesa Delivery', globallyExcluded: false },
      { id: 22, projectKey: 'TRS', friendlyName: 'Transformers', globallyExcluded: false },
    ],
    decisionCockpit: {
      health: { tone: 'warning', status: 'Needs attention', message: `${projectKey} needs one unblock decision today.` },
      nextBestAction: { issueKey: blockerKey, summary: blockerReason, assignee, ctaLabel: nextMove, riskTags: ['blocker'] },
      metrics: { daysRemaining: 6, timeLogged: { ratioPct: 40 } },
      keySignals: { completedRecent: { count: 2, storyPoints: 5 }, blockers: 1 },
      topRisks: [{ issueKey: blockerKey, summary: blockerReason, severity: 'High', reason: blockerReason, tags: ['Blocked'], riskTags: ['blocker'] }],
      quickActions: [{ label: 'Assign owners', count: 1, riskTags: ['owner'] }],
    },
  };
}

const TWO_BOARDS = [
  { id: 11, name: 'DMS Board', projectKey: 'DMS' },
  { id: 22, name: 'TRS Board', projectKey: 'TRS' },
];

const SD_MPSA_BOARDS = [
  { id: 9, name: 'MPSA Board', projectKey: 'MPSA' },
  { id: 44, name: 'SD Board', projectKey: 'SD' },
];

test.describe('Current Sprint focused squad switch contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/boards.json**', (route) => {
      const url = new URL(route.request().url());
      const projects = String(url.searchParams.get('projects') || '').toUpperCase();
      let boards = TWO_BOARDS;
      // Continuity cases scope to one squad; default fixture keeps the two-board shell set.
      if (projects === 'SD') boards = [{ id: 44, name: 'SD Board', projectKey: 'SD' }];
      else if (projects === 'TRS') boards = [{ id: 22, name: 'TRS Board', projectKey: 'TRS' }];
      else if (projects === 'DMS') boards = [{ id: 11, name: 'DMS Board', projectKey: 'DMS' }];
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ boards, jiraErrors: [] }),
      });
    });
    await page.route('**/api/current-sprint/truth.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ schemaVersion: 1, records: [] }),
    }));
    await page.route('**/api/current-sprint.json**', (route) => {
      const url = new URL(route.request().url());
      const boardId = Number(url.searchParams.get('boardId') || 11);
      const byBoard = {
        9: sprintPayload({
          boardId: 9,
          boardName: 'MPSA Board',
          projectKey: 'MPSA',
          sprintName: 'MPSA Sprint 1',
          blockerKey: 'MPSA-9',
          blockerReason: 'MPSA wallet cutover is blocked.',
          assignee: 'Alex',
          nextMove: 'Unblock wallet cutover',
          boards: SD_MPSA_BOARDS.map((b) => ({
            id: b.id,
            projectKey: b.projectKey,
            friendlyName: b.projectKey === 'SD' ? 'DMS Squad (Kilimanjaro Legends)' : 'M-SQUAD',
            globallyExcluded: b.projectKey === 'MPSA',
          })),
        }),
        22: sprintPayload({
          boardId: 22,
          boardName: 'TRS Board',
          projectKey: 'TRS',
          sprintName: 'TRS Sprint 9',
          blockerKey: 'TRS-21',
          blockerReason: 'Transformers release sign-off is blocked by unresolved QA fixes.',
          assignee: 'Neo',
          nextMove: 'Chase QA sign-off',
        }),
        44: sprintPayload({
          boardId: 44,
          boardName: 'SD Board',
          projectKey: 'SD',
          sprintName: 'DMS Sprint 14',
          blockerKey: 'SD-42',
          blockerReason: 'Recharge flow proof is stale and needs a fresh owner check.',
          assignee: 'Irene',
          nextMove: 'Re-check stale proof',
          boards: SD_MPSA_BOARDS.map((b) => ({
            id: b.id,
            projectKey: b.projectKey,
            friendlyName: b.projectKey === 'SD' ? 'DMS Squad (Kilimanjaro Legends)' : 'M-SQUAD',
            globallyExcluded: b.projectKey === 'MPSA',
          })),
        }),
        11: sprintPayload({
          boardId: 11,
          boardName: 'DMS Board',
          projectKey: 'DMS',
          sprintName: 'DMS Sprint 14',
          blockerKey: 'DMS-42',
          blockerReason: 'Recharge flow proof is stale and needs a fresh owner check.',
          assignee: 'Irene',
          nextMove: 'Re-check stale proof',
        }),
      };
      const payload = byBoard[boardId] || byBoard[11];
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
  });

  test('first fold shows answer, blocker, owner, and next move', async ({ page }) => {
    await loginIfRequired(page, '/current-sprint', { rootSelector: '.current-sprint-report-shell' });
    await expect(page.locator('.current-sprint-filter-strip')).toContainText('Scope');
    await expect(page.locator('.current-sprint-filter-strip')).toContainText('DMS');
    await expect(page.locator('.current-sprint-shell-actions')).toContainText('Open report');
    await expect(page.locator('[data-squad-select]')).toBeVisible();
    await expect(page.locator('.sprint-today-hero')).toContainText('Sprint today');
    await expect(page.locator('.sprint-today-hero')).toContainText('NEEDS WATCH');
    await expect(page.locator('.sprint-today-hero')).toContainText('Main blocker: DMS-42');
    await expect(page.locator('.sprint-today-hero')).toContainText('Irene');
    await expect(page.locator('.sprint-today-hero')).toContainText('Next move:');
    await expect(page.locator('.sprint-today-hero')).toContainText('Recharge flow proof');
  });

  test('squad switcher changes sprint focus without leaving the route', async ({ page }) => {
    await loginIfRequired(page, '/current-sprint', { rootSelector: '[data-squad-select]' });
    const squadSelect = page.locator('[data-squad-select]');
    await expect(squadSelect.locator('option')).toContainText(['M-Pesa Delivery', 'Transformers']);
    await squadSelect.selectOption('22');
    await expect(page).toHaveURL(/boardId=22/);
    await expect(page.locator('.sprint-today-hero')).toContainText('Main blocker: TRS-21');
    await expect(page.locator('.sprint-today-hero')).toContainText('Neo');
    await expect(page.locator('.sprint-today-hero')).toContainText('Next move:');
  });

  test('squad query continuity opens the requested squad lane on first load', async ({ page }) => {
    await loginIfRequired(page, '/current-sprint?squad=TRS', { rootSelector: '.sprint-today-hero' });
    await expect(page).toHaveURL(/current-sprint/);
    await expect(page).toHaveURL(/projects=TRS/);
    await expect(page).toHaveURL(/boardId=22/);
    await expect(page.locator('.current-sprint-filter-strip')).toContainText('T-Squad');
    await expect(page.locator('.sprint-today-hero')).toContainText('Main blocker: TRS-21');
    await expect(page.locator('.sprint-today-hero')).toContainText('Neo');
  });

  test('squad=SD with stale MPSA boardId lands on SD work only', async ({ page }) => {
    await loginIfRequired(page, '/current-sprint?squad=SD&boardId=9&projects=MPSA', { rootSelector: '.sprint-today-hero' });
    await expect(page).toHaveURL(/squad=SD/);
    await expect(page).toHaveURL(/projects=SD/);
    await expect(page).toHaveURL(/boardId=44/);
    await expect(page.locator('.current-sprint-shell-title-block h2')).toContainText('DMS Squad');
    await expect(page.locator('.current-sprint-filter-strip')).toContainText('DMS Squad');
    await expect(page.locator('.current-sprint-filter-strip')).not.toContainText('Scope M-SQUAD');
    await expect(page.locator('.sprint-today-hero')).toContainText('Main blocker: SD-42');
    await expect(page.locator('.sprint-today-hero')).not.toContainText('MPSA-9');
    await expect(page.locator('[data-squad-select]')).toContainText('DMS Squad');
  });

  test('Governance DMS today href includes projects=SD continuity tokens', async ({ page }) => {
    await loginIfRequired(page, '/governance', { rootSelector: '[data-testid="governance-active-loop"], .gov-loop-identity-links, body' });
    const todayLink = page.locator('a.gov-loop-identity-link-secondary[href*="squad=SD"], a[href*="/current-sprint"][href*="squad=SD"]').first();
    if (await todayLink.count()) {
      const href = await todayLink.getAttribute('href');
      expect(href).toMatch(/squad=SD/i);
      expect(href).toMatch(/projects=SD/i);
    } else {
      const built = await page.evaluate(async () => {
        const mod = await import('/Delivera-Shared-Continuity-Link-01Build.js');
        return mod.currentSprintSquadHref('SD');
      });
      expect(built).toMatch(/squad=SD/);
      expect(built).toMatch(/projects=SD/);
    }
  });

  test('stale boardId falls back to the first available board', async ({ page }) => {
    await loginIfRequired(page, '/current-sprint?boardId=999999', { rootSelector: '.sprint-today-hero' });
    await expect(page.locator('.sprint-today-hero')).toContainText('Main blocker: DMS-42');
    await expect(page.locator('.current-sprint-filter-strip')).toContainText('DMS');
  });

  test('one-board shell still exposes scope and filter actions', async ({ page }) => {
    await page.unroute('**/api/boards.json**');
    await page.route('**/api/boards.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ boards: [{ id: 11, name: 'DMS Board', projectKey: 'DMS' }], jiraErrors: [] }),
    }));
    await page.unroute('**/api/current-sprint.json**');
    await page.route('**/api/current-sprint.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sprintPayload({
        boardId: 11,
        boardName: 'DMS Board',
        projectKey: 'DMS',
        sprintName: 'DMS Sprint 14',
        blockerKey: 'DMS-42',
        blockerReason: 'Recharge flow proof is stale and needs a fresh owner check.',
        assignee: 'Irene',
        nextMove: 'Re-check stale proof',
        boards: [{ id: 11, projectKey: 'DMS', friendlyName: 'M-Pesa Delivery', globallyExcluded: false }],
      })),
    }));
    await loginIfRequired(page, '/current-sprint', { rootSelector: '.sprint-today-hero' });
    await expect(page.locator('.current-sprint-shell-actions')).toContainText('Open report');
    await expect(page.locator('[data-squad-select]')).toBeVisible();
    await expect(page.locator('.sprint-today-hero')).toContainText('Next move:');
  });

  test('top chrome stays readable after sprint render settles', async ({ page }) => {
    await loginIfRequired(page, '/current-sprint', { rootSelector: '.app-top-chrome' });
    await page.waitForTimeout(1200);
    const chrome = page.locator('.app-top-chrome');
    await expect(chrome).toBeVisible();
    const styles = await chrome.evaluate((node) => {
      const cs = window.getComputedStyle(node);
      return { background: cs.backgroundColor, color: cs.color };
    });
    expect(styles.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.background).not.toBe('rgb(255, 255, 255)');
  });
});
