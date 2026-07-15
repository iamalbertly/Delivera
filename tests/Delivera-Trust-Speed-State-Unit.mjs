import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  isDeliverySquad,
  deliverySquadKeys,
  operationalEntityKeys,
} from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';
import { rankProjectsByDataDensity } from '../public/Delivera-Governance-Portfolio-Scope-Rank-01SSOT.js';
import {
  actionCaseIdentity,
  dedupeActionCases,
} from '../public/Delivera-App-Actions-Case-01Scope-Filter-SSOT.js';
import { buildPriorityBrief } from '../lib/Delivera-Governance-PriorityBrief-01SSOT.js';

test('portfolio scoring excludes operational guilds without hiding them from the catalog', () => {
  assert.equal(isDeliverySquad('ASG'), false);
  assert.equal(isDeliverySquad('SD'), true);
  assert.deepEqual(operationalEntityKeys(), ['ASG']);
  assert.equal(deliverySquadKeys().length, 11);
  assert.deepEqual(rankProjectsByDataDensity(['ASG', 'SD', 'FIN'], {
    ASG: { hasBaseline: true, commitmentCount: 99 },
    SD: { hasBaseline: true, commitmentCount: 2 },
  }), ['SD', 'FIN']);
});

test('action identity is order-independent and duplicate cases collapse to one review', () => {
  const first = {
    id: 'case-a', project: 'SD', quarter: 'FY26 Q2', issueKeys: ['SD-2', 'SD-1'],
    triggerType: 'blocker', state: 'clarification-required', needsApproval: true,
  };
  const second = {
    id: 'case-b', project: 'sd', quarter: 'FY26 Q2', issueKeys: ['SD-1', 'SD-2'],
    triggerType: 'blocker', state: 'decision-required', needsApproval: false,
  };
  assert.equal(actionCaseIdentity(first), actionCaseIdentity(second));
  const rows = dedupeActionCases([first, second]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].duplicateCount, 1);
  assert.deepEqual(rows[0].duplicateCaseIds.sort(), ['case-a', 'case-b']);
});

test('cold first paint explains value and renders layout-shaped skeletons on every core surface', async () => {
  const expectations = {
    'public/governance.html': ['highest-confidence portfolio risk', 'operational guild excluded', 'instant-shell-rail-card'],
    'public/current-sprint.html': ['strongest intervention', 'instant-shell-signal-row', 'Jira evidence refreshes'],
    'public/actions.html': ['Nothing sends without review', 'instant-shell-case-card', 'last verified queue'],
    'public/settings.html': ['administrator-managed governance policy', 'instant-shell-settings-grid', 'connection health refreshes'],
  };
  for (const [file, phrases] of Object.entries(expectations)) {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const phrase of phrases) assert.match(html, new RegExp(phrase, 'i'), `${file} should contain ${phrase}`);
  }
});

test('current sprint shared scope refresh accepts the shared array contract', async () => {
  const source = await readFile(new URL('../public/Delivera-CurrentSprint-Page-Init-Controller.js', import.meta.url), 'utf8');
  assert.match(source, /Array\.isArray\(stored\)/);
  assert.doesNotMatch(source, /const csv = readSharedProjectsCsv[\s\S]{0,100}csv\.split/);
});

test('a baseline from another quarter is quarantined instead of scored', () => {
  const brief = {
    projects: ['SD'],
    meta: {
      quarter: 'FY26 Q2',
      baselineReadinessByProject: {
        SD: { hasBaseline: true, piName: 'SD:FY27 Q2', committedCount: 2 },
      },
    },
    baselineComparison: {
      piName: 'SD:FY27 Q2',
      items: [{ issueKey: 'SD-1', title: 'Future commitment', squad: 'SD', verdict: 'not-planned' }],
    },
    baselineComparisonByProject: {
      SD: {
        piName: 'SD:FY27 Q2',
        items: [{ issueKey: 'SD-1', title: 'Future commitment', squad: 'SD', verdict: 'not-planned' }],
      },
    },
    squadInsights: [{ projectKey: 'SD', boardName: 'DMS', boardResolved: true, verdictTier: 'watch' }],
  };
  const priority = buildPriorityBrief({
    brief,
    decision: { anchorProject: 'SD', periodKey: 'FY26 Q2', insights: brief.squadInsights },
    cases: [],
    baselineMode: 'pi-baseline',
  });
  assert.equal(priority.primaryActionTarget, 'alignment-studio-slide');
  assert.match(priority.conflictBanner?.text || '', /outside FY26 Q2/i);
  assert.doesNotMatch(priority.headline, /Future commitment|zero stories/i);
});
