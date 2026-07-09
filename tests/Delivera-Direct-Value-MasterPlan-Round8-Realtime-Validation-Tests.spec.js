/**
 * Direct-Value Master Plan Round 8 — AI trust sync & slide fast-path contracts.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY, BRIEF_CLIENT_CACHE_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import { waitForPortfolioReady } from './Delivera-Portfolio-Primary-Test-Helpers.js';
import { join } from 'path';
import { existsSync } from 'fs';

const SLIDE_DMS_Q2 = join(process.cwd(), 'data', 'testing_q2fy27_dms_commitments.png');

const AI_STATUS_OPENROUTER = {
  provider: 'openrouter',
  label: 'OpenRouter',
  configured: true,
  slideVisionReady: true,
  source: 'server',
  slideVision: { ready: true, provider: 'openrouter', source: 'server', envProvider: 'openrouter', envReady: true },
};

function stubRound8Brief(projects = ['SD'], overrides = {}) {
  const keys = Array.isArray(projects) ? projects : String(projects).split(',').map((p) => p.trim()).filter(Boolean);
  const primary = keys[0] || 'SD';
  return {
    briefId: `R8-${keys.join('-')}`,
    projects: keys,
    portfolio: keys.join(' + '),
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'medium', meetingAnswer: 'Scope uncertainty blocks delivery today.', narratedBy: 'template' },
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      quarter: 'FY27 Q2',
      scopeIntelligence: {
        cards: [{ projectKey: primary, sprint: 'active', isSelected: true, epicCount: 4, blockerCount: 2 }],
      },
      setupGaps: [{ id: 'pi-baseline', action: 'set-baseline', severity: 'high' }],
      piFocus: {
        synergy: 'low',
        primaryAction: 'set-baseline',
        headlineKey: 'piFocusBoardUnmatched',
        boardEpicCount: 2,
        proposedMissing: 1,
        duplicateRiskCount: 0,
        matchedCount: 0,
      },
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 0 },
      periodWindow: '28d',
      ...overrides.meta,
    },
    topRisks: [{ issueKey: `${primary}-8419`, assigneeName: 'Amani', recommendedAction: 'Unblock today', escalation: 'act-today', issueUrl: `https://example/${primary}-8419`, displayTitle: 'Stuck epic' }],
    evidencePack: { rows: [{ issueKey: `${primary}-8419`, statusNow: 'In Progress', whyFlagged: 'stale 994h' }] },
    squadInsights: keys.map((pk) => ({
      projectKey: pk,
      verdictTier: pk === primary ? 'blocked' : 'watch',
      verdictLabel: pk === primary ? 'DELIVERY BLOCKED' : 'Watch',
      sprintPulse: { committed: 13, done: 0 },
      bottleneckLine: `${pk} bottleneck`,
      productivityLine: 'Stale work',
      piCommitted: 4,
      piDone: 0,
      cardRisks: [{ issueKey: `${pk}-8419`, displayTitle: 'Stuck' }],
    })),
    ...overrides,
  };
}

async function mockRound8Governance(page, opts = {}) {
  const { projects = 'SD', mockInboxRoutes = true } = opts;
  const brief = stubRound8Brief(['SD']);
  await page.addInitScript(({ key, pk, cacheKey, cacheBody, aiPref }) => {
    try { localStorage.setItem(key, pk); } catch (_) {}
    try { localStorage.setItem('delivera_ai_provider_pref_v1', aiPref); } catch (_) {}
    try { localStorage.setItem('delivera_gov_quarter_v1', 'FY27 Q2'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
    const map = { 'SD||28d': { brief: cacheBody, at: Date.now(), ttlMs: 180000 } };
    sessionStorage.setItem(cacheKey, JSON.stringify(map));
  }, {
    key: PROJECTS_SSOT_KEY,
    pk: projects,
    cacheKey: BRIEF_CLIENT_CACHE_KEY,
    cacheBody: brief,
    aiPref: JSON.stringify({ provider: 'openai', key: 'sk-test-probe', host: '', lastTestOk: true, lastTestAt: '2026-01-01T00:00:00.000Z' }),
  });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance/interventions/seed-from-brief**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, seeded: 0, cases: [] }),
  }));
  await page.route('**/api/governance/portfolio-decision.json**', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: {
          headline: 'Scope uncertainty',
          narrative: { headline: 'Scope uncertainty', mainIssue: 'Evidence gap' },
          aboveFold: { exposedCommitments: 1, actionsReady: 0, poResponsesRequired: 0 },
          affectedCommitments: [{ id: 'SD-8419', issueKey: 'SD-8419', title: 'Stuck epic', status: 'At risk', reason: 'Stuck', decisionNeeded: 'Confirm scope' }],
          decisionRequired: { issue: 'Scope', owner: 'PO', evidenceConfidence: 'Medium' },
          preparedActions: { groups: [], items: [], totalReady: 0 },
          evidenceBreakdown: { confidenceLabel: 'Medium', available: 1, required: 4 },
          trust: { liveCases: 0, nudgesReady: 0, proofLevel: 'Medium' },
          dataTrust: { confidenceLabel: 'Medium', boardsConnected: { connected: 1, total: 1 }, commitmentsMapped: { mapped: 2, total: 4 }, dataGaps: 1, lastSync: 'Live' },
          portfolioSummary: { commitmentsOnTrack: 0, commitmentsAtRisk: 1, commitmentsTotal: 4, commitmentsBlocked: 1 },
          drivers: [{ title: 'Evidence', summary: 'Low proof.' }],
          monitoring: { squadCount: 1, commitmentCount: 4, exposedCommitmentCount: 1 },
          anchorProject: 'SD',
          periodKey: 'FY27 Q2',
        },
        comparison: { cards: [{ projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'Blocked', statusClass: 'blocked', nextAction: 'Ping Lilian', explanation: 'SD blocked.' }], actionsStrip: {} },
        cases: [],
      }),
    });
  });
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(brief),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q2', isCurrent: true }] }),
  }));
  await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(AI_STATUS_OPENROUTER),
  }));
  if (mockInboxRoutes) {
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }),
    }));
    await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, agents: [], lastImprovements: [] }),
    }));
  }
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ boards: [{ id: 1, projectKey: 'SD', name: 'SD board' }] }),
  }));
  await page.route('**/api/governance/pi-baseline/propose?**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ method: 'board-epics', candidates: [], guidanceCode: null }),
  }));
  await page.route('**/api/settings/ai-usage.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ totalCalls: 10, fallbacks: 4 }),
  }));
}

async function mockAlignedBlockedSprint(page) {
  const blocker = { issueKey: 'SD-8419', summary: 'Longest stale blocker', hoursInStatus: 994, status: 'Blocked', assignee: 'Lilian' };
  await page.route('**/api/current-sprint.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      sprint: { id: 42, name: 'Sprint 42', state: 'active', startDate: '2026-06-01', endDate: '2026-06-14' },
      board: { id: 1, name: 'SD board', projectKeys: ['SD'] },
      meta: { projects: 'SD', generatedAt: new Date().toISOString() },
      summary: { totalStories: 13, doneStories: 0, percentDone: 0, totalSP: 20 },
      daysMeta: { daysRemainingWorking: 9, daysRemainingCalendar: 9 },
      stories: Array.from({ length: 8 }, (_, i) => ({ issueKey: `SD-${100 + i}`, summary: `Story ${i}`, status: i === 0 ? 'Blocked' : 'In Progress', storyPoints: 3 })),
      stuckCandidates: [blocker],
      decisionCockpit: {
        health: { status: 'Needs Attention', tone: 'critical', message: 'Sprint blocked' },
        nextBestAction: { issueKey: blocker.issueKey, summary: blocker.summary, reason: `Stale ${blocker.hoursInStatus}h`, ctaLabel: 'Unblock', riskTags: ['blocker'] },
        topRisks: [{ issueKey: blocker.issueKey, summary: blocker.summary, riskTags: ['blocker'], severity: 'High' }],
        keySignals: { blockers: 1, scopeChanges: 0, inactivity: true, completedRecent: { count: 0, storyPoints: 0 } },
        metrics: { daysRemaining: 9, progressPct: { value: 0 }, workItems: { done: 0, total: 13, remaining: 13 }, timeLogged: { ratioPct: 10 } },
        quickActions: [],
        insights: {},
      },
      recentSprints: [{ id: 41, name: 'Sprint 41', state: 'closed' }],
    }),
  }));
}

async function mockEmptyActions(page) {
  await page.route('**/api/governance/interventions*.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }),
  }));
}

async function closeGovernanceOverlays(page) {
  await page.locator('[data-baseline-close], [data-drawer-close]').first().click({ timeout: 2000 }).catch(() => {});
  await page.locator('.work-draft-drawer [data-wdd-close], .work-draft-drawer button[aria-label="Close"]').first().click({ timeout: 2000 }).catch(() => {});
}

async function expectDrawerBelowChrome(page) {
  const panel = page.locator('#delivera-gov-right-drawer:not([hidden]) .gov-right-drawer-panel').first();
  await expect(panel).toBeVisible({ timeout: 15000 });
  const panelBox = await panel.boundingBox();
  expect(panelBox).toBeTruthy();
  expect(panelBox.y).toBeGreaterThanOrEqual(50);
}

test.describe('Direct-Value Master Plan Round 8 realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused direct-value round8 contracts', async ({ page, request }) => {
    let telemetry = captureBrowserTelemetry(page);

    await test.step('01 live ai-provider-status exposes slideVision contract', async () => {
      let res;
      try {
        res = await request.get('/api/ai-provider-status.json');
      } catch (err) {
        test.skip(true, `Server unavailable: ${err?.message || err}`);
        return;
      }
      if (res.status() === 401) {
        test.skip(true, 'Auth required');
        return;
      }
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body).toHaveProperty('slideVision');
      expect(typeof body.slideVisionReady).toBe('boolean');
    });

    await test.step('02 governance trust pill uses slide-ready signal', async () => {
      await mockRound8Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const pill = page.locator('[data-ai-trust-pill]').first();
      await expect(pill).toBeVisible({ timeout: 15000 });
      await expect(pill).toHaveAttribute('data-ai-slide-ready', /0|1/);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 PI wizard slide-ready when server OpenRouter mocked', async () => {
      await page.locator('[data-testid="gov-pi-focus-set-baseline"]').click();
      await expect(page.locator('.gov-right-drawer-panel .gov-baseline-wizard')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.gov-right-drawer-panel #gov-baseline-slide-drop[data-ai-slide-ready="1"]')).toBeVisible();
      await expect(page.locator('#gov-baseline-slide-input')).not.toBeDisabled();
      await page.locator('[data-baseline-close]').first().click();
    });

    await test.step('04 settings integrations shows slide-ready in status line', async () => {
      await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(AI_STATUS_OPENROUTER),
      }));
      await page.route('**/api/settings/ai-usage.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ totalCalls: 10, fallbacks: 4 }),
      }));
      await page.goto('/settings');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-ai-helper [data-ai-slide-ready="1"]')).toBeVisible({ timeout: 15000 });
    });

    await test.step('05 settings return deep link opens governance', async () => {
      await page.goto('/settings?return=/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-ai-helper')).toBeVisible({ timeout: 15000 });
    });

    await test.step('06 governance reload trust pill still consistent', async () => {
      await mockRound8Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await expect(page.locator('[data-ai-trust-pill][data-ai-slide-ready="1"]').first()).toBeVisible({ timeout: 15000 });
    });

    await test.step('07 upload-first empty wizard has expanded slide drop', async () => {
      await page.locator('[data-testid="gov-pi-focus-set-baseline"]').click();
      await expect(page.locator('details.gov-baseline-optional[open]')).toBeVisible({ timeout: 15000 });
    });

    await test.step('08 DMS Q2 slide mock shows squad and quarter context', async () => {
      if (!existsSync(SLIDE_DMS_Q2)) {
        test.skip(true, `Missing slide fixture ${SLIDE_DMS_Q2}`);
        return;
      }
      await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          method: 'slide-vision',
          quarter: 'FY27 Q2',
          inferredSquad: 'DMS',
          inferredQuarter: 'FY27 Q2',
          extracted: [{ month: 'July', theme: 'NBA', bullet: 'CVM channel productivity' }],
          candidates: [{ issueKey: 'SD-100', title: 'FY27 Q2 – DMS – NBA – CVM', method: 'slide-linked' }],
          resolved: [{ status: 'linked', issueKey: 'SD-100' }],
          matchedCount: 1,
          missingCount: 0,
          createWorkNarrative: 'FY27 Q2 DMS commitments',
        }),
      }));
      await expect(page.locator('.gov-baseline-loading')).toHaveCount(0, { timeout: 15000 });
      const uploadDone = page.waitForResponse((r) => r.url().includes('propose-from-image') && r.ok());
      await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_DMS_Q2);
      await uploadDone;
      await expect(page.locator('[data-testid="gov-baseline-context"]')).toContainText('DMS');
      await expect(page.locator('[data-testid="gov-baseline-context"]')).toContainText('FY27 Q2');
    });

    await test.step('09 upload error restores shell not stuck loading', async () => {
      if (!existsSync(SLIDE_DMS_Q2)) {
        test.skip(true, `Missing slide fixture ${SLIDE_DMS_Q2}`);
        return;
      }
      await page.locator('[data-baseline-close]').first().click();
      await mockRound8Governance(page);
      await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
        status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Vision failed', code: 'SLIDE_FAILED' }),
      }));
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await page.locator('[data-testid="gov-pi-focus-set-baseline"]').click();
      await expect(page.locator('.gov-baseline-wizard')).toBeVisible({ timeout: 15000 });
      await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_DMS_Q2);
      await expect(page.locator('.gov-baseline-loading[aria-busy="true"]')).toHaveCount(0, { timeout: 10000 });
      await expect(page.locator('.gov-baseline-wizard')).toBeVisible();
      telemetry = captureBrowserTelemetry(page);
    });

    await test.step('10 drop disabled when slide vision not ready', async () => {
      if (!existsSync(SLIDE_DMS_Q2)) {
        test.skip(true, `Missing slide fixture ${SLIDE_DMS_Q2}`);
        return;
      }
      await page.locator('[data-baseline-close]').first().click();
      await mockRound8Governance(page);
      await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ provider: 'built-in', configured: false, slideVisionReady: false, slideVision: { ready: false } }),
      }));
      await page.addInitScript(() => {
        localStorage.setItem('delivera_ai_provider_pref_v1', JSON.stringify({ provider: 'built-in', key: '', host: '' }));
      });
      await page.reload();
      await waitForPortfolioReady(page);
      await page.locator('[data-testid="gov-pi-focus-set-baseline"]').click();
      await expect(page.locator('.gov-right-drawer-panel #gov-baseline-slide-drop[data-ai-slide-ready="0"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#gov-baseline-slide-input')).toBeDisabled();
      await page.locator('[data-baseline-close]').first().click();
    });

    await test.step('11 sprint blocker CTA SSOT label', async () => {
      await mockAlignedBlockedSprint(page);
      await page.setViewportSize({ width: 1400, height: 900 });
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('.sprint-intervention-item-primary', { timeout: 20000 });
      await expect(page.locator('.sprint-intervention-item-primary')).toContainText(/Nudge|Ping|Unblock/i);
    });

    await test.step('12 actions inline blocker queue visible', async () => {
      await mockEmptyActions(page);
      await mockAlignedBlockedSprint(page);
      await page.goto('/actions');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="actions-blocker-queue"]')).toBeVisible({ timeout: 10000 });
    });

    await test.step('13 portfolio primary CTA Upload PI slide', async () => {
      await mockRound8Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await expect(page.locator('[data-testid="portfolio-primary-cta"]')).toContainText(/Upload PI slide/);
    });

    await test.step('14 mobile 390px drawer and trust dot', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('[data-testid="gov-pi-focus-strip"]')).toBeVisible();
      await closeGovernanceOverlays(page);
      await page.locator('[data-testid="gov-pi-focus-set-baseline"]').click();
      await expectDrawerBelowChrome(page);
      await page.locator('[data-baseline-close]').first().click();
    });

    await test.step('15 drawer clears top chrome overlap', async () => {
      await page.setViewportSize({ width: 1400, height: 900 });
      await closeGovernanceOverlays(page);
      await page.locator('[data-testid="gov-pi-focus-set-baseline"]').click();
      await expectDrawerBelowChrome(page);
      await page.locator('[data-baseline-close]').first().click();
    });

    await test.step('16 status honesty bar delivery blocked', async () => {
      await expect(page.locator('[data-testid="portfolio-status-honesty-bar"]')).toContainText(/Delivery blocked|PI not aligned/i);
    });

    await test.step('17 single baseline CTA on PI focus strip', async () => {
      await expect(page.locator('[data-testid="gov-pi-focus-set-baseline"]')).toHaveCount(1);
    });

    await test.step('18 zero match slide shows create work bridge', async () => {
      if (!existsSync(SLIDE_DMS_Q2)) return;
      await page.unroute('**/api/governance/pi-baseline/propose-from-image').catch(() => {});
      await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          method: 'slide-vision',
          extracted: [{ month: 'July', theme: 'NBA', bullet: 'New epic from slide' }],
          candidates: [],
          unmatched: [{
            suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – New',
            title: 'FY27 Q2 – DMS – NBA – New',
            method: 'slide-unmatched',
          }],
          resolved: [{ status: 'missing', suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – New' }],
          missingCount: 1,
          matchedCount: 0,
          createWorkNarrative: 'Draft from slide',
          inferredSquad: 'DMS',
          inferredQuarter: 'FY27 Q2',
        }),
      }));
      await page.locator('[data-testid="gov-pi-focus-set-baseline"]').click();
      await expect(page.locator('.gov-right-drawer-panel .gov-baseline-wizard')).toBeVisible({ timeout: 15000 });
      const uploadDone = page.waitForResponse((r) => r.url().includes('propose-from-image') && r.ok());
      await page.locator('.gov-right-drawer-panel #gov-baseline-slide-input').setInputFiles(SLIDE_DMS_Q2);
      await uploadDone;
      await expect(page.locator('[data-testid="gov-baseline-create-all"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="gov-baseline-create-work"]')).toBeVisible();
      await page.locator('[data-baseline-close]').first().click();
    });

    await test.step('19 cadence honesty dormant when no active sprint', async () => {
      const cadence = page.locator('[data-testid="gov-cadence-pack"]').first();
      if (await cadence.count()) {
        const health = await cadence.getAttribute('data-movement-health');
        const status = await cadence.getAttribute('data-cadence-status');
        const text = await cadence.innerText();
        if (health === 'blocked') {
          expect(text).not.toMatch(/^In sprint · Active sprint$/);
        }
        if (status === 'none' || status === 'idle') {
          expect(health).not.toBe('healthy');
        }
      }
    });

    await test.step('20 settings governance AI helper mounted', async () => {
      await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(AI_STATUS_OPENROUTER),
      }));
      await page.route('**/api/settings/ai-usage.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ totalCalls: 10, fallbacks: 4 }),
      }));
      await page.goto('/settings');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-ai-helper')).toBeVisible({ timeout: 15000 });
    });

    await test.step('21 governance return from settings without console noise', async () => {
      await mockRound8Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      assertTelemetryClean(telemetry);
    });

    await test.step('22 sub-chrome API routes return 200', async () => {
      const receipt = await request.get('/api/governance/worker-receipt.json?projects=SD');
      if (receipt.status() === 401) {
        test.skip(true, 'Auth required');
        return;
      }
      expect(receipt.ok()).toBeTruthy();
      const pi = await request.get('/api/governance/pi-confidence.json?projects=SD');
      expect(pi.ok()).toBeTruthy();
      const scope = await request.get('/api/governance/scope-intelligence.json?projects=SD');
      expect(scope.ok()).toBeTruthy();
    });

    await test.step('23 final telemetry clean seal', async () => {
      await mockRound8Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      assertTelemetryClean(telemetry);
    });
  });
});
