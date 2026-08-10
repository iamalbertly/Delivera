import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSprintCapableBoard,
  filterSprintCapableBoards,
  filterNonSprintCapableBoards,
  preferredBoardIdsFromRegistry,
  selectBoardsForSprintOps,
  pickPrimaryBacklogBoard,
  nonSprintBoardCacheKey,
} from '../lib/Delivera-Data-Board-Sprint-Capability-01SSOT.js';

describe('Board sprint capability SSOT', () => {
  it('treats scrum as capable and kanban/simple as not', () => {
    assert.equal(isSprintCapableBoard({ id: 1, type: 'scrum' }), true);
    assert.equal(isSprintCapableBoard({ id: 27, type: 'kanban' }), false);
    assert.equal(isSprintCapableBoard({ id: 3, type: 'simple' }), false);
    assert.equal(isSprintCapableBoard({ id: 4, type: 'SCRUM' }), true);
    assert.equal(isSprintCapableBoard(null), false);
  });

  it('allows unknown type (legacy caches) until negative cache applies', () => {
    assert.equal(isSprintCapableBoard({ id: 9 }), true);
    assert.equal(isSprintCapableBoard({ id: 9, type: '' }), true);
  });

  it('filters board 27 kanban fixture out of sprint-capable set', () => {
    const boards = [
      { id: 1, type: 'scrum', name: 'SD Scrum' },
      { id: 27, type: 'kanban', name: 'Broken Kanban' },
      { id: 44, type: 'scrum', name: 'DMS' },
    ];
    const capable = filterSprintCapableBoards(boards);
    assert.deepEqual(capable.map((b) => b.id), [1, 44]);
    assert.deepEqual(filterNonSprintCapableBoards(boards).map((b) => b.id), [27]);
  });

  it('reads preferred board IDs from registry boardMapping', () => {
    const registry = {
      squads: [
        { squadKey: 'SD', boardMapping: [1] },
        { squadKey: 'FIN', boardMapping: [230] },
      ],
    };
    const ids = preferredBoardIdsFromRegistry(registry, ['SD', 'FIN']);
    assert.ok(ids.has(1));
    assert.ok(ids.has(230));
    assert.equal(ids.size, 2);
  });

  it('selectBoardsForSprintOps prefers registry then scrum', () => {
    const boards = [
      { id: 27, type: 'kanban', name: 'Kanban' },
      { id: 1, type: 'scrum', name: 'SD Scrum' },
      { id: 99, type: 'scrum', name: 'Other' },
    ];
    const registry = { squads: [{ squadKey: 'SD', boardMapping: [1] }] };
    const selected = selectBoardsForSprintOps(boards, { projectKeys: ['SD'], registry });
    assert.equal(selected.preferredApplied, true);
    assert.deepEqual(selected.boards.map((b) => b.id), [1]);
    assert.equal(selected.skipped.length, 0);
  });

  it('falls back to scrum when registry only maps kanban', () => {
    const boards = [
      { id: 27, type: 'kanban', name: 'Kanban' },
      { id: 1, type: 'scrum', name: 'SD Scrum' },
    ];
    const registry = { squads: [{ squadKey: 'SD', boardMapping: [27] }] };
    const selected = selectBoardsForSprintOps(boards, { projectKeys: ['SD'], registry });
    assert.equal(selected.preferredApplied, false);
    assert.deepEqual(selected.boards.map((b) => b.id), [1]);
    assert.ok(selected.skipped.some((b) => b.id === 27));
  });

  it('pickPrimaryBacklogBoard prefers project+scrum', () => {
    const boards = [
      { id: 27, type: 'kanban', location: { projectKey: 'SD' } },
      { id: 1, type: 'scrum', location: { projectKey: 'SD' } },
      { id: 9, type: 'scrum', location: { projectKey: 'MPSA' } },
    ];
    const board = pickPrimaryBacklogBoard(boards, 'SD');
    assert.equal(board?.id, 1);
  });

  it('nonSprintBoardCacheKey is stable', () => {
    assert.equal(nonSprintBoardCacheKey(27), 'nonSprintBoard:27');
  });
});
