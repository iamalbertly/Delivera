import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { renderAiContributionStrip } from './Delivera-Shared-AgentQueue-01UI.js';

export function renderWorkerReceiptRail(brief, feedbackSummary = null, aiContribution = null) {
  const r = brief?.meta?.workerReceipt || {};
  const line = r.line || 'Worker will prepare your brief after startup.';
  const auth = r.authFailed;
  const improvements = feedbackSummary?.lastImprovements || [];
  const improveLine = improvements.length
    ? `${COPY.learningReceipt}: ${improvements.slice(0, 3).join(' · ')}`
    : '';
  const aiStrip = renderAiContributionStrip(aiContribution || brief?.meta?.aiContribution || {});
  const openAttr = auth ? ' open' : '';

  return `
    <details class="gov-receipt-details"${openAttr} role="status" aria-live="polite">
      <summary class="gov-worker-receipt${auth ? ' gov-worker-receipt--warn' : ''}">
        <span class="gov-worker-receipt-label">Agent</span>
        <span class="gov-worker-receipt-line">${escapeHtml(line)}</span>
        ${auth ? '<a href="/settings" class="gov-worker-receipt-link">Reconnect Jira</a>' : ''}
      </summary>
      ${aiStrip}
      ${improveLine ? `<p class="gov-worker-learning-line">${escapeHtml(improveLine)} <button type="button" class="btn btn-link btn-compact" id="gov-open-feedback-lab-inline">${COPY.openLab} →</button></p>` : ''}
    </details>`;
}
