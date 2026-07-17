/**
 * Churn retention master plan — scope stale overlay, real compare, AI SSOT, proof dedupe, right rail.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
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

function stubChurnBrief(projects = ['SD'], overrides = {}) {
  const keys = Array.isArray(projects) ? projects : String(projects).split(',').map((p) => p.trim()).filter(Boolean);
  const primary = keys[0] || 'SD';
  return JSON.stringify({
    briefId: `CHURN-${keys.join('-')}`,
    projects: keys,
    portfolio: keys.join(' + '),
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: `Blocked ${primary}`, narratedBy: 'template' },
    squadInsights: keys.map((pk) => squadInsight(pk, pk === 'SD' ? 'blocked' : 'watch')),
    topRisks: [{
      issueKey: `${primary}-5184`,
      assigneeName: 'Amani',
      recommendedAction: 'Unblock today',
      escalation: 'act-today',
      issueUrl: `https://example/${primary}-5184`,
      displayTitle: 'Stuck epic',
      summary: 'Stuck',
    }],
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      setupGaps: [],
      periodWindow: '28d',
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 5 },
      piConfidence: { trusted: false, counts: { committed: 0 }, timelineChips: [] },
      ...overrides.meta,
    },
    evidencePack: {
      rows: [{ issueKey: `${primary}-5184`, statusNow: 'In Progress', whyFlagged: 'stale' }],
    },
    ...overrides,
  });
}

async function mockChurnGovernance(page, opts = {}) {
  const { projects = 'SD', briefDelayMs = 0, mismatch = false, periodBodies = null } = opts;
  await page.addInitScript(({ key, pk }) => {
    try { localStorage.setItem(key, pk); } catch (_) {}
    try { sessionStorage.removeItem('delivera:brief:cache:v1'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
  }, { key: PROJECTS_SSOT_KEY, pk: projects });
  await routeProjectsCatalog(page);
  // This master-plan suite exercises the one-release comparison adapter; the
  // active-loop meeting story is validated independently at priority zero.
  await page.route('**/api/governance/active-loop.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/governance-brief.json**', async (route) => {
    if (briefDelayMs > 0) await new Promise((r) => setTimeout(r, briefDelayMs));
    const url = route.request().url();
    const reqProjects = decodeURIComponent((url.match(/projects=([^&]+)/) || [])[1] || projects).toUpperCase();
    const period = (url.match(/periodWindow=([^&]+)/) || [])[1]?.toLowerCase() || '28d';
    let body;
    if (periodBodies && periodBodies[period]) {
      body = periodBodies[period];
    } else if (mismatch) {
      body = JSON.parse(stubChurnBrief(['SD']));
    } else {
      const keys = reqProjects.split(',').map((p) => p.trim()).filter(Boolean);
      body = JSON.parse(stubChurnBrief(keys.length ? keys : ['SD']));
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge', payload: { owner: 'A', board: 'SD' } }],
      confirm: [{ id: 'c1', type: 'confirm', summary: 'Claim', payload: { owner: 'B', board: 'SD' } }],
      briefs: [], piDrift: [], impact: [], poReadiness: [],
    }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, byMetric: {} }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ boards: [{ projectKey: 'SD' }, { projectKey: 'BIO' }] }),
  }));
  await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ provider: 'openrouter', label: 'OpenRouter', configured: true, slideVisionReady: true, source: 'server' }),
  }));
  await page.route('**/api/settings/ai-usage.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ totalCalls: 10, fallbacks: 1 }),
  }));
  await page.route('**/api/governance/pi-baseline/propose**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ candidates: [{ issueKey: 'SD-100', summary: 'Epic alpha' }], totalBoardEpics: 3 }),
  }));
  await page.route('**/api/current-sprint.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      sprint: { id: 1, name: 'Sprint 1', state: 'active' },
      meta: { projects: 'SD' },
      summary: { totalStories: 2, doneStories: 1 },
      stories: [{ issueKey: 'SD-10', status: 'In Progress' }],
      stuckCandidates: [],
    }),
  }));
}

async function clickScopeProject(page, pk) {
  const chip = page.locator(`#gov-scope-expanded [data-project="${pk}"]`);
  if (!await chip.isVisible()) await page.locator('#gov-scope-change').click();
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
}

test.describe('Churn retention master plan realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused churn-retention master plan contracts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1400, height: 900 });

    await test.step('01 governance loads hero without console errors', async () => {
      await mockChurnGovernance(page);
      await page.goto('/governance?projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('02 project switch SD to BIO sets data-scope-stale then resolves', async () => {
      await mockChurnGovernance(page, { projects: 'SD', briefDelayMs: 600 });
      await page.goto('/governance?projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 20000 });
      await clickScopeProject(page, 'BIO');
      await expect(page.locator('#gov-brief-content')).toHaveAttribute('data-scope-stale', 'true', { timeout: 3000 });
      await expect(page.locator('.gov-scope-stale-overlay')).toBeVisible();
      await expect(page.locator('#gov-brief-content')).not.toHaveAttribute('data-scope-stale', 'true', { timeout: 15000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('03 mismatched API response shows error banner', async () => {
      await mockChurnGovernance(page, { projects: 'BIO', mismatch: true });
      await page.goto('/governance?projects=BIO');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-error')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#gov-error')).not.toBeEmpty();
      assertTelemetryClean(telemetry);
    });

    await test.step('04 compare add adds second squad with aria-pressed', async () => {
      await mockChurnGovernance(page, { projects: 'SD' });
      await page.evaluate((key) => {
        localStorage.setItem(key, 'SD');
        sessionStorage.removeItem('delivera:brief:cache:v1');
      }, PROJECTS_SSOT_KEY);
      await page.goto('/governance?projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 20000 });
      if (!(await page.locator('.gov-scope-capsule-text').textContent())?.includes('1 squad')) {
        await clickScopeProject(page, 'SD');
        await page.waitForTimeout(400);
      }
      await expect(page.locator('.gov-scope-capsule-text')).toContainText('1 squad');
      await expect(page.locator('[data-compare-add-tray="1"]')).toBeVisible({ timeout: 10000 });
      const addSecond = page.locator('[data-compare-add="MPSA"]');
      await expect(addSecond).toBeVisible();
      const briefWait = page.waitForResponse(
        (res) => res.url().includes('/api/governance-brief.json') && res.url().includes('MPSA') && res.ok(),
        { timeout: 15000 },
      );
      await addSecond.click();
      await briefWait;
      await page.waitForTimeout(400);
      await expect(page.locator('.gov-scope-capsule-text')).toContainText('2 squad');
      const stored = await page.evaluate(() => localStorage.getItem('delivera_selectedProjects') || '');
      expect(stored.split(',').filter(Boolean).length).toBe(2);
      expect(stored.toUpperCase()).toMatch(/SD/);
      expect(stored.toUpperCase()).toMatch(/MPSA/);
      assertTelemetryClean(telemetry);
    });

    await test.step('05 two-squad compare renders in right rail mount', async () => {
      await expect(page.locator('#gov-compare-rail-mount [data-compare-rail="1"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-compare-rail-card="SD"]')).toBeVisible();
      await expect(page.locator('[data-compare-rail-card="MPSA"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('06 server OpenRouter mock shows no add-ai-key gap', async () => {
      await expect(page.locator('[data-setup-action="add-ai-key"]')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('07 PI wizard hides key hint when slideVisionReady', async () => {
      await mockChurnGovernance(page, { projects: 'SD' });
      const gapBrief = JSON.parse(stubChurnBrief(['SD'], {
        topRisks: [],
        ownerGroups: [],
        meta: { setupGaps: [{ id: 'pi-baseline', action: 'set-baseline', severity: 'high' }] },
      }));
      await page.unroute('**/api/governance-brief.json**');
      await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(gapBrief),
      }));
      await page.evaluate((key) => {
        localStorage.setItem(key, 'SD');
        sessionStorage.removeItem('delivera:brief:cache:v1');
      }, PROJECTS_SSOT_KEY);
      await page.goto('/governance?projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await clickScopeProject(page, 'SD');
      await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 15000 });
      await page.keyboard.press('Escape');
      const baselineBtn = page.locator('[data-setup-baseline-ssot="1"]').first();
      await expect(baselineBtn).toBeVisible({ timeout: 15000 });
      await baselineBtn.click();
      await expect(page.locator('[data-testid="gov-baseline-context"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-ai-key-hint="1"]')).toHaveCount(0);
      await expect(page.locator('[data-ai-server-ready="1"]')).toBeAttached();
      assertTelemetryClean(telemetry);
    });

    await test.step('08 period window change uses distinct cache entries', async () => {
      const brief28 = JSON.parse(stubChurnBrief(['SD'], { meta: { periodWindow: '28d' } }));
      const brief14 = JSON.parse(stubChurnBrief(['SD'], { meta: { periodWindow: '14d' } }));
      brief28.leadershipNarrative.meetingAnswer = 'PERIOD-28D';
      brief14.leadershipNarrative.meetingAnswer = 'PERIOD-14D';
      brief28.meta.commandAnswerSentence = 'PERIOD-28D';
      brief14.meta.commandAnswerSentence = 'PERIOD-14D';
      await mockChurnGovernance(page, {
        projects: 'SD',
        periodBodies: { '28d': brief28, '14d': brief14 },
      });
      await page.evaluate((key) => {
        localStorage.setItem(key, 'SD');
        sessionStorage.removeItem('delivera:brief:cache:v1');
      }, PROJECTS_SSOT_KEY);
      await page.goto('/governance?projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await clickScopeProject(page, 'SD');
      await expect(page.locator('#main-content')).toContainText('PERIOD-28D', { timeout: 15000 });
      await page.locator('[data-period-chip="14d"]').click();
      await page.waitForTimeout(500);
      await expect(page.locator('#main-content')).toContainText('PERIOD-14D', { timeout: 15000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('09 right rail shows proof preview without opening supporting evidence', async () => {
      await mockChurnGovernance(page);
      await page.goto('/governance?projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-right-rail-proof-mount .gov-evidence-preview')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#gov-supporting-evidence')).toHaveJSProperty('open', false);
      assertTelemetryClean(telemetry);
    });

    await test.step('10 single proof surface — main proof risks hidden when preview active', async () => {
      await expect(page.locator('#gov-proof-risks')).toBeHidden();
      assertTelemetryClean(telemetry);
    });

    await test.step('11 scope bar queue count deduped — no pending in status chip', async () => {
      await mockChurnGovernance(page, { projects: 'SD' });
      await page.goto('/governance?projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-right-rail-mount [data-inbox-inline="1"]')).toBeVisible({ timeout: 15000 });
      const statusChip = page.locator('#gov-scope-bar-mount .gov-scope-status-chip');
      await expect(statusChip).toBeVisible();
      const chipText = await statusChip.textContent();
      expect(chipText || '').not.toMatch(/pending/i);
      await expect(page.locator('[data-queue-rail-head="1"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('12 sprint page shows inherited scope chip on desktop', async () => {
      await page.setViewportSize({ width: 1400, height: 900 });
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.current-sprint-scope-inline')).toHaveCSS('display', 'none');
      await expect(page.locator('#current-sprint-projects')).toHaveAttribute('aria-hidden', 'true');
      assertTelemetryClean(telemetry);
    });

    await test.step('13 settings shows server AI trust without false no-key', async () => {
      await page.goto('/settings');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-ai-trust-mode="server"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.gov-ai-helper-status').filter({ hasText: /No key/i })).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('14 full click-through scope compare inbox — telemetry clean', async () => {
      await mockChurnGovernance(page, { projects: 'SD' });
      await page.goto('/governance?projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 20000 });
      const addSecond = page.locator('[data-compare-add="MPSA"]');
      if (await addSecond.count()) await addSecond.click();
      await page.waitForTimeout(400);
      await clickScopeProject(page, 'SD');
      await page.waitForTimeout(400);
      const approve = page.locator('[data-inbox-approve]').first();
      if (await approve.count()) await approve.click();
      assertTelemetryClean(telemetry);
    });
  });
});
