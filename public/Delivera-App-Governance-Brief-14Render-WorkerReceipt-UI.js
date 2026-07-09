import { COPY, formatHumanAge } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderAiContributionStrip } from './Delivera-Shared-AgentQueue-01UI.js';

export function renderWorkerReceiptRail(brief, feedbackSummary = null, aiContribution = null) {
  const r = brief?.meta?.workerReceipt || {};
  const line = r.line || 'Worker will prepare your brief after startup.';
  const humanLine = /T\d{2}:\d{2}:\d{2}/.test(line) ? line : (r.generatedAt ? `Last run: ${formatHumanAge(r.generatedAt)}` : line);
  const auth = r.authFailed;
  const improvements = feedbackSummary?.lastImprovements || [];
  const improveLine = improvements.length
    ? `${COPY.learningReceipt}: ${improvements.slice(0, 3).join(' · ')}`
    : '';
  const aiStrip = renderAiContributionStrip(aiContribution || brief?.meta?.aiContribution || {});
  const openAttr = ' open';

    return `
    <details class="gov-receipt-details"${openAttr} role="status" aria-live="polite">
      <summary class="gov-worker-receipt gov-worker-receipt--clickable${auth ? ' gov-worker-receipt--warn' : ''}" data-worker-receipt-open="1" title="Open agent queue">
        <span class="gov-worker-receipt-label">Agent</span>
        <span class="gov-worker-receipt-line">${escapeHtml(humanLine)}</span>
        ${auth ? '<a href="/settings#integrations" class="gov-worker-receipt-link">Check Jira connection</a>' : ''}
      </summary>
      ${aiStrip}
      ${improveLine ? `<p class="gov-worker-learning-line">${escapeHtml(improveLine)} <button type="button" class="btn btn-link btn-compact" id="gov-open-feedback-lab-inline">${COPY.openLab} →</button></p>` : ''}
    </details>`;
}
