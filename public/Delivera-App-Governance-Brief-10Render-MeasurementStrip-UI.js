import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { renderAdHocEpicWatcher } from './Delivera-App-Governance-Brief-20Render-EpicHygienePanel-UI.js';

const GAP_ACTIONS = {
  'set-baseline': { href: '#gov-scope-baseline', label: 'Set baseline' },
  'add-ai-key': { href: '/settings#gov-ai-helper', label: 'Add AI key' },
  'map-board': { href: '#gov-scope-change', label: 'Map board' },
  'review-lanes': { href: '#gov-action-clusters-mount', label: 'Review lanes' },
  refresh: { href: '#gov-scope-refresh', label: 'Refresh' },
};

export function renderMeasurementStrip(brief, surfaces) {
  const gaps = brief?.meta?.setupGaps || [];
  const risks = surfaces?.measurementRisks || [];
  const rows = gaps.map((g) => {
    const act = GAP_ACTIONS[g.action] || { href: '/settings', label: 'Open settings' };
    return `
      <li class="gov-measurement-item">
        <span>${escapeHtml(g.label)}</span>
        <a class="btn btn-secondary btn-compact" href="${escapeHtml(act.href)}">${escapeHtml(act.label)}</a>
      </li>`;
  });
  for (const r of risks) {
    rows.push(`
      <li class="gov-measurement-item">
        <strong>${escapeHtml(r.squad || r.issueKey || 'Scope')}</strong>
        <span>${escapeHtml(r.displayTitle || r.riskLabel || '')}</span>
      </li>`);
  }
  const adHoc = renderAdHocEpicWatcher(brief);
  if (!rows.length && !adHoc) return adHoc;
  return `
    ${adHoc}
    <details class="gov-measurement-strip">
      <summary>${escapeHtml(COPY.measurementStrip)} (${rows.length})</summary>
      <ul class="gov-measurement-list">${rows.join('')}</ul>
    </details>`;
}
