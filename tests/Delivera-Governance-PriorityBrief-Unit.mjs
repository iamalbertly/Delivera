/**
 * Unit tests — Priority Brief SSOT ranking, states, edge cases.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPriorityBrief } from '../lib/Delivera-Governance-PriorityBrief-01SSOT.js';
import { rankPortfolioSquads } from '../lib/Delivera-Governance-PortfolioJudgment-01SSOT.js';
import { buildCommitmentRealityRows, summarizeCommitmentRows } from '../lib/Delivera-Governance-CommitmentReality-01SSOT.js';
import { estimateRecovery, RECOVERY_OUTLOOK } from '../lib/Delivera-Governance-RecoveryEstimate-01SSOT.js';
import { scopeDecisionCopy } from '../lib/Delivera-Governance-ScopeLanguage-01SSOT.js';
import { formatPromiseCount } from '../lib/Delivera-Governance-GovernanceState-01SSOT.js';
import { buildPortfolioDecision } from '../lib/Delivera-Governance-PortfolioDecision-01SSOT.js';

const baseBrief = {
  projects: ['SD', 'MAS', 'RPA', 'MPSA2'],
  generatedAt: '2026-07-12T10:00:00.000Z',
  freshness: { confidenceLimit: 'live' },
  meta: { quarter: 'FY27 Q2' },
  deliveryTruthKeys: { lateAdded: ['SD-100'] },
  baselineComparison: {
    piName: 'DMS FY27 Q2 PI baseline',
    baselineDate: '2026-03-28',
    summary: { totalCommitted: 6, delivered: 2, onTrack: 2, removed: 1, notTraceable: 1 },
    items: [
      { issueKey: 'SD-1', title: 'Access Review', squad: 'SD', verdict: 'on-track', statusNow: 'In Progress' },
      { issueKey: 'SD-2', title: 'Service Governance', squad: 'SD', verdict: 'not-traceable', statusNow: 'not found' },
      { issueKey: 'SD-3', title: 'Exception Framework', squad: 'SD', verdict: 'delayed', statusNow: 'In Progress' },
    ],
  },
  squadInsights: [
    { projectKey: 'SD', boardName: 'DMS Squad', boardResolved: true, verdictTier: 'blocked', sprintPulse: { committed: 10, done: 2 }, offPlanHours: 42, piCommitted: 6, cardRisks: [{ issueKey: 'SD-100' }] },
    { projectKey: 'MAS', boardName: 'AMS', boardResolved: true, verdictTier: 'onTrack', sprintPulse: { committed: 8, done: 7 }, offPlanHours: 2, piCommitted: 5, piDone: 5 },
    { projectKey: 'RPA', boardName: 'RPA', boardResolved: true, verdictTier: 'watch', sprintPulse: { committed: 8, done: 4 }, offPlanHours: 8, piCommitted: 5 },
    { projectKey: 'MPSA2', boardName: 'Transformers', boardResolved: true, verdictTier: 'onTrack', sprintPulse: { committed: 9, done: 8 }, offPlanHours: 3, piCommitted: 5, piDone: 5 },
  ],
  topRisks: [{ issueKey: 'SD-100', riskType: 'late-scope', summary: 'Access Review moved after planning', projectKey: 'SD' }],
};

test('formatPromiseCount uses counts not percentages', () => {
  assert.equal(formatPromiseCount({ supported: 4, total: 6 }), '2 of 6 promises lack delivery proof');
  assert.equal(formatPromiseCount({ supported: 6, total: 6 }), 'All 6 promises verified');
});

test('scopeDecisionCopy never says Confirm scope for post-planning', () => {
  const copy = scopeDecisionCopy({
    risk: { riskType: 'late-scope', issueKey: 'SD-100' },
    brief: { deliveryTruthKeys: { lateAdded: ['SD-100'] } },
  });
  assert.ok(!copy.toLowerCase().includes('confirm scope'));
  assert.ok(copy.includes('scope change'));
});

test('estimateRecovery returns honest unknown without capacity', () => {
  const est = estimateRecovery({ unsupportedCount: 2, offPlanHours: 0, sprintPulse: { committed: 0 } });
  assert.equal(est.outlook, RECOVERY_OUTLOOK.UNKNOWN);
});

test('buildCommitmentRealityRows is baseline-first', () => {
  const rows = buildCommitmentRealityRows({ brief: baseBrief, anchorKey: 'SD' });
  assert.ok(rows.length >= 3);
  const summary = summarizeCommitmentRows(rows);
  assert.ok(summary.total >= 3);
});

test('rankPortfolioSquads weights DMS highest', () => {
  const judgment = rankPortfolioSquads({
    insights: baseBrief.squadInsights,
    cases: [],
    brief: baseBrief,
    baselineMissing: false,
    anchorKey: 'SD',
  });
  assert.equal(judgment.leadingSquad?.projectKey, 'SD');
  assert.ok(judgment.atRisk.length >= 1);
  assert.ok(judgment.safeSquadsLine.includes('require no action'));
});

test('buildPriorityBrief headline names squad and unsupported promises', () => {
  const decision = buildPortfolioDecision({
    brief: baseBrief,
    anchorProject: 'SD',
    compareProjects: ['MAS', 'RPA', 'MPSA2'],
    cases: [],
    baselineMissing: false,
  });
  const pb = decision.priorityBrief;
  assert.ok(pb.headline.includes('DMS') || pb.headline.includes('decision') || pb.headline.includes('off-plan'));
  assert.ok(!pb.headline.includes('%'));
  assert.ok(pb.primaryAction);
  assert.ok(pb.evidenceAction);
});

test('missing baseline yields cannot verify not off-plan', () => {
  const decision = buildPortfolioDecision({
    brief: { ...baseBrief, baselineComparison: null },
    anchorProject: 'SD',
    compareProjects: ['MAS'],
    baselineMissing: true,
  });
  assert.ok(
    decision.priorityBrief.baselineProvenance.line.toLowerCase().includes('cannot')
    || decision.priorityBrief.headline.toLowerCase().includes('cannot'),
  );
});

test('zero risk portfolio calm headline', () => {
  const calmBrief = {
    ...baseBrief,
    baselineComparison: { summary: { totalCommitted: 4, delivered: 4, onTrack: 0 }, items: [] },
    squadInsights: baseBrief.squadInsights.map((s) => ({ ...s, verdictTier: 'onTrack', cardRisks: [] })),
    topRisks: [],
  };
  const decision = buildPortfolioDecision({
    brief: calmBrief,
    anchorProject: 'MAS',
    compareProjects: ['MPSA2'],
    cases: [],
    baselineMissing: false,
  });
  assert.ok(decision.priorityBrief.zeroRisk || decision.priorityBrief.headline.toLowerCase().includes('no governance'));
});
