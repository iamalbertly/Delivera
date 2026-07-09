import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCadencePackState } from '../public/Delivera-App-Governance-Cadence-01Pack-Render-UI.js';

test('buildCadencePackState marks idle squad as dormant not healthy', () => {
  const state = buildCadencePackState({
    projects: ['SD'],
    meta: {
      scopeIntelligence: {
        cards: [{ projectKey: 'SD', sprint: 'none', isSelected: true }],
      },
    },
  });
  assert.equal(state.status, 'none');
  assert.equal(state.movementHealth, 'dormant');
});

test('buildCadencePackState keeps blocked movement on active sprint with no progress', () => {
  const state = buildCadencePackState({
    projects: ['SD'],
    executiveView: { verdictTier: 'blocked' },
    meta: {
      scopeIntelligence: {
        cards: [{ projectKey: 'SD', sprint: 'active', isSelected: true }],
      },
    },
    squadInsights: [{ projectKey: 'SD', sprintPulse: { committed: 10, done: 0 } }],
  });
  assert.equal(state.status, 'active');
  assert.equal(state.movementHealth, 'blocked');
});
