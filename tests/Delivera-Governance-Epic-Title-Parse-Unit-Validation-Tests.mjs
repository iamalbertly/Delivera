/**
 * Unit validation: epic title FY/Q – Squad – Platform – Title SSOT.
 * Fail-fast node asserts (no Playwright / no Vercel).
 */
import assert from 'node:assert/strict';
import {
  parseEpicTitleParts,
  periodFromEpicSummary,
  epicSummaryHasPiPeriod,
  scoreEpicName,
  detectAdHocEpics,
} from '../lib/Delivera-Governance-EpicHygiene-01Score-SSOT.js';
import { diagnosePromiseEvidence } from '../lib/Delivera-Governance-PIBaseline-02Compare.js';
import { businessTitleFromSummary } from '../public/Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

const sample = 'FY27 Q2 - DMS - NBA - Integration of CVM for Channel Productivity Campaign';
const parts = parseEpicTitleParts(sample);
assert.equal(parts.fiscalPeriod, 'FY27 Q2');
assert.equal(parts.squad, 'DMS');
assert.equal(parts.platform, 'NBA');
assert.match(parts.title, /Integration of CVM/i);
assert.equal(parts.structured, true);
assert.equal(periodFromEpicSummary(sample), 'FY27 Q2');
assert.equal(epicSummaryHasPiPeriod(sample), true);
assert.equal(scoreEpicName(sample), 100);
assert.equal(epicSummaryHasPiPeriod('Random ops work'), false);
assert.match(businessTitleFromSummary(sample), /Integration of CVM/i);
assert.doesNotMatch(businessTitleFromSummary(sample), /^FY27/i);

// Title-period beats Fix-Version-only missing metadata when Domain clears the flag.
const withTitle = diagnosePromiseEvidence({
  issueKey: 'SD-5314',
  currentFound: true,
  existsInJira: true,
  missingPiMetadata: false,
  statusNow: 'In Progress',
});
assert.notEqual(withTitle.diagnosisCode, 'missing-pi-metadata');

const stillMissing = diagnosePromiseEvidence({
  issueKey: 'FIN-1',
  currentFound: true,
  existsInJira: true,
  missingPiMetadata: true,
  statusNow: 'In Progress',
});
assert.equal(stillMissing.diagnosisCode, 'missing-pi-metadata');
assert.match(stillMissing.diagnosisEvidence.map((e) => e.value).join(' '), /epic title|fix version/i);

const adHoc = detectAdHocEpics(
  { meta: { piBaselineCommittedKeys: [] } },
  [{ payload: { stories: [
    { epicKey: 'OPS-1', epicSummary: 'Password cleanup batch', created: new Date().toISOString() },
    { epicKey: 'SD-9', epicSummary: sample, created: new Date().toISOString() },
  ] }, board: { name: 'DMS' } }],
);
assert.ok(adHoc.some((e) => e.issueKey === 'OPS-1' && e.formatAligned === false));
assert.ok(adHoc.some((e) => e.issueKey === 'SD-9' && e.formatAligned === true));

console.log('epic-title-ssot-unit: ok');
