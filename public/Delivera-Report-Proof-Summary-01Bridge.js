import { readSharedProjectsCsv, GOVERNANCE_QUARTER_KEY } from './Delivera-Shared-Storage-Keys.js';
import { noOutcomesPlainEnglish, COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { fetchGovernanceBriefCached, peekGovernanceBriefCache } from './Delivera-Shared-Brief-Client-Cache-01Bridge.js';

const BRIEF_LINE_KEY = '__deliveraBriefSummaryLine';

export function getCachedBriefSummary() {
  try {
    return window[BRIEF_LINE_KEY] || null;
  } catch (_) {
    return null;
  }
}

export function clearCachedBriefSummary() {
  try {
    delete window[BRIEF_LINE_KEY];
  } catch (_) {
    window[BRIEF_LINE_KEY] = null;
  }
}

function buildBriefSummaryLine(brief) {
  const ev = brief.executiveView || {};
  const pulse = ev.sprintPulse || {};
  const d = brief.deliveryTruth || {};
  const verdict = ev.verdictLabel || COPY.verdictWatch;
  const line = ev.businessHeadline || brief.leadershipNarrative?.meetingAnswer || '';
  const pulseLine = pulse.committed
    ? `${pulse.done ?? d.done ?? 0} of ${pulse.committed ?? d.committed ?? 0} delivered`
    : '';
  const signals = `${brief.topRisks?.length || 0} delivery signals`;
  const parts = [`${verdict} — ${line}`.trim()];
  if (pulseLine) parts.push(pulseLine);
  parts.push(`${signals} · open Proof below for audit detail`);
  return parts.filter(Boolean).join(' · ');
}

export async function mountReportProofSummary() {
  const el = document.getElementById('report-filter-strip-summary');
  if (!el) return;
  const projects = readSharedProjectsCsv().join(',') || 'MPSA,MAS';
  let quarter = '';
  try { quarter = String(localStorage.getItem(GOVERNANCE_QUARTER_KEY) || '').trim(); } catch (_) { /* ignore */ }
  try {
    const brief = peekGovernanceBriefCache(projects, quarter)
      || await fetchGovernanceBriefCached({ projects, quarter });
    window[BRIEF_LINE_KEY] = buildBriefSummaryLine(brief);
    window.__deliveraNoOutcomesCopy = noOutcomesPlainEnglish();
  } catch (_) {
    clearCachedBriefSummary();
    el.closest('.report-mission-strip')?.classList.add('is-placeholder');
  }
  const refresh = window.__refreshReportingContextBar;
  if (typeof refresh === 'function') refresh();
}
