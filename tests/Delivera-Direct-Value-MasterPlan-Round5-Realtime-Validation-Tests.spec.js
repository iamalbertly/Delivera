/**
 * Direct-Value Master Plan Round 5 — trust & today mode contracts.
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

function stubRound5Brief(projects = ['SD'], overrides = {}) {
  const keys = Array.isArray(projects) ? projects : String(projects).split(',').map((p) => p.trim()).filter(Boolean);
  const primary = keys[0] || 'SD';
  return {
    briefId: `R5-${keys.join('-')}`,
    projects: keys,
    portfolio: keys.join(' + '),
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Scope uncertainty blocks delivery today.', narratedBy: 'template' },
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
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
      issueKey: `${primary}-5184`,
      assigneeName: 'Amani',
      recommendedAction: 'Unblock today',
      escalation: 'act-today',
      issueUrl: `https://example/${primary}-5184`,
      displayTitle: 'Stuck epic',
    }],
    evidencePack: {
      rows: [{ issueKey: `${primary}-5184`, statusNow: 'In Progress', whyFlagged: 'stale 14d' }],
    },
    squadInsights: keys.map((pk) => ({
      projectKey: pk,
      verdictTier: pk === primary ? 'blocked' : 'watch',
      verdictLabel: pk === primary ? 'DELIVERY BLOCKED' : 'Watch',
      bottleneckLine: `${pk} bottleneck`,
      productivityLine: 'Stale work',
      sprintPulse: { committed: 4, done: 1 },
      piCommitted: 4,
      piDone: 1,
      cardRisks: [{ issueKey: `${pk}-1`, displayTitle: 'Stuck' }],
    })),
    ...overrides,
  };
}

async function mockPortfolioDecision(page, opts = {}) {
  const { fuzzyCommitment = false } = opts;
  const commitments = fuzzyCommitment
    ? [{
      id: 'SD-5184',
      issueKey: 'SD-5184',
      title: 'Stuck epic',
      status: 'At risk',
      reason: 'Ping Lilian to confirm scope',
      decisionNeeded: 'Ping Lilian today to confirm scope',
    }]
    : [{
      id: 'SD-5184',
      issueKey: 'SD-5184',
      title: 'Stuck epic',
      status: 'At risk',
      reason: 'Stuck',
      decisionNeeded: 'Confirm scope',
    }];

  await page.route('**/api/governance/interventions/seed-from-brief**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, cases: [] }),
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
          decisionRequired: { issue: 'Scope and commitment uncertainty', owner: 'Product Owner' },
          preparedActions: { groups: [], items: [], totalReady: 0 },
          metrics: { delivery: { value: 25, peerMedian: 50 }, offPlanLoad: { value: 20, peerMedian: 10 }, proofConfidence: { value: 35, peerMedian: 48 } },
          trust: { liveCases: 0, nudgesReady: 0, proofLevel: 'Low' },
          drivers: [{ title: 'Evidence', summary: 'Proof confidence is low.' }],
          decisionOptions: [{ id: 'review-scope', label: 'Review scope', impactPreview: 'Confirm scope.' }],
          monitoring: { squadCount: 1, commitmentCount: 4, exposedCommitmentCount: 1 },
          anchorProject: 'SD',
          recommendation: { label: 'Confirm scope and proof before investment review' },
        },
        comparison: {
          cards: [
            { projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'Blocked', statusClass: 'blocked', nextAction: 'Ping Lilian', explanation: 'SD blocked.' },
            { projectKey: 'BIO', squadName: 'Bio Squad', selected: false, status: 'Watch', statusClass: 'watch', nextAction: 'Watch', explanation: 'BIO watch.' },
          ],
          actionsStrip: {},
        },
        cases: [],
      }),
    });
  });
}

async function mockRound5Governance(page, opts = {}) {
  const { projects = 'SD', fuzzyCommitment = false } = opts;
  const brief = stubRound5Brief(['SD']);
  await page.addInitScript(({ key, pk, cacheKey, cacheBody }) => {
    try { localStorage.setItem(key, pk); } catch (_) {}
    try { sessionStorage.removeItem('delivera:legacy-brief-needed'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
    const map = { 'SD||28d': { brief: cacheBody, at: Date.now(), ttlMs: 180000 } };
    sessionStorage.setItem(cacheKey, JSON.stringify(map));
  }, {
    key: PROJECTS_SSOT_KEY,
    pk: projects,
    cacheKey: BRIEF_CLIENT_CACHE_KEY,
    cacheBody: brief,
  });
  await routeProjectsCatalog(page);
  await mockPortfolioDecision(page, { fuzzyCommitment });
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(brief),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q2', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ nudges: [], confirm: [], briefs: [], piDrift: [], impact: [], poReadiness: [] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
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
    body: JSON.stringify({ provider: 'openrouter', configured: true, source: 'server' }),
  }));
}

async function mockBlockedSprint(page) {
  await page.route('**/api/current-sprint.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      sprint: { id: 42, name: 'Sprint 42', state: 'active', startDate: '2026-06-01', endDate: '2026-06-14' },
      board: { id: 1, name: 'SD board', projectKeys: ['SD'] },
      meta: { projects: 'SD', generatedAt: new Date().toISOString() },
      summary: { totalStories: 8, doneStories: 1, percentDone: 12, totalSP: 20 },
      daysMeta: { daysRemainingWorking: 9, daysRemainingCalendar: 9 },
      stories: Array.from({ length: 8 }, (_, i) => ({
        issueKey: `SD-${100 + i}`,
        summary: `Story ${i}`,
        status: i === 0 ? 'Blocked' : 'In Progress',
        storyPoints: 3,
      })),
      stuckCandidates: [{ issueKey: 'SD-8419', summary: 'Wrong stuck list head', hoursInStatus: 96 }],
      decisionCockpit: {
        health: { status: 'Blocked', tone: 'critical', message: 'Sprint blocked on scoring item' },
        nextBestAction: { issueKey: 'SD-8575', summary: 'Unblock scoring', ctaLabel: 'Review work', assignee: 'Lilian' },
        topRisks: [{ issueKey: 'SD-8575', summary: 'Scoring blocked', riskTags: ['blocker'] }],
        keySignals: { blockers: 1, scopeChanges: 0, inactivity: true, completedRecent: { count: 0, storyPoints: 0 } },
        metrics: { daysRemaining: 9, progressPct: { value: 12 }, workItems: { done: 1, total: 8, remaining: 7 }, timeLogged: { ratioPct: 40 } },
        quickActions: [],
        insights: {},
      },
      recentSprints: [{ id: 41, name: 'Sprint 41', state: 'closed' }],
      planned: { start: '2026-06-01', end: '2026-06-14' },
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

test.describe('Direct-Value Master Plan Round 5 realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused direct-value round5 contracts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1400, height: 900 });

    await test.step('01 header Unblock label issueKey matches cockpit Main blocker', async () => {
      await mockBlockedSprint(page);
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('.current-sprint-header-bar', { timeout: 20000 });
      const headerKey = await page.locator('.sprint-intervention-item-primary').innerText();
      const cockpitKey = await page.locator('[data-testid="cockpit-main-blocker"]').innerText();
      expect(headerKey).toMatch(/SD-8575/);
      expect(cockpitKey).toMatch(/SD-8575/);
      expect(headerKey).toContain(cockpitKey.replace(/Main blocker:\s*/i, '').trim());
    });

    await test.step('02 decision-cockpit-details not open on first paint', async () => {
      await expect(page.locator('.decision-cockpit-details').first()).not.toHaveAttribute('open', '');
    });

    await test.step('03 no duplicate attention table headers when cards visible', async () => {
      await expect(page.locator('.attention-queue-table')).toHaveCount(0);
    });

    await test.step('04 no Take Action link stories-card in viewport after blocked load', async () => {
      await expect(page.locator('.decision-primary-link')).toHaveCount(0);
      await expect(page.locator('[data-testid="cockpit-blockers-below"]')).toBeVisible();
      const stories = page.locator('#stories-card, #stories-card-wrap');
      await expect(stories.first()).toBeVisible();
      const box = await stories.first().boundingBox();
      expect(box).toBeTruthy();
      expect(box.y).toBeLessThan(900);
    });

    await test.step('05 See all evidence activates proof rail not full calibration overlay', async () => {
      await mockRound5Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await page.locator('[data-portfolio-action="view-governance-evidence"]').first().click();
      await page.waitForTimeout(400);
      const calibration = await page.locator('.portfolio-calibration-drawer, [data-calibration-drawer]').count();
      expect(calibration).toBe(0);
      const railActive = await page.locator('#gov-right-rail-proof-mount[data-proof-active="1"]').count();
      const docked = await page.locator('#delivera-gov-right-drawer[data-evidence-docked="1"]:not([hidden]), .gov-right-drawer-panel--gov-evidence-drawer-docked').count();
      expect(railActive + docked).toBeGreaterThan(0);
    });

    await test.step('06 governance telemetry clean after evidence click', async () => {
      assertTelemetryClean(telemetry);
    });

    await test.step('07 signal hero has no duplicate decision headline when rail h2 present', async () => {
      await expect(page.locator('[data-portfolio-signal-verdict]')).toHaveCount(0);
      await expect(page.locator('.portfolio-decision h2').first()).toBeVisible();
      const heroHeadline = page.locator('.portfolio-signal-headline--hero');
      if (await heroHeadline.count()) {
        const signalHeadline = await heroHeadline.innerText();
        expect(signalHeadline).not.toMatch(/Scope and commitment uncertainty/i);
      }
    });

    await test.step('08 actions inline blocker queue when ready=0 and stuckCandidates>0', async () => {
      await mockEmptyActions(page);
      await mockBlockedSprint(page);
      await page.goto('/actions');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="actions-blocker-queue"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#actions-blocker-banner')).toHaveCount(0);
    });

    await test.step('09 banner hidden when ready cases exist', async () => {
      await page.route('**/api/governance/interventions*.json**', (r) => r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          cases: [{
            id: 'case-ready-1',
            title: 'Ready case',
            state: 'open',
            needsApproval: true,
            project: 'SD',
          }],
        }),
      }));
      await page.goto('/actions?tab=ready');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('.actions-tab.is-active');
      await expect(page.locator('[data-testid="actions-blocker-queue"]')).toHaveCount(0);
    });

    await test.step('10 grid hides Next move column on desktop when decision rail visible', async () => {
      await mockRound5Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await expect(page.locator('body')).toHaveClass(/portfolio-rail-visible/);
      const hidden = await page.locator('.portfolio-grid-action').first().evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden';
      });
      expect(hidden).toBeTruthy();
    });

    await test.step('11 commitment row uses single Next move for fuzzy-matched reason/decision', async () => {
      await mockRound5Governance(page, { fuzzyCommitment: true });
      await page.evaluate(() => {
        try { sessionStorage.removeItem('delivera:portfolio-decision:cache:v1'); } catch (_) {}
      });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const row = page.locator('.portfolio-commitment-row').first();
      await expect(row.locator('.portfolio-commitment-next-move')).toHaveCount(1);
      await expect(row.locator('.portfolio-commitment-reason')).toHaveCount(0);
      await expect(row.locator('.portfolio-commitment-decision')).toHaveCount(0);
    });

    await test.step('12 off-PI recent stories fold closed by default', async () => {
      await mockBlockedSprint(page);
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('[data-alignment-above-fold="1"] .sprint-alignment-strip, .sprint-alignment-strip', { timeout: 20000 });
      await expect(page.locator('details.sprint-off-pi-fold').first()).not.toHaveAttribute('open', '');
    });

    await test.step('13 active filter chip visible without opening header drawer', async () => {
      await page.evaluate(() => {
        try { sessionStorage.removeItem('delivera:sprint-auto-blocker:42'); } catch (_) {}
      });
      await mockBlockedSprint(page);
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('.current-sprint-header-bar', { timeout: 20000 });
      await expect(page.locator('[data-testid="sprint-active-filter-chip"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="sprint-active-filter-chip"]')).toContainText(/blocker/i);
    });

    await test.step('14 cross-surface journey governance actions sprint telemetry clean', async () => {
      await mockRound5Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await mockEmptyActions(page);
      await mockBlockedSprint(page);
      await page.goto('/actions');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('.current-sprint-header-bar', { timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('15 scroll sprint stories-card remains visible E5 regression', async () => {
      await page.waitForSelector('#stories-card, #stories-card-wrap', { timeout: 25000 });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      await expect(page.locator('#stories-card, #stories-card-wrap').first()).toBeVisible();
      assertTelemetryClean(telemetry);
    });
  });
});
