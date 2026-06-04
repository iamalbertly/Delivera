import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { buildScopeIntelligence } from '../lib/Delivera-Governance-BoardIntelligence-01Scope-SSOT.js';
import { buildPIConfidenceStrip, buildPIForumAnswer } from '../lib/Delivera-Governance-PIConfidence-01Strip-SSOT.js';
import { scoreEpicHygiene, detectAdHocEpics } from '../lib/Delivera-Governance-EpicHygiene-01Score-SSOT.js';
import { classifyFeedbackToAgent } from '../lib/Delivera-Governance-FeedbackTriage-01Agents-SSOT.js';

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
    await page.goto('/governance');
    await expect(page.locator('.gov-pi-strip')).toBeVisible();
    await expect(page.locator('.gov-pi-gauge-track, .gov-pi-nodata')).toBeVisible();
    await expect(page.locator('.gov-pi-counter-row')).toBeVisible();
  });

  test('scope capsule shows available and no sprint counts', async ({ page }) => {
    await mockPiPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-scope-capsule-text')).toContainText(/5 available/);
    await expect(page.locator('.gov-scope-capsule-text')).toContainText(/1 no sprint/);
  });

  test('advanced scope opens intelligence drawer', async ({ page }) => {
    await mockPiPage(page);
    await page.goto('/governance');
    await page.locator('#gov-scope-change').click();
    await page.locator('#gov-scope-advanced').click();
    await expect(page.locator('#gov-right-drawer-title')).toContainText(/Scope intelligence/i);
  });

  test('epic hygiene and ad-hoc watcher render', async ({ page }) => {
    await mockPiPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-pi-hygiene-row')).toBeVisible();
    await expect(page.locator('.gov-adhoc-chip')).toBeVisible();
  });

  test('comparison tray filters with 5 squads', async ({ page }) => {
    await mockPiPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-comparison-tray-bar')).toBeVisible();
    await page.locator('[data-comparison-filter="blocked"]').click();
    await expect(page.locator('[data-heat-tile][data-verdict-tier="blocked"]')).toBeVisible();
  });

  test('visual answer blocks and trust chip row', async ({ page }) => {
    await mockPiPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-visual-answer-blocks')).toBeVisible();
    await expect(page.locator('.gov-trust-chip-row')).toBeVisible();
    await expect(page.locator('#gov-review-actions')).toBeVisible();
  });

  test('grouped inbox drawer shows group card', async ({ page }) => {
    await mockPiPage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        briefs: Array.from({ length: 3 }, (_, i) => ({
          id: `b${i}`, type: 'brief', summary: 'Ready brief', safeToSend: true,
          approvalRequired: false, payload: { owner: 'Amani', riskType: 'stale', board: 'SD' },
        })),
        nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [],
      }),
    }));
    await page.goto('/governance');
    await page.locator('.gov-top-chrome-summary').click();
    await page.locator('[data-queue-open]').click();
    await expect(page.locator('.gov-inbox-group-card')).toBeVisible();
    await expect(page.locator('.gov-inbox-group-card')).toContainText(/\d+ ·/i);
  });

  test('guided fix cards when setup gaps present', async ({ page }) => {
    const withGaps = { ...PI_BRIEF, meta: { ...PI_BRIEF.meta, setupGaps: [{ id: 'pi-baseline', label: 'PI baseline missing', action: 'set-baseline', severity: 'high' }] } };
    await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'MPSA,MAS'); });
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withGaps) }));
    await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }) }));
    await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }) }));
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [] }) }));
    await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, agents: [], lastImprovements: [] }) }));
    await page.goto('/governance');
    await expect(page.locator('.gov-fix-card')).toBeVisible();
  });

  test('narration trust badge and PI forum copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockPiPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-narration-badge--advisor')).toBeVisible();
    await page.locator('#gov-overflow-toggle').click();
    await page.locator('#gov-copy-pi-forum').click();
    await expect(page.locator('#gov-copy-pi-forum')).toContainText(/copied/i);
  });

  test('protect-me wording reveals safe line', async ({ page }) => {
    await mockPiPage(page);
    await page.goto('/governance');
    await page.locator('#gov-overflow-toggle').click();
    await page.locator('#gov-protect-me').click();
    await expect(page.locator('#gov-protect-me-line')).toBeVisible();
    await expect(page.locator('#gov-protect-me-line')).toContainText(/Safest wording/i);
  });

  test('improvement lab opens from mount', async ({ page }) => {
    await mockPiPage(page);
    await page.goto('/governance');
    await page.locator('#gov-open-feedback-lab').click();
    await expect(page.locator('#gov-right-drawer-title')).toContainText(/Feedback improvement/i);
  });

  test('global agent bar hidden on governance (scope chip owns queue)', async ({ page }) => {
    await mockPiPage(page);
    await page.goto('/governance');
    await expect(page.locator('#gov-global-agent-bar')).toBeHidden();
    await expect(page.locator('.gov-scope-status-chip')).toBeVisible();
  });

  test('sticky answer mount exists', async ({ page }) => {
    await mockPiPage(page);
    await page.goto('/governance');
    await expect(page.locator('#gov-sticky-answer-mount')).toBeAttached();
  });

  test('telemetry clean on PI governance load', async ({ page }) => {
    const telemetry = await captureBrowserTelemetry(page, async () => {
      await mockPiPage(page);
      await page.goto('/governance');
      await page.waitForSelector('.gov-pi-strip');
    });
    assertTelemetryClean(telemetry);
  });
});
