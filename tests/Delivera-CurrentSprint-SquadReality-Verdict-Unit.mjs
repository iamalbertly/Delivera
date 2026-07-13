import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSquadRealityVerdict } from '../lib/Delivera-CurrentSprint-SquadReality-01Verdict-SSOT.js';

test('deriveSquadRealityVerdict floors Healthy when squad idle after closed sprint', () => {
  const end = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const payload = {
    sprint: { id: 1, name: 'FY26DMS24', state: 'closed', endDate: end },
    meta: { activeSprintCount: 0 },
    summary: { totalStories: 5, doneStories: 5, percentDone: 100 },
    stories: [],
    stuckCandidates: [],
  };
  const v = deriveSquadRealityVerdict(payload, { requestedSprintId: 1 });
  assert.notEqual(v.verdict, 'Healthy');
  assert.equal(v.limbo, true);
});

test('deriveSquadRealityVerdict floors Critical when blocker stale 7d+ with near-zero progress', () => {
  const payload = {
    sprint: { id: 1, state: 'active', startDate: '2026-06-20', endDate: '2026-07-18' },
    summary: { totalStories: 12, doneStories: 0 },
    stories: [{ issueKey: 'SD-1' }],
    stuckCandidates: [{ issueKey: 'SD-5255', hoursInStatus: 991 }],
    recentSprints: [{ id: 1, state: 'active' }],
    meta: { activeSprintCount: 1 },
  };
  const v = deriveSquadRealityVerdict(payload);
  assert.equal(v.verdict, 'Critical');
  assert.match(v.verdictLine, /Blocker stale/i);
  assert.match(v.trustLabel, /blocker unchanged/i);
});

test('deriveSquadRealityVerdict escalates when next sprint start overdue', () => {
  const end = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const payload = {
    sprint: { state: 'closed', endDate: end },
    meta: { activeSprintCount: 0, nextSprintStartOverdue: true },
    summary: { totalStories: 0, doneStories: 0 },
    stories: [],
    stuckCandidates: [],
  };
  const v = deriveSquadRealityVerdict(payload);
  assert.equal(v.verdict, 'Critical');
});
