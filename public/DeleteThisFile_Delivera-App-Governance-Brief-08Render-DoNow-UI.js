import { COPY, firstNameFromDisplay, initialsFromDisplay } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

export function renderDoNow(brief, surfaces) {
  const actions = surfaces?.doNowActions || [];
  if (!actions.length) {
    return `<section class="gov-donow-section" aria-label="${escapeHtml(COPY.doNow)}"><p class="governance-empty">No urgent person actions — check measurement strip if data looks wrong.</p></section>`;
  }
  const cards = actions.map((a, i) => {
    const name = firstNameFromDisplay(a.assigneeName) || COPY.unassigned;
    const initials = initialsFromDisplay(a.assigneeName);
    const jira = a.issueUrl
      ? `<a class="btn btn-link btn-compact gov-donow-jira" href="${escapeHtml(a.issueUrl)}" target="_blank" rel="noopener">${escapeHtml(COPY.openInJira)}</a>`
      : '';
    return `
      <article class="gov-donow-card" data-donow-index="${i}">
        <div class="gov-donow-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
        <div class="gov-donow-body">
          <p class="gov-donow-name">${escapeHtml(name)}</p>
          <p class="gov-donow-title">${escapeHtml(a.displayTitle)}</p>
          <p class="gov-donow-action">${escapeHtml(a.actionPlain)}</p>
          <div class="gov-donow-actions">
            ${a.issueKey ? `<button type="button" class="btn btn-primary btn-compact" data-donow-nudge="${i}">${escapeHtml(COPY.sendNudge)}</button>` : ''}
            ${jira}
          </div>
        </div>
      </article>`;
  }).join('');
  return `
    <section class="gov-donow-section" aria-label="${escapeHtml(COPY.doNow)}">
      <h2 class="governance-section-title">${escapeHtml(COPY.doNow)}</h2>
      <div class="gov-donow-cards">${cards}</div>
    </section>`;
}
