import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function renderDecisionRow(label, value, source = 'Fact') {
  return `
    <div class="portfolio-decision-required-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value || 'Not set'))}</strong>
      <small>${escapeHtml(source)}</small>
    </div>`;
}

function decisionActionLabel(decision = {}) {
  const action = decision.decisionRequired?.recommendedAction || '';
  if (/scope/i.test(action)) return 'Confirm PI scope';
  if (/clarification|confirm/i.test(action)) return 'Request clarification';
  if (/escalat/i.test(action)) return 'Escalate decision';
  return 'Confirm commitment status';
}

export function renderWhyThisMatters(drivers = []) {
  const rows = (drivers || []).slice(0, 3);
  if (!rows.length) return '';
  return `
    <section class="portfolio-why" aria-label="Root-cause rows">
      <h2 class="portfolio-why-title">Root causes</h2>
      <dl class="portfolio-keyvalue-list">
        ${rows.map((d) => `
          <div class="portfolio-keyvalue-row" title="${escapeHtml(d.detail || '')}">
            <dt>${escapeHtml(d.title || 'Signal')}</dt>
            <dd>${escapeHtml(d.summary || '')}</dd>
          </div>`).join('')}
      </dl>
    </section>`;
}

export function renderPortfolioDecisionPanel(decision = {}) {
  const required = decision.decisionRequired || {};
  const recommended = decision.recommendation?.id || 'track-commitments';
  return `
    <section class="portfolio-decision portfolio-decision-required" aria-label="Decision required" id="portfolio-decision">
      <p class="portfolio-decision-eyebrow">Decision required</p>
      <h2>${escapeHtml(required.issue || decision.narrative?.mainIssue || 'Confirm portfolio decision')}</h2>
      <div class="portfolio-decision-required-rows">
        ${renderDecisionRow('Impact', required.impact || 'Commitment exposure unknown', 'Derived metric')}
        ${renderDecisionRow('Owner', required.owner || 'Product Owner', 'Fact')}
        ${renderDecisionRow('Due', required.dueAt || decision.aboveFold?.nextDeadline || 'Set owner due date', 'Fact')}
        ${renderDecisionRow('Evidence', required.evidenceConfidence || decision.evidenceBreakdown?.confidenceLabel || 'Medium', 'Derived metric')}
        ${renderDecisionRow('Escalation', required.escalationAfter || '24 hours after due date', 'Human confirmation pending')}
      </div>
      <div class="portfolio-decision-actions">
        <button type="button" class="btn btn-primary portfolio-decision-confirm" data-portfolio-action="confirm-decision" data-decision-id="${escapeHtml(recommended)}">${escapeHtml(decisionActionLabel(decision))}</button>
        <button type="button" class="btn btn-secondary btn-compact" data-portfolio-action="view-governance-evidence">View evidence</button>
      </div>
    </section>`;
}

export function bindPortfolioDecisionPanel(root, onConfirm) {
  if (!root) return;
  root.querySelector('[data-portfolio-action="confirm-decision"]')?.addEventListener('click', async (ev) => {
    const selected = ev.currentTarget?.getAttribute('data-decision-id') || 'track-commitments';
    if (onConfirm) await onConfirm(selected);
  });
}
