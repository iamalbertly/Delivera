import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

export function renderWhyThisMatters(drivers = []) {
  const rows = (drivers || []).slice(0, 3);
  return `
    <section class="portfolio-why" aria-label="Why this matters">
      <h2>Why this matters</h2>
      <ul class="portfolio-why-list">
        ${rows.map((d) => `
          <li class="portfolio-why-item" title="${escapeHtml(d.detail || '')}">
            <strong>${escapeHtml(d.title || '')}</strong>
            <span>${escapeHtml(d.summary || '')}</span>
          </li>`).join('')}
      </ul>
    </section>`;
}

export function renderPortfolioDecisionPanel(decision = {}, { selectedId = '' } = {}) {
  const options = decision.decisionOptions || [];
  const defaultId = selectedId || (options.find((o) => o.id === 'review-investment')?.id) || options[0]?.id || '';
  return `
    <section class="portfolio-decision" aria-label="Next portfolio decision" id="portfolio-decision">
      <h2>Next portfolio decision</h2>
      <p class="portfolio-decision-hint">Choose the best action for the selected squad.</p>
      <fieldset class="portfolio-decision-options">
        <legend class="gov-visually-hidden">Portfolio decision options</legend>
        ${options.map((o) => `
          <label class="portfolio-decision-option${o.id === defaultId ? ' is-selected' : ''}">
            <input type="radio" name="portfolio-decision" value="${escapeHtml(o.id)}" ${o.id === defaultId ? 'checked' : ''}>
            <span class="portfolio-decision-option-copy">
              <strong>${escapeHtml(o.label)}</strong>
              <span>${escapeHtml(o.hint || '')}</span>
            </span>
          </label>`).join('')}
      </fieldset>
      <button type="button" class="btn btn-primary portfolio-decision-confirm" data-portfolio-action="confirm-decision">Confirm decision</button>
      <a class="portfolio-decision-proof-link" href="/actions?tab=proof" data-portfolio-action="open-proof">Open proof in Actions</a>
    </section>`;
}

export function bindPortfolioDecisionPanel(root, onConfirm) {
  if (!root) return;
  root.addEventListener('change', (ev) => {
    const input = ev.target.closest('input[name="portfolio-decision"]');
    if (!input) return;
    root.querySelectorAll('.portfolio-decision-option').forEach((el) => el.classList.remove('is-selected'));
    input.closest('.portfolio-decision-option')?.classList.add('is-selected');
  });
  root.querySelector('[data-portfolio-action="confirm-decision"]')?.addEventListener('click', async () => {
    const selected = root.querySelector('input[name="portfolio-decision"]:checked')?.value || '';
    if (onConfirm) await onConfirm(selected);
  });
}
