import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { GOV_TOOLTIPS } from './Delivera-App-Governance-Brief-Tooltip-01SSOT.js';
import { COPY, setupGapImpact, setupGapTitle } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

const ACTION_LABELS = {
  'set-baseline': COPY.piBaselineCta,
  'add-ai-key': 'Add AI key',
  'map-board': 'Map board',
  'review-lanes': 'Review lanes',
  refresh: 'Refresh data',
  'create-work': 'Create work in Jira',
};

const VISIBLE_GAP_COUNT = 1;

function renderGapCard(g, hidden = false) {
  const act = ACTION_LABELS[g.action] || 'Open settings';
  const impact = setupGapImpact(g);
  const title = setupGapTitle(g);
  const createWorkAttrs = g.action === 'create-work'
    ? ' data-open-outcome-modal data-outcome-context="Create work in Jira for selected squads."'
    : '';
  return `
      <article class="gov-fix-card gov-fix-card--${escapeHtml(g.severity || 'medium')}" data-setup-gap-card data-hover-proof="setup-gap"${hidden ? ' hidden' : ''}>
        <h4 class="gov-fix-card-title">${escapeHtml(title)}</h4>
        <p class="gov-fix-card-impact">Impact: ${escapeHtml(impact)}</p>
        <button type="button" class="btn btn-primary btn-compact gov-fix-card-btn" data-setup-action="${escapeHtml(g.action)}"${g.action === 'set-baseline' ? ' data-setup-baseline-ssot="1"' : ''}${createWorkAttrs}>Fix: ${escapeHtml(act)}</button>
      </article>`;
}

export function renderSetupDebtStrip(brief, opts = {}) {
  const gaps = brief?.meta?.setupGaps || [];
  if (!gaps.length) return '';
  const topGap = gaps[0];
  const highSeverity = String(topGap?.severity || '').toLowerCase() === 'high';
  if (opts.compact && highSeverity) {
    return `
    <section class="gov-setup-debt gov-setup-debt--compact gov-setup-debt--auto" aria-label="Setup gaps">
      <div class="gov-fix-card-row">${renderGapCard(topGap)}</div>
      ${gaps.length > 1 ? `<button type="button" class="btn btn-link btn-compact" id="gov-setup-gaps-expand">+${gaps.length - 1} more setup gap${gaps.length > 1 ? 's' : ''}</button><div class="gov-setup-debt-full" hidden></div>` : ''}
    </section>`;
  }
  if (opts.compact) {
    const n = gaps.length;
    return `
    <section class="gov-setup-debt gov-setup-debt--compact" aria-label="Setup gaps">
      <button type="button" class="btn btn-link btn-compact" id="gov-setup-gaps-expand">${n} setup gap${n > 1 ? 's' : ''} — show</button>
      <div class="gov-setup-debt-full" hidden></div>
    </section>`;
  }
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

export function bindSetupDebtStripExpand(root, brief) {
  if (!root) return;
  root.querySelector('#gov-setup-gaps-expand')?.addEventListener('click', () => {
    const full = root.querySelector('.gov-setup-debt-full');
    if (!full || !brief) return;
    full.hidden = false;
    full.innerHTML = renderSetupDebtStrip(brief);
    bindSetupDebtStripExpand(full, brief);
    root.querySelector('#gov-setup-gaps-expand')?.remove();
    root.classList.remove('gov-setup-debt--compact');
  });
  root.querySelector('#gov-setup-gaps-more')?.addEventListener('click', () => {
    root.querySelectorAll('[data-setup-gap-card][hidden]').forEach((el) => el.removeAttribute('hidden'));
    root.querySelector('#gov-setup-gaps-more')?.remove();
  });
}
