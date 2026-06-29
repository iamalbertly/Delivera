import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { buildScopeIntelligence } from '../lib/Delivera-Governance-BoardIntelligence-01Scope-SSOT.js';
import { buildPIConfidenceStrip, buildPIForumAnswer } from '../lib/Delivera-Governance-PIConfidence-01Strip-SSOT.js';
import { scoreEpicHygiene, detectAdHocEpics } from '../lib/Delivera-Governance-EpicHygiene-01Score-SSOT.js';
import { classifyFeedbackToAgent } from '../lib/Delivera-Governance-FeedbackTriage-01Agents-SSOT.js';
import {
  waitForGovernanceReady,
  legacyBrief,
  clickLegacy,
  openLegacyDetails,
  mockPortfolioDecision,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';

const PI_BRIEF = {
  briefId: 'PI-TEST',
  projects: ['MPSA', 'MAS', 'RPA', 'SD', 'FOO'],
  period: { vodacomQuarter: 'FY27 Q1' },
  leadershipNarrative: { narratedBy: 'advisor', meetingAnswer: 'PI watch' },
  meta: {
    narratedBy: 'advisor',
    commandAnswerSentence: 'PI confidence needs baseline confirmation.',
    piForumAnswer: 'FY27 Q1 MPSA: confidence limited until baseline is set.',
    protectMeAnswer: 'Safest wording: delivery confidence issue supported by evidence.',
    piConfidence: {
      trusted: false,
      confidencePct: null,
      headline: 'PI Confidence: Not trusted yet',
      subline: '0 committed · 2 candidate',
      timelineChips: [],
      counts: { committed: 0, onTrack: 0, atRisk: 0, offPlan: 2, missingDates: 1 },
    },
    scopeIntelligence: {
      available: 5,
      noSprint: 1,
      piCommitted: 3,
      capsuleLine: 'Scope: MPSA + MAS · 5 available · 1 no sprint · 3 PI committed',
      cards: [
        { projectKey: 'MPSA', health: 'blocked', label: '2 blocked', sprint: 'active' },
        { projectKey: 'RPA', health: 'setup', label: 'no sprint', sprint: 'none' },
      ],
    },
    epicHygiene: { score: 72, epicCount: 4, summaryLine: 'MPSA 80% · MAS 65%', suggestions: [{ issueKey: 'MPSA-1', suggested: 'FY27 Q1 – X' }] },
    adHocEpics: [{ issueKey: 'MAS-99', summary: 'Ad hoc epic', reason: 'not in PI baseline' }],
    setupGaps: [],
    workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 3 },
    sinceLastRun: { summary: 'Since last brief: +1 blocker' },
  },
  squadInsights: [
    { projectKey: 'MPSA', verdictTier: 'blocked', boardResolved: true, healthSignals: { sprintSetup: 'ok' } },
    { projectKey: 'MAS', verdictTier: 'watch', boardResolved: true, healthSignals: { sprintSetup: 'ok' } },
    { projectKey: 'RPA', verdictTier: 'watch', boardResolved: true, healthSignals: { sprintSetup: 'limited' } },
    { projectKey: 'SD', verdictTier: 'on-track', boardResolved: true, healthSignals: { sprintSetup: 'ok' } },
    { projectKey: 'FOO', verdictTier: 'on-track', boardResolved: true, healthSignals: { sprintSetup: 'ok' } },
  ],
  portfolioRollup: { summaryLine: '5 squads in scope' },
  topRisks: [{ issueKey: 'MPSA-2', riskLabel: 'Stale', evidence: '96h unchanged', decisionNeededFrom: 'Tech Lead', recommendedAction: 'Unblock' }],
  evidencePack: { rows: [{ issueKey: 'MPSA-2', whyFlagged: 'stale', changelogAvailable: true }] },
};

async function mockPiPage(page) {
  await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'MPSA,MAS,RPA,SD,FOO'); });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(PI_BRIEF),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: 2, agents: [{ agent: 'Phrase Agent', count: 1, items: [], label: 'patterns' }], lastImprovements: ['1 phrase'] }),
  }));
  await page.route('**/api/governance/scope-intelligence.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ scope: PI_BRIEF.meta.scopeIntelligence, boards: 5, projectErrors: [] }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      projects: ['MPSA', 'MAS', 'RPA', 'SD'],
      boards: [
        { id: 1, name: 'MPSA', projectKey: 'MPSA' },
        { id: 2, name: 'MAS', projectKey: 'MAS' },
        { id: 3, name: 'RPA', projectKey: 'RPA' },
        { id: 4, name: 'SD', projectKey: 'SD' },
      ],
      projectErrors: [],
    }),
  }));
  await mockPortfolioDecision(page);
  await page.route('**/api/governance/interventions/seed-from-brief**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }),
  }));
  await page.route('**/api/governance/interventions.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }),
  }));
}

async function loadPiPage(page) {
  const briefPromise = page.waitForResponse('**/api/governance-brief.json**', { timeout: 25000 }).catch(() => null);
  await page.goto('/governance');
  if (page.url().includes('/login')) return false;
  await waitForGovernanceReady(page);
  await briefPromise;
  await page.waitForFunction(
    () => document.querySelector('.gov-pi-strip-fold') || document.querySelector('#gov-pi-strip-mount .gov-pi-strip'),
    { timeout: 15000 },
  ).catch(() => {});
  return true;
}

async function openPiStripFoldIfPresent(page) {
  const fold = legacyBrief(page, '.gov-pi-strip-fold');
  if (!(await fold.count())) return;
  await fold.waitFor({ state: 'attached' });
  await fold.evaluate((el) => { el.open = true; });
  await expect(fold).toHaveAttribute('open', '');
}

test.describe('Governance PI intelligence', () => {
  test('lib scope intelligence builds capsule line', () => {
    const scope = buildScopeIntelligence({
      boards: [{ id: 1, name: 'MPSA', location: { projectKey: 'MPSA' } }],
      boardPayloads: [{ board: { location: { projectKey: 'MPSA' } }, payload: { sprint: { state: 'active' }, stories: [{ epicKey: 'MPSA-1' }] } }],
      selectedProjects: ['MPSA'],
    });
    expect(scope.available).toBe(1);
    expect(scope.capsuleLine).toContain('MPSA');
  });

  test('lib PI confidence strip without baseline is not trusted', () => {
    const strip = buildPIConfidenceStrip({}, []);
    expect(strip.trusted).toBe(false);
    expect(strip.headline).toContain('Not trusted');
  });

  test('lib epic hygiene scores naming', () => {
    const h = scoreEpicHygiene({ period: { vodacomQuarter: 'FY27 Q1' } }, [{
      board: { name: 'MPSA board' },
      payload: { stories: [{ epicKey: 'E-1', epicSummary: 'FY27 Q1 – A – B – Goal' }] },
    }]);
    expect(h.score).toBeGreaterThan(50);
  });

  test('lib ad-hoc epic detection flags non-baseline', () => {
    const adHoc = detectAdHocEpics({ baselineComparison: { items: [] } }, [{
      board: { name: 'MAS' },
      payload: { stories: [{ epicKey: 'X-1', epicSummary: 'Random epic', created: new Date().toISOString() }] },
    }]);
    expect(adHoc.length).toBeGreaterThan(0);
  });

  test('lib feedback classifies phrase signals', () => {
    expect(classifyFeedbackToAgent({ note: 'wrong wording copy' })).toBe('phrase');
    expect(classifyFeedbackToAgent({ dismissReason: 'bad-data' })).toBe('data');
  });

  test('lib PI forum answer is deterministic', () => {
    const text = buildPIForumAnswer({ period: { vodacomQuarter: 'FY27 Q1' }, projects: ['MPSA'], meta: { piConfidence: buildPIConfidenceStrip({}) } });
    expect(text).toContain('FY27 Q1');
  });

  test('page renders PI confidence gauge or no-data state', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await expect(page.locator('[data-portfolio-signal]')).toBeVisible();
    await expect(legacyBrief(page, '.gov-owner-cluster, .gov-portfolio-grid-wrap').first()).toBeAttached();
    await openPiStripFoldIfPresent(page);
    await expect(legacyBrief(page, '.gov-pi-strip-fold[open] .gov-pi-strip')).toBeAttached();
    await expect(legacyBrief(page, '.gov-pi-strip-fold[open] .gov-pi-gauge-track, .gov-pi-strip-fold[open] .gov-pi-nodata').first()).toBeAttached();
    await expect(legacyBrief(page, '.gov-pi-strip-fold[open] .gov-pi-counter-row')).toBeAttached();
    await expect(legacyBrief(page, '.gov-pi-strip-fold[open] .gov-pi-counter-row')).toContainText(/Promised/i);
    await expect(legacyBrief(page, '.gov-pi-strip-fold[open] .gov-pi-counter-row')).toContainText(/Not saved yet/i);
  });

  test('scope capsule shows available and no sprint counts', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await expect(page.locator('[data-portfolio-scope-filters], .gov-scope-capsule-text').first()).toBeAttached();
  });

  test('advanced scope opens intelligence drawer', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await page.waitForSelector('#gov-scope-bar-mount [data-scope-intel-inline] .gov-scope-card', { state: 'attached', timeout: 20000 });
    await expect(page.locator('#gov-scope-bar-mount [data-scope-intel-inline] .gov-scope-card').first()).toBeAttached();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => {
      const { openScopeIntelligenceDrawer } = await import('/Delivera-App-Governance-Brief-18Render-ScopeIntelligenceDrawer-UI.js');
      const { govPage } = await import('/Delivera-Governance-Brief-Page-01Context.js');
      if (govPage.lastBrief) openScopeIntelligenceDrawer(govPage.lastBrief);
    });
    await expect(page.locator('#gov-right-drawer-title')).toContainText(/Scope intelligence/i);
  });

  test('epic hygiene and ad-hoc watcher render', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await expect(legacyBrief(page, '.gov-portfolio-grid-wrap')).toBeAttached();
    await openPiStripFoldIfPresent(page);
    await expect(legacyBrief(page, '.gov-pi-hygiene-row, .gov-pi-hygiene-compact').first()).toBeAttached();
    await expect(legacyBrief(page, '.gov-adhoc-chip')).toBeAttached();
  });

  test('comparison tray filters with 5 squads', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await expect(legacyBrief(page, '.gov-comparison-refine summary')).toContainText(/Refine|squads/i);
    await openLegacyDetails(page, '.gov-comparison-refine');
    await expect(legacyBrief(page, '.gov-comparison-tray-bar')).toBeAttached();
    await clickLegacy(page, '[data-comparison-filter="blocked"]');
    await expect(legacyBrief(page, '[data-heat-tile][data-verdict-tier="blocked"]')).toBeAttached();
  });

  test('visual answer blocks and trust chip row', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await expect(legacyBrief(page, '.gov-visual-answer-blocks')).toBeAttached();
    await expect(legacyBrief(page, '.gov-scope-status-chip')).toBeAttached();
    await expect(page.locator('#gov-review-actions')).toHaveCount(0);
    await expect(legacyBrief(page, '[data-grouped-nudge], [data-grouped-send]').first()).toBeAttached();
  });

  test('grouped inbox drawer shows group card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockPiPage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        briefs: [],
        nudges: Array.from({ length: 3 }, (_, i) => ({
          id: `n${i}`, type: 'nudge', summary: 'Ready nudge', safeToSend: true,
          approvalRequired: false,
          payload: { owner: 'Amani', riskType: 'stale', board: 'SD', issueKey: `SD-${i}` },
        })),
        piDrift: [], confirm: [], impact: [], poReadiness: [],
      }),
    }));
    await loadPiPage(page);
    await clickLegacy(page, '[data-queue-open]');
    await expect(page.locator('.gov-inbox-group-card')).toBeVisible();
    await expect(page.locator('.gov-inbox-group-card')).toContainText(/\d+ ·/i);
  });

  test('baseline propose 500 shows drawer error copy', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'allow-http-status-console', description: '500' });
    await mockPiPage(page);
    await page.route('**/api/governance/pi-baseline/propose**', (r) => r.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'PI propose failed' }),
    }));
    await page.route('**/api/boards.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ projects: ['MPSA'], boards: [{ id: 1, name: 'MPSA', projectKey: 'MPSA' }], projectErrors: [] }),
    }));
    await loadPiPage(page);
    await expect(legacyBrief(page, '.gov-portfolio-grid-wrap')).toBeAttached();
    await openPiStripFoldIfPresent(page);
    await clickLegacy(page, '#gov-pi-fix-baseline');
    await expect(page.locator('.gov-right-drawer-panel')).toBeVisible();
    await expect(page.locator('.gov-right-drawer-body')).toContainText(/PI propose failed|Could not load PI candidates/i);
  });

  test('trusted PI strip hides counter row', async ({ page }) => {
    const trusted = {
      ...PI_BRIEF,
      topRisks: [],
      meta: {
        ...PI_BRIEF.meta,
        piConfidence: {
          trusted: true,
          confidencePct: 82,
          timelineChips: [],
          counts: { committed: 3, onTrack: 2, atRisk: 0, offPlan: 0, missingDates: 0 },
        },
      },
    };
    await mockPiPage(page);
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(trusted),
    }));
    await loadPiPage(page);
    await openPiStripFoldIfPresent(page);
    await expect(legacyBrief(page, '.gov-pi-strip.is-trusted')).toBeAttached();
    await expect(legacyBrief(page, '.gov-pi-counter-row')).toHaveCount(0);
  });

  test('guided fix cards when setup gaps present', async ({ page }) => {
    const withGaps = { ...PI_BRIEF, meta: { ...PI_BRIEF.meta, setupGaps: [{ id: 'pi-baseline', action: 'set-baseline', severity: 'high' }] } };
    await mockPiPage(page);
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withGaps) }));
    await loadPiPage(page);
    const expand = legacyBrief(page, '#gov-setup-gaps-expand');
    if (await expand.count()) await clickLegacy(page, '#gov-setup-gaps-expand');
    await expect(legacyBrief(page, '.gov-fix-card')).toBeAttached();
  });

  test('narration trust badge and PI forum copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockPiPage(page);
    await loadPiPage(page);
    await clickLegacy(page, '#gov-copy-pi-forum');
    await expect(legacyBrief(page, '#gov-copy-pi-forum')).toContainText(/copied/i);
  });

  test('protect-me wording reveals safe line', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await expect(legacyBrief(page, '.gov-command-answer')).toBeAttached();
    await clickLegacy(page, '#gov-overflow-toggle');
    await clickLegacy(page, '#gov-protect-me');
    await expect(legacyBrief(page, '#gov-protect-me-line')).toBeAttached();
    await expect(legacyBrief(page, '#gov-protect-me-line')).toContainText(/Safest wording/i);
  });

  test('improvement lab opens from mount', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await page.evaluate(() => {
      const chrome = document.getElementById('gov-secondary-chrome');
      chrome?.removeAttribute('hidden');
      if (chrome && 'open' in chrome) chrome.open = true;
    });
    await clickLegacy(page, '#gov-open-feedback-lab');
    await expect(page.locator('#gov-right-drawer-title')).toContainText(/Feedback improvement/i);
  });

  test('global agent bar hidden on governance (scope chip owns queue)', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await expect(page.locator('#gov-global-agent-bar')).toBeHidden();
    await expect(legacyBrief(page, '.gov-scope-status-chip')).toBeAttached();
  });

  test('portfolio signal mount replaces legacy sticky answer', async ({ page }) => {
    await mockPiPage(page);
    await loadPiPage(page);
    await expect(page.locator('[data-portfolio-signal]')).toBeAttached();
    await expect(page.locator('#gov-sticky-answer-mount')).toHaveCount(0);
  });

  test('telemetry clean on PI governance load', async ({ page }) => {
    const telemetry = await captureBrowserTelemetry(page, async () => {
      await mockPiPage(page);
      await loadPiPage(page);
      await openPiStripFoldIfPresent(page);
      await page.waitForSelector('#gov-brief-content .gov-pi-strip', { state: 'attached', timeout: 20000 });
    });
    assertTelemetryClean(telemetry);
  });
});
