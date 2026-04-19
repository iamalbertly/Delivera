import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

/**
 * Returns HTML for a consistent empty-state block (title, message, optional hint, optional CTA).
 * SSOT for empty-state structure across Report, Current Sprint, and Leadership.
 * @param {string} title - Empty state title
 * @param {string} message - Main message
 * @param {string} [hint] - Optional hint text
 * @param {string} [ctaLabel] - Optional CTA button label (e.g. "Adjust filters"); renders button with data-action="adjust-filters" or link if ctaHref provided
 * @param {{ href?: string, extraHtml?: string }} [options] - Optional: href for CTA link; extraHtml for secondary actions (trusted HTML from this module only)
 * @returns {string} Safe HTML fragment for the empty-state div
 */
export function renderEmptyStateHtml(title, message, hint = '', ctaLabel = '', options = {}) {
  const hintHtml = (hint && String(hint).trim()) ? `<p><small>${escapeHtml(hint)}</small></p>` : '';
  const href = options && options.href;
  const extraHtml = options && options.extraHtml ? String(options.extraHtml) : '';
  const ctaHtml = (ctaLabel && String(ctaLabel).trim())
    ? href
      ? `<p><a href="${escapeHtml(href)}" class="btn btn-primary btn-compact">${escapeHtml(ctaLabel)}</a></p>`
      : `<p><button type="button" class="btn btn-primary btn-compact" data-action="adjust-filters">${escapeHtml(ctaLabel)}</button></p>`
    : '';
  return (
    '<div class="empty-state alert-info">' +
    '<p><strong>' + escapeHtml(title) + '</strong></p>' +
    '<p>' + escapeHtml(message) + '</p>' +
    hintHtml +
    ctaHtml +
    extraHtml +
    '</div>'
  );
}

export function renderNoActiveSprintEmptyState(projectsCsv = '') {
  const projects = String(projectsCsv || '').trim();
  const outcomeProjectsAttr = projects ? ` data-outcome-projects="${escapeHtml(projects)}"` : '';
  const extraHtml = (
    '<p class="empty-state-secondary-actions">'
    + '<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal'
    + ' data-outcome-context="No active sprint — capture the next piece of work to track."'
    + outcomeProjectsAttr
    + '>Create work</button>'
    + '</p>'
  );
  return renderEmptyStateHtml(
    'No active sprint',
    'No active sprint for this board.',
    'Pick a recent sprint or start work in Jira.',
    'Pick a board',
    { extraHtml },
  );
}

export function renderNoIssuesForContextEmptyState() {
  return renderEmptyStateHtml(
    'No issues for this context',
    'No issues were returned for the current sprint context.',
    'Add stories in Jira or pick a different board.',
    'Pick a board',
  );
}

export function renderNoBoardsForRangeEmptyState() {
  return renderEmptyStateHtml(
    'No boards for this project/range',
    'No boards were returned for the selected project set and date range.',
    'Open filters and widen the range or change projects.',
    'Open filters',
  );
}

export function renderNoProjectsSelectedEmptyState() {
  return renderEmptyStateHtml(
    'No projects selected',
    'Open Report, choose projects, and run a preview.',
    'This page will adopt that context automatically.',
    'Open report',
    { href: '/report' },
  );
}

/**
 * Compact inline data-availability strip: explains why sections are hidden without hijacking the page.
 * Shows first 2 items visible; remaining items are collapsed behind a "+N more" toggle.
 * @param {{ title?: string, items?: Array<{label?: string, reason?: string, source?: string}> }} options
 * @returns {string}
 */
export function renderDataAvailabilitySummaryHtml(options = {}) {
  const items = Array.isArray(options.items) ? options.items.filter(Boolean) : [];
  if (!items.length) return '';

  const MAX_VISIBLE = 2;
  const visibleItems = items.slice(0, MAX_VISIBLE);
  const overflowItems = items.slice(MAX_VISIBLE);
  const overflowCount = overflowItems.length;

  function buildChip(item) {
    const label = String(item.label || '').trim();
    if (!label) return '';
    const reason = String(item.reason || '').trim();
    const reasonText = reason ? ` — ${escapeHtml(reason)}` : '';
    const titleAttr = reason ? ` title="${escapeHtml(reason)}"` : '';
    return `<span class="data-availability-chip"${titleAttr}>${escapeHtml(label)}</span>${reasonText}`;
  }

  const visibleChips = visibleItems.map(buildChip).filter(Boolean);
  if (!visibleChips.length) return '';

  const overflowId = 'da-overflow-' + Math.random().toString(36).slice(2, 7);
  let overflowHtml = '';
  if (overflowCount > 0) {
    const overflowChips = overflowItems.map(buildChip).filter(Boolean).join(' · ');
    overflowHtml = ` <button type="button" class="data-availability-more-btn" aria-expanded="false" aria-controls="${overflowId}" data-overflow-count="${overflowCount}">+${overflowCount} more</button>`
      + `<span class="data-availability-overflow" id="${overflowId}" hidden> · ${overflowChips}</span>`;
  }

  return (
    '<div class="data-availability-inline" role="status" aria-live="polite">'
    + '<span class="data-availability-label">Data availability:</span> '
    + visibleChips.join(' · ')
    + overflowHtml
    + ' <a href="#" class="data-availability-why" tabindex="0" title="Data is hidden when there are no epics with usable timing, or hygiene thresholds are not met">[Why?]</a>'
    + '</div>'
  );
}
