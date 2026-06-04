import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { noOutcomesPlainEnglish, COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

export async function mountReportProofSummary() {
  const el = document.getElementById('report-proof-summary');
  if (!el) return;
  const projects = readSharedProjectsCsv().join(',') || 'MPSA,MAS';
  try {
    const res = await fetch(`/api/governance-brief.json?projects=${encodeURIComponent(projects)}`);
    if (!res.ok) throw new Error('brief unavailable');
    const brief = await res.json();
    const ev = brief.executiveView || {};
    const pulse = ev.sprintPulse || {};
    const d = brief.deliveryTruth || {};
    const verdict = ev.verdictLabel || COPY.verdictWatch;
    const line = ev.businessHeadline || brief.leadershipNarrative?.meetingAnswer || '';
    const pulseLine = pulse.committed
      ? `${pulse.done ?? d.done ?? 0} of ${pulse.committed ?? d.committed ?? 0} delivered`
      : '';
    el.innerHTML = `
      <p><strong>${verdict}</strong> — ${line}</p>
      ${pulseLine ? `<p>${pulseLine}</p>` : ''}
      <p class="report-proof-meta">${(brief.topRisks?.length || 0)} delivery signals · open Proof below for audit detail</p>`;
    window.__deliveraNoOutcomesCopy = noOutcomesPlainEnglish();
  } catch (_) {
    el.innerHTML = '<p>Load a report preview to see proof aligned with the Brief.</p>';
  }
}
