/**
 * AutoHacker v4 - duplicate text, main-column void, fold clipping, meeting script open.
 * Customer | Realism & Simplicity | Speed & Trust
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog, GOV_CATALOG_KEYS } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import {
  waitForPortfolioReady,
  legacyBrief,
  mockPortfolioDecision,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const AUTOHACKER = join(process.cwd(), '.autohacker');

function stubHeroBrief(overrides = {}) {
  return JSON.stringify({
    briefId: 'V4-SD',
    projects: ['SD'],
    portfolio: 'SD',
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked', meetingScript: 'SD delivery is blocked — confirm owner and next step in standup.', narratedBy: 'template' },
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      commandAnswerSentence: 'DELIVERY BLOCKED',
      safeToSend: true,
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 1 },
      piConfidence: { trusted: false, counts: { committed: 0 }, timelineChips: [] },
      setupGaps: [],
      ...overrides.meta,
    },
    topRisks: [{ issueKey: 'SD-1', assigneeName: 'Amani', recommendedAction: 'Unblock', escalation: 'act-today', issueUrl: 'https://x/SD-1', displayTitle: 'Stuck epic', summary: 'Stuck' }],
    evidencePack: { rows: [{ issueKey: 'SD-1', statusNow: 'Open', whyFlagged: 'stale' }] },
    squadInsights: [{
      projectKey: 'SD', verdictTier: 'blocked', verdictLabel: 'Blocked',
      bottleneckLine: 'Leadership', productivityLine: 'Stale',
      sprintPulse: { committed: 4, done: 1 }, piCommitted: 0, piDone: 0,
      cardRisks: [{ issueKey: 'SD-1', displayTitle: 'Stuck epic' }, { issueKey: 'SD-2', displayTitle: 'Scope drift' }],
    }],
    portfolioRollup: { summaryLine: '1 blocker' },
    ...overrides,
  });
}

async function mockV4Governance(page, { catalogKeys = ['SD'] } = {}) {
  await page.addInitScript(({ key, seed }) => {
    try { localStorage.setItem(key, seed); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
    try { sessionStorage.setItem('gov-scope-collapsed', '0'); } catch (_) {}
  }, { key: PROJECTS_SSOT_KEY, seed: catalogKeys.join(',') });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: stubHeroBrief(),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/**', (r) => {
    if (r.request().url().includes('inbox.json')) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nudges: [], confirm: [], briefs: [] }) });
    }
    if (r.request().url().includes('portfolio-decision.json')) {
      return r.continue();
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await mockPortfolioDecision(page);
}

async function loadGov(page, vp = { width: 1280, height: 900 }) {
  await page.setViewportSize(vp);
  await page.goto('/governance', { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await skipIfRedirectedToLogin(page, test)) return false;
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await waitForPortfolioReady(page).catch(() => {});
  await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', /content|loading|error/, { timeout: 60000 });
  return true;
}

function runCollector(script, runId, extraEnv = {}) {
  const runDir = join(AUTOHACKER, 'runs', runId);
  const env = { ...process.env, AUTOHACKER_RUN_DIR: runDir, AUTOHACKER_RUN_ID: runId, AUTOHACKER_TARGET: 'governance', HEADLESS: '1' };
  if (!('AUTOHACKER_DUP_OUT' in extraEnv)) delete env.AUTOHACKER_DUP_OUT;
  if (!('AUTOHACKER_CATALOG' in extraEnv)) delete env.AUTOHACKER_CATALOG;
  Object.assign(env, extraEnv);
  execSync(`node ${script}`, {
    cwd: process.cwd(),
    env,
    stdio: 'pipe',
    timeout: 180000,
  });
  return runDir;
}

test.describe('Governance AutoHacker v4 @governance-autohacker-v4 @autohacker', () => {
  test.beforeEach(async ({ page }) => { await mockV4Governance(page); });

  test('25 hero inline evidence without duplicate risk list', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-direct-value="evidence"]')).toBeVisible();
    await expect(page.locator('.gov-risk-tile-risks')).toHaveCount(0);
    const titles = await page.locator('[data-direct-value="evidence"] li').allTextContents();
    expect(new Set(titles.map((x) => x.trim())).size).toBe(titles.length);
    assertTelemetryClean(t);
  });

  test('26 meeting script open by default on governance', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const promoted = page.locator('[data-promoted-script="1"] details, #gov-script-mount details').first();
    await expect(promoted).toHaveAttribute('open', '');
    assertTelemetryClean(t);
  });

  test('27 duplicate-text collector zero duplicates hero SD', () => {
    const runId = `v4dup-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-duplicate-visible-text.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'duplicate-text-report.json'), 'utf8'));
    expect(report.duplicateCount).toBeLessThanOrEqual(0);
  });

  test('28 main-column void below threshold', () => {
    const runId = `v4void-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-main-column-void.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'main-column-void-report.json'), 'utf8'));
    expect(report.mainColumnVoidPx).toBeLessThanOrEqual(240);
    expect(report.pass).toBe(true);
  });

  test('29 fold-clipping collector within gate', () => {
    const runId = `v4fold-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-fold-clipping.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'fold-clipping-report.json'), 'utf8'));
    expect(report.clippedCount).toBeLessThanOrEqual(3);
  });

  test('30 scope to first value gap bounded on page', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const gap = await page.evaluate(() => {
      const scope = document.querySelector('#portfolio-scope-bar-mount, #gov-scope-bar-mount, #gov-scope-expanded');
      const value = document.querySelector('[data-portfolio-signal], [data-direct-value="squad-detail"], #gov-brief-content .gov-command-answer');
      if (!scope || !value) return 9999;
      return Math.round(value.getBoundingClientRect().top - scope.getBoundingClientRect().bottom);
    });
    expect(gap).toBeLessThan(250);
    assertTelemetryClean(t);
  });

  test('31 no repeated Stuck epic in hero card DOM', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const count = await page.locator('.gov-portfolio-grid-wrap--single :text("Stuck epic")').count();
    expect(count).toBe(1);
    assertTelemetryClean(t);
  });

  test('32 portfolio signal visible; legacy command answer hydrated', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-portfolio-signal]')).toBeVisible();
    await expect(legacyBrief(page, '.gov-command-answer')).toBeAttached();
    assertTelemetryClean(t);
  });

  test('33 real catalog multi-squad shows heat tray when 6 squads', async ({ page }) => {
    await mockV4Governance(page, { catalogKeys: GOV_CATALOG_KEYS.slice(0, 6) });
    await page.unroute('**/api/governance-brief.json**');
    const squads = GOV_CATALOG_KEYS.slice(0, 6).map((pk, i) => ({
      projectKey: pk, verdictTier: i === 0 ? 'blocked' : 'watch', verdictLabel: 'Watch',
      bottleneckLine: 'Test', productivityLine: 'Act',
      sprintPulse: { committed: 2, done: 1 }, piCommitted: 2, piDone: 1,
      cardRisks: [{ issueKey: `${pk}-1`, displayTitle: `Risk ${pk}` }],
    }));
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        briefId: 'V4-MULTI',
        projects: GOV_CATALOG_KEYS.slice(0, 6),
        portfolio: 'Multi',
        executiveView: { verdictTier: 'watch', verdictLine: 'WATCH' },
        leadershipNarrative: { confidence: 'medium', meetingAnswer: 'Watch', narratedBy: 'template' },
        freshness: { confidenceLimit: 'live' },
        meta: { safeToSend: true, workerReceipt: { line: 'ok' }, piConfidence: { trusted: true, counts: { committed: 1 }, timelineChips: [] } },
        topRisks: [],
        evidencePack: { rows: [] },
        squadInsights: squads,
        portfolioRollup: { summaryLine: '6 squads' },
      }),
    }));
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('.gov-portfolio-grid-wrap--tray')).toBeVisible();
    await expect(page.locator('[data-heat-tile]')).toHaveCount(6);
    assertTelemetryClean(t);
  });

  test('34 hidden-value count at or below v4 threshold', () => {
    const runId = `v4hid-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-hidden-value.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'hidden-value-report.json'), 'utf8'));
    expect(report.hiddenValueCount).toBeLessThanOrEqual(4);
  });

  test('35 autohacker v4 validate PASS with all gates', () => {
    execSync('npm run autohacker:validate', { cwd: process.cwd(), stdio: 'pipe', timeout: 300000 });
    const runsDir = join(AUTOHACKER, 'runs');
    const latest = readdirSync(runsDir).filter((d) => /^\d{8}_\d{6}$/.test(d)).sort().pop();
    const progress = readFileSync(join(runsDir, latest, 'progress.log'), 'utf8');
    expect(progress).toMatch(/Validate.*PASS/i);
    expect(progress).toMatch(/duplicate-text|main-column-void|fold-clipping/i);
  });

  test('36 bonus scope bar visible without scroll desktop', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const top = await page.locator('#gov-scope-bar-mount, #gov-scope-expanded').first().evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeLessThan(320);
    assertTelemetryClean(t);
  });

  test('37 bonus meeting script copy reachable without click', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-promoted-script="1"] details[open], #gov-script-mount details[open]')).toBeVisible();
    const text = await page.locator('[data-promoted-script="1"] details[open], #gov-script-mount details[open]').innerText();
    expect(text.length).toBeGreaterThan(20);
    assertTelemetryClean(t);
  });

  test('38 bonus full-catalog duplicate collector runs', () => {
    const runId = `v4full-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-duplicate-visible-text.mjs', runId, { AUTOHACKER_CATALOG: 'full', AUTOHACKER_DUP_OUT: 'duplicate-text-full-catalog-report.json' });
    expect(existsSync(join(runDir, 'duplicate-text-full-catalog-report.json'))).toBe(true);
  });

  test('39 bonus mobile meeting script open', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page, { width: 390, height: 844 }))) return;
    await expect(page.locator('.gov-meeting-script[open]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('40 bonus sprint link still direct-value not button stack', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-direct-value="sprint-link"]')).toBeVisible();
    await expect(page.locator('.gov-squad-detail-actions .btn-primary')).toHaveCount(0);
    assertTelemetryClean(t);
  });
});
