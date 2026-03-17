/**
 * Report preview meta and status HTML builder. SSOT for buildPreviewMetaAndStatus.
 */
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDateForDisplay } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { buildJiraIssueUrl } from './Reporting-App-Report-Utils-Jira-Helpers.js';
import { REPORT_LAST_RUN_KEY } from './Reporting-App-Shared-Storage-Keys.js';
import { buildCompactReportRangeLabel } from './Reporting-App-Shared-Context-From-Storage.js';
import { deriveOutcomeRiskFromPreviewRows } from './Reporting-App-Shared-Outcome-Risk-Semantics.js';

function summarizeProjectsList(projects) {
  const list = Array.isArray(projects)
    ? projects.map((p) => String(p || '').trim()).filter(Boolean)
    : [];
  if (list.length === 0) return { label: 'None', full: 'None' };
  if (list.length <= 2) return { label: list.join(', '), full: list.join(', ') };
  return { label: `${list[0]}, ${list[1]} +${list.length - 2}`, full: list.join(', ') };
}

function buildGeneratedLabels(generatedAt) {
  const generatedMs = generatedAt ? new Date(generatedAt).getTime() : Date.now();
  const ageMs = Date.now() - generatedMs;
  const generatedShort = generatedAt
    ? new Date(generatedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const recent = ageMs >= 0 && ageMs < 3600000;
  const ageMin = Math.max(0, Math.round(ageMs / 60000));
  const label = recent
    ? (ageMin < 1 ? 'Updated just now' : `Updated ${ageMin} min ago`)
    : `Updated: ${generatedShort}`;
  const stickySuffix = generatedAt
    ? (ageMin < 1 ? ' | Updated just now' : ` | Updated ${ageMin} min ago`)
    : '';
  return { label, stickySuffix, ageMin, isRecent: recent };
}

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
  if (meta.requireResolvedBySprintEnd) detailsLines.push('Done stories rule: resolved by sprint end only (strict mode)');

  const partialNotice = partial
    ? '<br><span class="partial-warning">Partial data: this preview hit a time limit. Export shows exactly what you see; try a smaller range for full history.</span>'
    : '';

  const selectedProjectsLabel = meta.selectedProjects?.length > 0 ? meta.selectedProjects.join(', ') : 'None';
  const projectSummary = summarizeProjectsList(meta.selectedProjects);
  const compactRangeLabel = buildCompactReportRangeLabel(meta.windowStart, meta.windowEnd);
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

  let prevRunText = '';
  try {
    const lastRun = sessionStorage.getItem(REPORT_LAST_RUN_KEY);
    if (lastRun) {
      const obj = JSON.parse(lastRun);
      const prevStories = typeof obj.doneStories === 'number' ? obj.doneStories : 0;
      const prevSprints = typeof obj.sprintsCount === 'number' ? obj.sprintsCount : 0;
      prevRunText = `Previous run: ${prevStories} done stories, ${prevSprints} sprints.`;
    }
  } catch (_) {}

  const generated = buildGeneratedLabels(meta.generatedAt);
  let dataStateLabel = 'Just updated';
  let dataStateKind = 'live';
  if (reducedScope) {
    dataStateLabel = 'Closest match';
    dataStateKind = 'closest';
  } else if (partial) {
    dataStateLabel = 'Unavailable';
    dataStateKind = 'partial';
  } else if (fromCache) {
    const ageMin = generated.ageMin;
    if (ageMin < 1) {
      dataStateLabel = 'Just updated';
      dataStateKind = 'cached';
    } else if (ageMin <= 30) {
      dataStateLabel = `Updated ${ageMin} min ago`;
      dataStateKind = 'cached';
    } else {
      dataStateLabel = 'Stale - refresh recommended';
      dataStateKind = 'stale';
    }
  }
  const dataStateBadgeHTML = `<span class="data-state-badge data-state-badge--${dataStateKind}" title="Data freshness: ${escapeHtml(generated.label)}">${escapeHtml(dataStateLabel)}</span>`;
  const riskCounts = deriveOutcomeRiskFromPreviewRows(previewRows);
  const blockersOwned = Number(riskCounts.blockersOwned || 0);
  const unownedOutcomes = Number(riskCounts.unownedOutcomes || 0);
  const exportLabel = rowsCount > 0 ? 'Export ready' : 'No data yet';

  let healthSentence;
  let zeroOutcomeHint = '';
  if (rowsCount === 0) {
    healthSentence = 'No outcome stories in this window (maintenance-only work)';
    zeroOutcomeHint = '<p class="preview-context-zero-hint">Define outcome labels or epic links in Jira to see outcome metrics here.</p>';
  } else {
    const riskParts = [];
    if (blockersOwned > 0) riskParts.push(`${blockersOwned} blocker${blockersOwned > 1 ? 's' : ''}`);
    if (unownedOutcomes > 0) riskParts.push(`${unownedOutcomes} unowned`);
    healthSentence = `${rowsCount} stor${rowsCount === 1 ? 'y' : 'ies'} | ${sprintsCount} sprint${sprintsCount === 1 ? '' : 's'} | ${boardsCount} board${boardsCount === 1 ? '' : 's'}`
      + (riskParts.length ? ' | ' + riskParts.join(' | ') : '');
  }

  const detailsHintParts = [];
  if (meta.requireResolvedBySprintEnd) detailsHintParts.push('Strict end-of-sprint rule enabled');
  if (!meta.discoveredFields?.storyPointsFieldId) detailsHintParts.push('Story points unavailable');
  if (!meta.discoveredFields?.epicLinkFieldId) detailsHintParts.push('Epic rollups unavailable');
  if (prevRunText) detailsHintParts.push(prevRunText);
  if (!rowsCount) detailsHintParts.push(exportLabel);
  const detailsHint = detailsHintParts.join(' | ');
  const healthRisk = blockersOwned > 0 || unownedOutcomes > 0;
  const healthChipExtra = healthRisk ? ' preview-context-chip-health--risk' : '';

  const outcomeLineHTML =
    '<div class="preview-context-bar" data-context-bar="true" role="group" aria-label="Report preview context and outcome">' +
      '<span class="preview-context-chip preview-context-chip-title preview-context-chip-muted">Performance history</span>' +
      '<button type="button" class="preview-context-chip preview-context-chip-link preview-context-chip-scope" data-preview-context-action="open-projects" title="' + escapeHtml('Projects: ' + projectSummary.full) + '" aria-label="Open project filters">Projects: ' + escapeHtml(projectSummary.label) + '<span class="visually-hidden"> Projects full list: ' + escapeHtml(projectSummary.full) + '</span></button>' +
      '<button type="button" class="preview-context-chip preview-context-chip-link preview-context-chip-scope" data-preview-context-action="open-range" title="' + escapeHtml('Range: ' + compactRangeLabel) + '" aria-label="Open date range">' + escapeHtml(compactRangeLabel) + '</button>' +
      '<button type="button" class="preview-context-chip preview-context-chip-link preview-context-chip-health' + healthChipExtra + '" data-preview-context-action="open-done-stories" aria-label="Open outcome list">' + escapeHtml(healthSentence) + '</button>' +
      '<span class="preview-context-chip preview-context-chip-data-state">' + dataStateBadgeHTML + '</span>' +
      '<button type="button" class="preview-context-chip preview-context-chip-link preview-context-details-toggle" aria-expanded="false" aria-controls="preview-meta-details" title="' + escapeHtml(detailsHint || 'Show range, timing and data mode details') + '">Details</button>' +
    '</div>' +
    zeroOutcomeHint;

  const phaseLog = Array.isArray(meta.phaseLog) ? meta.phaseLog : [];
  const phaseLogHtml = phaseLog.length > 0
    ? '<br><strong>Phase log:</strong> ' + phaseLog.map((p) => escapeHtml((p.phase || '') + (p.at ? ' @ ' + p.at : ''))).join(' | ')
    : '';

  if (meta.failedBoardCount && meta.failedBoardCount > 0) {
    const failedBoards = Array.isArray(meta.failedBoards) ? meta.failedBoards : [];
    const boardNames = failedBoards
      .map((b) => b?.boardName || (b?.boardId != null ? `Board ${b.boardId}` : 'Unknown board'))
      .filter(Boolean);
    const suffix = boardNames.length ? ` (${boardNames.join(', ')})` : '';
    detailsLines.push(`Skipped boards: ${meta.failedBoardCount}${suffix}`);
  }

  const previewMetaHTML = `
    <div class="meta-info meta-info-details" id="preview-meta-details" hidden>
      <strong>Range (UTC):</strong> ${escapeHtml(windowStartUtc)} to ${escapeHtml(windowEndUtc)}<br>
      <strong>Example story:</strong> ${sampleLabel}<br>
      <strong>Scope:</strong> ${escapeHtml(exportLabel)}${detailsHint ? ` | ${escapeHtml(detailsHint)}` : ''}<br>
      <strong>Details:</strong> ${escapeHtml(detailsLines.join(' | '))}
      ${phaseLogHtml}
      ${partialNotice}
    </div>
  `;

  const stickyText = `Preview: ${selectedProjectsLabel} | ${compactRangeLabel}${generated.stickySuffix}`;
  let statusStripText = '';
  if (partial) statusStripText = 'UNAVAILABLE';
  else if (reducedScope) statusStripText = 'CLOSEST MATCH';
  else if (previewMode !== 'normal') statusStripText = 'FAST MODE';
  else statusStripText = 'UP TO DATE';

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

  return {
    reportSubtitleText,
    appliedFiltersText,
    outcomeLineHTML,
    previewMetaHTML,
    stickyText,
    statusHTML,
    statusDisplay,
    statusStripText,
  };
}
