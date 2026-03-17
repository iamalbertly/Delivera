import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

export function renderAttentionQueue({ title = 'Attention queue', items = [] } = {}) {
  const safeItems = (Array.isArray(items) ? items : []).filter((item) => item && item.label);
  if (!safeItems.length) return '';
  const rows = safeItems.slice(0, 5).map((item) => {
    const tone = item.tone ? ` attention-queue-item--${escapeHtml(item.tone)}` : '';
    const attrs = item.action ? ` data-attention-action="${escapeHtml(item.action)}"` : '';
    const tag = item.action ? 'button type="button"' : 'div';
    const sub = item.detail ? `<span class="attention-queue-item-detail">${escapeHtml(item.detail)}</span>` : '';
    return `<${tag} class="attention-queue-item${tone}"${attrs}><span class="attention-queue-item-label">${escapeHtml(item.label)}</span>${sub}</${item.action ? 'button' : 'div'}>`;
  }).join('');
  return `<section class="attention-queue" aria-label="${escapeHtml(title)}"><div class="attention-queue-title">${escapeHtml(title)}</div><div class="attention-queue-list">${rows}</div></section>`;
}
