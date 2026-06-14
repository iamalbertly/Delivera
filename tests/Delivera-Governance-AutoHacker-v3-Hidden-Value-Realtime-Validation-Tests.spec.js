/**
 * AutoHacker v3 - hidden value, intra-card void, direct-to-value governance contracts.
 * Customer | Realism & Simplicity | Speed & Trust
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getLayoutOverlapReport,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const AUTOHACKER = join(process.cwd(), '.autohacker');

function stubHeroBrief(overrides = {}) {
  return JSON.stringify({
    briefId: 'V3-SD',
    projects: ['SD'],
    portfolio: 'SD',
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked', narratedBy: 'template' },
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

async function mockV3Governance(page) {
  await page.addInitScript((key) => {
    try { localStorage.setItem(key, 'SD'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
    try { sessionStorage.setItem('gov-scope-collapsed', '0'); } catch (_) {}
  }, PROJECTS_SSOT_KEY);
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
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function loadGov(page, vp = { width: 1280, height: 900 }) {
  await page.setViewportSize(vp);
  await page.goto('/governance', { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await skipIfRedirectedToLogin(page, test)) return false;
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', /content|loading|error/, { timeout: 60000 });
  return true;
}

test.describe('Governance AutoHacker v3 @governance-autohacker-v3 @autohacker', () => {
  test.beforeEach(async ({ page }) => { await mockV3Governance(page); });

  test('01 hero squad detail visible without tile click', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-direct-value="squad-detail"]')).toBeVisible({ timeout: 15000 });
    assertTelemetryClean(t);
  });

  test('02 inline evidence visible without Open evidence button', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-direct-value="evidence"]')).toBeVisible();
    await expect(page.locator('.gov-proof-chip:has-text("Open evidence")')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('03 scope expanded visible inline desktop', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('#gov-scope-expanded')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('04 send readiness pill on scope bar', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('#gov-send-readiness-pill')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('05 no duplicate sticky verdict on scroll', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(page.locator('.gov-sticky-answer--governance')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('06 right rail not nested scroll container', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const oy = await page.locator('.gov-right-rail').first().evaluate((el) => getComputedStyle(el).overflowY);
    expect(oy).not.toBe('auto');
    assertTelemetryClean(t);
  });

  test('07 hero card intra void below threshold', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const maxGap = await page.evaluate(() => {
      const el = document.querySelector('.gov-portfolio-grid-wrap--single');
      if (!el) return 0;
      const kids = [...el.children].filter((c) => c.getBoundingClientRect().height > 8);
      let max = 0;
      for (let i = 0; i < kids.length - 1; i++) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[i + 1].getBoundingClientRect();
        max = Math.max(max, Math.round(b.top - a.bottom));
      }
      return max;
    });
    expect(maxGap).toBeLessThan(160);
    assertTelemetryClean(t);
  });

  test('08 grouped send one-click visible', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-grouped-send="0"]')).toBeVisible({ timeout: 20000 });
    assertTelemetryClean(t);
  });

  test('09 proof cluster does not open supporting evidence accordion', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await page.locator('[data-proof-cluster]').first().click();
    await expect(page.locator('#gov-supporting-evidence[open]')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('10 issue preview keeps governance URL', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const before = page.url();
    await page.locator('.gov-cluster-issue-key[data-issue-key]').first().click();
    await expect(page.locator('#delivera-shared-issue-preview')).toBeVisible();
    expect(page.url()).toBe(before);
    assertTelemetryClean(t);
  });

  test('11 mobile scope inline no scope-sheet drawer', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page, { width: 375, height: 812 }))) return;
    await expect(page.locator('#gov-scope-expanded')).toBeVisible();
    await expect(page.locator('.gov-right-drawer-panel--scope-sheet')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('12 escape dismisses drawer', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await page.locator('[data-proof-cluster]').first().click();
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/gov-right-drawer-open/);
    assertTelemetryClean(t);
  });

  test('13 chrome overlap bounded', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const overlap = await getLayoutOverlapReport(page, {
      selectors: ['#app-top-chrome', '#gov-scope-bar-mount', '#main-content'],
      maxPairs: 12,
    });
    expect(overlap.overlaps.filter((o) => o.overlapPx > 4000)).toHaveLength(0);
    assertTelemetryClean(t);
  });

  test('14 stale brief hides send shows trust pill', async ({ page }) => {
    await page.unroute('**/api/governance-brief.json**');
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: stubHeroBrief({ freshness: { confidenceLimit: 'stale' }, meta: { safeToSend: false } }),
    }));
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('#gov-send-readiness-pill')).toContainText(/Stale|refresh/i);
    await expect(page.locator('[data-grouped-send]')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('15 no object Object in banner', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('body')).not.toContainText('[object Object]');
    assertTelemetryClean(t);
  });

  test('16 keyboard scope refresh focusable', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await page.locator('#gov-scope-refresh').focus();
    await expect(page.locator('#gov-scope-refresh')).toBeFocused();
    assertTelemetryClean(t);
  });

  test('17 hidden-value collector runs', () => {
    const runId = `v3-${Date.now()}`;
    const runDir = join(AUTOHACKER, 'runs', runId);
    execSync('node .autohacker/collectors/detect-hidden-value.mjs', {
      cwd: process.cwd(),
      env: { ...process.env, AUTOHACKER_RUN_DIR: runDir, AUTOHACKER_RUN_ID: runId, AUTOHACKER_TARGET: 'governance', HEADLESS: '1' },
      stdio: 'pipe',
      timeout: 120000,
    });
    const report = JSON.parse(readFileSync(join(runDir, 'hidden-value-report.json'), 'utf8'));
    expect(report.hiddenValueCount).toBeGreaterThanOrEqual(0);
    expect(report.findings).toBeDefined();
  });

  test('18 intra-card void collector runs', () => {
    const runId = `v3v-${Date.now()}`;
    const runDir = join(AUTOHACKER, 'runs', runId);
    execSync('node .autohacker/collectors/detect-intra-card-void.mjs', {
      cwd: process.cwd(),
      env: { ...process.env, AUTOHACKER_RUN_DIR: runDir, AUTOHACKER_RUN_ID: runId, AUTOHACKER_TARGET: 'governance', HEADLESS: '1' },
      stdio: 'pipe',
      timeout: 120000,
    });
    expect(existsSync(join(runDir, 'intra-card-void-report.json'))).toBe(true);
  });

  test('19 explore-page produces real ideas without padding flag', () => {
    const runId = `v3e-${Date.now()}`;
    const runDir = join(AUTOHACKER, 'runs', runId);
    execSync('node scripts/Delivera-Dev-Port-Guard-01Check.js && node .autohacker/collectors/explore-page.mjs', {
      cwd: process.cwd(),
      env: { ...process.env, AUTOHACKER_RUN_DIR: runDir, AUTOHACKER_RUN_ID: runId, AUTOHACKER_TARGET: 'governance', HEADLESS: '1' },
      stdio: 'pipe',
      timeout: 180000,
    });
    const report = JSON.parse(readFileSync(join(runDir, 'exploration-report.json'), 'utf8'));
    expect(report.summary.realIdeaCount).toBeGreaterThanOrEqual(4);
    expect(report.summary.paddedToTwenty).not.toBe(true);
  });

  test('20 prompt library has v3 phase templates', () => {
    for (const f of ['00-explore-cursor.md', '01-investigation.md', '02-master-plan.md', '03-build.md']) {
      expect(existsSync(join(AUTOHACKER, 'prompts', f))).toBe(true);
    }
  });

  test('21 autohacker validate writes progress log', () => {
    execSync('npm run autohacker:validate', { cwd: process.cwd(), stdio: 'pipe', timeout: 180000 });
    const runsDir = join(AUTOHACKER, 'runs');
    const latest = readdirSync(runsDir).filter((d) => /^\d{8}_\d{6}$/.test(d)).sort().pop();
    const progress = readFileSync(join(runsDir, latest, 'progress.log'), 'utf8');
    expect(progress).toMatch(/Validate.*PASS/i);
    expect(progress).toMatch(/hidden-value|intra-card-void|explore-page/i);
  });

  test('22 bonus mobile value anchor reachable', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page, { width: 390, height: 844 }))) return;
    const scrollNeed = await page.evaluate(() => {
      const el = document.querySelector('[data-direct-value="squad-detail"], .gov-portfolio-banner-line');
      if (!el) return 9999;
      const r = el.getBoundingClientRect();
      return r.top > window.innerHeight - 40 ? Math.round(r.top + window.scrollY) : 0;
    });
    expect(scrollNeed).toBeLessThan(1200);
    assertTelemetryClean(t);
  });

  test('23 bonus sprint link is text not primary button in hero', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-direct-value="sprint-link"]')).toContainText(/View sprint/i);
    await expect(page.locator('.gov-squad-detail-actions .btn-secondary:has-text("Open sprint")')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('24 bonus status chip in-place highlight', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await page.locator('[data-scope-status-action]').click({ timeout: 8000 });
    await expect(page.locator('[data-scope-status-active="1"]')).toBeVisible({ timeout: 3000 });
    assertTelemetryClean(t);
  });
});
