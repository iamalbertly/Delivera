import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSkipFreshnessRender } from '../public/Delivera-App-Governance-Freshness-01SSOT.js';

test('shouldSkipFreshnessRender when scope bar owns freshness', () => {
  assert.equal(shouldSkipFreshnessRender({ freshnessEl: {}, scopeHasStatusChip: true }), true);
});

test('shouldSkipFreshnessRender when freshness element missing', () => {
  assert.equal(shouldSkipFreshnessRender({ freshnessEl: null, scopeHasStatusChip: false }), true);
});

test('shouldSkipFreshnessRender allows pill when element present and no scope chip', () => {
  assert.equal(shouldSkipFreshnessRender({ freshnessEl: {}, scopeHasStatusChip: false }), false);
});
