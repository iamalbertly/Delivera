import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'fs/promises';

async function cleanSyntheticProject(project) {
  const files = [
    ['data/Delivera-Governance-InterventionCases.json', 'cases'],
    ['data/Delivera-Governance-ActionRegister.json', 'actions'],
    ['data/Delivera-Governance-Profile-Overrides.jsonl', 'jsonl'],
    ['data/Delivera-Governance-Inbox.jsonl', 'jsonl'],
    ['data/Delivera-Improvement-Events.jsonl', 'jsonl'],
  ];
  const hasProject = (row) => JSON.stringify(row).includes(project);
  for (const [path, key] of files) {
    let raw = '';
    try { raw = await readFile(path, 'utf8'); } catch { continue; }
    if (key === 'jsonl') {
      const rows = raw.split('\n').filter(Boolean).map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean).filter((row) => !hasProject(row));
      await writeFile(path, rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '', 'utf8');
      continue;
    }
    const parsed = JSON.parse(raw || '{}');
    parsed[key] = (parsed[key] || []).filter((row) => !hasProject(row));
    await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  }
}

test.describe('governance intervention loop', () => {
  test('seeds case from brief, preserves approval gates, verifies, and keeps shortlist compatible', async ({ request }) => {
    const project = `ZZ${Date.now().toString().slice(-5)}`;
    const issueKey = `${project}-101`;
    const risk = {
      issueKey,
      project,
      riskType: 'late-scope',
      summary: 'Scope changed after PI commitment without Product Owner confirmation',
      recommendedAction: `Confirm whether ${issueKey} remains committed scope.`,
      decisionNeededFrom: 'Product Owner',
      targetDate: '2026-06-23',
    };

    try {
      const seed = await request.post('/api/governance/interventions/seed-from-brief', {
        data: {
          projects: project,
          periodKey: 'UNIT-2026-Q2',
          brief: { topRisks: [risk], meta: { quarter: 'UNIT-2026-Q2' } },
          risks: [risk, { ...risk, summary: 'duplicate should not create another visible card' }],
        },
      });
    expect(seed.ok()).toBeTruthy();
    const seeded = await seed.json();
    const row = seeded.cases.find((item) => item.issueKeys.includes(issueKey));
    expect(row).toBeTruthy();
    expect(seeded.cases.every((item) => item.project === project)).toBeTruthy();

    const unresolved = await request.post(`/api/governance/interventions/${row.id}/approve-nudge`, {
      data: { confirmSend: true },
    });
    expect(unresolved.status()).toBe(422);
    await expect(unresolved.json()).resolves.toMatchObject({ blocked: true, reason: 'recipient-unresolved' });

    const role = await request.post('/api/governance/roles', {
      data: { project, role: 'Product Owner', displayName: 'Pat Product' },
    });
    expect(role.ok()).toBeTruthy();

    const review = await request.post(`/api/governance/interventions/${row.id}/approve-nudge`, {
      data: { confirmSend: false },
    });
    expect(review.ok()).toBeTruthy();
    await expect(review.json()).resolves.toMatchObject({ approvalRequired: true });

    const changed = await request.post(`/api/governance/interventions/${row.id}/approve-nudge`, {
      data: { confirmSend: true, latestIssueUpdatedAt: '2099-01-01T00:00:00.000Z' },
    });
    expect(changed.status()).toBe(409);
    await expect(changed.json()).resolves.toMatchObject({ blocked: true, reason: 'issue-changed-before-send' });

    const sent = await request.post(`/api/governance/interventions/${row.id}/approve-nudge`, {
      data: { confirmSend: true },
    });
    expect(sent.ok()).toBeTruthy();

    const response = await request.post(`/api/governance/interventions/${row.id}/record-response`, {
      data: { option: 'confirmed', responseText: 'Confirmed, keep it in PI and use Pat as owner.', observedBy: 'Pat Product' },
    });
    expect(response.ok()).toBeTruthy();

    const decision = await request.post(`/api/governance/interventions/${row.id}/record-decision`, {
      data: { decision: 'keep-in-pi', owner: 'Pat Product', targetDate: '2026-06-23' },
    });
    expect(decision.ok()).toBeTruthy();

    const verify = await request.post(`/api/governance/interventions/${row.id}/verify`, {
      data: { evidence: [{ source: 'unit', label: 'Decision confirmed', value: issueKey }] },
    });
    expect(verify.ok()).toBeTruthy();
    const verified = await verify.json();
    expect(verified.case.verification.status).toBe('passed');

    const shortlist = await request.get(`/api/governance/intervention-shortlist.json?projects=${project}`);
    expect(shortlist.ok()).toBeTruthy();
    const shortJson = await shortlist.json();
    expect(Array.isArray(shortJson.cases)).toBeTruthy();
    } finally {
      await cleanSyntheticProject(project);
    }
  });
});
