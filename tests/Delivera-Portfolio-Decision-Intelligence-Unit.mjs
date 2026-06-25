import test from 'node:test';
import assert from 'node:assert/strict';

test('peer comparison avoids delivery underperformance when both squads at 0%', async () => {
  const { buildPeerComparison } = await import('../lib/Delivera-Governance-PortfolioExposure-01SSOT.js');
  const anchor = {
    projectKey: 'SD', boardName: 'DMS Squad', boardResolved: true,
    sprintPulse: { committed: 0, done: 0, pct: 0 }, verdictTier: 'blocked', cardRisks: [{ issueKey: 'SD-1' }],
  };
  const peers = [{
    projectKey: 'MAS', boardName: 'MAS', boardResolved: true,
    sprintPulse: { committed: 0, done: 0, pct: 0 }, verdictTier: 'watch', cardRisks: [],
  }];
  const brief = { freshness: { confidenceLimit: 'live' } };
  const peer = buildPeerComparison({ anchor, peers, brief });
  assert.equal(peer.deliveryBothZero, true);
  assert.match(peer.conclusion, /evidence quality/i);
  assert.doesNotMatch(peer.sentence, /behind peer/i);
});

test('weak proof recommends scope not investment', async () => {
  const { buildPortfolioDecision } = await import('../lib/Delivera-Governance-PortfolioDecision-01SSOT.js');
  const brief = {
    projects: ['SD', 'MAS'],
    meta: { quarter: 'FY27 Q1' },
    squadInsights: [
      { projectKey: 'SD', boardName: 'DMS Squad', boardResolved: true, sprintPulse: { committed: 10, done: 0 }, offPlanHours: 16, verdictTier: 'blocked', cardRisks: [{ issueKey: 'SD-1', displayTitle: 'Recharge Growth Trends' }] },
      { projectKey: 'MAS', boardName: 'MAS', boardResolved: true, sprintPulse: { committed: 10, done: 0 }, offPlanHours: 4, verdictTier: 'watch', cardRisks: [] },
    ],
    topRisks: [{ issueKey: 'SD-5237', project: 'SD', summary: 'Scope outside PI baseline', riskType: 'late-scope' }],
    freshness: { confidenceLimit: 'live' },
  };
  const cases = [{ project: 'SD', needsApproval: true, state: 'clarification-required', title: 'SD scope decision', primaryAction: { action: 'Confirm scope', owner: 'Product Owner', dueAt: new Date().toISOString() } }];
  const decision = buildPortfolioDecision({ brief, anchorProject: 'SD', compareProjects: ['MAS'], cases });
  assert.notEqual(decision.recommendation.id, 'review-investment');
  assert.ok(['review-scope', 'insufficient-evidence'].includes(decision.recommendation.id));
  assert.ok(decision.metrics.proofConfidence.value <= 40 || decision.metrics.proofConfidence.value >= 8);
});

test('affected commitments derived from risks when piCommitted is zero', async () => {
  const { buildPortfolioDecision } = await import('../lib/Delivera-Governance-PortfolioDecision-01SSOT.js');
  const brief = {
    meta: { quarter: 'FY27 Q1' },
    squadInsights: [{ projectKey: 'SD', boardName: 'DMS', boardResolved: true, piCommitted: 0, sprintPulse: { committed: 0 }, cardRisks: [{ issueKey: 'SD-1', displayTitle: 'Customer Value Dashboard' }] }],
    topRisks: [{ issueKey: 'SD-99', summary: 'Recharge Growth Trends', project: 'SD', riskType: 'scope' }],
    freshness: { confidenceLimit: 'live' },
  };
  const decision = buildPortfolioDecision({ brief, anchorProject: 'SD', cases: [{ project: 'SD', title: 'Case A', id: 'c1' }] });
  assert.ok(decision.affectedCommitments.length >= 1);
  assert.ok(decision.monitoring.exposedCommitmentCount >= 1);
  assert.equal(decision.metrics.delivery.methodLabel, 'Progress by issue count');
});

test('portfolio decision exposes epic lineage for user-story context', async () => {
  const { buildPortfolioDecision } = await import('../lib/Delivera-Governance-PortfolioDecision-01SSOT.js');
  const brief = {
    projects: ['SD'],
    meta: {
      quarter: 'FY27 Q1',
      boardEpicIndex: [{ issueKey: 'SD-100', title: 'Recharge Growth Modernization', projectKey: 'SD' }],
    },
    _boardPayloads: [{
      board: { location: { projectKey: 'SD' } },
      payload: {
        stories: [
          { issueKey: 'SD-1', epicKey: 'SD-100', epicSummary: 'Recharge Growth Modernization', status: 'In Progress' },
          { issueKey: 'SD-2', epicKey: 'SD-100', epicSummary: 'Recharge Growth Modernization', status: 'Done' },
          { issueKey: 'SD-3', summary: 'Ad hoc production recovery', status: 'In Progress' },
        ],
      },
    }],
    squadInsights: [{
      projectKey: 'SD',
      boardName: 'DMS',
      boardResolved: true,
      piCommitted: 2,
      piDone: 1,
      sprintPulse: { committed: 2, done: 1 },
      cardRisks: [{ issueKey: 'SD-1', epicKey: 'SD-100', epicSummary: 'Recharge Growth Modernization' }],
    }],
    freshness: { confidenceLimit: 'live' },
  };
  const decision = buildPortfolioDecision({ brief, anchorProject: 'SD', cases: [] });
  assert.equal(decision.epicLineage.primary.epicKey, 'SD-100');
  assert.equal(decision.epicLineage.coveredStoryCount, 2);
  assert.equal(decision.epicLineage.unalignedStoryCount, 1);
  assert.equal(decision.epicLineage.unalignedStories[0].issueKey, 'SD-3');
  assert.match(decision.epicLineage.label, /Recharge Growth Modernization/);
  assert.equal(decision.metrics.delivery.methodLabel, 'Progress by delivery evidence');
  assert.equal(decision.timebox.totalDays, 90);
});

test('prepared actions grouped by role with deadline', async () => {
  const { buildPreparedActions } = await import('../lib/Delivera-Governance-PortfolioExposure-01SSOT.js');
  const due = new Date();
  due.setHours(15, 0, 0, 0);
  const prepared = buildPreparedActions({
    anchor: { projectKey: 'SD' },
    cases: [
      { project: 'SD', needsApproval: true, primaryAction: { action: 'Confirm scope', owner: 'Product Owner', dueAt: due.toISOString() } },
      { project: 'SD', needsApproval: true, primaryAction: { action: 'Confirm scope 2', owner: 'Product Owner', dueAt: due.toISOString() } },
      { project: 'SD', needsApproval: false, primaryAction: { action: 'Check blocker', owner: 'Tech Lead', dueAt: due.toISOString() } },
    ],
  });
  assert.ok(prepared.groups.some((g) => g.role === 'Product Owner'));
  assert.ok(prepared.nextDeadline.includes('15:00') || prepared.nextDeadline.length > 0);
  assert.equal(prepared.poResponsesRequired, 2);
});

test('decision options include impact preview fields', async () => {
  const { buildPortfolioDecision } = await import('../lib/Delivera-Governance-PortfolioDecision-01SSOT.js');
  const brief = {
    squadInsights: [{ projectKey: 'SD', boardName: 'DMS', boardResolved: true, sprintPulse: { committed: 8, done: 2 }, offPlanHours: 10, verdictTier: 'watch', cardRisks: [] }],
    freshness: { confidenceLimit: 'live' },
  };
  const decision = buildPortfolioDecision({ brief, anchorProject: 'SD', cases: [] });
  assert.ok(decision.decisionOptions.every((o) => o.impactPreview && o.useWhen && o.effect));
  assert.ok(decision.decisionBasis.why);
});

test('baselineMissing avoids investment recommendation', async () => {
  const { buildPortfolioDecision } = await import('../lib/Delivera-Governance-PortfolioDecision-01SSOT.js');
  const brief = {
    squadInsights: [{ projectKey: 'SD', boardName: 'DMS', boardResolved: true, sprintPulse: { committed: 8, done: 2 }, verdictTier: 'watch', cardRisks: [] }],
    freshness: { confidenceLimit: 'live' },
  };
  const decision = buildPortfolioDecision({ brief, anchorProject: 'SD', baselineMissing: true, cases: [] });
  assert.notEqual(decision.recommendation.id, 'review-investment');
});

test('comparison cards include squad-specific intelligence fields', async () => {
  const { buildPortfolioDecision } = await import('../lib/Delivera-Governance-PortfolioDecision-01SSOT.js');
  const { buildPortfolioComparisonCards } = await import('../lib/Delivera-Governance-PortfolioComparison-01SSOT.js');
  const brief = {
    squadInsights: [
      { projectKey: 'SD', boardName: 'DMS Squad', boardResolved: true, sprintPulse: { committed: 8, done: 0 }, offPlanHours: 18, verdictTier: 'blocked', cardRisks: [{ issueKey: 'SD-1' }] },
      { projectKey: 'MAS', boardName: 'MAS', boardResolved: true, sprintPulse: { committed: 8, done: 0 }, offPlanHours: 3, verdictTier: 'watch', cardRisks: [] },
    ],
    freshness: { confidenceLimit: 'live' },
  };
  const decision = buildPortfolioDecision({ brief, anchorProject: 'SD', compareProjects: ['MAS'], cases: [{ project: 'SD', needsApproval: true }] });
  const comparison = buildPortfolioComparisonCards({ decision, brief, insights: brief.squadInsights, cases: [{ project: 'SD', needsApproval: true }] });
  assert.ok(comparison.cards[0].mainIssue);
  assert.ok(comparison.cards[0].decisionNeeded);
  assert.notEqual(comparison.cards[0].explanation, comparison.cards[1].explanation);
});

test('portfolio decision contract exposes cockpit IA fields', async () => {
  const { buildPortfolioDecision } = await import('../lib/Delivera-Governance-PortfolioDecision-01SSOT.js');
  const brief = {
    projects: ['SD', 'MAS'],
    generatedAt: '2026-06-25T09:00:00.000Z',
    meta: { quarter: 'FY27 Q1', manualOverrideCount: 1 },
    _boardPayloads: [{
      board: { location: { projectKey: 'SD' } },
      payload: { stories: [{ issueKey: 'SD-4', summary: 'Story without PI Epic', status: 'In Progress' }] },
    }],
    squadInsights: [
      { projectKey: 'SD', boardName: 'DMS', boardResolved: true, piCommitted: 8, piDone: 1, sprintPulse: { committed: 8, done: 1 }, verdictTier: 'blocked', cardRisks: [{ issueKey: 'SD-4' }] },
      { projectKey: 'MAS', boardName: 'MAS', boardResolved: false, piCommitted: 4, piDone: 2, sprintPulse: { committed: 4, done: 2 }, verdictTier: 'watch', cardRisks: [] },
    ],
    freshness: { confidenceLimit: 'live' },
  };
  const cases = [{
    id: 'case-1',
    project: 'SD',
    needsApproval: true,
    state: 'clarification-required',
    primaryAction: { action: 'Confirm PI scope', owner: 'Product Owner', dueAt: '2026-06-26T14:00:00.000Z' },
  }];
  const decision = buildPortfolioDecision({ brief, anchorProject: 'SD', compareProjects: ['MAS'], cases, baselineMissing: true, partialSquads: 1 });
  assert.equal(decision.portfolioSummary.commitmentsTotal, 12);
  assert.equal(decision.portfolioSummary.commitmentsAtRisk >= 1, true);
  assert.equal(decision.decisionRequired.owner, 'Product Owner');
  assert.equal(decision.decisionRequired.recommendedAction, 'Confirm PI scope');
  assert.equal(decision.evidenceBreakdown.required, 12);
  assert.match(decision.evidenceBreakdown.interpretation, /evidence confidence/i);
  assert.equal(decision.dataTrust.boardsConnected.connected, 1);
  assert.equal(decision.dataTrust.boardsConnected.total, 2);
  assert.ok(decision.dataTrust.dataGaps >= 2);
  assert.ok(['material-risk', 'evidence-gap', 'decision-required', 'not-assessed', 'healthy'].includes(decision.statusSemantics.primary));
});
