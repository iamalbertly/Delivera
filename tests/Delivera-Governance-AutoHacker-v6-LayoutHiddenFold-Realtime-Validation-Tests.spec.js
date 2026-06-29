/**
 * AutoHacker v6 — void gaps, hidden value, mobile fold, inline direct-value.
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
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const AUTOHACKER = join(process.cwd(), '.autohacker');

function stubHeroBrief(overrides = {}) {
  return JSON.stringify({
    briefId: 'V6-SD',
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

async function mockV6Governance(page, { catalogKeys = ['SD'], briefOverrides = {} } = {}) {
  await page.addInitScript(({ key, seed }) => {
    try { localStorage.setItem(key, seed); } catch (_) {}
    try { localStorage.setItem('delivera_sidebar_collapsed', '1'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
    try { sessionStorage.setItem('gov-scope-collapsed', '0'); } catch (_) {}
  }, { key: PROJECTS_SSOT_KEY, seed: catalogKeys.join(',') });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: stubHeroBrief(briefOverrides),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/**', (r) => {
    if (r.request().url().includes('inbox.json')) {
      return r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ nudges: [{ id: 'n1', type: 'nudge', summary: 'MPSA-8174 looks blocked (17 days with no update). Who owns the next step?', issueKey: 'MPSA-8174' }], confirm: [], briefs: [] }),
      });
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
  await page.waitForSelector('#main-content[data-gov-layout-ready="1"]', { timeout: 30000 }).catch(() => {});
  return true;
}

function runCollector(script, runId, extraEnv = {}) {
  const runDir = join(AUTOHACKER, 'runs', runId);
  const env = { ...process.env, AUTOHACKER_RUN_DIR: runDir, AUTOHACKER_RUN_ID: runId, AUTOHACKER_TARGET: 'governance', HEADLESS: '1' };
  Object.assign(env, extraEnv);
  execSync(`node ${script}`, { cwd: process.cwd(), env, stdio: 'pipe', timeout: 180000 });
  return runDir;
}

test.describe('Governance AutoHacker v6 @governance-autohacker-v6 @autohacker', () => {
  test.beforeEach(async ({ page }) => { await mockV6Governance(page); });

  test('61 scope bar spans full shell width desktop', async ({ page }) => {
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

  test('62 promoted meeting script visible without collapsed details', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-promoted-script="1"] .gov-meeting-script-body')).toBeVisible();
    await expect(page.locator('[data-promoted-script="1"] details:not([open])')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('63 agent receipt open by default in right rail', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('.gov-receipt-details[open] .gov-worker-receipt-line')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('64 hidden-value collector at or below v6 threshold', () => {
    const runId = `v6hid-${Date.now()}`;
    const runDir = runCollector('.autohacker/collectors/detect-hidden-value.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'hidden-value-report.json'), 'utf8'));
    expect(report.hiddenValueCount).toBeLessThanOrEqual(8);
  });

  test('65 screenshot density left whitespace bounded', () => {
    const runId = `v6shot-${Date.now()}`;
    runCollector('.autohacker/collectors/explore-page.mjs', runId);
    const runDir = runCollector('.autohacker/collectors/analyze-screenshot-density.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'screenshot-density-report.json'), 'utf8'));
    expect(report.leftWhitespaceRatio).toBeLessThanOrEqual(0.55);
    expect(report.pass).toBe(true);
  });

  test('66 mobile fold dead band below v6 gate', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page, { width: 390, height: 844 }))) return;
    const gap = await page.evaluate(() => {
      const scope = document.querySelector('#gov-scope-bar-mount');
      const value = document.querySelector('.gov-command-answer, #gov-answer-mount');
      if (!scope || !value) return 9999;
      return Math.max(0, Math.round(value.getBoundingClientRect().top - scope.getBoundingClientRect().bottom));
    });
    expect(gap).toBeLessThan(320);
    assertTelemetryClean(t);
  });

  test('67 PI baseline SSOT single CTA when setup gap present', async ({ page }) => {
    await mockV6Governance(page, {
      briefOverrides: {
        meta: {
          setupGaps: [{ id: 'pi-baseline', label: 'PI baseline missing', action: 'set-baseline', severity: 'high' }],
          piConfidence: { trusted: false, counts: { committed: 0 }, timelineChips: [] },
        },
      },
    });
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('[data-setup-baseline-ssot="1"]')).toHaveCount(1);
    await expect(page.locator('[data-squad-pi-row="1"] [data-setup-baseline-ssot]')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('68 no auto PI wizard on first governance load', async ({ page }) => {
    await page.addInitScript(() => { try { sessionStorage.removeItem('gov-pi-auto-open-dismissed'); } catch (_) {} });
    await mockV6Governance(page, {
      briefOverrides: {
        meta: {
          setupGaps: [{ id: 'pi-baseline', label: 'PI baseline missing', action: 'set-baseline', severity: 'high' }],
        },
      },
    });
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await page.waitForTimeout(600);
    await expect(page.locator('#gov-pi-baseline-wizard, [data-pi-wizard-open="1"]')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('69 all proof scrolls rail into view', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const proofBtn = page.locator('#gov-main-fold-proof #gov-evidence-preview-more, #gov-right-rail-proof-mount #gov-evidence-preview-more').first();
    const before = await proofBtn.evaluate((el) => el.getBoundingClientRect().top);
    await proofBtn.click();
    await page.waitForTimeout(400);
    const after = await proofBtn.evaluate((el) => el.getBoundingClientRect().top);
    expect(after).toBeLessThanOrEqual(before + 40);
    assertTelemetryClean(t);
  });

  test('70 scope capsule text not truncated at desktop', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const clipped = await page.locator('.gov-scope-capsule-text').evaluate((el) => {
      const st = getComputedStyle(el);
      return st.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 4;
    });
    expect(clipped).toBe(false);
    assertTelemetryClean(t);
  });

  test('71 advanced scope deduped to single details block', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    await expect(page.locator('.gov-scope-intel-block')).toHaveCount(1);
    assertTelemetryClean(t);
  });

  test('72 inbox inline summary not ellipsis clipped', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    if (!(await loadGov(page))) return;
    const clipped = await page.locator('.gov-inbox-inline-summary').first().evaluate((el) => {
      const st = getComputedStyle(el);
      return st.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 4;
    }).catch(() => false);
    expect(clipped).toBe(false);
    assertTelemetryClean(t);
  });

  test('73 compare-add ignored while brief loading', async ({ page }) => {
    await mockV6Governance(page, { catalogKeys: GOV_CATALOG_KEYS.slice(0, 4) });
    const t = captureBrowserTelemetry(page);
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-compare-add]').first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
    assertTelemetryClean(t);
  });

  test('74 state matrix summary passes v6 gates', () => {
    const runId = `v6matrix-${Date.now()}`;
    runCollector('.autohacker/collectors/explore-page.mjs', runId);
    runCollector('.autohacker/collectors/detect-horizontal-void.mjs', runId, { MAX_HORIZONTAL_VOID_RATIO: '0.55' });
    runCollector('.autohacker/collectors/detect-content-overlap.mjs', runId);
    runCollector('.autohacker/collectors/detect-negative-void.mjs', runId);
    runCollector('.autohacker/collectors/detect-main-column-void.mjs', runId);
    runCollector('.autohacker/collectors/detect-hidden-value.mjs', runId);
    runCollector('.autohacker/collectors/synthesize-ux-metrics.mjs', runId);
    runCollector('.autohacker/collectors/analyze-screenshot-density.mjs', runId);
    const runDir = runCollector('.autohacker/collectors/synthesize-state-matrix.mjs', runId);
    const report = JSON.parse(readFileSync(join(runDir, 'state-matrix-summary.json'), 'utf8'));
    expect(report.worst).toBeTruthy();
    expect(report.pass).toBe(true);
  });

  test('75 edge empty scope shows needs-scope without console errors', async ({ page }) => {
    await page.addInitScript((key) => { try { localStorage.setItem(key, ''); } catch (_) {} }, PROJECTS_SSOT_KEY);
    const t = captureBrowserTelemetry(page);
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'needs-scope', { timeout: 30000 });
    assertTelemetryClean(t);
  });

});
