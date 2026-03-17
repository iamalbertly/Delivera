import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

export const KPI_TREND_VISIBILITY_HINT = 'For trend visibility and decision support, not for ranking teams.';

export function renderKPICard(options) {
  const {
    label,
    value,
    unit = '',
    target = '',
    targetLabel = '',
    status = 'no-data',
    detailHref = '',
    trendHtml = '',
    trustBadge,
  } = options || {};

  const hasLink = Boolean(detailHref);
  const wrapStart = hasLink
    ? `<a href="${escapeHtml(detailHref)}" class="hud-card-link" style="text-decoration:none;color:inherit;display:block;">`
    : '';
  const wrapEnd = hasLink ? '</a>' : '';

  const valueText = value === null || value === undefined || Number.isNaN(Number(value))
    ? 'No data'
    : escapeHtml(String(value));

  const unitHtml = unit ? `<span class="metric-unit">${escapeHtml(unit)}</span>` : '';
  const targetText = targetLabel || target;
  const targetHtml = targetText ? `<div class="metric-target">${escapeHtml(String(targetText))}</div>` : '';
  const trendBlock = trendHtml ? `<div class="metric-trend">${trendHtml}</div>` : '';

  let trustHtml = '';
  if (trustBadge && trustBadge.label) {
    const toneClass = trustBadge.tone || 'neutral';
    const title = trustBadge.tooltip ? ` title="${escapeHtml(trustBadge.tooltip)}"` : '';
    trustHtml = `<span class="metric-trust metric-trust-${escapeHtml(toneClass)}"${title}>${escapeHtml(trustBadge.label)}</span>`;
  }

  return `
    ${wrapStart}<div class="hud-card kpi-card kpi-card-status-${escapeHtml(status || 'no-data')}">
      <div class="metric-label-row">
        <div class="metric-label">${escapeHtml(label || '')}</div>
        ${trustHtml}
      </div>
      <div class="metric-value-row">
        <div class="metric-value">${valueText}${unitHtml}</div>
      </div>
      ${targetHtml}
      ${trendBlock}
    </div>${wrapEnd}
  `;
}

