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
} from './Reporting-App-Shared-Storage-Keys.js';

const FRESHNESS_STALE_THRESHOLD_MS = 30 * 60 * 1000;
const CONTEXT_SEPARATOR = ' | ';
const DATE_RANGE_SEPARATOR = ' - ';

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

function formatDateForContext(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function buildReportRangeLabel(startIso, endIso) {
  const startStr = formatDateForContext(startIso);
  const endStr = formatDateForContext(endIso);
  if (!startStr || !endStr) return 'Report range: -';
  return `Report range: ${startStr}${DATE_RANGE_SEPARATOR}${endStr} (UTC)`;
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
    return parts.length ? `Last: ${parts.join(', ')}` : null;
  } catch (_) {
    return null;
  }
}

/**
 * Returns freshness info like { label: 'Generated 3 min ago', isStale: true }
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
    if (diffMs < 60000) return { label: 'Generated just now', isStale };
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return { label: `Generated ${minutes} min ago`, isStale };
    const hours = Math.round(minutes / 60);
    return { label: `Generated ${hours}h ago`, isStale };
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
  const ctx = getValidLastQuery() || getFallbackContext();
  const lastRun = getLastRunSummary();
  const freshnessInfo = getLastMetaFreshnessInfo();
  const freshness = freshnessInfo.label;
  const proj = ctx ? ctx.projects.replace(/,/g, ', ') : '';
  const rangeLabel = ctx ? buildReportRangeLabel(ctx.start, ctx.end) : '';
  const contextPart = rangeLabel
    ? `Active filters: Projects ${proj}${CONTEXT_SEPARATOR}${rangeLabel}`
    : (proj ? `Active filters: Projects ${proj}` : '');
  const freshnessPart = freshness ? `Data freshness: ${freshness}` : '';
  const pieces = [];
  if (lastRun) pieces.push(lastRun);
  if (contextPart) pieces.push(contextPart);
  if (freshnessPart) pieces.push(freshnessPart);
  if (pieces.length) return pieces.join(CONTEXT_SEPARATOR);
  return 'No report run yet';
}

/**
 * Returns HTML for the persistent sidebar context card (selected projects, last generated, freshness).
 * Used on /report, /current-sprint, /leadership. Call renderSidebarContextCard() after DOM ready.
 */
export function getContextCardHtml() {
  const ctx = getValidLastQuery() || getFallbackContext();
  const freshnessInfo = getLastMetaFreshnessInfo();
  const projCount = ctx?.projects ? ctx.projects.split(',').filter(Boolean).length : 0;
  const projectsLabel = projCount ? `Selected: ${projCount} project${projCount !== 1 ? 's' : ''}` : 'No projects selected';
  const lastLabel = freshnessInfo.label || 'No data yet';
  const isStale = freshnessInfo.isStale;
  const freshnessClass = isStale ? 'context-freshness-stale' : 'context-freshness-ok';
  const freshnessText = isStale ? 'Data may be stale (>30 min)' : (freshnessInfo.label ? 'Data freshness: OK' : 'Generate a report');
  const rangeStr = ctx && ctx.start && ctx.end
    ? `${new Date(ctx.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${DATE_RANGE_SEPARATOR}${new Date(ctx.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';
  let html = '<div class="context-card"><h3 class="context-card-title">Context</h3>';
  html += '<p class="context-card-line">' + escapeHtml(projectsLabel) + '</p>';
  html += '<p class="context-card-line">' + escapeHtml(lastLabel) + '</p>';
  if (rangeStr) html += '<p class="context-card-line context-card-range">' + escapeHtml(rangeStr) + '</p>';
  html += '<p class="context-card-line ' + freshnessClass + '" title="' + escapeHtml(freshnessText) + '">' + escapeHtml(freshnessText) + '</p>';
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
