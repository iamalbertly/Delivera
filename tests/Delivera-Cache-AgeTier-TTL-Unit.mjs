import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveCacheTtlMs,
  deriveStaleServeMs,
  portfolioDecisionCacheKey,
  governanceBriefCacheKey,
} from '../lib/Delivera-Cache-AgeTier-01TTL-SSOT.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

test('deriveCacheTtlMs — fresh data under 24h gets 3h TTL', () => {
  const now = Date.now();
  const { ttlMs } = deriveCacheTtlMs({ generatedAt: new Date(now - 2 * HOUR_MS).toISOString() });
  assert.equal(ttlMs, 3 * HOUR_MS);
});

test('deriveCacheTtlMs — 1–3d data gets 6h TTL', () => {
  const { ttlMs } = deriveCacheTtlMs({ generatedAt: new Date(Date.now() - 2 * DAY_MS).toISOString() });
  assert.equal(ttlMs, 6 * HOUR_MS);
});

test('deriveCacheTtlMs — 3–7d data gets 12h TTL', () => {
  const { ttlMs } = deriveCacheTtlMs({ generatedAt: new Date(Date.now() - 5 * DAY_MS).toISOString() });
  assert.equal(ttlMs, 12 * HOUR_MS);
});

test('deriveCacheTtlMs — older than 7d uses fibonacci hours capped at 7d', () => {
  const { ttlMs } = deriveCacheTtlMs({ generatedAt: new Date(Date.now() - 30 * DAY_MS).toISOString() });
  assert.ok(ttlMs >= 21 * HOUR_MS);
  assert.ok(ttlMs <= 7 * DAY_MS);
});

test('deriveStaleServeMs mirrors TTL up to cap', () => {
  assert.equal(deriveStaleServeMs(3 * HOUR_MS), 3 * HOUR_MS);
  assert.equal(deriveStaleServeMs(10 * DAY_MS), 7 * DAY_MS);
});

test('portfolioDecisionCacheKey is stable for same inputs', () => {
  const a = portfolioDecisionCacheKey({
    anchor: 'MPSA',
    compare: ['MAS', 'RPA'],
    periodKey: 'Q1',
    briefId: 'b1',
    cases: [{ id: 'c1' }],
    baselineMode: 'pi-baseline',
  });
  const b = portfolioDecisionCacheKey({
    anchor: 'mpsa',
    compare: ['RPA', 'MAS'],
    periodKey: 'Q1',
    briefId: 'b1',
    cases: [{ id: 'c1' }],
    baselineMode: 'pi-baseline',
  });
  assert.equal(a, b);
  assert.match(a, /^portfolioDecision:MPSA:/);
});

test('governanceBriefCacheKey encodes evidence and period window', () => {
  const key = governanceBriefCacheKey({
    projects: ['MAS', 'MPSA'],
    periodWindow: '14d',
    includeEvidence: false,
    includePOReadiness: true,
  });
  assert.match(key, /^governanceBrief:MAS,MPSA:e0:p1:w14d$/);
});
