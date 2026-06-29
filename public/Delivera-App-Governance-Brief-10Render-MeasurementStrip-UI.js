import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

export function renderMeasurementStrip(brief, surfaces) {
  const risks = surfaces?.measurementRisks || [];
  const rows = risks.map((r) => `
      <li class="gov-measurement-item">
        <strong>${escapeHtml(r.squad || r.issueKey || 'Scope')}</strong>
        <span>${escapeHtml(r.displayTitle || r.riskLabel || '')}</span>
      </li>`);
  if (!rows.length) return '';
  return `
    <details class="gov-measurement-strip">
      <summary>${escapeHtml(COPY.measurementStrip)} (${rows.length})</summary>
      <ul class="gov-measurement-list">${rows.join('')}</ul>
    </details>`;
}
