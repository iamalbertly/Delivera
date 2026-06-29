import { test, expect } from '@playwright/test';

test.describe('Evidence OS API contracts', () => {
  test('captures contribution, validation request, distinct no_response, and report gap', async ({ request }) => {
    const contributionRes = await request.post('/api/evidence-os/contributions', {
      data: {
        workItemKey: 'MPSA-4242',
        teamStatement: 'Team completed release readiness.',
        individualActionStatement: 'Facilitated release readiness and removed a dependency blocker.',
        impactStatement: 'Release was ready for stakeholder review.',
        evidence: { tier: 'user_statement', sourceType: 'manual_capture', statement: 'Captured by user' },
      },
    });
    expect(contributionRes.ok()).toBeTruthy();
    const contribution = (await contributionRes.json()).contribution;
    expect(contribution.individualActionStatement).toContain('Facilitated');

    const validationRes = await request.post('/api/evidence-os/validation-requests', {
      data: {
        entityType: 'contribution',
        entityId: contribution.id,
        humanPrompt: 'Albert recorded that he coordinated dependency resolution. Did you directly observe this?',
        whyNeeded: 'This outcome is material for the Nuru monthly brief.',
      },
    });
    expect(validationRes.ok()).toBeTruthy();
    const validationRequest = (await validationRes.json()).validationRequest;
    expect(validationRequest.channel).toBe('teams_or_email');
    expect(validationRequest.neutralNoResponse).toBeTruthy();

    const responseRes = await request.post(`/api/evidence-os/validation-requests/${validationRequest.id}/responses`, {
      data: { response: 'no_response', note: 'Deadline passed without response.' },
    });
    expect(responseRes.ok()).toBeTruthy();
    expect((await responseRes.json()).validationResponse.response).toBe('no_response');

    const reportRes = await request.post('/api/evidence-os/reports', {
      data: {
        variant: 'personal_evidence',
        sourceRecordIds: [],
        validationRequests: [{ entityId: contribution.id, response: 'no_response' }],
        narrative: 'Monthly snapshot.',
      },
    });
    expect(reportRes.ok()).toBeTruthy();
    const report = (await reportRes.json()).report;
    expect(report.explicitGaps[0].response).toBe('no_response');
  });

  test('rejects assignee-only and Tier 4 verified evidence shortcuts', async ({ request }) => {
    const assigneeOnly = await request.post('/api/evidence-os/contributions', { data: { assigneeOnly: true, workItemKey: 'MPSA-1' } });
    expect(assigneeOnly.status()).toBe(422);

    const evRes = await request.post('/api/evidence-os/evidence', { data: { tier: 'ai_interpretation', sourceType: 'ai:test', statement: 'Draft only' } });
    expect(evRes.ok()).toBeTruthy();
    const evidence = (await evRes.json()).evidence;
    const linkRes = await request.post('/api/evidence-os/evidence-links', {
      data: { evidenceId: evidence.id, entityType: 'report_section', entityId: 'verified', requiredForVerified: true },
    });
    expect(linkRes.status()).toBe(422);
  });

  test('returns cockpit, linked commitments, and blocks duplicate manual goals', async ({ request }) => {
    const cockpitRes = await request.get('/api/evidence-os/cockpit');
    expect(cockpitRes.ok()).toBeTruthy();
    const cockpit = await cockpitRes.json();
    expect(Array.isArray(cockpit.attentionItems)).toBeTruthy();
    expect(cockpit.managerBrief.purpose).toContain('Nuru');

    const commitmentsRes = await request.get('/api/evidence-os/commitments/detect');
    expect(commitmentsRes.ok()).toBeTruthy();
    const commitments = (await commitmentsRes.json()).commitments;
    expect(commitments[0].sourceSystem).toContain('jira');

    const manualGoal = await request.post('/api/evidence-os/goals', { data: { title: 'Do not duplicate source goal' } });
    expect(manualGoal.status()).toBe(422);
  });
});
