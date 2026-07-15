import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSprintBlockerSignal } from '../public/Delivera-CurrentSprint-Action-Bridge.js';
import { BRIEF_CLIENT_CACHE_KEY, PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

const storage = new Map();

function mockStorage() {
  const localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  const sessionStorage = {
    getItem: (k) => storage.get(`s:${k}`) ?? null,
    setItem: (k, v) => storage.set(`s:${k}`, String(v)),
    removeItem: (k) => storage.delete(`s:${k}`),
  };
  global.window = { localStorage, sessionStorage };
  global.localStorage = localStorage;
  global.sessionStorage = sessionStorage;
}

describe('fetchSprintBlockerSignal', () => {
  let originalFetch;

  beforeEach(() => {
    storage.clear();
    mockStorage();
    storage.set(PROJECTS_SSOT_KEY, 'SD');
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete global.window;
    delete global.localStorage;
    delete global.sessionStorage;
  });

  it('returns live items from current-sprint when board is warm', async () => {
    global.fetch = async (url) => {
      if (String(url).includes('/api/boards.json')) {
        return { ok: true, json: async () => ({ boards: [{ id: 6, projectKey: 'SD' }] }) };
      }
      if (String(url).includes('/api/current-sprint.json')) {
        return {
          ok: true,
          json: async () => ({
            stuckCandidates: [{
              issueKey: 'SD-99',
              summary: 'Blocked epic',
              assignee: 'Amani',
              hoursInStatus: 48,
            }],
          }),
        };
      }
      return { ok: false };
    };
    const signal = await fetchSprintBlockerSignal();
    assert.equal(signal.source, 'live');
    assert.equal(signal.hasBlockers, true);
    assert.equal(signal.primaryKey, 'SD-99');
    assert.equal(signal.items[0].issueKey, 'SD-99');
    assert.equal(signal.items[0].source, 'live');
  });

  it('falls back to brief cache with cache source when sprint fetch fails', async () => {
    sessionStorage.setItem(BRIEF_CLIENT_CACHE_KEY, JSON.stringify({
      'SD|FY27 Q2': {
        brief: {
          topRisks: [{
            issueKey: 'SD-12',
            displayTitle: 'Cached risk',
            assigneeName: 'Lee',
            hoursInStatus: 120,
          }],
        },
      },
    }));
    global.fetch = async () => ({ ok: false });
    const signal = await fetchSprintBlockerSignal();
    assert.equal(signal.source, 'cache');
    assert.equal(signal.items[0].issueKey, 'SD-12');
    assert.equal(signal.items[0].source, 'cache');
  });

  it('returns honest unavailable when live and cache are empty', async () => {
    global.fetch = async () => ({ ok: false });
    const signal = await fetchSprintBlockerSignal();
    assert.equal(signal.source, 'unavailable');
    assert.equal(signal.hasBlockers, false);
    assert.deepEqual(signal.items, []);
  });
});
