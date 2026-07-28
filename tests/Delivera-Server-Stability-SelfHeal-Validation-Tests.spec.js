import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';

const BASE = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

test.describe('Server stability + self-heal contracts', () => {
  test.describe.configure({ mode: 'serial' });

  test('healthz stays ready without auth', async ({ request }) => {
    const res = await request.get(`${BASE}/healthz`);
    expect(res.status(), 'healthz should be reachable').toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, ready: true });
    expect(typeof body.instanceId).toBe('string');
    expect(typeof body.uptime).toBe('number');
  });

  test('Governance ActiveLoop paints after login (not blank white)', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err?.message || err)));

    await loginIfRequired(page, '/governance', {
      rootSelector: '[data-testid="governance-active-loop"], #gov-active-loop-mount',
      timeout: 20000,
    });
    const hero = page.getByTestId('governance-active-loop');
    await expect(hero).toBeVisible({ timeout: 20000 });
    await expect(hero.locator('#gov-loop-answer, h1').first()).toBeVisible();
    const fatalClient = consoleErrors.filter((text) => /Cannot set headers after they are sent|ERR_HTTP_HEADERS_SENT/i.test(text));
    expect(fatalClient, `client logcat must not surface headers-sent: ${fatalClient.join(' | ')}`).toEqual([]);
  });

  test('squad=SD with stale MPSA boardId still lands on DMS/SD identity', async ({ page }) => {
    await page.route('**/api/boards.json**', (route) => {
      const url = new URL(route.request().url());
      const projects = String(url.searchParams.get('projects') || '').toUpperCase();
      const boards = projects === 'SD'
        ? [{ id: 44, name: 'SD Board', projectKey: 'SD' }]
        : [{ id: 9, name: 'MPSA Board', projectKey: 'MPSA' }, { id: 44, name: 'SD Board', projectKey: 'SD' }];
      return route.fulfill({
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
      const boardId = Number(url.searchParams.get('boardId') || 0);
      const projectKey = boardId === 44 ? 'SD' : 'MPSA';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          board: { id: boardId || 44, name: `${projectKey} Board`, projectKey, projectKeys: [projectKey] },
          sprint: { id: 100, name: `${projectKey} Sprint`, state: 'active', startDate: '2026-07-21T00:00:00Z', endDate: '2026-08-04T00:00:00Z' },
          meta: { projects: projectKey, boardId: boardId || 44 },
          summary: { totalStories: 2, doneStories: 0 },
          stories: [],
          decisionCockpit: {
            health: { tone: 'warning', status: 'Needs attention', message: `${projectKey} needs one unblock.` },
            nextBestAction: { issueKey: `${projectKey}-1`, summary: 'Owner missing', assignee: 'Scrum Master', ctaLabel: 'Assign', riskTags: ['unassigned'] },
            metrics: { daysRemaining: 5 },
            keySignals: { blockers: 1 },
            topRisks: [{ issueKey: `${projectKey}-1`, summary: 'Owner missing', severity: 'High', riskTags: ['unassigned'] }],
            quickActions: [],
          },
          availableBoards: [
            { id: 44, projectKey: 'SD', friendlyName: 'DMS Squad (Kilimanjaro Legends)', globallyExcluded: false },
            { id: 9, projectKey: 'MPSA', friendlyName: 'M-SQUAD', globallyExcluded: true },
          ],
        }),
      });
    });

    await loginIfRequired(page, '/current-sprint?squad=SD&boardId=9&projects=MPSA', {
      rootSelector: '.attention-queue, [data-sprint-lean-next-move], .current-sprint-report-shell',
      timeout: 20000,
    });
    await expect(page).toHaveURL(/squad=SD/i);
    await expect(page).toHaveURL(/projects=SD/i);
    await expect(page.locator('.current-sprint-shell-title-block h2, h2').first()).toContainText(/DMS Squad|SD/i);
    await expect(page.locator('.attention-queue, [data-sprint-lean-next-move], .current-sprint-report-shell').first()).not.toContainText('MPSA-1');
  });

  test('dashboard identity links expose governance and sprint continuity', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('delivera_selectedProjects', 'SD,DMS'); } catch (_) {}
    });
    await page.route('**/api/current-sprint.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sprint: { name: 'SD Sprint', state: 'active' },
        stories: [],
        meta: {},
        risks: { blockersOwned: 0 },
      }),
    }));
    await page.route('**/api/leadership-summary.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ squads: [] }),
    }));
    await page.route('**/api/boards.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ boards: [{ id: 44, name: 'SD Board', projectKey: 'SD' }], jiraErrors: [] }),
    }));
    await loginIfRequired(page, '/home?stay=1', {
      rootSelector: '#surface-identity-links, .executive-surface-shell',
      timeout: 20000,
    });
    const links = page.locator('#surface-identity-links a');
    await expect(links.first()).toBeVisible({ timeout: 10000 });
    const hrefs = await links.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href') || ''));
    expect(hrefs.some((href) => /\/governance/.test(href) && /spotlight=/i.test(href))).toBe(true);
    expect(hrefs.some((href) => /\/current-sprint/.test(href) && /squad=/i.test(href) && /projects=/i.test(href))).toBe(true);
  });

  test('healthz survives a short refresh storm', async ({ page, request }) => {
    await loginIfRequired(page, '/governance', {
      rootSelector: '[data-testid="governance-active-loop"], body.governance-page',
      timeout: 20000,
    });
    for (let i = 0; i < 4; i += 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    const res = await request.get(`${BASE}/healthz`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ready).toBe(true);
    await expect(page.getByTestId('governance-active-loop')).toBeVisible({ timeout: 20000 });
  });

  test('Settings registry bands remain visible', async ({ page }) => {
    await loginIfRequired(page, '/settings', {
      rootSelector: '#gov-settings-registry-mount, #governance-registry-title',
      timeout: 20000,
    });
    await expect(page.locator('#gov-settings-registry-mount, #governance-registry-title').first()).toBeVisible();
    await expect(page.locator('.registry-band, .registry-health-strip, #governance-registry-title').first()).toBeVisible();
  });
});
