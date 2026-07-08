/**
 * Direct-Value Master Plan Round 4 — churn retention UX contracts.
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

function stubRound4Brief(projects = ['SD'], overrides = {}) {
  const keys = Array.isArray(projects) ? projects : String(projects).split(',').map((p) => p.trim()).filter(Boolean);
  const primary = keys[0] || 'SD';
  return {
    briefId: `R4-${keys.join('-')}`,
    projects: keys,
    portfolio: keys.join(' + '),
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked today', narratedBy: 'template' },
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
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 2 },
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
  const { duplicateCommitments = false, dueAt = '2026-07-10T12:00:00.000Z' } = opts;
  const commitments = duplicateCommitments
    ? [
      { id: 'SD-5184-a', issueKey: 'SD-5184', title: 'Stuck epic', status: 'At risk', reason: 'Stuck', decisionNeeded: 'Confirm scope' },
      { id: 'SD-5184-b', issueKey: 'SD-5184', title: 'Stuck epic dup', status: 'At risk', reason: 'Stuck', decisionNeeded: 'Confirm scope' },
    ]
    : [{ id: 'SD-5184', issueKey: 'SD-5184', title: 'Stuck epic', status: 'At risk', reason: 'Stuck', decisionNeeded: 'Confirm scope' }];

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
          headline: 'SD needs scope confirmation',
          narrative: { headline: 'SD needs scope confirmation', mainIssue: 'Evidence gap' },
          aboveFold: { exposedCommitments: 1, actionsReady: 1, poResponsesRequired: 0, nextDeadline: dueAt },
          affectedCommitments: commitments,
          decisionRequired: { dueAt, issue: 'Confirm PI scope', owner: 'Product Owner' },
          preparedActions: { groups: [], items: [], totalReady: 0 },
          metrics: { delivery: { value: 25, peerMedian: 50 }, offPlanLoad: { value: 20, peerMedian: 10 }, proofConfidence: { value: 35, peerMedian: 48 } },
          trust: { liveCases: 1, nudgesReady: 0, proofLevel: 'Low' },
          drivers: [{ title: 'Evidence', summary: 'Proof confidence is low.' }],
          decisionOptions: [{ id: 'review-scope', label: 'Review scope', impactPreview: 'Confirm scope.' }],
          monitoring: { squadCount: 1, commitmentCount: 4, exposedCommitmentCount: 1 },
          anchorProject: 'SD',
          recommendation: { label: 'Confirm scope and proof before investment review' },
        },
        comparison: {
          cards: [
            { projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'Blocked', statusClass: 'blocked', explanation: 'SD blocked.' },
            { projectKey: 'BIO', squadName: 'Bio Squad', selected: false, status: 'Watch', statusClass: 'watch', explanation: 'BIO watch.' },
          ],
          actionsStrip: {},
        },
        cases: [],
      }),
    });
  });
}

async function mockRound4Governance(page, opts = {}) {
  const { projects = 'SD', briefDelayMs = 0, duplicateCommitments = false, warmCache = false } = opts;
  const brief = stubRound4Brief(['SD']);
  await page.addInitScript(({ key, pk, cacheKey, cacheBody, seedCache }) => {
    try { localStorage.removeItem('delivera:portfolio-scope-seen'); } catch (_) {}
    try { localStorage.setItem(key, pk); } catch (_) {}
    try { sessionStorage.removeItem('delivera:legacy-brief-needed'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
    if (seedCache) {
      const map = { 'SD||28d': { brief: cacheBody, at: Date.now(), ttlMs: 180000 } };
      sessionStorage.setItem(cacheKey, JSON.stringify(map));
    }
  }, {
    key: PROJECTS_SSOT_KEY,
    pk: projects,
    cacheKey: BRIEF_CLIENT_CACHE_KEY,
    cacheBody: brief,
    seedCache: warmCache,
  });
  await routeProjectsCatalog(page);
  await mockPortfolioDecision(page, { duplicateCommitments });
  await page.route('**/api/governance-brief.json**', async (route) => {
    if (briefDelayMs > 0) await new Promise((r) => setTimeout(r, briefDelayMs));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(brief) });
  });
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
      stories: Array.from({ length: 8 }, (_, i) => ({
        issueKey: `SD-${100 + i}`,
        summary: `Story ${i}`,
        status: i === 0 ? 'Blocked' : 'In Progress',
        storyPoints: 3,
      })),
      stuckCandidates: [{ issueKey: 'SD-100', summary: 'Blocked story', hoursInStatus: 72 }],
      recentSprints: [{ id: 41, name: 'Sprint 41', state: 'closed' }, { id: 40, name: 'Sprint 40', state: 'closed' }],
      planned: { start: '2026-06-01', end: '2026-06-14' },
    }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ boards: [{ id: 1, projectKey: 'SD', name: 'SD board' }] }),
  }));
}

test.describe('Direct-Value Master Plan Round 4 realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused direct-value round4 contracts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1400, height: 900 });

    await test.step('01 portfolio paints cached signal without full skeleton when cache warm', async () => {
      await mockRound4Governance(page, { warmCache: true, briefDelayMs: 800 });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-portfolio-signal]').first()).toBeVisible({ timeout: 5000 });
      const swrPaint = await page.locator('#main-content[data-gov-brief-state="loading"] [data-portfolio-signal]').count();
      const contentReady = await page.locator('#main-content[data-gov-brief-state="content"]').count();
      expect(swrPaint > 0 || contentReady > 0).toBeTruthy();
      await waitForPortfolioReady(page);
    });

    await test.step('02 exactly one Open Alignment Studio primary button in viewport', async () => {
      await expect(page.locator('[data-testid="portfolio-primary-cta"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="portfolio-primary-cta"]')).toContainText(/Open Alignment Studio/i);
      await expect(page.locator('[data-testid="gov-pi-focus-baseline"]')).toHaveCount(0);
    });

    await test.step('03 commitments list has no duplicate issueKey rows', async () => {
      await mockRound4Governance(page, { duplicateCommitments: true });
      await page.reload();
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const keys = await page.locator('[data-commitment-issue]').evaluateAll((els) => els.map((el) => el.getAttribute('data-commitment-issue')));
      const unique = new Set(keys.filter(Boolean));
      expect(unique.size).toBe(keys.filter(Boolean).length);
    });

    await test.step('04 decision rail Due shows human label not ISO Z suffix', async () => {
      await mockRound4Governance(page, { duplicateCommitments: false });
      await page.reload();
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const dueText = await page.locator('#portfolio-decision .portfolio-decision-required-rows').first().innerText();
      expect(dueText).not.toMatch(/T\d{2}:\d{2}:\d{2}(\.\d+)?Z/);
      expect(dueText).toMatch(/Due today|Due tomorrow|Due in|Due /i);
    });

    await test.step('05 scope bar expanded on first visit localStorage absent', async () => {
      await page.evaluate(() => {
        localStorage.removeItem('delivera:portfolio-scope-seen');
      });
      await page.reload();
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await expect(page.locator('[data-portfolio-scope-body]:not([hidden])')).toBeVisible();
      await expect(page.locator('[data-portfolio-scope-toggle][aria-expanded="true"]')).toBeAttached();
    });

    await test.step('06 performance grid visible compare hides redundant add-comparison select desktop', async () => {
      await expect(page.locator('[data-portfolio-carousel], .portfolio-performance-grid-row').first()).toBeVisible();
      await expect(page.locator('#portfolio-scope-add')).toBeHidden();
    });

    await test.step('07 right rail contains data-trust or pi-focus strip below decision', async () => {
      const trust = page.locator('[data-testid="portfolio-data-trust"]');
      const piFocus = page.locator('[data-testid="gov-pi-focus-strip"]');
      await expect(trust.or(piFocus).first()).toBeVisible();
    });

    await test.step('08 governance telemetry clean after scope change click', async () => {
      const addSelect = page.locator('#portfolio-scope-add');
      if (await addSelect.isVisible()) {
        await addSelect.selectOption('BIO');
      } else {
        await page.evaluate(() => {
          document.querySelector('#portfolio-scope-bar-mount [data-project="BIO"]')?.click();
        });
      }
      await waitForPortfolioReady(page);
      assertTelemetryClean(telemetry);
    });

    await test.step('09 sprint auto-applies blocker filter when verdict blocked mock', async () => {
      await mockBlockedSprint(page);
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('.current-sprint-header-bar', { timeout: 20000 });
      const filterLabel = await page.locator('[data-header-active-filter-value]').first().innerText();
      expect(filterLabel.toLowerCase()).toMatch(/blocker/);
    });

    await test.step('10 sprint history folded details closed by default viewportLean', async () => {
      const fold = page.locator('details.sprint-history-fold');
      if (await fold.count()) {
        await expect(fold.first()).not.toHaveAttribute('open', '');
      }
    });

    await test.step('11 settings page has no settings-quick-nav mount', async () => {
      await page.goto('/settings');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#settings-quick-nav')).toHaveCount(0);
    });

    await test.step('12 actions page hides agent pill in top chrome', async () => {
      await page.route('**/api/governance/interventions*.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }),
      }));
      await page.goto('/actions');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.app-top-agent-pill, [data-top-action="agent"]')).toHaveCount(0);
    });

    await test.step('13 inline evidence row visible before View evidence click', async () => {
      await mockRound4Governance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      await expect(page.locator('[data-testid="portfolio-inline-evidence"]')).toBeVisible();
      await expect(page.locator('[data-portfolio-action="view-governance-evidence"]')).toContainText(/See all evidence/i);
    });

    await test.step('14 scroll sprint page stories-card remains visible no blank viewport', async () => {
      await mockBlockedSprint(page);
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('#stories-card', { timeout: 25000 });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      await expect(page.locator('#stories-card')).toBeVisible();
      assertTelemetryClean(telemetry);
    });
  });
});
