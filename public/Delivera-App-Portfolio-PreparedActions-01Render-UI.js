import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function actionLabel(item = {}) {
  return item.label || item.title || item.action || 'Confirm next step';
}

function ownerLabel(item = {}) {
  return item.owner || item.role || item.decisionNeededFrom || 'Owner';
}

export function renderPortfolioPreparedActions(decision = {}, { inlineInSignal = false } = {}) {
  if (inlineInSignal) return '';
  const prepared = decision.preparedActions || {};
  const groups = prepared.groups || [];
  const items = prepared.items || [];
  const totalReady = Number(prepared.totalReady) || items.filter((i) => i.needsApproval).length || groups.length;

  if (!groups.length && !items.length) {
    return `
      <section class="portfolio-prepared-actions portfolio-prepared-actions--empty" aria-label="Action stream" data-portfolio-prepared-actions hidden>
        <p class="portfolio-prepared-empty">No prepared interventions for this squad yet.</p>
      </section>`;
  }

  const primary = totalReady > 1
    ? `Resolve top ${Math.min(3, totalReady)} commitment gaps`
    : actionLabel(items[0] || groups[0] || {});

  // Audit fix (click tax): the "Open intervention queue" primary button here
  // duplicated the same `view-prepared-items` CTA already surfaced in the
  // Decision Panel "Top actions" and the Portfolio Signal hero. The Decision
  // Panel is the canonical surface for the primary CTA; this section now
  // shows a compact item list with a single text link to the full queue
  // instead of a competing primary button.
  const moreCount = Math.max(0, items.length - 4);
  return `
    <section class="portfolio-prepared-actions portfolio-action-stream" aria-label="Action stream" data-portfolio-prepared-actions>
      <div class="portfolio-action-stream-head">
        <p class="portfolio-prepared-eyebrow">Action stream</p>
        <h2 class="portfolio-prepared-title">${escapeHtml(primary)}</h2>
      </div>
      <ul class="portfolio-prepared-items">
        ${items.slice(0, 4).map((it) => `
          <li class="portfolio-prepared-item">
            <span class="portfolio-prepared-role">${escapeHtml(ownerLabel(it))}</span>
            <strong>${escapeHtml(actionLabel(it))}</strong>
            <span>${escapeHtml(it.dueAt || prepared.nextDeadline || decision.decisionRequired?.dueAt || 'Set due date')}</span>
            <span>${escapeHtml(it.caseId || decision.decisionRequired?.relatedCommitmentIds?.[0] || 'Related commitment')}</span>
            <span class="portfolio-prepared-status">${it.needsApproval ? 'Decision required' : 'Draft'}</span>
          </li>`).join('')}
      </ul>
      ${prepared.nextDeadline ? `<p class="portfolio-prepared-deadline">Next response due: <strong>${escapeHtml(prepared.nextDeadline)}</strong></p>` : ''}
      ${moreCount > 0 ? `<button type="button" class="btn btn-link btn-compact portfolio-prepared-more" data-portfolio-action="view-prepared-items" data-testid="portfolio-prepared-more">+${moreCount} more in queue →</button>` : ''}
      ${prepared.escalationReady ? '<p class="portfolio-prepared-escalation">Escalation ready if no response</p>' : ''}
    </section>`;
}
