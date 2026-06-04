import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { GOV_TOOLTIPS } from './Delivera-App-Governance-Brief-Tooltip-01SSOT.js';

const ACTION_LABELS = {
  'set-baseline': 'Review baseline candidates',
  'add-ai-key': 'Add AI key',
  'map-board': 'Map board',
  'review-lanes': 'Review lanes',
  refresh: 'Refresh data',
  'create-work': 'Create work in Jira',
};

const IMPACT_BY_ID = {
  'pi-baseline': 'PI trust low · carryover unproven',
  'ai-key': 'Template wording only',
  'no-sprint': 'Delivery invisible for squad',
  unassigned: 'Owner confidence low',
  'stale-data': 'Do not send nudges yet',
};

const VISIBLE_GAP_COUNT = 1;

function renderGapCard(g, hidden = false) {
  const act = ACTION_LABELS[g.action] || 'Open settings';
  const impact = IMPACT_BY_ID[g.id] || 'Brief confidence is limited';
  const title = String(g.label || '').split('—')[0].trim() || g.id;
  return `
      <article class="gov-fix-card gov-fix-card--${escapeHtml(g.severity || 'medium')}" data-setup-gap-card data-hover-proof="setup-gap"${hidden ? ' hidden' : ''}>
        <h4 class="gov-fix-card-title">${escapeHtml(title)}</h4>
        <p class="gov-fix-card-impact">Impact: ${escapeHtml(impact)}</p>
        <button type="button" class="btn btn-primary btn-compact gov-fix-card-btn" data-setup-action="${escapeHtml(g.action)}">Fix: ${escapeHtml(act)}</button>
      </article>`;
}

export function renderSetupDebtStrip(brief) {
  const gaps = brief?.meta?.setupGaps || [];
  if (!gaps.length) return '';
  const visible = gaps.slice(0, VISIBLE_GAP_COUNT);
  const hidden = gaps.slice(VISIBLE_GAP_COUNT);
  const cards = visible.map((g) => renderGapCard(g)).join('')
    + hidden.map((g) => renderGapCard(g, true)).join('');
  const moreBtn = hidden.length
    ? `<button type="button" class="btn btn-link btn-compact" id="gov-setup-gaps-more">+${hidden.length} more setup gap${hidden.length > 1 ? 's' : ''}</button>`
    : '';
  return `
    <section class="gov-setup-debt" aria-label="Setup gaps">
      <p class="gov-setup-debt-label" title="${escapeHtml(GOV_TOOLTIPS.piConfidence)}">Fix setup:</p>
      <div class="gov-fix-card-row">${cards}</div>
      ${moreBtn}
    </section>`;
}

export function bindSetupDebtStripExpand(root) {
  if (!root) return;
  root.querySelector('#gov-setup-gaps-more')?.addEventListener('click', () => {
    root.querySelectorAll('[data-setup-gap-card][hidden]').forEach((el) => el.removeAttribute('hidden'));
    root.querySelector('#gov-setup-gaps-more')?.remove();
  });
}
