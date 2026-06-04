import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

export function renderMeasurementStrip(surfaces) {
  const risks = surfaces?.measurementRisks || [];
  if (!risks.length) return '';
  const rows = risks.map((r) => `
    <li class="gov-measurement-item">
      <strong>${escapeHtml(r.squad || r.issueKey || 'Scope')}</strong>
      <span>${escapeHtml(r.displayTitle || r.riskLabel || r.riskType || '')}</span>
      <span class="gov-measurement-hint">${escapeHtml(r.recommendedAction || 'Check board and field setup in Jira.')}</span>
    </li>`).join('');
  return `
    <details class="gov-measurement-strip">
      <summary>${escapeHtml(COPY.measurementStrip)} (${risks.length})</summary>
      <ul class="gov-measurement-list">${rows}</ul>
      <p class="gov-measurement-foot"><a href="/settings">Open settings</a> to adjust scope or boards.</p>
    </details>`;
}
