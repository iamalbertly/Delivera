import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { GOV_TOOLTIPS } from './Delivera-App-Governance-Brief-Tooltip-01SSOT.js';
import { COPY, setupGapImpact, setupGapTitle } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { renderCreateWorkButton } from './Delivera-App-Shared-CreateWork-01Button-Render-SSOT.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { filterSetupGapsForPiFocus } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';

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
  const projectsCsv = readSharedProjectsCsv().join(',');
  let fixBtn;
  if (g.action === 'create-work') {
    fixBtn = renderCreateWorkButton({
      projectsCsv,
      label: `Fix: ${act}`,
      testId: 'gov-setup-create-work',
      context: 'Create work in Jira for selected squads.',
      variant: 'btn-primary',
    }).replace('btn-compact"', 'btn-compact gov-fix-card-btn"');
  } else {
    fixBtn = `<button type="button" class="btn btn-primary btn-compact gov-fix-card-btn" data-setup-action="${escapeHtml(g.action)}"${g.action === 'set-baseline' ? ' data-setup-baseline-ssot="1"' : ''}>Fix: ${escapeHtml(act)}</button>`;
  }
  return `
      <article class="gov-fix-card gov-fix-card--${escapeHtml(g.severity || 'medium')}" data-setup-gap-card data-hover-proof="setup-gap"${hidden ? ' hidden' : ''}>
        <h4 class="gov-fix-card-title">${escapeHtml(title)}</h4>
        <p class="gov-fix-card-impact">Impact: ${escapeHtml(impact)}</p>
        ${fixBtn}
      </article>`;
}

export function renderSetupDebtStrip(brief, opts = {}) {
  const gaps = filterSetupGapsForPiFocus(brief);
  if (!gaps.length) return '';
  const topGap = gaps[0];
  const highSeverity = String(topGap?.severity || '').toLowerCase() === 'high';
  if (opts.compact && highSeverity) {
    return `
    <section class="gov-setup-debt gov-setup-debt--compact gov-setup-debt--auto gov-setup-debt--baseline-ssot" aria-label="Setup gaps" data-direct-value="setup-gap">
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
    <section class="gov-setup-debt" aria-label="Quick wins">
      <p class="gov-setup-debt-label" title="${escapeHtml(GOV_TOOLTIPS.piConfidence)}">Quick wins to unlock more insight:</p>
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
