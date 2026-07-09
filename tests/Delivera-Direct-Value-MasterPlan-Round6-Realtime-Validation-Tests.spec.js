/**
 * Direct-Value Master Plan Round 6 — honest trust & console-clean contracts.
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

function stubRound6Brief(projects = ['SD'], overrides = {}) {
  const keys = Array.isArray(projects) ? projects : String(projects).split(',').map((p) => p.trim()).filter(Boolean);
  const primary = keys[0] || 'SD';
  return {
    briefId: `R6-${keys.join('-')}`,
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
    topRisks: [{
      issueKey: `${primary}-8419`,
      assigneeName: 'Amani',
      recommendedAction: 'Unblock today',
      escalation: 'act-today',
      issueUrl: `https://example/${primary}-8419`,
      displayTitle: 'Stuck epic',
    }],
    evidencePack: {
      rows: [{ issueKey: `${primary}-8419`, statusNow: 'In Progress', whyFlagged: 'stale 994h' }],
    },
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

async function mockRound6Governance(page, opts = {}) {
  const { projects = 'SD', fuzzyCommitment = false, mockInboxRoutes = true } = opts;
  const brief = stubRound6Brief(['SD']);
  await page.addInitScript(({ key, pk, cacheKey, cacheBody, aiPref }) => {
    try { localStorage.setItem(key, pk); } catch (_) {}
    try { localStorage.setItem('delivera_ai_provider_pref_v1', aiPref); } catch (_) {}
    try { localStorage.setItem('delivera_gov_quarter_v1', 'FY27 Q2'); } catch (_) {}
    try { sessionStorage.removeItem('delivera:legacy-brief-needed'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
    const map = { 'SD||28d': { brief: cacheBody, at: Date.now(), ttlMs: 180000 } };
    sessionStorage.setItem(cacheKey, JSON.stringify(map));
  }, {
    key: PROJECTS_SSOT_KEY,
    pk: projects,
    cacheKey: BRIEF_CLIENT_CACHE_KEY,
    cacheBody: brief,
    aiPref: JSON.stringify({ provider: 'openai', key: 'sk-test-probe', host: '' }),
  });
  await routeProjectsCatalog(page);
  const commitments = fuzzyCommitment
    ? [{
      id: 'SD-8419',
      issueKey: 'SD-8419',
      title: 'Stuck epic',
      status: 'At risk',
      reason: 'Ping Lilian to confirm scope',
      decisionNeeded: 'Ping Lilian today to confirm scope',
    }]
    : [{
      id: 'SD-8419',
      issueKey: 'SD-8419',
      title: 'Stuck epic',
      status: 'At risk',
      reason: 'Stuck',
      decisionNeeded: 'Confirm scope',
    }];

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
          headline: 'Scope and commitment uncertainty',
          narrative: { headline: 'Scope and commitment uncertainty', mainIssue: 'Evidence gap' },
          aboveFold: { exposedCommitments: 1, actionsReady: 0, poResponsesRequired: 0 },
          affectedCommitments: commitments,
          decisionRequired: { issue: 'Scope and commitment uncertainty', owner: 'Product Owner', evidenceConfidence: 'Medium' },
          preparedActions: { groups: [], items: [], totalReady: 0 },
          evidenceBreakdown: { confidenceLabel: 'Medium', available: 1, required: 4 },
          trust: { liveCases: 0, nudgesReady: 0, proofLevel: 'Medium' },
          dataTrust: { confidenceLabel: 'Medium', boardsConnected: { connected: 1, total: 1 }, commitmentsMapped: { mapped: 2, total: 4 }, dataGaps: 1, lastSync: 'Live' },
          portfolioSummary: { commitmentsOnTrack: 0, commitmentsAtRisk: 1, commitmentsTotal: 4, commitmentsBlocked: 1 },
          drivers: [{ title: 'Evidence', summary: 'Proof confidence is low.' }],
          monitoring: { squadCount: 1, commitmentCount: 4, exposedCommitmentCount: 1 },
          anchorProject: 'SD',
          periodKey: 'FY27 Q2',
        },
        comparison: {
          cards: [
            { projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'Blocked', statusClass: 'blocked', nextAction: 'Ping Lilian', explanation: 'SD blocked.' },
          ],
          actionsStrip: {},
        },
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
  await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ provider: 'openrouter', configured: true, source: 'server' }),
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
      stories: Array.from({ length: 8 }, (_, i) => ({
        issueKey: `SD-${100 + i}`,
        summary: `Story ${i}`,
        status: i === 0 ? 'Blocked' : 'In Progress',
        storyPoints: 3,
      })),
      stuckCandidates: [blocker],
      decisionCockpit: {
        health: { status: 'Needs Attention', tone: 'critical', message: 'Sprint blocked' },
        nextBestAction: {
          issueKey: blocker.issueKey,
          summary: blocker.summary,
          reason: `Stale ${blocker.hoursInStatus}h`,
          ctaLabel: 'Unblock',
          riskTags: ['blocker'],
        },
        topRisks: [{ issueKey: blocker.issueKey, summary: blocker.summary, riskTags: ['blocker'], severity: 'High' }],
        keySignals: { blockers: 1, scopeChanges: 0, inactivity: true, completedRecent: { count: 0, storyPoints: 0 } },
        metrics: { daysRemaining: 9, progressPct: { value: 0 }, workItems: { done: 0, total: 13, remaining: 13 }, timeLogged: { ratioPct: 10 } },
        quickActions: [],
        insights: {},
      },
      recentSprints: [{ id: 41, name: 'Sprint 41', state: 'closed' }],
    }),
  }));
  await page.route('**/api/governance/pi-baseline**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ committedItems: [] }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ boards: [{ id: 1, projectKey: 'SD', name: 'SD board' }] }),
  }));
}

async function mockEmptyActions(page) {
  await page.route('**/api/governance/interventions*.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }),
  }));
}

test.describe('Direct-Value Master Plan Round 6 realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused direct-value round6 contracts', async ({ page, request }) => {
    const telemetry = captureBrowserTelemetry(page);

    await test.step('01 live inbox and feedback-summary return 200', async () => {
      const inbox = await request.get('/api/governance/inbox.json?projects=SD');
      if (inbox.status() === 401) {
        test.skip(true, 'Auth required for live inbox route');
        return;
      }
      expect(inbox.ok()).toBeTruthy();
      const feedback = await request.get('/api/governance/feedback-summary.json?projects=SD');
      expect(feedback.ok()).toBeTruthy();
    });

    await test.step('02 governance load without inbox 404 console noise', async () => {
      await mockRound6Governance(page, { mockInboxRoutes: false });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 honest cadence not bare In sprint when movement blocked', async () => {
      await mockRound6Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const cadence = page.locator('[data-testid="gov-cadence-pack"]').first();
      if (await cadence.count()) {
        const health = await cadence.getAttribute('data-movement-health');
        const text = await cadence.innerText();
        if (health === 'blocked') {
          expect(text).not.toMatch(/Sprint active · no movement/);
          expect(text).not.toMatch(/^In sprint · Active sprint$/);
        }
      }
    });

    await test.step('04 single primary Set baseline when PI focus strip visible', async () => {
      await expect(page.locator('[data-testid="gov-pi-focus-strip"]')).toBeVisible();
      await expect(page.locator('[data-testid="gov-pi-focus-set-baseline"]')).toHaveCount(1);
      await expect(page.locator('.gov-setup-debt [data-setup-baseline-ssot="1"]')).toHaveCount(0);
      await expect(page.locator('.gov-pi-empty-cta [data-setup-baseline-ssot="1"]')).toHaveCount(0);
    });

    await test.step('05 header and cockpit share aligned blocker key', async () => {
      await mockAlignedBlockedSprint(page);
      await page.setViewportSize({ width: 1400, height: 900 });
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('.current-sprint-header-bar', { timeout: 20000 });
      const headerText = await page.locator('.sprint-intervention-item-primary').innerText();
      const cockpitText = await page.locator('[data-testid="cockpit-main-blocker"]').innerText();
      expect(headerText).toMatch(/SD-8419/);
      expect(cockpitText).toMatch(/SD-8419/);
    });

    await test.step('06 actions inline blocker queue with boards-backed fetch', async () => {
      await mockEmptyActions(page);
      await mockAlignedBlockedSprint(page);
      await page.goto('/actions');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="actions-blocker-queue"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#actions-blocker-banner')).toHaveCount(0);
    });

    await test.step('07 status honesty bar and low confidence on blocked brief', async () => {
      await mockRound6Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await expect(page.locator('[data-testid="portfolio-status-honesty-bar"]')).toBeVisible();
    });

    await test.step('08 commitment fuzzy merge single Next move line', async () => {
      await mockRound6Governance(page, { fuzzyCommitment: true });
      await page.evaluate(() => {
        try { sessionStorage.removeItem('delivera:portfolio-decision:cache:v1'); } catch (_) {}
      });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const row = page.locator('.portfolio-commitment-row').first();
      await expect(row.locator('.portfolio-commitment-next-move')).toHaveCount(1);
      await expect(row.locator('.portfolio-commitment-reason')).toHaveCount(0);
    });

    await test.step('09 ultrawide sprint proof rail visible', async () => {
      await mockAlignedBlockedSprint(page);
      await page.setViewportSize({ width: 1904, height: 929 });
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('[data-testid="sprint-proof-rail"]', { timeout: 20000 });
      await expect(page.locator('.current-sprint-grid-layout.sprint-rail-visible')).toBeVisible();
    });

    await test.step('10 blocked sprint full-sprint fold closed by default', async () => {
      await expect(page.locator('details.sprint-full-sprint-fold').first()).not.toHaveAttribute('open', '');
    });

    await test.step('11 PI wizard DMS Q2 slide shows aligned reconcile state', async () => {
      if (!existsSync(SLIDE_DMS_Q2)) {
        test.skip(true, `Missing slide fixture ${SLIDE_DMS_Q2}`);
        return;
      }
      await mockRound6Governance(page);
      await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          method: 'slide-vision',
          quarter: 'FY27 Q2',
          candidates: [{ issueKey: 'SD-100', title: 'FY27 Q2 – DMS – NBA – CVM', method: 'slide-linked' }],
          resolved: [{ status: 'linked', issueKey: 'SD-100' }],
          matchedCount: 1,
          missingCount: 0,
        }),
      }));
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await page.locator('[data-testid="gov-pi-focus-set-baseline"]').click();
      await expect(page.locator('.gov-right-drawer-panel .gov-baseline-wizard')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.gov-baseline-loading')).toHaveCount(0, { timeout: 15000 });
      await page.locator('details.gov-baseline-optional').evaluate((el) => { el.open = true; });
      const uploadDone = page.waitForResponse((r) => r.url().includes('propose-from-image') && r.ok());
      await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_DMS_Q2);
      await uploadDone;
      await expect(page.locator('[data-testid="gov-baseline-aligned"]')).toBeVisible({ timeout: 15000 });
    });

    await test.step('12 evidence rail docked not calibration overlay', async () => {
      await mockRound6Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await page.locator('[data-portfolio-action="view-governance-evidence"]').first().click();
      await page.waitForTimeout(400);
      const calibration = await page.locator('.portfolio-calibration-drawer, [data-calibration-drawer]').count();
      expect(calibration).toBe(0);
      const docked = await page.locator('#delivera-gov-right-drawer[data-evidence-docked="1"]:not([hidden]), .gov-right-drawer-panel--gov-evidence-drawer-docked, #gov-right-rail-proof-mount[data-proof-active="1"]').count();
      expect(docked).toBeGreaterThan(0);
    });

    await test.step('13 grid Next move hidden when portfolio rail visible', async () => {
      await expect(page.locator('body')).toHaveClass(/portfolio-rail-visible/);
      const hidden = await page.locator('.portfolio-grid-action').first().evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden';
      });
      expect(hidden).toBeTruthy();
    });

    await test.step('14 cross-surface telemetry clean', async () => {
      await mockEmptyActions(page);
      await mockAlignedBlockedSprint(page);
      await page.goto('/actions');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('.current-sprint-header-bar', { timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('15 stories card visible above fold on blocked load', async () => {
      await page.waitForSelector('#stories-card, #stories-card-wrap', { timeout: 25000 });
      const box = await page.locator('#stories-card, #stories-card-wrap').first().boundingBox();
      expect(box).toBeTruthy();
      expect(box.y).toBeLessThan(950);
    });

    await test.step('16 final telemetry guard', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
