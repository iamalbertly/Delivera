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
import { waitForLegacyBriefHydrated, waitForPortfolioReady } from './Delivera-Portfolio-Primary-Test-Helpers.js';

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

async function mockPortfolioDecision(page) {
  await page.route('**/api/governance/interventions/seed-from-brief**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      cases: [{ id: 'SD-5184', project: 'SD', title: 'Stuck epic', needsApproval: true }],
    }),
  }));
  await page.route('**/api/governance/portfolio-decision.json**', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: {
          headline: 'SD needs scope confirmation',
          narrative: { headline: 'SD needs scope confirmation', mainIssue: 'Evidence gap' },
          aboveFold: { exposedCommitments: 1, actionsReady: 1, poResponsesRequired: 0, nextDeadline: 'Today' },
          affectedCommitments: [{ id: 'SD-5184', title: 'Stuck epic', status: 'At risk', reason: 'Stuck', decisionNeeded: 'Confirm scope' }],
          preparedActions: { groups: [{ role: 'Product Owner', count: 1, label: '1 Product Owner' }], items: [], totalReady: 1 },
          metrics: { delivery: { value: 25, peerMedian: 50 }, offPlanLoad: { value: 20, peerMedian: 10 }, proofConfidence: { value: 35, peerMedian: 48 } },
          trust: { liveCases: 1, nudgesReady: 1, proofLevel: 'Low' },
          drivers: [{ title: 'Evidence', summary: 'Proof confidence is low.' }],
          decisionOptions: [{ id: 'review-scope', label: 'Review scope', impactPreview: 'Confirm scope before investment review.' }],
          monitoring: { squadCount: 1, commitmentCount: 4, exposedCommitmentCount: 1 },
          anchorProject: 'SD',
          recommendation: { label: 'Confirm scope and proof before investment review' },
          peerComparison: { sentence: 'The current difference is evidence quality, not proven delivery underperformance.' },
        },
        comparison: {
          cards: [{ projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'Blocked', statusClass: 'blocked', explanation: 'SD blocked path.' }],
          actionsStrip: {},
        },
        cases: [],
      }),
    });
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
  await mockPortfolioDecision(page);
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

async function clickLegacyScopeProject(page, pk) {
  await page.waitForSelector(`#gov-scope-bar-mount [data-project="${pk}"]`, { state: 'attached', timeout: 15000 });
  await page.evaluate((projectKey) => {
    document.querySelector(`#gov-scope-bar-mount [data-project="${projectKey}"]`)?.click();
  }, pk);
}

async function clickLegacyScopeBar(page, selector) {
  await page.waitForSelector(`#gov-scope-bar-mount ${selector}`, { timeout: 20000, state: 'attached' });
  await page.evaluate((sel) => {
    document.querySelector(`#gov-scope-bar-mount ${sel}`)?.click();
  }, selector);
}

test.describe('Churn retention master plan realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused churn-retention master plan contracts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1400, height: 900 });

    await test.step('01 governance loads hero without console errors', async () => {
      await mockChurnGovernance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      assertTelemetryClean(telemetry);
    });

    await test.step('02 project switch SD to BIO sets data-scope-stale then resolves', async () => {
      await mockChurnGovernance(page, { projects: 'SD', briefDelayMs: 600 });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const briefWait = page.waitForResponse(
        (res) => res.url().includes('/api/governance-brief.json') && res.url().includes('BIO') && res.ok(),
        { timeout: 15000 },
      );
      await page.locator('#portfolio-scope-selected').selectOption('BIO');
      await expect(page.locator('#gov-brief-content')).toHaveAttribute('data-scope-stale', 'true', { timeout: 3000 });
      await briefWait;
      await expect(page.locator('#gov-brief-content')).not.toHaveAttribute('data-scope-stale', 'true', { timeout: 15000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('03 mismatched API response shows error banner', async () => {
      await mockChurnGovernance(page, { projects: 'BIO', mismatch: true });
      await page.goto('/governance');
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
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const briefWait = page.waitForResponse(
        (res) => res.url().includes('/api/governance-brief.json') && res.url().includes('MPSA') && res.ok(),
        { timeout: 15000 },
      );
      await page.locator('#portfolio-scope-add').selectOption('MPSA');
      await briefWait;
      await page.waitForTimeout(400);
      const stored = await page.evaluate(() => localStorage.getItem('delivera_selectedProjects') || '');
      expect(stored.split(',').filter(Boolean).length).toBe(2);
      expect(stored.toUpperCase()).toMatch(/SD/);
      expect(stored.toUpperCase()).toMatch(/MPSA/);
      assertTelemetryClean(telemetry);
    });

    await test.step('05 two-squad compare renders in right rail mount', async () => {
      await waitForLegacyBriefHydrated(page);
      await expect(page.locator('#gov-compare-rail-mount [data-compare-rail="1"]')).toBeAttached({ timeout: 10000 });
      await expect(page.locator('[data-compare-rail-card="SD"]')).toBeAttached();
      await expect(page.locator('[data-compare-rail-card="MPSA"]')).toBeAttached();
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
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await waitForLegacyBriefHydrated(page);
      await page.keyboard.press('Escape');
      const baselineBtn = page.locator('[data-setup-baseline-ssot="1"]').first();
      await expect(baselineBtn).toBeAttached({ timeout: 15000 });
      await page.evaluate(() => {
        document.querySelector('[data-setup-baseline-ssot="1"]')?.click();
      });
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
        sessionStorage.setItem('gov-period-window', '28d');
      }, PROJECTS_SSOT_KEY);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await waitForLegacyBriefHydrated(page);
      await expect.poll(async () => page.evaluate(() => document.querySelector('#gov-answer-mount')?.textContent || '')).toContain('PERIOD-28D', { timeout: 15000 });
      const brief14Wait = page.waitForResponse(
        (res) => res.url().includes('/api/governance-brief.json') && res.url().includes('periodWindow=14d') && res.ok(),
        { timeout: 15000 },
      );
      await clickLegacyScopeBar(page, '[data-period-chip="14d"]');
      await brief14Wait;
      await waitForLegacyBriefHydrated(page);
      await expect.poll(async () => page.evaluate(() => document.querySelector('#gov-answer-mount')?.textContent || '')).toContain('PERIOD-14D', { timeout: 15000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('09 right rail shows proof preview without opening supporting evidence', async () => {
      await mockChurnGovernance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await waitForLegacyBriefHydrated(page);
      await expect(page.locator('#gov-right-rail-proof-mount .gov-evidence-preview')).toBeAttached({ timeout: 15000 });
      await expect(page.locator('#gov-supporting-evidence')).toHaveJSProperty('open', false);
      assertTelemetryClean(telemetry);
    });

    await test.step('10 single proof surface — main proof risks hidden when preview active', async () => {
      await expect(page.locator('#gov-proof-risks')).toBeHidden();
      assertTelemetryClean(telemetry);
    });

    await test.step('11 scope bar queue count deduped — no pending in status chip', async () => {
      await mockChurnGovernance(page, { projects: 'SD' });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await waitForLegacyBriefHydrated(page);
      await expect(page.locator('#gov-right-rail-mount [data-inbox-inline="1"]')).toBeAttached({ timeout: 15000 });
      const statusChip = page.locator('#gov-scope-bar-mount .gov-scope-status-chip');
      await expect(statusChip).toBeAttached();
      const chipText = await statusChip.textContent();
      expect(chipText || '').not.toMatch(/pending/i);
      await expect(page.locator('[data-queue-rail-head="1"]')).toBeAttached();
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
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await waitForLegacyBriefHydrated(page);
      const addSecond = page.locator('#portfolio-scope-add');
      if (await addSecond.count()) await addSecond.selectOption('MPSA');
      await page.waitForTimeout(400);
      const approve = page.locator('[data-inbox-approve]').first();
      if (await approve.count()) {
        await page.evaluate(() => {
          document.querySelector('[data-inbox-approve]')?.click();
        });
      }
      assertTelemetryClean(telemetry);
    });
  });
});
