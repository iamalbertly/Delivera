/**
 * Unit coverage: attention evidence, relevance tiers, headline language, effective squad.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCommitmentRelevance,
  buildAttentionEvidenceRows,
  buildEvidenceCopyPack,
  RELEVANCE_TIERS,
} from '../lib/Delivera-Governance-CommitmentRelevance-01SSOT.js';
import { buildPriorityBrief } from '../lib/Delivera-Governance-PriorityBrief-01SSOT.js';
import { rankPortfolioSquads } from '../lib/Delivera-Governance-PortfolioJudgment-01SSOT.js';
import { resolveEffectiveSquad } from '../lib/Delivera-Governance-EffectiveSquad-01Resolve-SSOT.js';
import { PORTFOLIO_ALL } from '../lib/Delivera-Governance-Portfolio-Scope-Rank-01SSOT.js';

test('relevance tiers: active, stale, hygiene', () => {
  const active = classifyCommitmentRelevance({
    title: 'FY27 Q2 – FIN – Tower – Contract – Base Rate',
    verdict: 'not-planned',
    lifecycleStage: 'not-planned',
    updated: new Date().toISOString(),
    epicActivity: { storyCount: 0, lifecycle: 'not-started' },
  });
  assert.equal(active.tier, RELEVANCE_TIERS.ACTIVE_GAP);

  const stale = classifyCommitmentRelevance({
    title: 'FY27 Q2 – FIN – Tower – Contract – Base Rate',
    verdict: 'not-planned',
    lifecycleStage: 'not-planned',
    updated: '2024-01-01T00:00:00.000Z',
    epicActivity: { storyCount: 0, lifecycle: 'jira-only' },
  });
  assert.equal(stale.tier, RELEVANCE_TIERS.STALE_CANDIDATE);

  const hygiene = classifyCommitmentRelevance({
    title: 'misc',
    verdict: 'not-planned',
    lifecycleStage: 'not-planned',
    governanceState: 'unsupported',
  });
  assert.equal(hygiene.tier, RELEVANCE_TIERS.HYGIENE_SUSPECT);
});

test('evidence rows match claim count and carry browse URLs', () => {
  const rows = [
    {
      issueKey: 'DMS-1',
      title: 'FY27 Q2 – A – B – C – One',
      verdict: 'not-planned',
      lifecycleStage: 'not-planned',
      projectKey: 'DMS',
      updated: new Date().toISOString(),
    },
    {
      issueKey: 'DMS-2',
      title: 'FY27 Q2 – A – B – C – Two',
      verdict: 'not-planned',
      lifecycleStage: 'not-planned',
      projectKey: 'DMS',
      updated: new Date().toISOString(),
    },
    {
      issueKey: 'DMS-3',
      title: 'Done item',
      verdict: 'delivered',
      lifecycleStage: 'delivered',
      projectKey: 'DMS',
    },
  ];
  const evidence = buildAttentionEvidenceRows({
    commitmentRows: rows,
    focusProjectKey: 'DMS',
    resolveIssueUrl: (k) => `https://jira.example/browse/${k}`,
  });
  assert.equal(evidence.total, 2);
  assert.ok(evidence.rows.every((r) => r.issueUrl.includes('/browse/')));
  const pack = buildEvidenceCopyPack(evidence);
  assert.ok(pack.jql.includes('DMS-1'));
});

test('All Projects headline uses Jira story evidence gap, not a generic risk list', () => {
  const brief = {
    meta: {
      quarter: 'FY27 Q2',
      jiraHost: 'https://jira.example',
      baselineReadinessByProject: {
        DMS: { hasBaseline: true, committedCount: 2, piName: 'FY27 Q2', baselineDate: '2026-07-01' },
      },
    },
    baselineComparisonByProject: {
      DMS: {
        items: [
          {
            issueKey: 'DMS-10',
            title: 'FY27 Q2 – A – B – C – Epic',
            verdict: 'not-planned',
            squad: 'DMS',
            epicActivity: { lifecycle: 'jira-only', storyCount: 0 },
          },
        ],
        summary: { totalCommitted: 1, notPlanned: 1, delivered: 0, onTrack: 0 },
      },
    },
    squadInsights: [
      {
        projectKey: 'DMS',
        squadName: 'DMS',
        boardResolved: true,
        verdictTier: 'watch',
        piCommitted: 1,
        piDone: 0,
      },
    ],
  };
  const pb = buildPriorityBrief({
    brief,
    decision: {
      anchorProject: PORTFOLIO_ALL,
      portfolioGeneral: true,
      insights: brief.squadInsights,
      periodKey: 'FY27 Q2',
    },
    cases: [],
  });
  assert.ok(!/risk list/i.test(pb.headline));
  assert.ok(/missing Jira story evidence|board-gap|need attention|zero stories/i.test(pb.headline));
});

test('resolveEffectiveSquad never returns __ALL__ by default', () => {
  assert.equal(resolveEffectiveSquad({ anchor: PORTFOLIO_ALL, projects: ['SD', 'FIN'] }), 'SD');
  assert.equal(resolveEffectiveSquad({ anchor: 'FIN', projects: ['SD', 'FIN'] }), 'FIN');
  assert.equal(resolveEffectiveSquad({ anchor: PORTFOLIO_ALL, allowAll: true, projects: ['SD'] }), PORTFOLIO_ALL);
});

test('rankPortfolioSquads filters __ALL__ sentinel', () => {
  const judgment = rankPortfolioSquads({
    insights: [
      { projectKey: PORTFOLIO_ALL, boardResolved: true },
      { projectKey: 'SD', boardResolved: true, verdictTier: 'onTrack' },
    ],
    cases: [],
    brief: { meta: { baselineReadinessByProject: { SD: { hasBaseline: false } } } },
    anchorKey: 'SD',
  });
  assert.ok(!judgment.squads.some((s) => s.projectKey === PORTFOLIO_ALL));
});
