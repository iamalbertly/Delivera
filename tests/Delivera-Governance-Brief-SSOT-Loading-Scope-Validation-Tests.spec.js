import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getLayoutOverlapReport,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

async function clickScopeProject(page, pk) {
  const chip = page.locator(`#gov-scope-expanded [data-project="${pk}"]`);
  if (!await chip.isVisible()) await page.locator('#gov-scope-change').click();
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
}

const SD_BRIEF = {
  briefId: 'SSOT-SD',
  projects: ['SD'],
  portfolio: 'SD',
  freshness: { confidenceLimit: 'live', jiraFetchedAt: new Date().toISOString() },
  deliveryTruth: { committed: 2, done: 1 },
  executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
  leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked for SD', narratedBy: 'template' },
  meta: {
    narratedBy: 'template',
    commandAnswerSentence: 'DELIVERY BLOCKED — SD squad act today',
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
  squadInsights: [],
};

const BIO_BRIEF = {
  ...SD_BRIEF,
  briefId: 'SSOT-SD-BIO',
  projects: ['SD', 'BIO'],
  portfolio: 'SD + BIO',
  topRisks: [{
    issueKey: 'BIO-9',
    squad: 'KK board',
    assigneeName: 'Other',
    decisionNeededFrom: 'Leadership',
    recommendedAction: 'Wrong scope',
    escalation: 'act-today',
    displayTitle: 'Wrong squad',
  }],
};

async function mockGovernanceApis(page, brief = SD_BRIEF, delayMs = 0) {
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    sessionStorage.removeItem('delivera:brief:cache:v1');
  });
  await routeProjectsCatalog(page);
  // Keep these legacy Brief tests deterministic. The active-loop journey has
  // its own fail-fast suite; an empty projection deliberately falls back to
  // the legacy Brief surface exercised here.
  await page.route('**/api/governance/active-loop.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({}),
  }));
  await page.route('**/api/governance-brief.json**', async (route) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const url = route.request().url();
    const refresh = url.includes('refresh=1');
    const projects = url.includes('projects=SD%2CBIO') || url.includes('projects=SD,BIO') ? BIO_BRIEF : SD_BRIEF;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...projects, meta: { ...projects.meta, refreshed: refresh } }),
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
    body: JSON.stringify({ projects: ['SD'], boards: [{ id: 1, name: 'SD board', projectKey: 'SD' }], projectErrors: [] }),
  }));
}

test.describe('Governance Brief SSOT loading and scope', () => {
  test('shows loading shell before brief resolves', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page, SD_BRIEF, 400);
    await page.goto('/governance?projects=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const loading = page.locator('#gov-loading');
    await expect(loading).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 15000 });
    await expect(loading).toBeHidden();
    assertTelemetryClean(telemetry);
  });

  test('owner block shows SD scope not foreign KK board', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page);
    await page.goto('/governance?projects=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.gov-answer-block--owner')).toContainText('SD', { timeout: 15000 });
    await expect(page.locator('.gov-answer-block--owner')).not.toContainText('KK');
    assertTelemetryClean(telemetry);
  });

  test('single scope bar mount (no duplicate)', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.goto('/governance?projects=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#gov-scope-bar-mount')).toHaveCount(1);
  });

  test('scope change updates sidebar Projects segment', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page);
    await page.goto('/governance?projects=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 15000 });
    let scopeChanged = false;
    await page.evaluate(() => {
      window.addEventListener('delivera:scope-changed', () => { window.__scopeChanged = true; });
    });
    await clickScopeProject(page, 'BIO');
    await page.waitForTimeout(300);
    scopeChanged = await page.evaluate(() => Boolean(window.__scopeChanged));
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
    await page.goto('/governance?projects=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 15000 });
    await page.locator('#gov-scope-refresh').click();
    await page.waitForTimeout(800);
    expect(urls.some((u) => u.includes('refresh=1'))).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('verified active-loop cache paints the contract answer before slow network completes', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript((brief) => {
      localStorage.setItem('delivera_selectedProjects', 'SD');
      localStorage.setItem('delivera:governance:active-loop:v1:SD:current', JSON.stringify({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        answer: {
          schemaVersion: 1,
          answerVersion: 2,
          answer: 'SD has one PI promise requiring proof.',
          sourceLine: 'Compared with FY27 Q2 PI contract · 1 promise checked · last verified 10:32 UTC',
          deliveraDid: 'Delivera checked the saved promise before contacting Jira.',
          scope: { mode: 'all-squads', projects: ['SD'], complete: true },
          squads: [{ squad: 'SD', attentionCount: 1, topState: '1 no-proof promise', proofState: 'stale proof', piPct: 0 }],
          promises: [],
          loopCompletion: 0,
        },
      }));
    }, SD_BRIEF);
    await routeProjectsCatalog(page);
    await page.route('**/api/governance-brief.json**', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SD_BRIEF) });
    });
    await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"quarters":[]}' }));
    await page.route('**/api/governance/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto('/governance?projects=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.getByTestId('governance-active-loop')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('governance-active-loop')).toContainText('SD has one PI promise requiring proof');
    assertTelemetryClean(telemetry);
  });

  test('scope switch shows stale overlay while brief loads', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page, SD_BRIEF, 500);
    await page.goto('/governance?projects=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 15000 });
    await clickScopeProject(page, 'BIO');
    await expect(page.locator('#gov-brief-content')).toHaveAttribute('data-scope-stale', 'true', { timeout: 3000 });
    await expect(page.locator('.gov-scope-stale-overlay')).toBeVisible();
    await expect(page.locator('#gov-brief-content')).not.toHaveAttribute('data-scope-stale', 'true', { timeout: 15000 });
    assertTelemetryClean(telemetry);
  });

  test('mobile search collapsed does not overlap switcher', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceApis(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance?projects=SD');
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
