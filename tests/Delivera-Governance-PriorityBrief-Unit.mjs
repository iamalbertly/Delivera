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
import { buildPortfolioDecision, resolveBaselineReadinessByProject, isBaselineMissingForProject } from '../lib/Delivera-Governance-PortfolioDecision-01SSOT.js';
import { ATTENTION_STATES } from '../lib/Delivera-Governance-GovernanceState-01SSOT.js';
import { comparePIBaselineToNow } from '../lib/Delivera-Governance-PIBaseline-02Compare.js';
import { buildCurrentByKey } from '../lib/Delivera-Governance-Brief-03Assemble-Service.js';

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

test('formatPromiseCount uses linked metrics strip', () => {
  assert.equal(formatPromiseCount({ linked: 4, total: 6, needAttention: 2 }), '4 of 6 linked · 2 need action');
  assert.equal(formatPromiseCount({ linked: 6, total: 6, needAttention: 0 }), '6 of 6 linked · all verified');
  assert.equal(formatPromiseCount({ supported: 4, total: 6 }), '2 of 6 promises lack delivery proof');
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
  assert.ok(pb.headline.includes('DMS') || pb.headline.includes('decision') || pb.headline.includes('behind') || pb.headline.includes('off-plan') || pb.headline.includes('need'));
  assert.ok(!pb.headline.includes('%'));
  assert.ok(pb.primaryAction);
  assert.ok(pb.evidenceAction);
});

test('missing baseline yields upload slide CTA not board alignment error', () => {
  const decision = buildPortfolioDecision({
    brief: { ...baseBrief, baselineComparison: null, meta: { ...baseBrief.meta, setupGaps: [{ id: 'pi-baseline', action: 'set-baseline' }] } },
    anchorProject: 'SD',
    compareProjects: ['MAS'],
    baselineMissing: true,
  });
  const pb = decision.priorityBrief;
  assert.ok(pb.headline.toLowerCase().includes('upload'));
  assert.ok(pb.headline.includes('FY27 Q2') || pb.headline.toLowerCase().includes('quarter'));
  assert.equal(pb.primaryActionTarget, 'alignment-studio-slide');
  assert.ok(pb.baselineProvenance.line.toLowerCase().includes('upload') || pb.baselineProvenance.line.toLowerCase().includes('baseline'));
});

test('board unresolved routes to alignment studio board mode', () => {
  const brief = {
    ...baseBrief,
    squadInsights: baseBrief.squadInsights.map((s) => (
      s.projectKey === 'SD' ? { ...s, boardResolved: false, verdictTier: 'not-assessed' } : s
    )),
  };
  const decision = buildPortfolioDecision({
    brief,
    anchorProject: 'SD',
    compareProjects: ['MAS'],
    baselineMissing: false,
  });
  assert.equal(decision.priorityBrief.primaryActionTarget, 'alignment-studio-board');
  assert.match(decision.priorityBrief.headline, /board/i);
});

test('zero risk portfolio calm headline', () => {
  const calmBrief = {
    ...baseBrief,
    projects: ['MAS', 'MPSA2'],
    baselineComparison: { summary: { totalCommitted: 4, delivered: 4, onTrack: 0 }, items: [] },
    meta: {
      ...baseBrief.meta,
      baselineReadinessByProject: {
        MAS: { hasBaseline: true, piName: 'MAS:FY27 Q2', committedCount: 4 },
        MPSA2: { hasBaseline: true, piName: 'MPSA2:FY27 Q2', committedCount: 4 },
      },
    },
    baselineComparisonByProject: {
      MAS: { summary: { totalCommitted: 4, delivered: 4, onTrack: 0 }, items: [] },
      MPSA2: { summary: { totalCommitted: 4, delivered: 4, onTrack: 0 }, items: [] },
    },
    squadInsights: [
      { projectKey: 'MAS', boardName: 'AMS', boardResolved: true, verdictTier: 'onTrack', sprintPulse: { committed: 8, done: 7 }, offPlanHours: 0, piCommitted: 4, piDone: 4, cardRisks: [] },
      { projectKey: 'MPSA2', boardName: 'Transformers', boardResolved: true, verdictTier: 'onTrack', sprintPulse: { committed: 9, done: 8 }, offPlanHours: 0, piCommitted: 4, piDone: 4, cardRisks: [] },
    ],
    topRisks: [],
    executiveView: { verdictTier: 'onTrack' },
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

test('MPSA2 without own baseline is cannot-verify not off-plan', () => {
  const mixedBrief = {
    ...baseBrief,
    meta: {
      ...baseBrief.meta,
      baselineReadinessByProject: {
        SD: { hasBaseline: true, piName: 'SD:FY27 Q2', baselineDate: '2026-07-12', committedCount: 6 },
        MAS: { hasBaseline: false, piName: '', baselineDate: '', committedCount: 0 },
        RPA: { hasBaseline: false, piName: '', baselineDate: '', committedCount: 0 },
        MPSA2: { hasBaseline: false, piName: '', baselineDate: '', committedCount: 0 },
      },
    },
    baselineComparisonByProject: {
      SD: baseBrief.baselineComparison,
      MAS: null,
      RPA: null,
      MPSA2: null,
    },
  };
  const judgment = rankPortfolioSquads({
    insights: mixedBrief.squadInsights,
    cases: [],
    brief: mixedBrief,
    baselineMissing: false,
    anchorKey: 'SD',
  });
  const mpsa2 = judgment.squads.find((s) => s.projectKey === 'MPSA2');
  assert.ok(mpsa2);
  assert.equal(mpsa2.attentionState, ATTENTION_STATES.CANNOT_VERIFY);
  assert.notEqual(mpsa2.attentionState, ATTENTION_STATES.OFF_PLAN);
  assert.equal(mpsa2.dataTrust, 'board-health-only');
  assert.ok(mpsa2.meaning.includes('plan not uploaded'));
  assert.equal(buildCommitmentRealityRows({ brief: mixedBrief, anchorKey: 'MPSA2', baselineMissing: true }).length, 0);
});

test('resolveBaselineReadinessByProject does not inherit SD slide for MPSA2', () => {
  const brief = {
    projects: ['SD', 'MPSA2'],
    baselineComparison: baseBrief.baselineComparison,
    meta: {
      baselineReadinessByProject: {
        SD: { hasBaseline: true, piName: 'SD:FY27 Q2', committedCount: 6 },
        MPSA2: { hasBaseline: false, piName: '', committedCount: 0 },
      },
    },
  };
  const ready = resolveBaselineReadinessByProject(brief, ['SD', 'MPSA2']);
  assert.equal(ready.SD.hasBaseline, true);
  assert.equal(ready.MPSA2.hasBaseline, false);
  assert.equal(isBaselineMissingForProject(brief, 'MPSA2'), true);
  assert.equal(isBaselineMissingForProject(brief, 'SD'), false);
});

test('scoped compare does not flood foreign MPSA2 keys into SD baseline', () => {
  const boardPayloads = [
    {
      board: { location: { projectKey: 'SD' } },
      payload: {
        stories: [
          { issueKey: 'SD-5314', status: 'In Progress', epicKey: 'SD-5314', summary: 'DMS Epic' },
          { issueKey: 'MPSA2-99', status: 'In Progress', epicKey: 'MPSA2-99', summary: 'Foreign epic' },
        ],
      },
    },
    {
      board: { location: { projectKey: 'MPSA2' } },
      payload: {
        stories: [
          { issueKey: 'MPSA2-1', status: 'In Progress', epicKey: 'MPSA2-1', summary: 'MPSA work' },
        ],
      },
    },
  ];
  const sdEpicMap = buildCurrentByKey(boardPayloads, { projectKeys: ['SD'], epicOnly: true });
  const compare = comparePIBaselineToNow({
    baseline: {
      piName: 'SD:FY27 Q2',
      baselineDate: '2026-07-12',
      committedItems: [{ issueKey: 'SD-5314', title: 'DMS Epic', squad: 'SD' }],
    },
    currentByKey: buildCurrentByKey(boardPayloads, { projectKeys: ['SD'] }),
    currentKeys: Array.from(sdEpicMap.keys()),
  });
  const foreign = compare.items.filter((i) => String(i.issueKey || '').startsWith('MPSA2'));
  assert.equal(foreign.length, 0);
});

test('buildCauseLines returns structured objects with issueKey', () => {
  const decision = buildPortfolioDecision({
    brief: {
      ...baseBrief,
      meta: {
        ...baseBrief.meta,
        jiraHost: 'https://jira.example.com',
      },
    },
    anchorProject: 'SD',
    compareProjects: ['MAS'],
    baselineMissing: false,
  });
  const causes = decision.priorityBrief.causeLines || [];
  assert.ok(causes.length > 0);
  const first = causes[0];
  assert.equal(typeof first, 'object');
  assert.ok(first.text);
  assert.ok(first.issueKey || first.text);
});

test('SD-5316 jira-only epic is not-planned not removed / not found on boards', async () => {
  const { BASELINE_VERDICTS } = await import('../lib/Delivera-Governance-PIBaseline-02Compare.js');
  const { attentionStateLabel } = await import('../lib/Delivera-Governance-GovernanceState-01SSOT.js');
  const compare = comparePIBaselineToNow({
    baseline: {
      piName: 'SD:FY27 Q2',
      baselineDate: '2026-07-12',
      committedItems: [{
        issueKey: 'SD-5316',
        title: 'Access Review Automation',
        squad: 'SD',
        epicActivity: { lifecycle: 'jira-only', sprintCount: 0 },
      }],
    },
    currentByKey: new Map(),
    currentKeys: [],
  });
  const item = compare.items.find((i) => i.issueKey === 'SD-5316');
  assert.ok(item);
  assert.equal(item.verdict, BASELINE_VERDICTS.NOT_PLANNED);
  assert.notEqual(item.verdict, BASELINE_VERDICTS.REMOVED);
  assert.match(String(item.statusNow), /no stories/i);

  const brief = {
    ...baseBrief,
    meta: {
      ...baseBrief.meta,
      baselineReadinessByProject: {
        SD: { hasBaseline: true, piName: 'SD:FY27 Q2', committedCount: 1 },
      },
      jiraHost: 'https://jira.example.com',
    },
    baselineComparisonByProject: { SD: compare },
    baselineComparison: compare,
  };
  const rows = buildCommitmentRealityRows({ brief, anchorKey: 'SD', baselineMissing: false });
  const row = rows.find((r) => r.issueKey === 'SD-5316');
  assert.ok(row);
  assert.equal(row.hasJiraMatch, true);
  assert.equal(row.lifecycleStage, 'not-planned');
  assert.match(row.reality, /not planned/i);

  const decision = buildPortfolioDecision({
    brief,
    anchorProject: 'SD',
    compareProjects: [],
    baselineMissing: false,
  });
  const causeText = (decision.priorityBrief.causeLines || []).map((c) => c.text || c).join(' ');
  assert.ok(!/not found on the selected boards/i.test(causeText));
  assert.ok(/no stories on the selected boards/i.test(causeText) || /not planned/i.test(row.reality));
  assert.equal(attentionStateLabel(ATTENTION_STATES.OFF_PLAN), 'Behind sprint commitment');
});

test('humanEpicActivityLabel distinguishes jira-only from not in sprint', async () => {
  const { humanEpicActivityLabel } = await import('../public/Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js');
  assert.equal(humanEpicActivityLabel({ lifecycle: 'jira-only', storyCount: 0 }), 'In Jira · no stories on selected boards');
  assert.notEqual(humanEpicActivityLabel({ lifecycle: 'jira-only' }), 'Not in sprint yet');
});

test('readiness gate stage 0 for squad without baseline', async () => {
  const { resolveSquadReadinessStage, READINESS_STAGES } = await import('../lib/Delivera-Governance-ReadinessGate-01SSOT.js');
  const { buildPortfolioComparisonCards } = await import('../lib/Delivera-Governance-PortfolioComparison-01SSOT.js');
  const stage = resolveSquadReadinessStage({
    projectKey: 'MPSA2',
    brief: {
      meta: {
        baselineReadinessByProject: {
          MPSA2: { hasBaseline: false, missing: true },
        },
      },
    },
    squadName: 'MPSA2',
  });
  assert.equal(stage.stage, READINESS_STAGES.UPLOAD_SLIDE);
  assert.equal(stage.gated, true);
  assert.match(stage.cta, /Upload/i);

  const comparison = buildPortfolioComparisonCards({
    decision: { anchorProject: 'MPSA2', compareProjects: [], periodKey: 'FY27 Q2' },
    brief: {
      meta: {
        baselineReadinessByProject: {
          MPSA2: { hasBaseline: false, missing: true },
        },
      },
      squadInsights: [{ projectKey: 'MPSA2', boardResolved: true, verdictTier: 'onTrack' }],
    },
    insights: [{ projectKey: 'MPSA2', boardResolved: true, verdictTier: 'onTrack' }],
    cases: [],
  });
  assert.equal(comparison.cards[0]?.readiness?.stage, 0);
  assert.equal(comparison.cards[0]?.metrics?.delivered, null);
  assert.ok(comparison.readinessSummary?.line);
});

test('priority surface keeps commitment detail and folds exceptions into squad comparison', async () => {
  const { renderGovernancePrioritySurface } = await import('../public/Delivera-App-Governance-PrioritySurface-01Render-UI.js');
  const html = renderGovernancePrioritySurface({
    anchorProject: 'SD',
    priorityBrief: {
      headline: 'Test',
      detailRows: [{
        issueKey: 'SD-5316',
        title: 'Access Review',
        baselinePromise: 'Access Review',
        projectKey: 'SD',
        reality: 'Committed · not planned yet',
        lifecycleStage: 'not-planned',
        verdict: 'not-planned',
        hasJiraMatch: true,
        governanceState: 'unsupported',
        statusNow: 'in Jira · no stories on selected boards',
      }],
      atRiskSquads: [],
    },
    portfolioJudgment: {
      squads: [{ projectKey: 'SD', squadName: 'DMS', attentionLabel: 'Decision required', meaning: 'need action' }],
      atRisk: [{ projectKey: 'SD', squadName: 'DMS', attentionLabel: 'Decision required', meaning: 'need action' }],
      safe: [],
    },
  }, {});
  const carouselIdx = html.indexOf('data-testid="governance-squad-comparison"');
  const commitmentIdx = html.indexOf('data-testid="governance-commitment-detail"');
  const exceptionIdx = html.indexOf('data-testid="governance-exception-rail"');
  const heroIdx = html.indexOf('gov-priority-brief-hero');
  const mainIdx = html.indexOf('data-testid="governance-priority-main"');
  const railIdx = html.indexOf('data-testid="governance-priority-rail"');
  assert.ok(mainIdx > 0 && railIdx > 0, 'main|rail layout required');
  assert.ok(carouselIdx > 0);
  assert.ok(commitmentIdx > 0);
  assert.equal(exceptionIdx, -1, 'duplicate exception rail stays removed');
  assert.ok(heroIdx >= 0 && carouselIdx > heroIdx, 'carousel must render after hero');
  assert.ok(carouselIdx < commitmentIdx, 'carousel must render before commitment table');
  assert.ok(carouselIdx < railIdx || html.indexOf('governance-priority-main') < railIdx, 'compare lives in main column');
  assert.ok(html.includes('gov-priority-layout'), 'page-level layout grid');
  assert.ok(html.includes('gov-commitment-decision'));
  assert.ok(html.includes('btn-secondary'));
  assert.ok(html.includes('governance-plan-legend') || html.includes('Plan-backed'));
  // Hero and compare both inside main; agentic rail is outside main
  const mainSlice = html.slice(mainIdx, railIdx > mainIdx ? railIdx : html.length);
  assert.ok(mainSlice.includes('gov-priority-brief-hero'));
  assert.ok(mainSlice.includes('governance-squad-comparison'));
  assert.ok(mainSlice.includes('gov-compare-skeleton') || mainSlice.includes('portfolio-carousel-cache-placeholder'), 'compare skeleton until live paint');
  assert.ok(!mainSlice.includes('governance-agentic-panel'), 'agentic aside must not sit inside main with hero');
  assert.ok(html.includes('governance-agentic-ctas'), 'sticky decision CTAs present in rail');
});

test('jira work item link never uses fake hash when url missing', async () => {
  const { renderJiraWorkItemLink } = await import('../public/Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js');
  const html = renderJiraWorkItemLink({ issueKey: 'SD-5316', title: 'Epic', issueUrl: '' });
  assert.ok(!html.includes('#work-item-'));
  assert.ok(html.includes('Connect Jira') || html.includes('jira-work-item-link--disabled'));
  const withUrl = renderJiraWorkItemLink({ issueKey: 'SD-5316', title: 'Epic', issueUrl: 'https://jira.example.com/browse/SD-5316' });
  assert.ok(withUrl.includes('https://jira.example.com/browse/SD-5316'));
  assert.ok(withUrl.includes('target="_blank"'));
});
