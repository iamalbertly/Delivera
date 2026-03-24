import { renderContextSummaryStrip } from './Reporting-App-Shared-Context-Summary-Strip.js';
import { renderAttentionQueue } from './Reporting-App-Shared-Attention-Queue.js';
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

/**
 * Shared "ContextBar" renderer: one-line context + optional attention queue.
 *
 * Intended usage:
 * - Report / Current Sprint / Leadership renderers should build the same chip grammar:
 *   Projects • Range • Rules • Freshness (plus optional Trust/Repair signal).
 * - Keep this bar the SSOT; other "context" duplicates should be hidden or removed.
 */

export function renderContextBar({ title = 'Current performance window', chips = [], secondary = '', actions = [], attention = null } = {}) {
  const strip = renderContextSummaryStrip({ title, chips, secondary, actions });
  const attentionHtml = attention && Array.isArray(attention.items)
    ? renderAttentionQueue({ title: attention.title || 'Attention queue', items: attention.items, compact: attention.compact !== false })
    : '';
  return ''
    + '<section class="app-context-bar preview-context-bar" aria-label="' + escapeHtml(title || 'Context') + '">'
    + strip
    + (attentionHtml ? `<div class="app-context-bar-attention">${attentionHtml}</div>` : '')
    + '</section>';
}

export function chip(label, value, { action = '', tone = '' } = {}) {
  return {
    label: String(label || '').trim(),
    value: value == null ? '' : String(value).trim(),
    action: action ? String(action) : '',
    tone: tone ? String(tone) : '',
  };
}

export function action(label, actionName) {
  return { label: String(label || '').trim(), action: String(actionName || '').trim() };
}

/**
 * Convenience: render a compact freshness badge as a chip value.
 */
export function freshnessChip(label, { tone = '' } = {}) {
  const safe = String(label || '').trim();
  const html = safe ? `<span class="data-state-badge ${escapeHtml(tone)}">${escapeHtml(safe)}</span>` : '';
  return chip('Freshness', html, { tone: 'muted' });
}

