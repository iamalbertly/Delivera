import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPiFocusState, applyPiFocusToSetupGaps } from '../lib/Delivera-Governance-PIFocus-01Synergy-Build-SSOT.js';

describe('PI focus synergy SSOT', () => {
  it('buildPiFocusState flags low synergy when no baseline and board epics lack quarter titles', () => {
    const focus = buildPiFocusState({
      baselineComparison: null,
      meta: {
        boardEpicIndex: [
          { issueKey: 'SD-1', title: 'Random backlog epic' },
        ],
      },
    });
    assert.equal(focus.synergy, 'low');
    assert.equal(focus.reason, 'board-unmatched');
    assert.equal(focus.primaryAction, 'create-work');
  });

  it('applyPiFocusToSetupGaps prepends pi-synergy before pi-baseline', () => {
    const gaps = [
      { id: 'pi-baseline', action: 'set-baseline', severity: 'high' },
      { id: 'no-sprint', action: 'map-board', severity: 'high' },
    ];
    const next = applyPiFocusToSetupGaps(gaps, { synergy: 'low', primaryAction: 'create-work' });
    assert.equal(next[0].id, 'pi-synergy');
    assert.equal(next[0].action, 'create-work');
    assert.equal(next[1].id, 'pi-baseline');
  });

  it('synergy ok leaves gaps unchanged', () => {
    const gaps = [{ id: 'pi-baseline', action: 'set-baseline' }];
    const next = applyPiFocusToSetupGaps(gaps, { synergy: 'ok' });
    assert.deepEqual(next, gaps);
  });
});
