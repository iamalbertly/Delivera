/**
 * Exception squad rail — compressed peer status below Priority Brief.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function railTone(attentionState = '') {
  if (attentionState === 'off-plan' || attentionState === 'decision-required') return 'critical';
  if (attentionState === 'proof-required') return 'watch';
  if (attentionState === 'cannot-verify') return 'muted';
  return 'healthy';
}

export function renderExceptionRail(portfolioJudgment = {}, { selectedKey = '' } = {}) {
  const judgment = portfolioJudgment || {};
  const squads = judgment.squads || [];
  if (!squads.length) return '';

  const atRisk = judgment.atRisk || [];
  const safeLine = judgment.safe?.length
    ? (portfolioJudgment.safeSquadsLine || '')
    : '';

  const rows = atRisk.map((s) => {
    const tone = railTone(s.attentionState);
    const selected = String(s.projectKey).toUpperCase() === String(selectedKey).toUpperCase();
    return `
      <button type="button"
        class="gov-exception-rail-row gov-exception-rail-row--${escapeHtml(tone)}${selected ? ' is-selected' : ''}"
        data-testid="governance-squad-row"
        data-governance-squad-select="${escapeHtml(s.projectKey)}"
        aria-pressed="${selected ? 'true' : 'false'}">
        <span class="gov-exception-rail-name">${escapeHtml(s.squadName || s.projectKey)}</span>
        <span class="gov-exception-rail-state">${escapeHtml(s.attentionLabel || '')}</span>
        <span class="gov-exception-rail-meaning">${escapeHtml(s.meaning || '')}</span>
      </button>`;
  }).join('');

  const collapsed = safeLine ? `
    <p class="gov-exception-rail-collapsed" data-testid="governance-squad-collapsed">${escapeHtml(safeLine)}</p>` : '';

  return `
    <nav class="gov-exception-rail" data-testid="governance-exception-rail" aria-label="Squad governance status">
      <div class="gov-exception-rail-track" role="list">${rows}</div>
      ${collapsed}
    </nav>`;
}

export function bindExceptionRail(root, { onSelectSquad } = {}) {
  if (!root) return;
  const select = (el) => {
    const key = el?.getAttribute?.('data-governance-squad-select');
    if (key) onSelectSquad?.(key);
  };
  root.addEventListener('click', (ev) => {
    const row = ev.target.closest('[data-governance-squad-select]');
    if (!row) return;
    ev.preventDefault();
    select(row);
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const row = ev.target.closest('[data-governance-squad-select]');
    if (!row) return;
    ev.preventDefault();
    select(row);
  });
}
