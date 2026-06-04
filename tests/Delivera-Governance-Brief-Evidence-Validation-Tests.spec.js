import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { buildBriefFactContract } from '../lib/Delivera-Governance-Brief-01FactContract-SSOT.js';
import { assignDecisionOwners, DECISION_LANES } from '../lib/Delivera-Governance-DecisionOwner-01Map-SSOT.js';
import { narrateBriefTemplate } from '../lib/Delivera-Governance-Brief-02Narrator-Template.js';
import { narrateBriefViaProvider } from '../lib/Delivera-AI-Provider-Gateway.js';
import { comparePIBaselineToNow, BASELINE_VERDICTS } from '../lib/Delivera-Governance-PIBaseline-02Compare.js';
import { buildEvidencePack } from '../lib/Delivera-Governance-Evidence-01Pack-Builder.js';
import { clampConfidenceToFreshness, RISK_TYPES } from '../lib/Delivera-Governance-Grammar-01Rules-SSOT.js';
import { attachExecutiveViewToBrief } from '../lib/Delivera-Governance-Executive-01View-SSOT.js';

function mockBoardPayload() {
  return {
    board: { name: 'MPSA Squad A' },
    sprint: { state: 'active', startDate: '2026-05-01T00:00:00Z' },
    meta: { activeSprintCount: 1 },
    stories: [
      { issueKey: 'MPSA-1', status: 'Done', storyPoints: 3, assignee: 'Alice', updated: '2026-05-20' },
      { issueKey: 'MPSA-2', status: 'In Progress', assignee: '', updated: '2026-05-02' },
      { issueKey: 'MPSA-3', status: 'To Do', created: '2026-05-10T00:00:00Z', updated: '2026-05-10' },
    ],
    stuckCandidates: [{ issueKey: 'MPSA-2', status: 'In Progress', hoursInStatus: 60, summary: 'stuck thing' }],
    scopeChanges: [{ issueKey: 'MPSA-3', summary: 'late add', date: '2026-05-10' }],
  };
}

function noActiveSprintBoard() {
  return {
    board: { name: 'MAS Squad B' },
    sprint: { state: 'closed' },
    meta: { activeSprintCount: 0 },
    nextSprint: { name: 'S2', startDate: '2026-05-01' },
    stories: [], stuckCandidates: [], scopeChanges: [],
  };
}

function buildEnrichedContract() {
  const contract = buildBriefFactContract({
    projects: ['MPSA', 'MAS'],
    boardPayloads: [{ payload: mockBoardPayload() }, { payload: noActiveSprintBoard() }],
    period: { vodacomQuarter: 'Q1' },
    freshnessMeta: {},
  });
  contract.risks = assignDecisionOwners(contract.risks);
  contract.topRisks = contract.risks.slice(0, 5);
  contract.portfolioRisks = assignDecisionOwners(contract.portfolioRisks);
  return contract;
}

test.describe('Governance Brief - deterministic logic (mocked Jira)', () => {
  test('contract completeness: required fields and evidence-bound counts', () => {
    const c = buildEnrichedContract();
    expect(c.briefId).toBeTruthy();
    expect(c.generatedAt).toBeTruthy();
    expect(c.freshness.confidenceLimit).toBe('live');
    expect(c.deliveryTruth.committed).toBe(3);
    expect(c.deliveryTruth.done).toBe(1);
    expect(c.deliveryTruth.lateAdded).toBe(1);
    // Honest, never invented: changelog-derived counts are null until enriched.
    expect(c.deliveryTruth.removed).toBeNull();
    expect(c.deliveryTruth.carryover).toBeNull();
  });

  test('never flags completed work as a risk', () => {
    const c = buildEnrichedContract();
    const keys = c.risks.map((r) => r.issueKey);
    expect(keys).not.toContain('MPSA-1'); // Done item must not appear
  });

  test('every risk maps to an issue key and carries evidence', () => {
    const c = buildEnrichedContract();
    for (const r of c.risks) {
      expect(r.issueKey).toMatch(/^[A-Z]+-\d+$/);
      expect(typeof r.evidence).toBe('string');
      expect(r.evidence.length).toBeGreaterThan(0);
    }
  });

  test('decision-owner mapping assigns lanes, not developers', () => {
    const c = buildEnrichedContract();
    const lanes = new Set(Object.values(DECISION_LANES));
    for (const r of c.topRisks) expect(lanes.has(r.decisionNeededFrom)).toBe(true);
  });

  test('data-confidence gap when story points unavailable', () => {
    const payload = mockBoardPayload();
    payload.summary = { storyPointsFieldWarning: true, totalSP: 0 };
    const c = buildBriefFactContract({
      projects: ['MPSA'],
      boardPayloads: [{ payload }],
      period: {},
      freshnessMeta: {},
    });
    const gap = c.portfolioRisks.find((r) => r.riskType === RISK_TYPES.DATA_CONFIDENCE_GAP);
    expect(gap).toBeTruthy();
    expect(gap.ruleFired).toBe(RISK_TYPES.DATA_CONFIDENCE_GAP);
  });

  test('attachExecutiveView adds squadInsights per selected project', () => {
    const contract = buildEnrichedContract();
    const boardPayloads = [
      { board: { name: 'MPSA Squad A', location: { projectKey: 'MPSA' } }, payload: mockBoardPayload() },
      { board: { name: 'MAS Squad B', location: { projectKey: 'MAS' } }, payload: noActiveSprintBoard() },
    ];
    attachExecutiveViewToBrief(contract, boardPayloads, { rows: [] });
    expect(contract.squadInsights).toHaveLength(2);
    expect(contract.squadInsights[0].projectKey).toBe('MPSA');
    expect(contract.portfolioRollup.totalSquads).toBe(2);
  });

  test('insufficient delivery when squad has zero done stories', () => {
    const payload = {
      board: { name: 'MAS Squad' },
      sprint: { state: 'active' },
      meta: { activeSprintCount: 1 },
      stories: [
        { issueKey: 'MAS-1', status: 'To Do', updated: '2026-05-10' },
        { issueKey: 'MAS-2', status: 'In Progress', updated: '2026-05-10' },
      ],
      stuckCandidates: [],
      scopeChanges: [],
    };
    const c = buildBriefFactContract({
      projects: ['MAS'],
      boardPayloads: [{ payload }],
      period: { vodacomQuarter: 'Q1' },
      freshnessMeta: {},
    });
    const insuf = c.portfolioRisks.find((r) => r.riskType === RISK_TYPES.INSUFFICIENT_DELIVERY);
    expect(insuf).toBeTruthy();
    expect(insuf.ruleFired).toBe(RISK_TYPES.INSUFFICIENT_DELIVERY);
  });

  test('no-active-sprint surfaces as a portfolio risk owned by the Scrum Master', () => {
    const c = buildEnrichedContract();
    const noSprint = c.portfolioRisks.find((r) => r.riskType === RISK_TYPES.NO_ACTIVE_SPRINT);
    expect(noSprint).toBeTruthy();
    expect(noSprint.squad).toContain('MAS');
    expect(noSprint.decisionNeededFrom).toBe(DECISION_LANES.SM);
  });

  test('freshness downgrade clamps confidence', () => {
    expect(clampConfidenceToFreshness('high', 'stale')).not.toBe('high');
    expect(clampConfidenceToFreshness('high', 'cached')).toBe('medium');
    expect(clampConfidenceToFreshness('high', 'live')).toBe('high');
  });

  test('template narration is evidence-bound and labelled', () => {
    const c = buildEnrichedContract();
    const n = narrateBriefTemplate(c);
    expect(n.narratedBy).toBe('template');
    expect(n.headline).toContain('MPSA');
    expect(n.meetingAnswer).toBeTruthy();
    expect(n.whatToSay).toBeTruthy();
    expect(n.meetingScript).toBeTruthy();
    expect(Array.isArray(n.decisionsNeeded)).toBe(true);
  });

  test('advisor falls back to identical template narration when no provider', async () => {
    const c = buildEnrichedContract();
    const templateFn = () => narrateBriefTemplate(c);
    const viaProvider = await narrateBriefViaProvider(c, { provider: 'built-in' }, templateFn);
    const direct = templateFn();
    expect(viaProvider.headline).toBe(direct.headline);
    expect(viaProvider.oneParagraph).toBe(direct.oneParagraph);
    expect(viaProvider.narratedBy).toBe('template');
  });

  test('evidence pack degrades gracefully without a Jira client', async () => {
    const c = buildEnrichedContract();
    const pack = await buildEvidencePack({ risks: c.topRisks, version3Client: null });
    expect(pack.degraded).toBe(true);
    expect(pack.rows.length).toBe(c.topRisks.length);
    for (const row of pack.rows) {
      expect(row.issueKey).toBeTruthy();
      expect(row.statusLastWeek).toContain('no changelog');
    }
  });

  test('PI baseline diff classifies delivered, removed, and added-after-baseline', () => {
    const baseline = {
      piName: 'MPSA+MAS', baselineDate: '2026-04-01',
      committedItems: [
        { issueKey: 'MPSA-1', title: 'Committed done' },
        { issueKey: 'MPSA-9', title: 'Committed missing' },
      ],
    };
    const currentByKey = new Map([
      ['MPSA-1', { status: 'Done', created: '2026-03-01' }],
      ['MPSA-2', { status: 'In Progress', created: '2026-05-02' }],
    ]);
    const diff = comparePIBaselineToNow({ baseline, currentByKey, currentKeys: ['MPSA-1', 'MPSA-2'] });
    expect(diff.summary.delivered).toBe(1);
    expect(diff.summary.removed).toBe(1); // MPSA-9 gone
    expect(diff.summary.addedAfterBaseline).toBe(1); // MPSA-2 new
    const delivered = diff.items.find((i) => i.issueKey === 'MPSA-1');
    expect(delivered.verdict).toBe(BASELINE_VERDICTS.DELIVERED);
  });

  test('PI baseline treats epic rollup as delivered when children are done', () => {
    const baseline = {
      piName: 'MPSA',
      baselineDate: '2026-04-01',
      committedItems: [{ issueKey: 'MPSA-EPIC', title: 'Epic committed' }],
    };
    const currentByKey = new Map([
      ['MPSA-EPIC', { status: 'Done', epicRollup: true, title: 'Epic committed' }],
    ]);
    const diff = comparePIBaselineToNow({ baseline, currentByKey, currentKeys: ['MPSA-EPIC'] });
    expect(diff.summary.delivered).toBe(1);
    expect(diff.summary.removed).toBe(0);
  });
});

test.describe('Governance Brief - UI surface (mocked brief)', () => {
  const MOCK_BRIEF = {
    briefId: 'MPSA-MAS-Q1-2026-W23',
    generatedAt: new Date().toISOString(),
    freshness: { confidenceLimit: 'stale', cacheAgeMinutes: 42, jiraFetchedAt: new Date().toISOString() },
    portfolio: 'MPSA + MAS',
    deliveryTruth: { committed: 3, done: 1, inProgress: 1, staleInProgress: 1, blocked: 0, lateAdded: 1, removed: null, carryover: null },
    topRisks: [{
      issueKey: 'MPSA-2', squad: 'MPSA Squad A', summary: 'stuck thing', riskType: 'stale-in-progress',
      audience: 'delivery', displayTitle: 'Stuck thing', impactLine: 'No progress for 60 hours',
      assigneeName: 'Alice', evidence: 'status unchanged for 60h in In Progress', decisionNeededFrom: 'Tech Lead',
      recommendedAction: 'Ping Alice on MPSA-2.', escalation: 'act-today', ageHours: 60, issueUrl: 'https://example/MPSA-2',
    }],
    portfolioRisks: [],
    evidencePack: { rows: [{ issueKey: 'MPSA-2', statusNow: 'In Progress', statusLastWeek: 'To Do', lastTransitionDate: '2026-05-02', sprintAddedDate: '2026-05-01', addedAfterSprintStart: false, assignee: 'Alice', reporter: 'Bob', whyFlagged: 'status unchanged for 60h', changelogAvailable: true }], degraded: false, fetched: 1 },
    poReadiness: { signals: { noEstimate: 1 }, items: [], totalFlagged: 1, readinessLabel: '1 item carries backlog-readiness risk.' },
    baselineComparison: null,
    executiveView: {
      verdictTier: 'blocked',
      verdictLabel: 'DELIVERY BLOCKED',
      businessHeadline: 'Stuck delivery on MPSA-2',
      verdictLine: 'DELIVERY BLOCKED. Stuck delivery on MPSA-2',
      sprintPulse: { done: 1, committed: 3, pct: 33, daysElapsed: 4, daysRemaining: 6, phaseHint: 'in_progress' },
    },
    leadershipNarrative: {
      confidence: 'low', headline: 'MPSA + MAS at low confidence', oneParagraph: 'One stale item needs attention.',
      meetingAnswer: 'DELIVERY BLOCKED. Stuck delivery on MPSA-2',
      whatToSay: 'We need a decision today on stale MPSA-2.',
      meetingScript: 'One stale item needs attention.\n\nWe need a decision today on stale MPSA-2.',
      decisionsNeeded: [{ issueKey: 'MPSA-2', decisionNeededFrom: 'Tech Lead', action: 'Ping', riskLabel: 'Stale' }],
      narratedBy: 'template',
    },
    meta: { narratedBy: 'template' },
  };

  async function mockAndGo(page) {
    await page.addInitScript(() => {
      localStorage.setItem('delivera_selectedProjects', 'MPSA');
    });
    await page.route('**/api/governance-brief.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BRIEF) }));
    await page.route('**/api/quarters-list**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }) }));
    await page.route('**/api/governance/adoption-metrics.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ byMetric: {}, total: 0 }) }));
    await page.route('**/api/leadership-summary.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ velocity: { source: 'unavailable' } }) }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required; skipping governance UI assertions'); return false; }
    return true;
  }

  test('renders meeting answer, stale freshness, and decision owner', async ({ page }) => {
    if (!(await mockAndGo(page))) return;
    await expect(page.locator('.gov-verdict-zone')).toHaveAttribute('data-verdict-tier', 'blocked');
    await expect(page.locator('.gov-verdict-business-line')).toContainText(/MPSA|stuck/i);
    await expect(page.locator('.governance-freshness-pill.is-stale')).toBeVisible();
    await expect(page.locator('.governance-risk-lane')).toContainText('Tech Lead');
  });

  test('Why-flagged expander reveals rule fired and changelog', async ({ page }) => {
    if (!(await mockAndGo(page))) return;
    await page.locator('#gov-supporting-evidence summary').click();
    await page.locator('#gov-proof-risks [data-why="0"]').click();
    const detail = page.locator('[data-detail="0"]');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Rule fired');
    await expect(detail).toContainText('Status last week');
    await expect(detail).toContainText('To Do');
  });

  test('export markdown includes meeting answer and actions', async ({ page, context }) => {
    if (!(await mockAndGo(page))) return;
    await page.route('**/api/governance/impact-pack.json**', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ markdown: '## Grow My Impact\n\n- Briefs: 1' }),
    }));
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#gov-export').click();
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain("Today's delivery answer");
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Tech Lead');
    expect(text).toContain('What to say');
  });

  test('copy meeting answer excludes technical labels', async ({ page, context }) => {
    if (!(await mockAndGo(page))) return;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#gov-copy-answer-inline').click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/DELIVERY BLOCKED|at risk/i);
    expect(text).not.toContain('narrated by');
    expect(text).not.toContain('Brief ID');
  });

  test('nudge is blocked when data is stale (trust guard)', async ({ page }) => {
    if (!(await mockAndGo(page))) return;
    await page.locator('#gov-supporting-evidence summary').click();
    await expect(page.locator('#gov-proof-risks [data-nudge="0"]')).toBeVisible();
    await page.locator('#gov-proof-risks [data-nudge="0"]').click({ force: true });
    await expect(page.locator('body')).toHaveClass(/jira-nudge-review-open/);
    await expect(page.locator('#delivera-jira-nudge-review-sheet')).not.toHaveAttribute('hidden', '');
    await expect(page.locator('.jira-nudge-review-trust')).toContainText(/Live sprint required/i);
    await expect(page.locator('#jira-nudge-review-text')).toBeDisabled();
    await expect(page.locator('[data-review-send]')).toBeDisabled();
  });
});
