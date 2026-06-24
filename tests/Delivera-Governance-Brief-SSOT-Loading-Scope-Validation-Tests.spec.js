import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getLayoutOverlapReport,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY, PORTFOLIO_ANCHOR_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

const SD_BRIEF = {
  briefId: 'SSOT-SD',
  projects: ['SD', 'BIO'],
  portfolio: 'SD',
  freshness: { confidenceLimit: 'live', jiraFetchedAt: new Date().toISOString() },
  deliveryTruth: { committed: 2, done: 1 },
  executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
  leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked for SD', narratedBy: 'template' },
  meta: {
    narratedBy: 'template',
    commandAnswerSentence: 'DELIVERY BLOCKED — SD squad act today',
    quarter: 'FY27 Q1',
    safeToSend: true,
    workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 0 },
    setupGaps: [],
  },
  topRisks: [{
    issueKey: 'SD-1',
    squad: 'SD board',
    assigneeName: 'Amani',
    decisionNeededFrom: 'Leadership',
    recommendedAction: 'Ping Amani',
    escalation: 'act-today',
    issueUrl: 'https://example/SD-1',
    displayTitle: 'Stuck item',
    summary: 'Stuck',
  }],
  portfolioRisks: [],
  evidencePack: { rows: [{ issueKey: 'SD-1', statusNow: 'In Progress', statusLastWeek: 'To Do', whyFlagged: 'stale' }] },
  poReadiness: null,
  squadInsights: [
    { projectKey: 'SD', boardName: 'SD board', boardResolved: true, verdictTier: 'blocked', sprintPulse: { committed: 5, done: 1 }, offPlanHours: 8, cardRisks: [] },
    { projectKey: 'BIO', boardName: 'BIO board', boardResolved: true, verdictTier: 'watch', sprintPulse: { committed: 4, done: 2 }, offPlanHours: 2, cardRisks: [] },
  ],
};

async function mockGovernanceApis(page, brief = SD_BRIEF, delayMs = 0) {
  await page.addInitScript(({ projectsKey, anchorKey }) => {
    localStorage.setItem(projectsKey, 'SD,BIO');
    localStorage.setItem(anchorKey, 'SD');
    sessionStorage.removeItem('delivera:brief:cache:v1');
  }, { projectsKey: PROJECTS_SSOT_KEY, anchorKey: PORTFOLIO_ANCHOR_KEY });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', async (route) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const url = route.request().url();
    const refresh = url.includes('refresh=1');
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...brief, meta: { ...brief.meta, refreshed: refresh } }),
    });
  });
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, byMetric: {} }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [] }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, agents: [], lastImprovements: [] }),
  }));
  await page.route('**/api/governance/scope-intelligence.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ scope: { cards: [{ projectKey: 'SD', health: 'ok' }] }, boards: 1 }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ projects: ['SD', 'BIO'], boards: [{ id: 1, name: 'SD board', projectKey: 'SD' }], projectErrors: [] }),
  }));
  await page.route('**/api/governance/interventions/seed-from-brief**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cases: [] }),
  }));
  await page.route('**/api/governance/portfolio-decision.json**', (r) => {
    if (r.request().method() !== 'POST') return r.continue();
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: {
          headline: 'Review SD scope now',
          summary: 'SD portfolio signal',
          anchorProject: 'SD',
          periodKey: 'FY27 Q1',
          metrics: { delivery: { value: 30, peerMedian: 50 }, offPlanLoad: { value: 20, peerMedian: 15 }, proofConfidence: { value: 40, peerMedian: 55 } },
          trust: { liveCases: 0, nudgesReady: 0, proofLevel: 'Medium' },
          drivers: [],
          decisionOptions: [{ id: 'review-investment', label: 'Review investment', hint: 'Fix issues' }],
          monitoring: { squadCount: 2, commitmentCount: 0 },
          recommendation: { label: 'Review investment' },
        },
        comparison: { cards: [], actionsStrip: {} },
        cases: [],
      }),
    });
  });
}

test.describe('Governance Brief SSOT loading and scope', () => {
  test('shows loading shell before portfolio resolves', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page, SD_BRIEF, 400);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const loading = page.locator('#gov-loading');
    await expect(loading).toBeVisible({ timeout: 2000 });
    await expect(page.locator('#portfolio-signal-mount .portfolio-signal, [data-portfolio-signal]')).toBeVisible({ timeout: 15000 });
    await expect(loading).toBeHidden();
    assertTelemetryClean(telemetry);
  });

  test('portfolio signal shows SD anchor not foreign squad copy', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#portfolio-signal-mount')).toContainText(/SD|DMS|scope/i, { timeout: 15000 });
    assertTelemetryClean(telemetry);
  });

  test('single scope bar mount (no duplicate)', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#portfolio-scope-bar-mount')).toHaveCount(1);
    await expect(page.locator('#gov-scope-bar-mount:not([hidden])')).toHaveCount(0);
  });

  test('scope change updates sidebar Projects segment', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#portfolio-signal-mount')).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => {
      window.__scopeChanged = false;
      window.addEventListener('delivera:scope-changed', () => { window.__scopeChanged = true; });
    });
    await page.locator('#portfolio-scope-selected').selectOption('BIO');
    await page.waitForTimeout(400);
    const scopeChanged = await page.evaluate(() => Boolean(window.__scopeChanged));
    expect(scopeChanged).toBe(true);
    const sidebarText = await page.locator('#sidebar-context-card .context-card-segment').filter({ hasText: 'Projects' }).textContent();
    expect(sidebarText || '').toMatch(/BIO|SD/);
    assertTelemetryClean(telemetry);
  });

  test('Refresh requests server cache bypass', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    const urls = [];
    await mockGovernanceApis(page);
    await page.route('**/api/governance-brief.json**', async (route) => {
      urls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SD_BRIEF),
      });
    });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#portfolio-signal-mount')).toBeVisible({ timeout: 15000 });
    await page.locator('#portfolio-scope-refresh').click();
    await page.waitForTimeout(800);
    expect(urls.some((u) => u.includes('refresh=1'))).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('cache peek paints portfolio before slow network completes', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript((brief) => {
      localStorage.setItem('delivera_selectedProjects', 'SD,BIO');
      localStorage.setItem('delivera.portfolio.anchor.v1', 'SD');
      const map = {};
      map['SD,BIO|FY27 Q1|pi'] = { brief, at: Date.now(), ttlMs: 180000 };
      sessionStorage.setItem('delivera:brief:cache:v1', JSON.stringify(map));
    }, SD_BRIEF);
    await routeProjectsCatalog(page);
    await page.route('**/api/governance-brief.json**', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SD_BRIEF) });
    });
    await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"quarters":[{"label":"FY27 Q1","isCurrent":true}]}' }));
    await page.route('**/api/governance/interventions/seed-from-brief**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"cases":[]}' }));
    await page.route('**/api/governance/portfolio-decision.json**', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: { headline: 'Cached SD', summary: 'ok', anchorProject: 'SD', periodKey: 'FY27 Q1', metrics: { delivery: { value: 1, peerMedian: 1 }, offPlanLoad: { value: 1, peerMedian: 1 }, proofConfidence: { value: 1, peerMedian: 1 } }, trust: {}, drivers: [], decisionOptions: [], monitoring: {}, recommendation: { label: 'Review' } },
        comparison: { cards: [], actionsStrip: {} },
        cases: [],
      }),
    }));
    await page.route('**/api/governance/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.portfolio-signal[data-portfolio-signal]')).toBeVisible({ timeout: 5000 });
    assertTelemetryClean(telemetry);
  });

  test('scope switch shows loading while portfolio refreshes', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page, SD_BRIEF, 500);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#portfolio-signal-mount')).toBeVisible({ timeout: 15000 });
    await page.locator('#portfolio-scope-selected').selectOption('BIO');
    await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'loading', { timeout: 3000 });
    await expect(page.locator('#portfolio-signal-mount .portfolio-signal')).toBeVisible({ timeout: 15000 });
    assertTelemetryClean(telemetry);
  });

  test('mobile search collapsed does not overlap switcher', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#app-top-chrome')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.app-top-search-wrap')).toHaveClass(/is-collapsed/);
    const overlap = await getLayoutOverlapReport(page, {
      selectors: [
        '#app-top-chrome .app-top-switcher-item',
        '#app-top-chrome .app-top-search-wrap',
      ],
    });
    expect(overlap.overlaps, JSON.stringify(overlap.overlaps)).toEqual([]);
    assertTelemetryClean(telemetry);
  });
});
