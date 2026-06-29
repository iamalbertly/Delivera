import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cache } from '../lib/cache.js';
import {
  getOrBuildPortfolioDecision,
  invalidatePortfolioDecisionForScope,
  buildPortfolioDecisionPayload,
} from '../lib/Delivera-Governance-PortfolioDecision-01Service.js';
import { CACHE_NS } from '../lib/Delivera-Cache-AgeTier-01TTL-SSOT.js';

const briefFixture = {
  projects: ['SD', 'MAS'],
  generatedAt: new Date().toISOString(),
  meta: { briefId: 'brief-test-1', quarter: 'FY27 Q1' },
  squadInsights: [
    { projectKey: 'SD', boardResolved: true, sprintPulse: { done: 1, committed: 4 } },
    { projectKey: 'MAS', boardResolved: true, sprintPulse: { done: 2, committed: 5 } },
  ],
  topRisks: [],
};

const baseOpts = {
  anchor: 'SD',
  compareRaw: ['MAS'],
  periodKey: 'FY27 Q1',
  baselineMode: 'pi-baseline',
  brief: briefFixture,
  baselineMissing: false,
  partialSquads: 0,
};

async function clearPortfolioDecisionCache() {
  await cache.invalidateByPrefix(`${CACHE_NS.PORTFOLIO_DECISION}:SD:`);
}

describe('Governance-PortfolioDecision-01Service', () => {
  beforeEach(async () => {
    await clearPortfolioDecisionCache();
  });

  it('buildPortfolioDecisionPayload returns decision envelope', () => {
    const built = buildPortfolioDecisionPayload({
      brief: briefFixture,
      anchor: 'SD',
      compareRaw: ['MAS'],
      cases: [],
      baselineMode: 'pi-baseline',
      baselineMissing: false,
      partialSquads: 0,
    });
    assert.ok(built.decision?.headline);
    assert.ok(Array.isArray(built.comparison?.cards));
  });

  it('returns cached meta on second identical build', async () => {
    const first = await getOrBuildPortfolioDecision(baseOpts);
    assert.equal(first.meta.cached, false);
    assert.ok(first.decision?.headline);

    const second = await getOrBuildPortfolioDecision(baseOpts);
    assert.equal(second.meta.cached, true);
    assert.equal(second.decision.headline, first.decision.headline);
  });

  it('invalidates cache for scope prefix', async () => {
    await getOrBuildPortfolioDecision(baseOpts);
    await invalidatePortfolioDecisionForScope({ anchor: 'SD', periodKey: 'FY27 Q1' });
    const after = await getOrBuildPortfolioDecision(baseOpts);
    assert.equal(after.meta.cached, false);
  });

  it('forceRefresh bypasses cache', async () => {
    await getOrBuildPortfolioDecision(baseOpts);
    const forced = await getOrBuildPortfolioDecision({ ...baseOpts, forceRefresh: true });
    assert.equal(forced.meta.cached, false);
  });
});
