import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERVENTION_STATES,
  assertInterventionTransition,
  interventionFingerprint,
} from '../lib/Delivera-Governance-InterventionCase-01SSOT.js';
import { resolveGovernanceRole, canSendToResolvedRole } from '../lib/Delivera-Governance-RoleResolver-01SSOT.js';
import { buildGovernanceNudgeDraft, buildScopeNudgeDraft } from '../lib/Delivera-Governance-ScopeNudge-01Draft-SSOT.js';
import { resolveEscalationLevel } from '../lib/Delivera-Governance-Escalation-01Ladder-SSOT.js';
import {
  caseActionFromRisk,
  issueChangedBeforeSend,
  riskListFromBrief,
  riskProject,
} from '../routes/governance-interventions.js';

test('intervention state machine rejects illegal manual workflow jumps', () => {
  assert.throws(
    () => assertInterventionTransition(INTERVENTION_STATES.DETECTED, INTERVENTION_STATES.CLOSED),
    /Illegal intervention transition/,
  );
});

test('intervention fingerprint dedupes same risk regardless of issue key order', () => {
  const left = interventionFingerprint({
    project: 'SD',
    periodKey: '2026-Q2',
    triggerType: 'dependency',
    issueKeys: ['SD-2', 'SD-1'],
  });
  const right = interventionFingerprint({
    project: 'sd',
    periodKey: '2026-q2',
    triggerType: 'dependency',
    issueKeys: ['SD-1', 'SD-2'],
  });
  assert.equal(left, right);
});

test('role resolver does not guess Product Owner from assignee-only data', async () => {
  const role = await resolveGovernanceRole({
    projectKey: 'ZZUNIT',
    role: 'Product Owner',
    risk: { issueKey: 'ZZUNIT-1', assigneeName: 'Developer One' },
  });
  assert.equal(role.source, 'unresolved');
  assert.equal(canSendToResolvedRole(role), false);
});

test('scope nudge blocks send when Product Owner is unresolved', () => {
  const draft = buildScopeNudgeDraft({
    caseRow: { issueKeys: ['ZZUNIT-2'] },
    risk: { issueKey: 'ZZUNIT-2', riskType: 'late-scope' },
    role: { role: 'Product Owner', displayName: '', accountId: '', confidence: 'none' },
  });
  assert.equal(draft.safeToSend, false);
  assert.equal(draft.approvalRequired, true);
});

test('escalation without target date is limited confidence and starts at reminder level', () => {
  const level = resolveEscalationLevel({ dueAt: '' });
  assert.equal(level.confidence, 'limited');
  assert.equal(level.key, 'reminder');
});

test('risk list merges brief sources and dedupes repeated issue risks', () => {
  const rows = riskListFromBrief({
    risks: [{ issueKey: 'SD-1', summary: 'direct' }],
    brief: {
      topRisks: [{ issueKey: 'SD-1', summary: 'duplicate' }, { issueKey: 'SD-2', summary: 'top' }],
      leadershipNarrative: { decisionsNeeded: [{ issueKey: 'SD-2', summary: 'duplicate' }, { summary: 'owner needed' }] },
    },
  });
  assert.deepEqual(rows.map((r) => r.issueKey || r.summary), ['SD-1', 'SD-2', 'owner needed']);
});

test('risk project is inferred from Jira key before fallback', () => {
  assert.equal(riskProject({ issueKey: 'mas-44' }, 'SD'), 'MAS');
  assert.equal(riskProject({ project: ' dms ' }, 'SD'), 'DMS');
});

test('generic governance nudge supports dependency and blocker risks', () => {
  const draft = buildGovernanceNudgeDraft({
    caseRow: { issueKeys: ['SD-44'] },
    risk: { issueKey: 'SD-44', riskType: 'dependency', summary: 'External mapping owner has not confirmed data' },
    role: { role: 'Scrum Master', displayName: 'Sam SM' },
  });
  assert.equal(draft.safeToSend, true);
  assert.deepEqual(draft.buttons, ['confirmed', 'partly-confirmed', 'needs-correction']);
  assert.match(draft.text, /delivery decision needed/);
});

test('issue changed before send blocks when latest marker differs or captured fact is missing', () => {
  assert.equal(issueChangedBeforeSend({}, { latestIssueUpdatedAt: '2026-06-22T10:00:00.000Z' }), true);
  assert.equal(issueChangedBeforeSend({
    facts: [{ key: 'updated:SD-1', value: '2026-06-22T09:00:00.000Z' }],
  }, { latestIssueUpdatedAt: '2026-06-22T10:00:00.000Z' }), true);
  assert.equal(issueChangedBeforeSend({
    facts: [{ key: 'updated:SD-1', value: '2026-06-22T10:00:00.000Z' }],
  }, { latestIssueUpdatedAt: '2026-06-22T10:00:00.000Z' }), false);
  assert.equal(issueChangedBeforeSend({}, {}), false);
});

test('case action from risk keeps one approval-gated next step', () => {
  const action = caseActionFromRisk({ issueKey: 'SD-8', recommendedAction: 'Confirm owner today' });
  assert.equal(action.actionId, 'act-sd-8');
  assert.equal(action.approvalRequired, true);
  assert.equal(action.action, 'Confirm owner today');
});

test('portfolio decision uses deterministic recommendation before AI wording', async () => {
  const { buildPortfolioDecision } = await import('../lib/Delivera-Governance-PortfolioDecision-01SSOT.js');
  const brief = {
    projects: ['DMS', 'RPA'],
    squadInsights: [
      { projectKey: 'DMS', boardName: 'DMS Squad', boardResolved: true, sprintPulse: { committed: 10, done: 2 }, offPlanHours: 20, verdictTier: 'blocked', cardRisks: [{ issueKey: 'DMS-1' }] },
      { projectKey: 'RPA', boardName: 'RPA', boardResolved: true, sprintPulse: { committed: 10, done: 6 }, offPlanHours: 4, verdictTier: 'watch', cardRisks: [] },
    ],
    freshness: { confidenceLimit: 'live' },
  };
  const decision = buildPortfolioDecision({
    brief,
    anchorProject: 'DMS',
    compareProjects: ['RPA'],
    cases: [{ project: 'DMS', needsApproval: true, state: 'clarification-required' }],
  });
  assert.match(decision.headline, /DMS/i);
  assert.equal(decision.metrics.delivery.value, 20);
  assert.ok(decision.recommendation.id);
  assert.equal(decision.drivers.length, 3);
});

test('portfolio comparison cards produce squad-specific explanations', async () => {
  const { buildPortfolioDecision } = await import('../lib/Delivera-Governance-PortfolioDecision-01SSOT.js');
  const { buildPortfolioComparisonCards } = await import('../lib/Delivera-Governance-PortfolioComparison-01SSOT.js');
  const brief = {
    squadInsights: [
      { projectKey: 'DMS', boardName: 'DMS Squad', boardResolved: true, sprintPulse: { committed: 8, done: 2 }, offPlanHours: 18, verdictTier: 'blocked' },
      { projectKey: 'MAS', boardName: 'Mini Apps', boardResolved: true, sprintPulse: { committed: 8, done: 5 }, offPlanHours: 3, verdictTier: 'onTrack' },
    ],
  };
  const decision = buildPortfolioDecision({ brief, anchorProject: 'DMS', compareProjects: ['MAS'] });
  const comparison = buildPortfolioComparisonCards({ decision, brief, insights: brief.squadInsights });
  assert.equal(comparison.cards.length, 2);
  assert.notEqual(comparison.cards[0].explanation, comparison.cards[1].explanation);
  assert.match(comparison.cards[0].explanation, /off-plan work/i);
});
