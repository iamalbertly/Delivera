import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

/**
 * Shared renderer for the 4-tile health/trust strip used in:
 * - Governance baseline wizard (PIBaseline trust strip)
 * - Settings AI helper (processing intelligence health)
 *
 * tiles: [{ label: string, value: string|number, lineBreak?: boolean }]
 */
export function renderHealthTileStrip(tiles = [], { ariaLabel = '', role = 'status' } = {}) {
  const list = (Array.isArray(tiles) ? tiles : []).filter((t) => t && t.label != null && t.value != null);
  if (!list.length) return '';

  const attrs = ariaLabel
    ? `aria-label="${escapeHtml(ariaLabel)}"`
    : `role="${escapeHtml(role)}"`;

  const spans = list.map((t) => {
    const line = t.lineBreak ? '<br>' : ' ';
    return `<span><strong>${escapeHtml(String(t.label))}</strong>${line}${escapeHtml(String(t.value))}</span>`;
  }).join('');

  return `<div class="gov-baseline-trust-strip" ${attrs}>${spans}</div>`;
}

