/**
 * Exception squad rail — compressed peer status below Priority Brief.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { attentionTone } from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';

export function renderExceptionRail(portfolioJudgment = {}, { selectedKey = '' } = {}) {
  const judgment = portfolioJudgment || {};
  const squads = judgment.squads || [];
  if (!squads.length) return '';

  const atRisk = judgment.atRisk || [];
  const safeLine = judgment.safe?.length
    ? (portfolioJudgment.safeSquadsLine || '')
    : '';

  const rows = atRisk.map((s) => {
    const tone = attentionTone(s.attentionState);
    const selected = String(s.projectKey).toUpperCase() === String(selectedKey).toUpperCase();
    const trust = s.dataTrustLabel
      ? `<span class="gov-data-trust-chip gov-data-trust-chip--${escapeHtml(s.dataTrust || 'cannot-judge')}" data-testid="governance-data-trust" title="${escapeHtml(s.attentionHint || s.dataTrustLabel)}">${escapeHtml(s.dataTrustLabel)}</span>`
      : '';
    return `
      <button
        type="button"
        class="gov-exception-rail-row gov-exception-rail-row--${escapeHtml(tone)}${selected ? ' is-selected' : ''}"
        data-testid="governance-squad-row"
        data-squad-key="${escapeHtml(s.projectKey)}"
        data-governance-action="select-squad"
        aria-current="${selected ? 'true' : 'false'}"
        title="${escapeHtml(s.attentionHint || s.meaning || `Switch scope to ${s.squadName || s.projectKey}`)}">
        <span class="gov-exception-rail-name">${escapeHtml(s.squadName || s.projectKey)}</span>
        <span class="gov-exception-rail-state">${escapeHtml(s.attentionLabel || '')}</span>
        ${trust}
        <span class="gov-exception-rail-meaning">${escapeHtml(s.meaning || s.attentionHint || '')}</span>
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
  if (!root || root.dataset.exceptionRailBound === '1') return;
  root.dataset.exceptionRailBound = '1';
  root.addEventListener('click', (ev) => {
    const row = ev.target?.closest?.('[data-governance-action="select-squad"][data-squad-key]');
    if (!row) return;
    const key = String(row.getAttribute('data-squad-key') || '').trim().toUpperCase();
    if (!key) return;
    if (typeof onSelectSquad === 'function') onSelectSquad(key);
  });
}
