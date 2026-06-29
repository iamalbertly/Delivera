import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ensureTierCanVerify } from '../lib/Delivera-Evidence-01Service.js';
import { scoreProgress } from '../lib/Delivera-Goal-01Service.js';
import { createGoal, detectLinkedCommitments } from '../lib/Delivera-Goal-01Service.js';
import { safeRiskLanguage } from '../lib/Delivera-RiskIntervention-01Service.js';
import { resolveEnablementScoringStatus } from '../lib/Delivera-Opportunity-01Service.js';
import { labelDevelopmentSupportRecord } from '../lib/Delivera-DevelopmentSupport-01Service.js';
import { mutateEvidenceOsStore } from '../lib/Delivera-EvidenceOS-00Store-IO.js';

describe('Evidence OS edge policies', () => {
  const identity = { userId: 'user-unit', orgId: 'org-delivera-local', roles: ['individual_contributor'], permissions: ['*'], reporteeIds: [] };

  it('blocks Tier 4 evidence from verified sections', () => {
    assert.throws(() => ensureTierCanVerify('ai_interpretation'), /cannot satisfy verified/);
    assert.doesNotThrow(() => ensureTierCanVerify('system_fact'));
  });

  it('does not score pre-effective-date goal activity', async () => {
    await mutateEvidenceOsStore((store) => {
      store.goals = [{
        id: 'goal-unit-effective-date',
        organizationId: 'org-delivera-local',
        userId: 'user-unit',
        title: 'Effective date test',
        target: 'After July',
        effectiveAt: '2026-07-01T00:00:00.000Z',
        status: 'active',
      }];
      store.goalAmendments = [];
      return true;
    });
    const result = await scoreProgress('goal-unit-effective-date', '2026-06-30T23:59:00.000Z');
    assert.equal(result.status, 'informational_only');
    assert.equal(result.reason, 'before_effective_date');
  });

  it('keeps speculative risk language safe', () => {
    const line = safeRiskLanguage({ consequenceConfidence: 'speculative', action: 'Raised dependency risk early' });
    assert.match(line, /Reduced exposure/);
    assert.doesNotMatch(line, /prevented failure/i);
  });

  it('turns missing opportunity support into an enablement gap', () => {
    const result = resolveEnablementScoringStatus({ status: 'blocked', blockedBy: 'Sponsor not assigned' });
    assert.equal(result.scoreable, false);
    assert.equal(result.status, 'enablement_gap');
  });

  it('labels development support as non-HR record', () => {
    const record = labelDevelopmentSupportRecord({ title: 'Coaching plan' });
    assert.equal(record.officialHrReference, false);
    assert.match(record.disclaimer, /not an official HR system/);
  });

  it('blocks default manual goal creation and favors linked commitments', async () => {
    await assert.rejects(
      () => createGoal(identity, { title: 'Duplicate manual goal' }),
      /Manual goal creation is disabled/,
    );
    const commitments = await detectLinkedCommitments(identity, { workItemKeys: ['MPSA-100'] });
    assert.ok(commitments.length >= 1);
    assert.equal(commitments[0].sourceSystem.includes('jira'), true);
  });
});
