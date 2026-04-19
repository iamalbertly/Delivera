import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

function renderChip(chip) {
  const label = escapeHtml(chip?.label || '');
  const value = escapeHtml(chip?.value || '');
  const text = value ? `${label}: ${value}` : label;
  const action = chip?.action
    ? ` data-context-action="${escapeHtml(chip.action)}" data-preview-context-action="${escapeHtml(chip.action)}"`
    : '';
  const tone = chip?.tone ? ` context-summary-chip--${escapeHtml(chip.tone)}` : '';
  const tag = chip?.action ? 'button' : 'span';
  const typeAttr = chip?.action ? ' type="button"' : '';
  return `<${tag}${typeAttr} class="context-summary-chip${tone}"${action}>${text}</${tag}>`;
}

export function renderContextSummaryStrip({ title = '', chips = [], secondary = '', actions = [], stripAriaLabel = 'Current performance window' } = {}) {
  const chipHtml = (Array.isArray(chips) ? chips : []).map(renderChip).join('');
  const actionsHtml = (Array.isArray(actions) ? actions : [])
    .map((action) => `<button type="button" class="context-summary-inline-action" data-context-action="${escapeHtml(action.action || '')}">${escapeHtml(action.label || '')}</button>`)
    .join('');
  return ''
    + '<section class="context-summary-strip" data-context-summary-strip="true" aria-label="' + escapeHtml(stripAriaLabel) + '">'
    + (title ? `<div class="context-summary-title">${escapeHtml(title)}</div>` : '')
    + (chipHtml ? `<div class="context-summary-chips">${chipHtml}</div>` : '')
    + (secondary || actionsHtml
      ? '<div class="context-summary-meta">'
        + (secondary ? `<span class="context-summary-secondary">${escapeHtml(secondary)}</span>` : '')
        + (actionsHtml ? `<div class="context-summary-actions">${actionsHtml}</div>` : '')
        + '</div>'
      : '')
    + '</section>';
}
