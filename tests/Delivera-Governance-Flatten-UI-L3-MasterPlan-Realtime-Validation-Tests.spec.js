/**
 * L3 Flatten Governance UI — Customer · Realism & Simplicity · Speed & Trust.
 * Validates scope flatten, single scroll owner, cluster/evidence scroll-chain cuts.
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

function squadInsight(pk, tier = 'watch') {
  return {
    projectKey: pk,
    verdictTier: tier,
    verdictLabel: tier === 'blocked' ? 'DELIVERY BLOCKED' : 'Watch',
    bottleneckLine: `${pk} bottleneck`,
    productivityLine: 'Stale work',
    sprintPulse: { committed: 4, done: 1 },
    piCommitted: 4,
    piDone: 1,
    cardRisks: [{ issueKey: `${pk}-1`, displayTitle: 'Stuck' }],
  };
}

function stubL3Brief(projects = ['SD'], overrides = {}) {
  const keys = Array.isArray(projects) ? projects : String(projects).split(',').map((p) => p.trim()).filter(Boolean);
  const primary = keys[0] || 'SD';
  return JSON.stringify({
    briefId: `L3-${keys.join('-')}`,
    projects: keys,
    portfolio: keys.join(' + '),
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked today', narratedBy: 'template' },
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      commandAnswerSentence: 'DELIVERY BLOCKED — act today',
      safeToSend: true,
      sinceLastRun: { summary: 'Since last brief: +1 blocker', parts: ['+1 blocker'] },
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 2, sinceLastRun: { summary: 'Since last brief: +1 blocker' } },
      piConfidence: { trusted: false, counts: { committed: 0 }, timelineChips: [] },
      setupGaps: [],
      ...overrides.meta,
    },
    topRisks: [{
      issueKey: `${primary}-1`,
      assigneeName: 'Amani',
      recommendedAction: 'Unblock today',
      escalation: 'act-today',
      issueUrl: `https://example/${primary}-1`,
      displayTitle: 'Stuck epic',
      summary: 'Stuck',
    }],
    evidencePack: {
      rows: [
        { issueKey: `${primary}-1`, statusNow: 'In Progress', whyFlagged: 'stale', changelogAvailable: true },
        { issueKey: `${primary}-2`, statusNow: 'Open', whyFlagged: 'stale' },
      ],
    },
    squadInsights: keys.map((pk) => squadInsight(pk, pk === primary ? 'blocked' : 'watch')),
    ...overrides,
  });
}

async function mockL3Governance(page, opts = {}) {
  const { projects = 'SD' } = opts;
  await page.addInitScript(({ key, pk }) => {
    try { localStorage.setItem(key, pk); } catch (_) {}
    try { sessionStorage.removeItem('delivera:brief:cache:v1'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
  }, { key: PROJECTS_SSOT_KEY, pk: projects });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', async (route) => {
    const url = route.request().url();
    const reqProjects = decodeURIComponent((url.match(/projects=([^&]+)/) || [])[1] || projects).toUpperCase();
    const keys = reqProjects.split(',').map((p) => p.trim()).filter(Boolean);
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: stubL3Brief(keys.length ? keys : ['SD']),
    });
  });
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/**', (r) => {
    if (r.request().url().includes('inbox.json')) {
      return r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          briefs: [],
          nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge draft', payload: { owner: 'Amani', issueKey: 'SD-1', draftText: 'Please update' } }],
          confirm: [{ id: 'c1', type: 'confirm', summary: 'Approve send', payload: { issueKey: 'SD-1' } }],
          piDrift: [], impact: [], poReadiness: [],
        }),
      });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/governance/inbox/**/resolve**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }),
  }));
  await page.route('**/api/issues/**/comment**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }),
  }));
}

async function loadGovernance(page, viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto('/governance', { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await skipIfRedirectedToLogin(page, test)) return false;
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', /content|loading|error/, { timeout: 60000 });
  return true;
}

async function railScrollMetrics(page) {
  return page.evaluate(() => {
    const rail = document.querySelector('.gov-right-rail');
    const preview = document.querySelector('.gov-inbox-inline-preview');
    const cs = rail ? getComputedStyle(rail) : null;
    const ps = preview ? getComputedStyle(preview) : null;
    return {
      railOverflowY: cs?.overflowY || null,
      railMaxHeight: cs?.maxHeight || null,
      railPosition: cs?.position || null,
      previewMaxHeight: ps?.maxHeight || null,
      previewOverflowY: ps?.overflowY || null,
      scopeHeight: document.querySelector('.gov-scope-bar-sticky')?.getBoundingClientRect().height || 0,
      bodyDrawerLock: document.body.classList.contains('gov-right-drawer-open'),
    };
  });
}

test.describe('Governance flatten UI L3 @governance-flatten-l3', () => {
  test.describe.configure({ retries: 0 });

  test.beforeEach(async ({ page }) => {
    await mockL3Governance(page);
  });

  // --- Phase 1: Scope bar flatten (Customer + Simplicity) ---
  test('01 desktop scope expanded always visible inline', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await expect(page.locator('#gov-scope-expanded')).toBeVisible();
    await expect(page.locator('.gov-scope-chips .gov-scope-chip').first()).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('02 scope summary strip stays compact while expanded chips stay inline', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    const m = await page.evaluate(() => {
      const strip = document.querySelector('.gov-scope-summary-strip')?.getBoundingClientRect().height || 0;
      const expanded = document.querySelector('#gov-scope-expanded')?.getBoundingClientRect().height || 0;
      const sticky = document.querySelector('.gov-scope-bar-sticky');
      const stickyPos = sticky ? getComputedStyle(sticky).position : '';
      return { stripH: strip, expandedH: expanded, stickyPos };
    });
    expect(m.stripH).toBeGreaterThan(20);
    expect(m.stripH).toBeLessThanOrEqual(80);
    expect(m.expandedH).toBeGreaterThan(40);
    expect(['sticky', 'relative', 'static']).toContain(m.stickyPos);
    assertTelemetryClean(telemetry);
  });

  test('03 mobile scope inline without scope-sheet drawer', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page, { width: 375, height: 812 }))) return;
    await expect(page.locator('#gov-scope-toggle')).toBeVisible();
    await expect(page.locator('#gov-scope-bar-mount')).toHaveAttribute('data-scope-collapsed', '1');
    await page.locator('#gov-scope-toggle').click();
    await expect(page.locator('#gov-scope-expanded')).toBeVisible();
    await expect(page.locator('.gov-right-drawer-panel--scope-sheet')).toHaveCount(0);
    assertTelemetryClean(telemetry);
  });

  test('04 scope refresh survives rapid double-click (Speed & Trust)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await page.locator('#gov-scope-refresh').dblclick();
    await page.waitForTimeout(800);
    await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'content');
    assertTelemetryClean(telemetry);
  });

  test('05 status chip uses in-place highlight (data-scope-status-active)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.locator('[data-scope-status-action]').click({ timeout: 8000 });
    await expect(page.locator('[data-scope-status-active="1"]')).toBeVisible({ timeout: 3000 });
    assertTelemetryClean(telemetry);
  });

  test('06 period pills visible in scope row (zero extra drawer)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await expect(page.locator('[data-period-chip]').first()).toBeVisible({ timeout: 10000 });
    assertTelemetryClean(telemetry);
  });

  test('07 send-readiness pill SSOT on scope bar (Customer)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await expect(page.locator('#gov-send-readiness-pill')).toBeVisible();
    await expect(page.locator('.gov-owner-cluster-head .gov-send-badge')).toHaveCount(0);
    assertTelemetryClean(telemetry);
  });

  test('08 edge: multi-project scope chips remain tappable', async ({ page }) => {
    await mockL3Governance(page, { projects: 'SD,MPSA' });
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await expect(page.locator('.gov-scope-chip[data-project="MPSA"]')).toBeVisible({ timeout: 10000 });
    await page.locator('.gov-scope-chip[data-project="MPSA"]').click();
    await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'content');
    assertTelemetryClean(telemetry);
  });

  // --- Phase 2: Single scroll owner (Realism & Simplicity) ---
  test('09 desktop right rail is not a nested scroll container', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    const m = await railScrollMetrics(page);
    expect(m.railOverflowY).not.toBe('auto');
    expect(m.railOverflowY).not.toBe('scroll');
    expect(m.railMaxHeight).toMatch(/none|0px|100%|auto/i);
    assertTelemetryClean(telemetry);
  });

  test('10 desktop grid rail uses static positioning', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    const m = await railScrollMetrics(page);
    expect(m.railPosition).toBe('static');
    assertTelemetryClean(telemetry);
  });

  test('11 inbox inline preview has no max-height scroll trap', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await expect(page.locator('.gov-inbox-inline-preview').first()).toBeVisible({ timeout: 10000 });
    const m = await railScrollMetrics(page);
    expect(m.previewMaxHeight).toMatch(/none|0px|100%|auto/i);
    expect(m.previewOverflowY).not.toBe('auto');
    assertTelemetryClean(telemetry);
  });

  test('12 document scroll keeps scope bar visible (no duplicate sticky verdict)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await page.evaluate(() => window.scrollTo(0, 450));
    await expect(page.locator('.gov-sticky-answer--governance')).toHaveCount(0);
    await expect(page.locator('#gov-scope-bar-mount')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('13 desktop queue tab does not lock body scroll', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    const tab = page.locator('[data-inbox-tab]').first();
    if (await tab.count()) await tab.click();
    const m = await railScrollMetrics(page);
    expect(m.bodyDrawerLock).toBe(false);
    assertTelemetryClean(telemetry);
  });

  test('14 chrome vs main content overlap stays bounded', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    const overlap = await getLayoutOverlapReport(page, {
      selectors: ['#app-top-chrome', '#gov-scope-bar-mount', '#main-content'],
      maxPairs: 12,
    });
    expect(overlap.overlaps.filter((o) => o.overlapPx > 4000)).toHaveLength(0);
    assertTelemetryClean(telemetry);
  });

  test('15 edge: scroll restores value anchor without excessive dead band', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    const metrics = await page.evaluate(() => {
      const pick = (sels) => {
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (el && el.getBoundingClientRect().height > 2) return el.getBoundingClientRect();
        }
        return null;
      };
      const value = pick(['#gov-answer-mount', '.gov-command-answer', '#gov-verdict-mount']);
      let chromeBottom = 0;
      for (const sel of ['#app-top-chrome', '#gov-scope-bar-mount']) {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        if (r) chromeBottom = Math.max(chromeBottom, r.bottom);
      }
      return value ? Math.max(0, Math.round(value.top - chromeBottom)) : 9999;
    });
    expect(metrics).toBeLessThanOrEqual(120);
    assertTelemetryClean(telemetry);
  });

  // --- Phase 3: Cluster + evidence scroll chains (Speed & Trust) ---
  test('16 one-click grouped send visible on load', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await expect(page.locator('[data-grouped-send="0"]')).toBeVisible({ timeout: 20000 });
    assertTelemetryClean(telemetry);
  });

  test('17 inline approve on queue summary', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await expect(page.locator('.gov-inbox-inline-approve').first()).toBeVisible({ timeout: 10000 });
    assertTelemetryClean(telemetry);
  });

  test('18 issue preview keeps governance URL', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    const urlBefore = page.url();
    await page.locator('.gov-cluster-issue-key[data-issue-key]').first().click();
    await expect(page.locator('#delivera-shared-issue-preview')).toBeVisible();
    expect(page.url()).toBe(urlBefore);
    await page.keyboard.press('Escape');
    assertTelemetryClean(telemetry);
  });

  test('19 proof cluster does not open supporting evidence accordion', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await page.locator('[data-proof-cluster]').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('#gov-supporting-evidence')).toBeVisible();
    await expect(page.locator('#gov-supporting-evidence[open]')).toHaveCount(0);
    assertTelemetryClean(telemetry);
  });

  test('20 proof click highlights rail in place when visible', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    const rail = page.locator('#gov-right-rail-proof-mount');
    if (await rail.isHidden()) test.skip();
    await page.locator('[data-proof-cluster="evidence-count"]').first().click({ timeout: 8000 }).catch(() =>
      page.locator('[data-proof-cluster]').first().click());
    await expect(rail).toHaveAttribute('data-proof-active', '1', { timeout: 3000 });
    assertTelemetryClean(telemetry);
  });

  test('21 focus-first-nudge adds focus ring without forced scroll-to-top', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await page.evaluate(() => window.scrollTo(0, 250));
    const before = await page.evaluate(() => window.scrollY);
    const nudgeBtn = page.locator('#gov-scroll-first-nudge-only, #gov-review-actions, [data-grouped-send]').first();
    if (await nudgeBtn.count() === 0) test.skip();
    await nudgeBtn.click({ timeout: 8000 });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.scrollY);
    expect(after).toBeGreaterThan(100);
    expect(Math.abs(after - before)).toBeLessThan(200);
    assertTelemetryClean(telemetry);
  });

  test('22 escape dismisses proof drawer overlay', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await page.locator('[data-proof-cluster]').first().click({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/gov-right-drawer-open/, { timeout: 5000 });
    assertTelemetryClean(telemetry);
  });

  test('23 edge: stale brief hides send and shows trust pill', async ({ page }) => {
    await page.unroute('**/api/governance-brief.json**');
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: stubL3Brief(['SD'], { freshness: { confidenceLimit: 'stale' }, meta: { safeToSend: false } }),
    }));
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await expect(page.locator('#gov-send-readiness-pill')).toContainText(/Stale|refresh/i);
    await expect(page.locator('[data-grouped-send]')).toHaveCount(0);
    assertTelemetryClean(telemetry);
  });

  // --- Bonus creativity: end-user journey realism ---
  test('24 bonus: portfolio banner never shows object Object', async ({ page }) => {
    await mockL3Governance(page, { projects: 'SD,MPSA' });
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await expect(page.locator('[data-portfolio-banner="1"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).not.toContainText('[object Object]');
    assertTelemetryClean(telemetry);
  });

  test('25 bonus: mobile value anchor reachable without deep scroll', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page, { width: 390, height: 844 }))) return;
    const scrollNeed = await page.evaluate(() => {
      const el = document.querySelector('#gov-answer-mount .gov-command-answer-text, #gov-answer-mount .gov-command-answer, #gov-verdict-mount .gov-portfolio-banner-line, #gov-answer-mount');
      if (!el) return 9999;
      const r = el.getBoundingClientRect();
      let chromeBottom = 0;
      for (const sel of ['#app-top-chrome', '#gov-scope-bar-mount']) {
        const cr = document.querySelector(sel)?.getBoundingClientRect();
        if (cr) chromeBottom = Math.max(chromeBottom, cr.bottom);
      }
      const deadBand = Math.max(0, Math.round(r.top - chromeBottom));
      if (r.top <= window.innerHeight - 40) return deadBand;
      return Math.round(r.top + window.scrollY);
    });
    expect(scrollNeed).toBeLessThanOrEqual(80);
    assertTelemetryClean(telemetry);
  });

  test('26 bonus: keyboard user can reach scope refresh', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    await page.locator('#gov-scope-refresh').focus();
    await expect(page.locator('#gov-scope-refresh')).toBeFocused();
    assertTelemetryClean(telemetry);
  });

  test('27 bonus: proof rail mount exists in flat right-rail topology', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!(await loadGovernance(page))) return;
    const order = await page.evaluate(() => {
      const rail = document.getElementById('gov-right-rail-mount');
      if (!rail) return [];
      return [...rail.children].map((c) => c.id || c.className.split(' ')[0]).filter(Boolean);
    });
    expect(order).toContain('gov-right-rail-proof-mount');
    expect(order.some((id) => id.includes('queue') || id === 'gov-queue-mount')).toBeTruthy();
    assertTelemetryClean(telemetry);
  });
});
