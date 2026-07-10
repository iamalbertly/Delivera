import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

export function decisionActionLabel(decision = {}, brief = {}) {
  if (brief?.meta?.piFocus?.synergy === 'low') return COPY.alignmentStudioOpen;
  const action = decision.decisionRequired?.recommendedAction || '';
  if (/scope/i.test(action)) return 'Confirm PI scope';
  if (/clarification|confirm/i.test(action)) return 'Request clarification';
  if (/escalat/i.test(action)) return 'Escalate decision';
  return decision.recommendation?.label || 'Confirm commitment status';
}

export function renderWhyThisMatters(drivers = []) {
  const rows = (drivers || []).slice(0, 3);
  if (!rows.length) return '';
  return `
    <section class="portfolio-why" aria-label="Why this matters">
      <h2 class="portfolio-why-title">Why this matters</h2>
      <dl class="portfolio-keyvalue-list">
        ${rows.map((d) => `
          <div class="portfolio-keyvalue-row" title="${escapeHtml(d.detail || '')}">
            <dt>${escapeHtml(d.title || 'Signal')}</dt>
            <dd>${escapeHtml(d.summary || '')}</dd>
          </div>`).join('')}
      </dl>
    </section>`;
}

function renderNextDecisionRadios(decision = {}, brief = {}) {
  const options = decision.decisionOptions || [];
  const anchor = decision.anchorProject || 'this squad';
  const synergyLow = brief?.meta?.piFocus?.synergy === 'low';
  if (synergyLow || !options.length) {
    return `
      <section class="portfolio-next-decision" aria-label="Next decision">
        <h2 class="portfolio-next-decision-title">Next decision</h2>
        <p class="portfolio-next-decision-prompt">Investment posture for ${escapeHtml(anchor)}</p>
        <p class="portfolio-next-decision-hint">Confirm in the hero above when scope is aligned.</p>
      </section>`;
  }
  const recommended = decision.recommendation?.id || 'review-investment';
  let defaultId = 'review-investment';
  if (recommended === 'move-capacity') defaultId = 'move-capacity';
  else if (recommended === 'continue-scale' || recommended === 'continue-improve') defaultId = 'keep-funding';
  else if (recommended === 'review-scope' || recommended === 'insufficient-evidence') defaultId = 'keep-funding';
  const selected = options.find((o) => o.id === defaultId) || options[0];

  return `
    <section class="portfolio-next-decision" aria-label="Next decision">
      <h2 class="portfolio-next-decision-title">Next decision</h2>
      <p class="portfolio-next-decision-prompt">Recommended for ${escapeHtml(anchor)}</p>
      <fieldset class="portfolio-decision-radio-group" data-portfolio-decision-radios aria-label="Decision options">
        ${options.map((opt) => `
          <label class="portfolio-decision-radio${opt.id === defaultId ? ' is-selected' : ''}">
            <input type="radio" name="portfolio-decision-option" value="${escapeHtml(opt.id)}"${opt.id === defaultId ? ' checked' : ''} data-sync-hero-decision="1">
            <span class="portfolio-decision-radio-label">${escapeHtml(opt.label)}</span>
            <span class="portfolio-decision-radio-hint">${escapeHtml(opt.hint || '')}</span>
          </label>`).join('')}
      </fieldset>
      <p class="portfolio-next-decision-hint">Selected: <strong>${escapeHtml(selected?.label || '')}</strong> — confirm with the hero button.</p>
    </section>`;
}

function renderQuickLinks(decision = {}) {
  const anchor = decision.anchorProject || '';
  const squadHref = anchor
    ? `/current-sprint?projects=${encodeURIComponent(anchor)}`
    : '/current-sprint';
  return `
    <nav class="portfolio-quick-links" aria-label="Quick links">
      <a href="/actions${anchor ? `?project=${encodeURIComponent(anchor)}` : ''}">Interventions</a>
      <a href="${escapeHtml(squadHref)}">Squad sprint</a>
    </nav>`;
}

export function renderPortfolioDecisionPanel(decision = {}, brief = {}) {
  const topProof = (brief?.evidencePack?.rows || [])[0];
  const inlineProof = topProof
    ? `<p class="portfolio-decision-inline-proof" data-testid="portfolio-inline-evidence"><strong>${escapeHtml(topProof.issueKey || 'Proof')}</strong> · ${escapeHtml(topProof.whyFlagged || topProof.statusNow || 'Needs review')}</p>`
    : '';
  return `
    <div class="portfolio-rail-stack" id="portfolio-decision">
      ${renderWhyThisMatters(decision.drivers || [])}
      ${renderNextDecisionRadios(decision, brief)}
      ${inlineProof}
      ${renderQuickLinks(decision, brief)}
    </div>`;
}

export function bindPortfolioDecisionPanel(root, onConfirm) {
  if (!root) return;
  const syncHeroDecisionId = (decisionId) => {
    const heroBtn = document.querySelector('[data-testid="portfolio-primary-cta"][data-portfolio-action="confirm-decision"]');
    if (heroBtn && decisionId) heroBtn.setAttribute('data-decision-id', decisionId);
  };
  root.addEventListener('change', (ev) => {
    const input = ev.target.closest?.('.portfolio-decision-radio input');
    if (!input || !root.contains(input)) return;
    root.querySelectorAll('.portfolio-decision-radio').forEach((el) => {
      el.classList.toggle('is-selected', el.contains(input));
    });
    syncHeroDecisionId(input.value);
  });
  root._portfolioConfirmHandler = onConfirm;
}
