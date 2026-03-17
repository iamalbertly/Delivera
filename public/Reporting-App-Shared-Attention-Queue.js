import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

export function renderAttentionQueue({ title = 'Attention queue', items = [], compact = false } = {}) {
  const safeItems = (Array.isArray(items) ? items : []).filter((item) => item && item.label);
  if (!safeItems.length) return '';
  const rows = safeItems.slice(0, compact ? 3 : 5).map((item) => {
    const tone = item.tone ? ` attention-queue-item--${escapeHtml(item.tone)}` : '';
    const attrs = item.action ? ` data-attention-action="${escapeHtml(item.action)}"` : '';
    const tag = item.action ? 'button type="button"' : 'div';
    const sub = item.detail ? `<span class="attention-queue-item-detail">${escapeHtml(item.detail)}</span>` : '';
    return `<${tag} class="attention-queue-item${tone}"${attrs}><span class="attention-queue-item-label">${escapeHtml(item.label)}</span>${sub}</${item.action ? 'button' : 'div'}>`;
  }).join('');
  const titleHtml = title ? `<div class="attention-queue-title">${escapeHtml(title)}</div>` : '';
  return `<section class="attention-queue${compact ? ' attention-queue--compact' : ''}" aria-label="${escapeHtml(title || 'Attention queue')}">${titleHtml}<div class="attention-queue-list">${rows}</div></section>`;
}
