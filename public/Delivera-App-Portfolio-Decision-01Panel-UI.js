import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY, portfolioDecisionLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { resolveProjectDisplay } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';

export function decisionActionLabel(decision = {}, brief = {}) {
  const action = decision.decisionRequired?.recommendedAction || '';
  const recId = decision.recommendation?.id || '';
  if (/review investment/i.test(action) || recId === 'review-investment') return COPY.portfolioDecisionReview;
  if (recId === 'move-capacity') return COPY.portfolioDecisionShift;
  if (recId === 'continue-scale' || recId === 'continue-improve' || recId === 'keep-funding') return COPY.portfolioDecisionContinue;
  if (/scope/i.test(action) || recId === 'review-scope') return 'Confirm PI scope';
  if (/clarification|confirm/i.test(action)) return 'Request clarification';
  if (/escalat/i.test(action)) return 'Escalate decision';
  return portfolioDecisionLabel(recId) || decision.recommendation?.label || 'Confirm commitment status';
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
  const squadName = resolveProjectDisplay(anchor).primary || anchor;
  if (!options.length) {
    return `
      <section class="portfolio-next-decision" aria-label="Next decision">
        <h2 class="portfolio-next-decision-title">Next decision</h2>
        <p class="portfolio-next-decision-prompt">${escapeHtml(COPY.portfolioDecisionPrompt.replace('{squad}', squadName))}</p>
        <p class="portfolio-next-decision-hint">Choose an option below when ready.</p>
      </section>`;
  }
  const recommended = decision.recommendation?.id || 'review-investment';
  let defaultId = 'review-investment';
  if (recommended === 'move-capacity') defaultId = 'move-capacity';
  else if (recommended === 'continue-scale' || recommended === 'continue-improve') defaultId = 'keep-funding';
  else if (recommended === 'review-scope' || recommended === 'insufficient-evidence') defaultId = 'keep-funding';

  return `
    <section class="portfolio-next-decision" aria-label="Next decision">
      <h2 class="portfolio-next-decision-title">Next decision</h2>
      <p class="portfolio-next-decision-prompt">${escapeHtml(COPY.portfolioDecisionPrompt.replace('{squad}', squadName))}</p>
      <fieldset class="portfolio-decision-radio-group" data-portfolio-decision-radios aria-label="Decision options">
        ${options.map((opt) => `
          <label class="portfolio-decision-radio${opt.id === defaultId ? ' is-selected' : ''}">
            <input type="radio" name="portfolio-decision-option" value="${escapeHtml(opt.id)}"${opt.id === defaultId ? ' checked' : ''} data-sync-hero-decision="1">
            <span class="portfolio-decision-radio-label">${escapeHtml(opt.label)}</span>
            <span class="portfolio-decision-radio-hint">${escapeHtml(opt.hint || '')}</span>
          </label>`).join('')}
      </fieldset>
    </section>`;
}

function renderQuickLinks(decision = {}) {
  const anchor = decision.anchorProject || '';
  const period = decision.periodKey ? `&period=${encodeURIComponent(decision.periodKey)}` : '';
  const squadHref = anchor
    ? `/current-sprint?projects=${encodeURIComponent(anchor)}${period}`
    : '/current-sprint';
  return `
    <nav class="portfolio-quick-links" aria-label="Quick links">
      <button type="button" class="btn btn-link btn-compact" data-portfolio-action="view-governance-evidence">View in Evidence</button>
      <a href="/actions${anchor ? `?project=${encodeURIComponent(anchor)}&tab=ready` : '?tab=ready'}">Create intervention</a>
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
    if (typeof onConfirm === 'function' && window.matchMedia('(min-width: 1024px)').matches) {
      void onConfirm(input.value);
    }
  });
  root._portfolioConfirmHandler = onConfirm;
}
