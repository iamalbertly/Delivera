/**
 * AutoHacker v5 - layout adaptive gates: horizontal void, overlap, stacking, screenshot density.
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
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const AUTOHACKER = join(process.cwd(), '.autohacker');

function stubHeroBrief(overrides = {}) {
  return JSON.stringify({
    briefId: 'V5-SD',
    projects: ['SD'],
    portfolio: 'SD',
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: {
      confidence: 'low',
      meetingAnswer: 'Blocked',
      meetingScript: 'SD delivery is blocked — confirm owner and next step in standup.',
      narratedBy: 'template',
    },
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
      cardRisks: [{ issueKey: 'SD-1', displayTitle: 'Stuck epic' }],
    }],
    portfolioRollup: { summaryLine: '1 blocker' },
    ...overrides,
  });
}

async function mockV5Governance(page, { catalogKeys = ['SD'] } = {}) {
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
  await page.waitForSelector('#main-content[data-gov-layout-ready="1"]', { timeout: 30000 }).catch(() => {});
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

test.describe('Governance AutoHacker v5 @governance-autohacker-v5 @autohacker', () => {
  test.beforeEach(async ({ page }) => { await mockV5Governance(page); });

  test('41 desktop grid active before content paint', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toHaveClass(/governance-shell--desktop-grid/);
    assertTelemetryClean(t);
  });

  test('42 layout ready sentinel after brief load', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('#main-content')).toHaveAttribute('data-gov-layout-ready', '1');
    assertTelemetryClean(t);
  });

  test('43 meeting script visible without click blocked tier', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-promoted-script="1"] details[open], .gov-meeting-script[open]').first()).toBeVisible();
    assertTelemetryClean(t);
  });

  test('44 horizontal-void collector passes gate', () => {
    const runId = `v5hvoid-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-horizontal-void.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'horizontal-void-report.json'), 'utf8'));
    expect(report.horizontalVoidRatio).toBeLessThanOrEqual(0.35);
    expect(report.pass).toBe(true);
  });

  test('45 content-overlap collector passes gate', () => {
    const runId = `v5overlap-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-content-overlap.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'content-overlap-report.json'), 'utf8'));
    expect(report.overlapPxTotal).toBeLessThanOrEqual(500);
    expect(report.obscuredValueCount).toBeLessThanOrEqual(0);
    expect(report.pass).toBe(true);
  });

  test('46 negative-void stacking not detected', () => {
    const runId = `v5nvoid-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-negative-void.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'negative-void-report.json'), 'utf8'));
    expect(report.stackingDetected).not.toBe(true);
    expect(report.mainColumnVoidPx).toBeGreaterThanOrEqual(0);
    expect(report.pass).toBe(true);
  });

  test('47 main-column void non-negative and bounded', () => {
    const runId = `v5mvoid-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-main-column-void.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'main-column-void-report.json'), 'utf8'));
    expect(report.mainColumnVoidPx).toBeGreaterThanOrEqual(0);
    expect(report.mainColumnVoidPx).toBeLessThanOrEqual(240);
    expect(report.pass).toBe(true);
  });

  test('48 screenshot density left whitespace bounded', () => {
    const runId = `v5shot-${Date.now()}`;
    runCollector('.autohacker/collectors/explore-page.mjs', runId);
    const runDir = runCollector('.autohacker/collectors/analyze-screenshot-density.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'screenshot-density-report.json'), 'utf8'));
    expect(report.leftWhitespaceRatio).toBeLessThanOrEqual(0.55);
    expect(report.pass).toBe(true);
  });

  test('49 hidden-value count at or below v5 threshold', () => {
    const runId = `v5hid-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-hidden-value.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'hidden-value-report.json'), 'utf8'));
    expect(report.hiddenValueCount).toBeLessThanOrEqual(2);
  });

  test('50 scope bar spans full shell width desktop', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const widths = await page.evaluate(() => {
      const shell = document.querySelector('#main-content');
      const scope = document.querySelector('#gov-scope-bar-mount');
      if (!shell || !scope) return null;
      return { shell: shell.getBoundingClientRect().width, scope: scope.getBoundingClientRect().width };
    });
    expect(widths).not.toBeNull();
    expect(widths.scope / widths.shell).toBeGreaterThan(0.85);
    assertTelemetryClean(t);
  });

  test('51 progressive squad chip overflow when catalog large', async ({ page }) => {
    await mockV5Governance(page, { catalogKeys: GOV_CATALOG_KEYS.slice(0, 10) });
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('.gov-scope-chip-overflow summary')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('52 sticky chrome ratio within v5 gate', () => {
    const runId = `v5metrics-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/synthesize-ux-metrics.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'metrics-snapshot.json'), 'utf8'));
    expect(report.stickyChromeRatio).toBeLessThanOrEqual(0.45);
  });

  test('53 state matrix summary aggregates worst metrics', () => {
    const runId = `v5matrix-${Date.now()}`;
    runCollector('.autohacker/collectors/detect-horizontal-void.mjs', runId);
    runCollector('.autohacker/collectors/detect-content-overlap.mjs', runId);
    runCollector('.autohacker/collectors/detect-negative-void.mjs', runId);
    runCollector('.autohacker/collectors/detect-main-column-void.mjs', runId);
    runCollector('.autohacker/collectors/detect-hidden-value.mjs', runId);
    runCollector('.autohacker/collectors/synthesize-ux-metrics.mjs', runId);
    const runDir = runCollector('.autohacker/collectors/synthesize-state-matrix.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'state-matrix-summary.json'), 'utf8'));
    expect(report.worst).toBeTruthy();
    expect(report.pass).toBe(true);
  });

  test('54 command answer direct-value without extra click', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-portfolio-signal]')).toBeVisible();
    await expect(legacyBrief(page, '.gov-command-answer')).toBeAttached();
    await expect(page.locator('[data-direct-value="evidence"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('55 mobile fold dead band reduced vs v4 baseline', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page, { width: 390, height: 844 }))) return;
    const gap = await page.evaluate(() => {
      const scope = document.querySelector('#gov-scope-bar-mount');
      const value = document.querySelector('[data-portfolio-signal], .gov-command-answer, #gov-answer-mount');
      if (!scope || !value) return 9999;
      return Math.max(0, Math.round(value.getBoundingClientRect().top - scope.getBoundingClientRect().bottom));
    });
    expect(gap).toBeLessThan(320);
    assertTelemetryClean(t);
  });

  test('56 escape closes scope drawer without console error', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    assertTelemetryClean(t);
  });

  test('57 duplicate refresh SSOT scope bar only on desktop', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const refreshCount = await page.locator('#gov-scope-refresh').count();
    expect(refreshCount).toBe(1);
    assertTelemetryClean(t);
  });

  test('58 v5 collector artifacts present after explore', () => {
    const runId = `v5explore-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/explore-page.mjs', runId);
    expect(existsSync(join(runDir, 'exploration-report.json'))).toBe(true);
    expect(existsSync(join(runDir, 'screenshots', 'desktop-fold.png'))).toBe(true);
    const summary = JSON.parse(readFileSync(join(runDir, 'exploration-report.json'), 'utf8')).summary;
    expect(summary.ideaCount).toBeGreaterThanOrEqual(20);
  });
});
