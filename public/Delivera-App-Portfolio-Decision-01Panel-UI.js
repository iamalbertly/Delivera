import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY, formatDecisionDueLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

function renderDecisionRow(label, value, source = 'Fact', { showSource = false } = {}) {
  return `
    <div class="portfolio-decision-required-row" data-decision-meta-source="${escapeHtml(source)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value || 'Not set'))}</strong>
      ${showSource ? `<small>${escapeHtml(source)}</small>` : ''}
    </div>`;
}

function decisionActionLabel(decision = {}, brief = {}) {
  if (brief?.meta?.piFocus?.synergy === 'low') return COPY.alignmentStudioOpen;
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

export function renderPortfolioDecisionPanel(decision = {}, brief = {}) {
  const required = decision.decisionRequired || {};
  const recommended = decision.recommendation?.id || 'track-commitments';
  const synergyLow = brief?.meta?.piFocus?.synergy === 'low';
  const primaryAttr = synergyLow
    ? 'data-portfolio-action="open-alignment-studio"'
    : `data-portfolio-action="confirm-decision" data-decision-id="${escapeHtml(recommended)}"`;
  const dueRaw = required.dueAt || decision.aboveFold?.nextDeadline || '';
  const dueLabel = formatDecisionDueLabel(dueRaw) || 'Set owner due date';
  const topProof = (brief?.evidencePack?.rows || [])[0];
  const inlineProof = topProof
    ? `<p class="portfolio-decision-inline-proof" data-testid="portfolio-inline-evidence"><strong>${escapeHtml(topProof.issueKey || 'Proof')}</strong> · ${escapeHtml(topProof.whyFlagged || topProof.statusNow || 'Needs review')}</p>`
    : '';
  return `
    <section class="portfolio-decision portfolio-decision-required" aria-label="Decision required" id="portfolio-decision">
      <p class="portfolio-decision-eyebrow">Decision required</p>
      <h2>${escapeHtml(required.issue || decision.narrative?.mainIssue || 'Confirm portfolio decision')}</h2>
      <div class="portfolio-decision-required-rows">
        ${renderDecisionRow('Impact', required.impact || 'Commitment exposure unknown', 'Derived metric')}
        ${renderDecisionRow('Owner', required.owner || 'Product Owner', 'Fact')}
        ${renderDecisionRow('Due', dueLabel, 'Fact')}
        ${renderDecisionRow('Evidence', required.evidenceConfidence || decision.evidenceBreakdown?.confidenceLabel || 'Medium', 'Derived metric')}
        ${renderDecisionRow('Escalation', required.escalationAfter || '24 hours after due date', 'Human confirmation pending')}
      </div>
      ${inlineProof}
      <details class="portfolio-decision-meta">
        <summary class="btn btn-link btn-compact">Source details</summary>
        <div class="portfolio-decision-required-rows portfolio-decision-required-rows--meta">
          ${renderDecisionRow('Impact', required.impact || 'Commitment exposure unknown', 'Derived metric', { showSource: true })}
          ${renderDecisionRow('Owner', required.owner || 'Product Owner', 'Fact', { showSource: true })}
          ${renderDecisionRow('Due', dueLabel, 'Fact', { showSource: true })}
          ${renderDecisionRow('Evidence', required.evidenceConfidence || decision.evidenceBreakdown?.confidenceLabel || 'Medium', 'Derived metric', { showSource: true })}
          ${renderDecisionRow('Escalation', required.escalationAfter || '24 hours after due date', 'Human confirmation pending', { showSource: true })}
        </div>
      </details>
      <div class="portfolio-decision-actions">
        <button type="button" class="btn btn-primary portfolio-decision-confirm" data-testid="portfolio-primary-cta" ${primaryAttr}>${escapeHtml(decisionActionLabel(decision, brief))}</button>
        <button type="button" class="btn btn-secondary btn-compact" data-portfolio-action="view-governance-evidence">${topProof ? 'See all evidence' : 'View evidence'}</button>
      </div>
    </section>`;
}

export function bindPortfolioDecisionPanel(root, onConfirm) {
  if (!root) return;
  root.querySelector('[data-portfolio-action="confirm-decision"]')?.addEventListener('click', async (ev) => {
    const selected = ev.currentTarget?.getAttribute('data-decision-id') || 'track-commitments';
    if (onConfirm) await onConfirm(selected);
  });
  root.querySelector('[data-portfolio-action="open-alignment-studio"]')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('gov:open-alignment-studio', { bubbles: true }));
  });
}
