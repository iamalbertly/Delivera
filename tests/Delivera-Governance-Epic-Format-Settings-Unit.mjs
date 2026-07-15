import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEpicTitleFromFormat,
  buildEpicFormatPreview,
  buildEpicFormatPreviewWithModule,
  validateEpicTitle,
  resolveSquadAlias,
  DEFAULT_EPIC_FORMAT,
} from '../lib/Delivera-Governance-Epic-Format-01SSOT.js';

describe('Epic format SSOT', () => {
  it('builds FY27 Q2 – DMS – NBA – Example title (empty module stripped)', () => {
    const title = buildEpicTitleFromFormat({
      quarter: 'FY27 Q2',
      squad: 'DMS',
      subsystem: 'NBA',
      capability: 'E-HOD Regional Profile',
    });
    assert.equal(title, 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile');
  });

  it('builds 5-segment FIN TowerCo title', () => {
    const title = buildEpicTitleFromFormat({
      quarter: 'FY27 Q2',
      squad: 'FIN',
      subsystem: 'TOWERCO',
      module: 'Contract Management',
      capability: 'Base Rate Management',
    });
    assert.equal(title, 'FY27 Q2 – FIN – TOWERCO – Contract Management – Base Rate Management');
  });

  it('preview matches canonical pattern', () => {
    const preview = buildEpicFormatPreview(DEFAULT_EPIC_FORMAT);
    assert.match(preview, /^FY27 Q2 – DMS – NBA – /);
  });

  it('module preview is 5 segments', () => {
    const preview = buildEpicFormatPreviewWithModule(DEFAULT_EPIC_FORMAT);
    assert.equal(preview, 'FY27 Q2 – FIN – TOWERCO – Contract Management – Base Rate Management');
  });

  it('validates 4- and 5-segment epic titles', () => {
    assert.equal(validateEpicTitle('FY27 Q2 – DMS – NBA – E-HOD Regional Profile').valid, true);
    assert.equal(
      validateEpicTitle('FY27 Q2 – FIN – TOWERCO – Contract Management – Base Rate Management').valid,
      true,
    );
  });

  it('resolves Tycoons nickname to FIN', () => {
    assert.equal(resolveSquadAlias('Tycoons'), 'FIN');
    assert.equal(resolveSquadAlias('Finance Squad'), 'FIN');
  });
});
