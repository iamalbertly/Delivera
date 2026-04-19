/**
 * Reads and validates cross-page context (last query or projects + date range) for display and auto-run.
 * Used by shared header context bar and Leadership auto-run.
 */
import {
  PROJECTS_SSOT_KEY,
  SHARED_DATE_RANGE_KEY,
  LAST_QUERY_KEY,
  REPORT_LAST_RUN_KEY,
  REPORT_LAST_META_KEY,
  REPORT_FILTERS_STALE_KEY,
} from './Delivera-Shared-Storage-Keys.js';
import { getLiveReportFilterSnapshot } from './Delivera-Report-Page-Filter-Params.js';
import { reportState } from './Delivera-Report-Page-State.js';

const FRESHNESS_STALE_THRESHOLD_MS = 30 * 60 * 1000;
const CONTEXT_SEPARATOR = ' | ';
const DATE_RANGE_SEPARATOR = ' - ';
const CONTEXT_LABEL_ORDER = ['Last', 'Projects', 'Range', 'Freshness', 'Context'];

function parseDate(s) {
  if (typeof s !== 'string' || !s.trim()) return null;
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function isValidRange(start, end) {
  const startD = parseDate(start);
  const endD = parseDate(end);
  if (!startD || !endD) return false;
  return startD.getTime() < endD.getTime();
}

function getFiltersStaleFlag() {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(REPORT_FILTERS_STALE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

/**
 * Returns validated { projects, start, end } from LAST_QUERY_KEY, or null if missing/invalid.
 * Invalid entries are removed from localStorage.
 */
export function getValidLastQuery() {
  try {
    const raw = localStorage.getItem(LAST_QUERY_KEY);
    if (!raw || !raw.trim()) return null;
    const data = JSON.parse(raw);
    const projects = typeof data?.projects === 'string' ? data.projects.trim() : '';
    const start = typeof data?.start === 'string' ? data.start.trim() : '';
    const end = typeof data?.end === 'string' ? data.end.trim() : '';
    if (!projects || !isValidRange(start, end)) {
      localStorage.removeItem(LAST_QUERY_KEY);
      return null;
    }
    return { projects, start, end };
  } catch (_) {
    try {
      localStorage.removeItem(LAST_QUERY_KEY);
    } catch (_) {}
    return null;
  }
}

/**
 * Returns fallback context from PROJECTS_SSOT_KEY + SHARED_DATE_RANGE_KEY if valid.
 */
export function getFallbackContext() {
  try {
    const projects = localStorage.getItem(PROJECTS_SSOT_KEY);
    const rangeRaw = localStorage.getItem(SHARED_DATE_RANGE_KEY);
    if (!projects || !projects.trim() || !rangeRaw || !rangeRaw.trim()) return null;
    const range = JSON.parse(rangeRaw);
    const start = typeof range?.start === 'string' ? range.start.trim() : '';
    const end = typeof range?.end === 'string' ? range.end.trim() : '';
    if (!isValidRange(start, end)) return null;
    return { projects: projects.trim(), start, end };
  } catch (_) {
    return null;
  }
}

export function formatDateForContext(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function buildCompactReportRangeLabel(startIso, endIso) {
  const startStr = formatDateForContext(startIso);
  const endStr = formatDateForContext(endIso);
  if (!startStr || !endStr) return '-';
  return `${startStr}${DATE_RANGE_SEPARATOR}${endStr} (UTC)`;
}

export function buildReportRangeLabel(startIso, endIso) {
  return `Report range: ${buildCompactReportRangeLabel(startIso, endIso)}`;
}

export function buildActiveFiltersContextLabel(projectsCsv, startIso, endIso) {
  const pieces = getContextPieces({
    projects: projectsCsv,
    rangeStart: startIso,
    rangeEnd: endIso,
    lastRun: '',
    freshness: '',
  });
  const summary = buildContextSegmentList(pieces)
    .filter((segment) => segment.label === 'Projects' || segment.label === 'Range')
    .map((segment) => `${segment.label} ${segment.value}`);
  return summary.length ? `Active filters: ${summary.join(CONTEXT_SEPARATOR)}` : 'Active filters';
}

export function getLastRunSummaryLabel() {
  return getLastRunSummary();
}

export function getContextPieces(overrides = {}) {
  const ctx = getValidLastQuery() || getFallbackContext();
  const freshnessInfo = getLastMetaFreshnessInfo();
  const filtersStale = getFiltersStaleFlag();
  const live = getLiveReportFilterSnapshot();

  const projects = typeof overrides.projects === 'string'
    ? overrides.projects.trim()
    : (live?.projectsCsv || ctx?.projects || '');
  const rangeStart = overrides.rangeStart || live?.startIso || ctx?.start || '';
  const rangeEnd = overrides.rangeEnd || live?.endIso || ctx?.end || '';
  const last = overrides.lastRun === undefined ? getLastRunSummary() : overrides.lastRun;
  const freshness = overrides.freshness === undefined ? freshnessInfo.label : overrides.freshness;

  let filtersStaleLabel = 'Selection changed — tap Refresh when ready';
  try {
    if (document.body?.classList?.contains('report-page') && reportState.previewInProgress && filtersStale) {
      filtersStaleLabel = 'Updating preview…';
    }
  } catch (_) {}

  return {
    last,
    projects: projects ? projects.split(',').map((p) => p.trim()).filter(Boolean).join(', ') : '',
    range: rangeStart && rangeEnd ? buildCompactReportRangeLabel(rangeStart, rangeEnd) : '',
    freshness,
    filtersStale,
    filtersStaleLabel,
    freshnessIsStale: overrides.freshnessIsStale === undefined ? freshnessInfo.isStale : !!overrides.freshnessIsStale,
  };
}

export function buildContextSegmentList(pieces) {
  const parts = [];
  const safePieces = pieces || {};

  if (safePieces.last) parts.push({ label: 'Last', value: safePieces.last });
  if (safePieces.projects) parts.push({ label: 'Projects', value: safePieces.projects });
  if (safePieces.range) parts.push({ label: 'Range', value: safePieces.range });
  if (safePieces.freshness) {
    parts.push({
      label: 'Freshness',
      value: safePieces.freshness,
      stateClass: safePieces.freshnessIsStale ? ' is-stale' : ' is-fresh',
    });
  }
  if (safePieces.filtersStale) {
    parts.push({
      label: 'Context',
      value: safePieces.filtersStaleLabel || 'Selection changed — tap Refresh when ready',
      stateClass: ' is-warning',
      isAction: true,
    });
  }

  return parts.sort((a, b) => CONTEXT_LABEL_ORDER.indexOf(a.label) - CONTEXT_LABEL_ORDER.indexOf(b.label));
}

/**
 * Render a pre-built segment list (same markup as {@link renderContextSegments}).
 * Use when the segment set is not derived from {@link buildContextSegmentList}.
 */
export function renderContextPartList(parts, options = {}) {
  const list = Array.isArray(parts) ? parts : [];
  if (!list.length) return '';

  const className = options.className || 'context-segments';
  const segmentClass = options.segmentClass || 'context-segment';
  const refreshAction = options.refreshAction || 'refresh-context';
  const actionsByLabel = options.actionsByLabel || {};
  const listSemantics = options.listSemantics === true;
  const stripAriaLabel = typeof options.stripAriaLabel === 'string' ? options.stripAriaLabel : 'Report and sprint context';
  const containerAriaLabel = typeof options.containerAriaLabel === 'string' ? options.containerAriaLabel : 'Context';

  const outerOpen = listSemantics
    ? '<ul class="' + escapeHtml(className) + '" role="list" aria-label="' + escapeHtml(stripAriaLabel) + '">'
    : '<div class="' + escapeHtml(className) + '" aria-label="' + escapeHtml(containerAriaLabel) + '">';
  const outerClose = listSemantics ? '</ul>' : '</div>';

  let html = outerOpen;
  list.forEach((part) => {
    const stateClass = typeof part.stateClass === 'string' ? part.stateClass : '';
    const actionName = part.isAction
      ? refreshAction
      : (actionsByLabel[part.label] || '');
    const isActionable = !!actionName;
    const tagName = isActionable ? 'button' : 'span';
    const extraAttrs = isActionable
      ? ' type="button" data-context-action="' + escapeHtml(actionName) + '"'
      : '';
    if (listSemantics) html += '<li>';
    html += '<' + tagName + ' class="' + escapeHtml(segmentClass + stateClass + (isActionable ? ' is-actionable' : '')) + '" data-context-segment-label="' + escapeHtml(part.label) + '"' + extraAttrs + '>';
    html += '<span class="' + escapeHtml(segmentClass + '-label') + '">' + escapeHtml(part.label) + '</span>';
    html += '<span class="' + escapeHtml(segmentClass + '-value') + '">' + escapeHtml(part.value) + '</span>';
    html += '</' + tagName + '>';
    if (listSemantics) html += '</li>';
  });
  html += outerClose;
  return html;
}

export function renderContextSegments(pieces, options = {}) {
  const parts = buildContextSegmentList(pieces);
  return renderContextPartList(parts, options);
}

/**
 * Returns last-run summary from sessionStorage when available (for context bar).
 */
function getLastRunSummary() {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(REPORT_LAST_RUN_KEY) : null;
    if (!raw || !raw.trim()) return null;
    const obj = JSON.parse(raw);
    const stories = typeof obj.doneStories === 'number' ? obj.doneStories : null;
    const sprints = typeof obj.sprintsCount === 'number' ? obj.sprintsCount : null;
    if (stories == null && sprints == null) return null;
    const parts = [];
    if (stories != null) parts.push(`${stories} stories`);
    if (sprints != null) parts.push(`${sprints} sprints`);
    return parts.length ? parts.join(', ') : null;
  } catch (_) {
    return null;
  }
}

/**
 * Returns freshness info like { label: 'Updated 3 min ago', isStale: true }
 * based on the last preview meta stored in sessionStorage.
 */
export function getLastMetaFreshnessInfo() {
  try {
    if (typeof sessionStorage === 'undefined') return { label: null, isStale: false };
    const raw = sessionStorage.getItem(REPORT_LAST_META_KEY);
    if (!raw || !raw.trim()) return { label: null, isStale: false };
    const obj = JSON.parse(raw);
    const generatedAt = typeof obj?.generatedAt === 'string' ? obj.generatedAt.trim() : '';
    if (!generatedAt) return { label: null, isStale: false };
    const ts = new Date(generatedAt);
    if (Number.isNaN(ts.getTime())) return { label: null, isStale: false };
    const diffMs = Date.now() - ts.getTime();
    if (diffMs < 0) return { label: null, isStale: false };
    const isStale = diffMs >= FRESHNESS_STALE_THRESHOLD_MS;
    if (diffMs < 60000) return { label: 'Just updated', isStale };
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return { label: `Updated ${minutes} min ago`, isStale };
    const hours = Math.round(minutes / 60);
    return { label: isStale ? 'Older snapshot — refresh when ready' : `Updated ${hours}h ago`, isStale };
  } catch (_) {
    return { label: null, isStale: false };
  }
}

/**
 * Returns a one-line display string for the context bar, or a fallback message.
 * When sessionStorage has last-run data, prepends "Last: X stories, Y sprints | " to projects/range.
 * When preview meta is available, appends a freshness fragment: "Generated N min ago".
 */
export function getContextDisplayString() {
  const parts = buildContextSegmentList(getContextPieces()).map((segment) => `${segment.label}: ${segment.value}`);
  if (parts.length) return parts.join(CONTEXT_SEPARATOR);
  return 'No report run yet';
}

/**
 * Returns HTML for the persistent sidebar context card (selected projects, last generated, freshness).
 * Used on /report, /current-sprint, /leadership. Call renderSidebarContextCard() after DOM ready.
 */
export function getContextCardHtml() {
  const pieces = getContextPieces();
  const isReportPage = typeof document !== 'undefined' && document.body?.classList?.contains('report-page');
  const previewActive = isReportPage && typeof document !== 'undefined' && document.body?.classList?.contains('preview-active');

  let html = '<div class="context-card' + (previewActive ? ' context-card--report-preview-compact' : '') + '"><h3 class="context-card-title">Context</h3>';

  if (previewActive) {
    const compactParts = [];
    if (pieces.filtersStale) {
      compactParts.push({
        label: 'Context',
        value: pieces.filtersStaleLabel || 'Selection changed — tap Refresh when ready',
        stateClass: ' is-warning',
        isAction: true,
      });
    }
    if (pieces.freshness) {
      compactParts.push({
        label: 'Freshness',
        value: pieces.freshness,
        stateClass: pieces.freshnessIsStale ? ' is-stale' : ' is-fresh',
      });
    }
    const hint = '<p class="context-card-hint context-card-hint--compact" role="note">'
      + escapeHtml('Scope and dates match the summary under the title. Use the Performance history row for outcomes; open Details for timing and cache info.')
      + '</p>';
    const segHtml = renderContextPartList(compactParts, {
      className: 'context-card-segments context-card-segments--report-preview',
      segmentClass: 'context-card-segment',
      actionsByLabel: isReportPage ? { Freshness: 'explain-freshness' } : {},
      containerAriaLabel: 'Trust signals',
      stripAriaLabel: 'Trust signals',
    });
    const fallback = '<p class="context-card-line">Preview loaded — open Filters to adjust scope.</p>';
    html += hint + (segHtml || fallback);
  } else {
    html += renderContextSegments(pieces, {
      className: 'context-card-segments',
      segmentClass: 'context-card-segment',
      actionsByLabel: isReportPage
        ? {
          Projects: 'open-project-filters',
          Range: 'open-range-filters',
          Freshness: 'explain-freshness',
        }
        : {},
    }) || '<p class="context-card-line">No report run yet</p>';
  }
  html += '</div>';
  return html;
}

function escapeHtml(s) {
  if (s == null) return '';
  const str = String(s);
  const div = typeof document !== 'undefined' && document.createElement('div');
  if (div) {
    div.textContent = str;
    return div.innerHTML;
  }
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderSidebarContextCard() {
  const el = document.getElementById('sidebar-context-card');
  if (el) el.innerHTML = getContextCardHtml();
}
