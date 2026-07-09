import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichComparisonForDiffOnly } from '../public/Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';

test('enrichComparisonForDiffOnly surfaces shared root and per-squad deltas', () => {
  const comparison = {
    cards: [
      { projectKey: 'MPSA', mainIssue: 'Evidence gap', metrics: { delivered: 0 }, affectedCommitmentCount: 3 },
      { projectKey: 'MAS', mainIssue: 'Evidence gap', metrics: { delivered: 5 }, affectedCommitmentCount: 4 },
    ],
  };
  const out = enrichComparisonForDiffOnly(comparison);
  assert.equal(out.sharedRootIssue, 'Evidence gap');
  assert.match(out.cards[0].mainIssue, /MPSA/);
  assert.match(out.cards[1].mainIssue, /MAS/);
});

test('enrichComparisonForDiffOnly leaves distinct issues unchanged', () => {
  const comparison = {
    cards: [
      { projectKey: 'A', mainIssue: 'Gap A', metrics: { delivered: 1 }, affectedCommitmentCount: 1 },
      { projectKey: 'B', mainIssue: 'Gap B', metrics: { delivered: 2 }, affectedCommitmentCount: 2 },
    ],
  };
  const out = enrichComparisonForDiffOnly(comparison);
  assert.equal(out.sharedRootIssue, undefined);
  assert.equal(out.cards[0].mainIssue, 'Gap A');
});
