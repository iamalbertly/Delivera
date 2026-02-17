/**
 * Report preview meta and status HTML builder. SSOT for buildPreviewMetaAndStatus.
 */
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDateForDisplay } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { buildJiraIssueUrl } from './Reporting-App-Report-Utils-Jira-Helpers.js';
import { REPORT_LAST_RUN_KEY } from './Reporting-App-Shared-Storage-Keys.js';
import { buildActiveFiltersContextLabel } from './Reporting-App-Shared-Context-From-Storage.js';

function buildGeneratedLabels(generatedAt) {
  const generatedMs = generatedAt ? new Date(generatedAt).getTime() : Date.now();
  const ageMs = Date.now() - generatedMs;
  const generatedShort = generatedAt
    ? new Date(generatedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const recent = ageMs >= 0 && ageMs < 3600000;
  const ageMin = Math.max(0, Math.round(ageMs / 60000));
  // UX Fix #1: Human-readable freshness — no developer-speak [Cached]/[Live] brackets
  const label = recent
    ? (ageMin < 1 ? 'Updated just now' : `Updated ${ageMin} min ago`)
    : `Updated: ${generatedShort}`;
  const stickySuffix = generatedAt
    ? (ageMin < 1 ? ' | Updated just now' : ` | Updated ${ageMin} min ago`)
    : '';
  return { label, stickySuffix, ageMin, isRecent: recent };
}

/**
 * @param {{ meta: object, previewRows?: array, boardsCount: number, sprintsCount: number, rowsCount: number, unusableCount: number }} params
 * @returns {{ reportSubtitleText: string, appliedFiltersText: string, outcomeLineHTML: string, previewMetaHTML: string, stickyText: string, statusHTML: string, statusDisplay: string }}
 */
export function buildPreviewMetaAndStatus(params) {
  const { meta, previewRows = [], boardsCount, sprintsCount, rowsCount, unusableCount } = params;
  const windowStartLocal = formatDateForDisplay(meta.windowStart);
  const windowEndLocal = formatDateForDisplay(meta.windowEnd);
  const windowStartUtc = meta.windowStart ? new Date(meta.windowStart).toUTCString() : '';
  const windowEndUtc = meta.windowEnd ? new Date(meta.windowEnd).toUTCString() : '';
  const fromCache = meta.fromCache === true;
  const partial = meta.partial === true;
  const partialReason = meta.partialReason || '';
  const reducedScope = meta.reducedScope === true;
  const previewMode = meta.previewMode || 'normal';
  const timedOut = meta.timedOut === true;
  const recentSplitDays = typeof meta.recentSplitDays === 'number' ? meta.recentSplitDays : null;
  const recentCutoffDate = meta.recentCutoffDate ? new Date(meta.recentCutoffDate) : null;
  const elapsedMs = typeof meta.elapsedMs === 'number' ? meta.elapsedMs : null;
  const cachedElapsedMs = typeof meta.cachedElapsedMs === 'number' ? meta.cachedElapsedMs : null;

  const detailsLines = [];
  if (elapsedMs != null) detailsLines.push(`Elapsed: ~${Math.round(elapsedMs / 1000)}s`);
  if (fromCache && meta.cacheAgeMinutes !== undefined) detailsLines.push(`Cache age: ${meta.cacheAgeMinutes} min`);
  if (cachedElapsedMs != null) detailsLines.push(`Original run: ~${Math.round(cachedElapsedMs / 1000)}s`);
  if (previewMode && previewMode !== 'normal') {
    const modeLabel = previewMode === 'recent-only'
      ? 'Recent-only (last 2 weeks)'
      : (previewMode === 'recent-first' ? 'Recent-first (recent data prioritized)' : previewMode);
    detailsLines.push(`Preview mode: ${modeLabel}`);
  }
  if (timedOut) detailsLines.push('Time budget: hit (preview returned partial data before full completion)');
  if (recentSplitDays && recentCutoffDate && !Number.isNaN(recentCutoffDate.getTime())) {
    detailsLines.push(`Recent window: last ${recentSplitDays} days (from ${recentCutoffDate.toUTCString()})`);
  }
  if (meta.fieldInventory) {
    const foundCount = Array.isArray(meta.fieldInventory.ebmFieldsFound) ? meta.fieldInventory.ebmFieldsFound.length : 0;
    const missingCount = Array.isArray(meta.fieldInventory.ebmFieldsMissing) ? meta.fieldInventory.ebmFieldsMissing.length : 0;
    detailsLines.push(`EBM fields found: ${foundCount}, missing: ${missingCount}`);
  }
  if (!meta.discoveredFields?.storyPointsFieldId) detailsLines.push('Story Points: not configured (SP metrics show N/A)');
  if (!meta.discoveredFields?.epicLinkFieldId) detailsLines.push('Epic Links: not configured (Epic rollups limited)');

  const partialNotice = partial
    ? '<br><span class="partial-warning">Partial data: this preview hit a time limit. Export shows exactly what you see; try a smaller range for full history.</span>'
    : '';

  const selectedProjectsLabel = meta.selectedProjects?.length > 0 ? meta.selectedProjects.join(', ') : 'None';
  const sampleRow = previewRows && previewRows.length > 0 ? previewRows[0] : null;
  let sampleLabel = 'None';
  if (sampleRow) {
    const host = meta.jiraHost || meta.host || '';
    const sampleKey = sampleRow.issueKey || '';
    const sampleSummary = sampleRow.issueSummary || '';
    const url = buildJiraIssueUrl(host, sampleKey);
    const keyText = escapeHtml(sampleKey);
    const summaryText = escapeHtml(sampleSummary);
    sampleLabel = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${keyText}</a> - ${summaryText}`
      : `${keyText} - ${summaryText}`;
  }

  const reportSubtitleText = `Projects: ${selectedProjectsLabel} | ${windowStartLocal} to ${windowEndLocal}`;
  const opts = [];
  if (meta.requireResolvedBySprintEnd) opts.push('Require resolved by sprint end');
  if (meta.includePredictability) opts.push('Include Predictability');
  const appliedFiltersText = `Applied: ${selectedProjectsLabel} | ${windowStartLocal} - ${windowEndLocal}${opts.length ? ' | ' + opts.join(', ') : ''}`;

  const partialSuffix = partial ? ' (partial)' : '';
  let prevRunHtml = '';
  try {
    const lastRun = sessionStorage.getItem(REPORT_LAST_RUN_KEY);
    if (lastRun) {
      const obj = JSON.parse(lastRun);
      const prevStories = typeof obj.doneStories === 'number' ? obj.doneStories : 0;
      const prevSprints = typeof obj.sprintsCount === 'number' ? obj.sprintsCount : 0;
      prevRunHtml = '<span class="preview-previous-run" aria-live="polite"> Previous run: ' + prevStories + ' done stories, ' + prevSprints + ' sprints.</span>';
    }
  } catch (_) {}
  const outcomeLineHTML = escapeHtml(rowsCount + ' done stories | ' + sprintsCount + ' sprints | ' + boardsCount + ' boards in window' + partialSuffix) + prevRunHtml;

  const phaseLog = Array.isArray(meta.phaseLog) ? meta.phaseLog : [];
  const phaseLogHtml = phaseLog.length > 0
    ? '<br><strong>Phase log:</strong> ' + phaseLog.map((p) => escapeHtml((p.phase || '') + (p.at ? ' @ ' + p.at : ''))).join(' | ')
    : '';
  let metaSummaryWhy = '';
  if (partial) metaSummaryWhy = partialReason ? ` | Partial: ${partialReason}` : ' | Partial: time limit';
  else if (timedOut) metaSummaryWhy = ' | Time limit reached (partial data)';
  else if (previewMode === 'recent-first') metaSummaryWhy = ' | Recent live; older from cache';

  // UX Fix #1: Human-readable data state — replace [Cached]/[Live] developer-speak with
  // freshness signals that communicate data reality to business users, not engineers.
  const generated = buildGeneratedLabels(meta.generatedAt);
  const ageMin = generated.ageMin;
  let dataStateLabel = 'Live';
  let dataStateKind = 'live';
  if (reducedScope) {
    dataStateLabel = 'Closest match';
    dataStateKind = 'closest';
  } else if (partial) {
    dataStateLabel = 'Partial data';
    dataStateKind = 'partial';
  } else if (fromCache) {
    // Show actual age instead of opaque "Cached" — users need to know if data is stale
    dataStateLabel = ageMin < 1 ? 'Just updated' : (ageMin < 60 ? `${ageMin} min ago` : 'Over 1h ago');
    dataStateKind = ageMin > 30 ? 'stale' : 'cached';
  }
  if (meta.failedBoardCount && meta.failedBoardCount > 0) {
    const failedBoards = Array.isArray(meta.failedBoards) ? meta.failedBoards : [];
    const boardNames = failedBoards
      .map((b) => b?.boardName || (b?.boardId != null ? `Board ${b.boardId}` : 'Unknown board'))
      .filter(Boolean);
    const suffix = boardNames.length ? ` (${boardNames.join(', ')})` : '';
    detailsLines.push(`Skipped boards: ${meta.failedBoardCount}${suffix}`);
  }
  const outcomeLine = rowsCount + ' done stories | ' + sprintsCount + ' sprints | ' + boardsCount + ' boards in window' + partialSuffix;
  const compactSummaryLine = 'Window coverage: Boards ' + boardsCount + (sprintsCount > 0 ? ' | Sprints ' + sprintsCount : '');
  // UX Fix #1: contextLine = scope info only; freshness and partial/time-limit reasons live in the badge and status banner.
  const activeFiltersLine = buildActiveFiltersContextLabel(selectedProjectsLabel, meta.windowStart, meta.windowEnd);
  const contextLine = escapeHtml(activeFiltersLine);
  // data-state-badge--stale triggers amber warning colour via CSS (> 30 min = stale signal to user)
  const dataStateBadgeHTML = `<span class="data-state-badge data-state-badge--${dataStateKind}" title="Data freshness: ${escapeHtml(generated.label)}">${escapeHtml(dataStateLabel)}</span>`;
  const previewMetaHTML = `
    <div class="meta-info-summary meta-summary-line">
      <div class="meta-outcome-line">${escapeHtml(compactSummaryLine)}</div>
      <div class="meta-context-line">${contextLine} ${dataStateBadgeHTML}</div>
    </div>
    <div class="meta-info meta-info-details">
      <strong>Range (UTC):</strong> ${escapeHtml(windowStartUtc)} to ${escapeHtml(windowEndUtc)}<br>
      <strong>Example story:</strong> ${sampleLabel}<br>
      <strong>Details:</strong> ${escapeHtml(detailsLines.join(' | '))}
      ${phaseLogHtml}
      ${partialNotice}
    </div>
  `;

  const stickyText = `Preview: ${selectedProjectsLabel} | ${windowStartLocal} to ${windowEndLocal}${generated.stickySuffix}`;
  let statusHTML = '';
  let statusDisplay = 'none';
  if (rowsCount > 0 && (partial || previewMode !== 'normal' || reducedScope)) {
    let bannerMessage;
    if (reducedScope) {
      bannerMessage = meta.failedBoardCount > 0
        ? `Showing available data. ${meta.failedBoardCount} board(s) could not return sprint history; use Retry preview or narrow filters.`
        : 'Showing closest available data for your selection. Use Full refresh for exact filters.';
    } else if (partial) {
      bannerMessage = 'Partial data: preview hit a time limit. Export shows what you see now; narrow the dates for full history.';
    } else if (previewMode === 'recent-first' || previewMode === 'recent-only' || recentSplitDays) {
      const days = recentSplitDays || 14;
      bannerMessage = `Faster mode: latest ${days} days live, older sprints from cache. Export matches what you see.`;
    } else {
      bannerMessage = 'Faster mode: preview optimized for speed. Export matches the on-screen data; run Full refresh if you need a fully fresh history.';
    }
    statusHTML = `
      <div class="status-banner warning alert-warning">
        <div class="status-banner-message">${escapeHtml(bannerMessage)}</div>
        <button type="button" class="status-close" aria-label="Dismiss">x</button>
      </div>
    `;
    statusDisplay = 'block';
  }
  return { reportSubtitleText, appliedFiltersText, outcomeLineHTML, previewMetaHTML, stickyText, statusHTML, statusDisplay };
}



