/**
 * Ambition-table (TowerCo / Tycoons) slide → 12 FIN epic titles.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAmbitionTableRows,
  parseSlideExtraction,
  detectSlideLayout,
  normalizeRagStatus,
} from '../lib/Delivera-Governance-PIBaseline-03Propose-Slide-02SSOT.js';
import { resolveSlideCommitments } from '../lib/Delivera-Governance-PIBaseline-05Slide-Resolver-02Match-SSOT.js';
import { playbookForProjects, EPIC_PLAYBOOKS } from '../lib/Delivera-Governance-PIBaseline-05Slide-Playbook-01SSOT.js';
import { DEFAULT_EPIC_FORMAT } from '../lib/Delivera-Governance-Epic-Format-01SSOT.js';
import { rankProjectsByDataDensity, PORTFOLIO_ALL } from '../lib/Delivera-Governance-Portfolio-Scope-Rank-01SSOT.js';

const TOWERCO_MODULE_ROWS = [
  {
    module: 'Contract Management',
    month: 'July',
    deliveryPlan: [
      { item: 'Base rate Management', ragStatus: 'Delivered' },
      { item: 'Allowances input', ragStatus: 'Delivered' },
      { item: 'Excess computation', ragStatus: 'Delivered' },
      { item: 'Escalation computation', ragStatus: 'Delivered' },
      { item: 'Milestone computation', ragStatus: 'In progress' },
    ],
  },
  {
    module: 'ITP & Change Management',
    month: 'July',
    deliveryPlan: [
      'Site creation using ITP and RFI',
      'Configuration of approval hierarchy',
      'Linking ITP changes to specific site records',
      'Dashboards for monitoring changes',
    ],
  },
  {
    module: 'Billing Reconciliation',
    month: 'August',
    deliveryPlan: [
      'Define billing logic',
      'Generate expected costs',
      'Invoice reconciliation with 3rd party',
    ],
  },
];

describe('Ambition-table slide extraction', () => {
  it('expands module rows into 12 delivery commitments', () => {
    const rows = normalizeAmbitionTableRows(TOWERCO_MODULE_ROWS, { program: 'TowerCo' });
    assert.equal(rows.length, 12);
    assert.equal(rows[0].module, 'Contract Management');
    assert.equal(rows[0].deliveryItem, 'Base rate Management');
    assert.equal(rows[0].ragStatus, 'delivered');
    assert.equal(rows[4].ragStatus, 'in-progress');
  });

  it('detects ambition-table layout from program + modules', () => {
    assert.equal(detectSlideLayout({ program: 'TowerCo' }, [{ module: 'Contract Management' }]), 'ambition-table');
    assert.equal(detectSlideLayout({}, [{ month: 'July', theme: 'Growth', bullet: 'CVM' }]), 'roadmap');
  });

  it('resolves FIN playbook to 12 canonical titles', () => {
    const extracted = normalizeAmbitionTableRows(TOWERCO_MODULE_ROWS, { program: 'TowerCo' });
    const resolved = resolveSlideCommitments({
      extracted,
      quarter: 'FY27 Q2',
      projects: ['FIN'],
      epicFormat: DEFAULT_EPIC_FORMAT,
      program: 'TowerCo',
      layout: 'ambition-table',
    });
    assert.equal(resolved.length, 12);
    assert.ok(resolved.every((r) => r.suggestedEpicTitle.startsWith('FY27 Q2 – FIN – TOWERCO –')));
    assert.equal(
      resolved[0].suggestedEpicTitle,
      'FY27 Q2 – FIN – TOWERCO – Contract Management – Base Rate Management',
    );
    assert.ok(resolved.some((r) => /Invoice Reconciliation/i.test(r.suggestedEpicTitle)));
    assert.equal(EPIC_PLAYBOOKS['FIN:FY27 Q2'].length, 12);
    assert.equal(playbookForProjects(['FIN'], 'FY27 Q2').length, 12);
  });

  it('parseSlideExtraction expands nested deliveryPlan JSON', () => {
    const raw = JSON.stringify({
      layout: 'ambition-table',
      squad: 'Tycoons',
      program: 'TowerCo',
      quarter: 'FY27 Q2',
      commitments: TOWERCO_MODULE_ROWS,
    });
    const parsed = parseSlideExtraction(raw);
    assert.equal(parsed.layout, 'ambition-table');
    assert.equal(parsed.extracted.length, 12);
    assert.equal(parsed.lowConfidence, false);
  });

  it('flags low confidence when fewer than 3 delivery items', () => {
    const raw = JSON.stringify({
      layout: 'ambition-table',
      squad: 'FIN',
      program: 'TowerCo',
      commitments: [{ module: 'X', deliveryItem: 'Only one' }],
    });
    const parsed = parseSlideExtraction(raw);
    assert.equal(parsed.lowConfidence, true);
  });

  it('normalizes RAG statuses', () => {
    assert.equal(normalizeRagStatus('Delivered'), 'delivered');
    assert.equal(normalizeRagStatus('In progress'), 'in-progress');
    assert.equal(normalizeRagStatus('Off Track'), 'off-track');
  });
});

describe('Portfolio scope ranking', () => {
  it('ranks projects with baselines first', () => {
    const ranked = rankProjectsByDataDensity(['MAS', 'SD', 'FIN', 'MPSA'], {
      SD: { hasBaseline: true, commitmentCount: 7 },
      FIN: { hasBaseline: true, commitmentCount: 12 },
      MAS: { hasBaseline: false, commitmentCount: 0 },
      MPSA: { hasBaseline: false, issueVolume: 50 },
    });
    assert.equal(ranked[0], 'FIN');
    assert.equal(ranked[1], 'SD');
    assert.ok(!ranked.includes(PORTFOLIO_ALL));
  });
});
