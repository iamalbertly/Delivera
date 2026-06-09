/**
 * SSOT: PI alignment classification for work items.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

export function classifyWorkAlignment({ epicKey = '', piBaselineCommittedKeys = [], adHocEpicKeys = [] } = {}) {
  const ek = String(epicKey || '').trim().toUpperCase();
  const baseline = new Set((piBaselineCommittedKeys || []).map((k) => String(k).toUpperCase()));
  const adHoc = new Set((adHocEpicKeys || []).map((k) => String(k?.issueKey || k).toUpperCase()));
  if (!ek) {
    return { tier: 'adHoc', label: COPY.adHocWork, title: 'No epic link — treated as ad-hoc' };
  }
  if (adHoc.has(ek)) {
    return { tier: 'adHoc', label: COPY.adHocWork, title: 'Epic flagged as ad-hoc' };
  }
  if (baseline.size && baseline.has(ek)) {
    return { tier: 'pi', label: COPY.piAligned, title: 'Linked to committed PI epic' };
  }
  if (baseline.size) {
    return { tier: 'offPi', label: COPY.offPi, title: 'Epic not in saved PI baseline' };
  }
  return { tier: 'offPi', label: COPY.offPi, title: 'PI baseline not set — epic unverified' };
}

export function renderAlignmentChip(alignment) {
  const tier = alignment?.tier || 'offPi';
  const label = alignment?.label || COPY.offPi;
  const title = alignment?.title || '';
  return `<span class="work-alignment-chip work-alignment-chip--${tier}" data-alignment-tier="${tier}" title="${title.replace(/"/g, '&quot;')}">${label}</span>`;
}
