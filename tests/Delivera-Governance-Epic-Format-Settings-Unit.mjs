import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEpicTitleFromFormat,
  buildEpicFormatPreview,
  validateEpicTitle,
  DEFAULT_EPIC_FORMAT,
} from '../lib/Delivera-Governance-Epic-Format-01SSOT.js';

describe('Epic format SSOT', () => {
  it('builds FY27 Q2 – DMS – NBA – Example title', () => {
    const title = buildEpicTitleFromFormat({
      quarter: 'FY27 Q2',
      squad: 'DMS',
      subsystem: 'NBA',
      capability: 'E-HOD Regional Profile',
    });
    assert.equal(title, 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile');
  });

  it('preview matches canonical pattern', () => {
    const preview = buildEpicFormatPreview(DEFAULT_EPIC_FORMAT);
    assert.match(preview, /^FY27 Q2 – DMS – NBA – /);
  });

  it('validates structured epic titles', () => {
    const ok = validateEpicTitle('FY27 Q2 – DMS – NBA – E-HOD Regional Profile');
    assert.equal(ok.valid, true);
  });
});
