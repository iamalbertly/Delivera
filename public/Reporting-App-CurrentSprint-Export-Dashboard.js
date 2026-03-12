/**
 * Export Dashboard Component
 * Copy as Text, Markdown, PNG snapshot, Share URL, Email options
 */
import { formatDate } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { exportRisksInsightsAsMarkdown } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { setActionErrorOnEl } from './Reporting-App-Shared-Status-Helpers.js';
import { buildReportRangeLabel } from './Reporting-App-Shared-Context-From-Storage.js';
import { getUnifiedRiskCounts } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';

const SUMMARY_SECTION_KEYS = [
  'summary',
  'health',
  'blockers',
  'scope',
  'flowLogging',
  'actions',
];

function createEmptySummaryModel() {
  const sections = {};
  SUMMARY_SECTION_KEYS.forEach((key) => {
    sections[key] = [];
  });
  return {
    sections,
    meta: {
      mode: 'markdownEnhanced',
    },
  };
}

function escapeHtmlText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SUMMARY_SEPARATOR = ' \u00b7 ';
const DATE_RANGE_RENDER_SEPARATOR = '\u2013';
const SECTION_TITLES = {
  health: 'Health',
  blockers: 'Work risks',
  scope: 'Scope',
  flowLogging: 'Capacity',
  actions: 'Actions',
};

function pushSummaryLine(section, text, options = {}) {
  if (!text) return;
  section.push({
    text,
    isHeading: !!options.isHeading,
    isBold: !!options.isBold,
    isItalic: false,
    isSeparator: false,
  });
}

function buildDateRangeLabel(startIso, endIso) {
  const startLabel = formatDate(startIso) || '';
  const endLabel = formatDate(endIso) || '';
  if (startLabel && endLabel) return `${startLabel}${DATE_RANGE_RENDER_SEPARATOR}${endLabel}`;
  if (startLabel) return `Starts ${startLabel}`;
  if (endLabel) return `Ends ${endLabel}`;
  return '';
}

function getTimeLeftLabel(remainingDays) {
  if (remainingDays == null || remainingDays <= 0) return 'ended';
  if (remainingDays < 1) return 'ends in <1d';
  return `ends in ${remainingDays}d`;
}

function normalizeBulletText(text) {
  return String(text || '')
    .replace(/^\s*[-*]\s*/, '')
    .replace(/^\s*\d+\.\s*/, '')
    .trim();
}

function renderClipboardLine(line, index, mode) {
  if (!line || !line.text) return '';
  if (mode !== 'markdownEnhanced') return line.text;
  if (index === 0 || (index === 1 && line.isBold)) return `**${line.text}**`;
  if (line.isHeading) return `**${line.text}**`;
  return line.text;
}

function renderSectionToMarkdown(lines, title, section) {
  if (!Array.isArray(section) || !section.length) return;
  lines.push(`## ${title}`);
  lines.push('');
  section.forEach((line) => {
    if (!line?.text) return;
    lines.push(`- ${normalizeBulletText(line.text)}`);
  });
  lines.push('');
}

/**
 * Build a structured sprint summary model that can be rendered to
 * clipboard text or Markdown without duplicating logic.
 *
 * Sections: summary, flowLogging, blockers, scope, actions.
 * Each section contains ordered lines:
 * { text, isBold, isItalic, isHeading, isSeparator }.
 *
 * The builder keeps text readable when Markdown is stripped so
 * non-Markdown clients still get an intelligible narrative.
 */
export async function buildSprintSummaryModel(data, options = {}) {
  const mode = options.mode || 'markdownEnhanced';
  const model = createEmptySummaryModel();
  model.meta.mode = mode;

  const sprint = data?.sprint || {};
  const board = data?.board || {};
  const summary = data?.summary || {};
  const days = data?.daysMeta || {};
  const stuck = Array.isArray(data?.stuckCandidates) ? data.stuckCandidates : [];
  const trackingSummary = data?.subtaskTracking?.summary || {};
  const trackingRows = Array.isArray(data?.subtaskTracking?.subtasks) ? data.subtaskTracking.subtasks : [];
  const scopeChanges = Array.isArray(data?.scopeChanges) ? data.scopeChanges : [];
  const meta = data?.meta || {};

  const doneStories = Number(summary.doneStories || 0);
  const totalStories = Number(summary.totalStories || 0);
  const pctDone = Number(summary.percentDone || 0);
  const remainingDays = days.daysRemainingWorking != null
    ? Number(days.daysRemainingWorking)
    : (days.daysRemainingCalendar != null ? Number(days.daysRemainingCalendar) : null);

  const sprintName = sprint.name || 'Sprint';
  const boardName = board.name || 'Board';
  const dateRangeLabel = buildDateRangeLabel(sprint.startDate, sprint.endDate);
  const estHrs = Number(trackingSummary.totalEstimateHours || 0);
  const logHrs = Number(trackingSummary.totalLoggedHours || 0);
  const remainHrs = Number(trackingSummary.totalRemainingHours || 0);
  const recentSubtaskMovement = trackingRows.filter((row) => Number(row?.hoursInStatus) >= 0 && Number(row?.hoursInStatus) < 24).length;
  const parentKeysWithRecentMovement = new Set(
    trackingRows
      .filter((row) => Number(row?.hoursInStatus) >= 0 && Number(row?.hoursInStatus) < 24)
      .map((row) => row?.parentKey)
      .filter(Boolean),
  ).size;

  const { deriveSprintVerdict } = await import('./Reporting-App-CurrentSprint-Alert-Banner.js');
  const verdictInfo = deriveSprintVerdict(data);
  const unifiedRiskCounts = getUnifiedRiskCounts(data);
  const blockersCount = Number(unifiedRiskCounts.blockersOwned || 0);
  const unownedOutcomes = Number(unifiedRiskCounts.unownedOutcomes || 0);
  const missingEstimate = Number(summary.subtaskMissingEstimate || 0);
  const missingLogged = Number(summary.subtaskMissingLogged || 0);
  const closedSprintCount = Number(board.closedSprintCount || meta.closedSprintCount || meta.closedSprintTotal || 0);
  const limitedHistory = closedSprintCount > 0 && closedSprintCount < 3;
  const justStarting = totalStories <= 1 || (pctDone === 0 && recentSubtaskMovement === 0 && logHrs === 0);

  const isHistorical = String(sprint.state || '').toLowerCase() !== 'active' || Boolean(meta.fromSnapshot);
  const verdict = limitedHistory
    ? 'Limited history / low-confidence signals'
    : (justStarting ? 'Sprint just starting / evidence not formed yet' : (verdictInfo.verdict || 'Sprint'));
  const hasTrackableSignals = totalStories > 0 || trackingRows.length > 0 || estHrs > 0 || logHrs > 0 || scopeChanges.length > 0 || stuck.length > 0;

  const headerParts = ['Current Sprint', boardName, sprintName];
  if (dateRangeLabel) headerParts.push(dateRangeLabel);
  headerParts.push(isHistorical ? `${verdict} - historical snapshot` : verdict);
  const headerLine = headerParts.filter(Boolean).join(' - ');

  pushSummaryLine(model.sections.summary, headerLine, { isHeading: true, isBold: true });

  if (!hasTrackableSignals) {
    pushSummaryLine(model.sections.health, 'No trackable work yet - add stories in Jira for this sprint to see health metrics.');
  } else if (isHistorical) {
    pushSummaryLine(
      model.sections.health,
      `Historical snapshot - read only${dateRangeLabel ? ` (${dateRangeLabel})` : ''}. ${pctDone}% done, ${doneStories}/${totalStories} stories.`,
    );
  } else if (justStarting) {
    pushSummaryLine(
      model.sections.health,
      `Sprint just started - no risks yet, next check-in ${remainingDays != null && remainingDays > 0 ? `in ${remainingDays}d` : 'soon'}.`,
      { isBold: true },
    );
  } else {
    pushSummaryLine(
      model.sections.health,
      `${verdict}${SUMMARY_SEPARATOR}${pctDone}% done${SUMMARY_SEPARATOR}${doneStories}/${totalStories} stories${SUMMARY_SEPARATOR}${getTimeLeftLabel(remainingDays)}`,
      { isBold: true },
    );
  }

  if (justStarting || !hasTrackableSignals) {
    if (trackingRows.length === 0 && estHrs === 0 && logHrs === 0 && !hasTrackableSignals) {
      pushSummaryLine(model.sections.flowLogging, 'No time-tracking or capacity signals yet.');
    }
  } else if (trackingRows.length === 0 && estHrs === 0 && logHrs === 0) {
    pushSummaryLine(model.sections.flowLogging, 'No recent movement or logging captured yet.');
  } else {
    const flowBits = [];
    if (trackingRows.length > 0) {
      flowBits.push(`${recentSubtaskMovement}/${trackingRows.length} subtasks moved in the last 24h`);
      if (parentKeysWithRecentMovement > 0) {
        flowBits.push(`${parentKeysWithRecentMovement} parent stories moving`);
      }
    }
    if (estHrs > 0 || logHrs > 0) {
      const logPct = estHrs > 0 ? Math.round((logHrs / estHrs) * 100) : 0;
      let loggingLine = `${logHrs}h logged / ${estHrs}h estimated`;
      if (estHrs > 0) loggingLine += ` (${logPct}%)`;
      flowBits.push(loggingLine);
    }
    if (flowBits.length) {
      pushSummaryLine(model.sections.flowLogging, flowBits.join(SUMMARY_SEPARATOR));
    }
    if (logHrs === 0 && estHrs > 0) {
      pushSummaryLine(model.sections.flowLogging, 'Estimated work exists, but time logging has not started.');
    } else if (trackingRows.length > 0 && estHrs === 0 && logHrs === 0) {
      pushSummaryLine(model.sections.flowLogging, 'Movement is visible, but estimates and logs are still missing.');
    } else if (remainHrs > 0) {
      pushSummaryLine(model.sections.flowLogging, `${remainHrs}h remaining estimate is still open.`);
    }
  }

  const inProgressStuck = stuck.filter((item) => {
    const status = String(item?.status || '').toLowerCase();
    return status && status !== 'to do' && status !== 'open' && status !== 'backlog';
  });
  const notStartedStuck = stuck.filter((item) => {
    const status = String(item?.status || '').toLowerCase();
    return status === 'to do' || status === 'open' || status === 'backlog';
  });

  if (inProgressStuck.length > 0) {
    inProgressStuck.slice(0, 5).forEach((item) => {
      const key = item?.issueKey || item?.key || '?';
      const summaryText = item?.summary || 'Stale in progress work';
      const ageText = item?.hoursInStatus != null ? ` (${Math.round(Number(item.hoursInStatus))}h stale)` : '';
      const ownerText = item?.assignee ? ` [${item.assignee}]` : ' [Unassigned]';
      pushSummaryLine(model.sections.blockers, `${key}: ${summaryText}${ageText}${ownerText}`);
    });
    if (inProgressStuck.length > 5) {
      pushSummaryLine(model.sections.blockers, `+${inProgressStuck.length - 5} more stale in-progress items`);
    }
  } else if (notStartedStuck.length > 0) {
    pushSummaryLine(model.sections.blockers, `${notStartedStuck.length} items are still waiting in To Do.`);
  }

  if (scopeChanges.length > 0) {
    const scopeSP = scopeChanges.reduce((sum, row) => sum + (Number(row?.storyPoints) || 0), 0);
    const scopeByType = new Map();
    scopeChanges.forEach((row) => {
      const kind = row?.classification || 'other';
      scopeByType.set(kind, (scopeByType.get(kind) || 0) + 1);
    });
    const scopeMix = [...scopeByType.entries()].map(([kind, count]) => `${count} ${kind}`).join(', ');
    pushSummaryLine(
      model.sections.scope,
      `+${scopeChanges.length} items landed mid-sprint${scopeSP > 0 ? ` (+${scopeSP} SP)` : ''}${scopeMix ? `: ${scopeMix}` : ''}`,
    );
  }

  const actions = [];
  if (!isHistorical) {
    if (logHrs === 0 && estHrs > 0) actions.push(`Start time logging against ${estHrs}h of estimated work.`);
    if (recentSubtaskMovement > 0 && logHrs === 0) actions.push('Send one shared logging nudge while work is actively moving.');
    if (Math.max(blockersCount, inProgressStuck.length) > 0) actions.push(`Unblock ${Math.max(blockersCount, inProgressStuck.length)} active blocker${Math.max(blockersCount, inProgressStuck.length) === 1 ? '' : 's'}.`);
    if (notStartedStuck.length > 0) actions.push(`Pull ${notStartedStuck.length} waiting item${notStartedStuck.length === 1 ? '' : 's'} into active work or cut them.`);
    if (unownedOutcomes > 0) actions.push(`Assign ownership for ${unownedOutcomes} unowned outcome${unownedOutcomes === 1 ? '' : 's'}.`);
    if (missingEstimate > 0) actions.push(`Add estimates for ${missingEstimate} work item${missingEstimate === 1 ? '' : 's'} missing a baseline.`);
    if (missingLogged > 0 && !justStarting) actions.push(`Review ${missingLogged} item${missingLogged === 1 ? '' : 's'} with no logged effort yet.`);
    if (pctDone < 30 && remainingDays != null && remainingDays < 5) actions.push('Re-cut scope now if the remaining plan no longer fits the sprint window.');
  }
  actions.slice(0, 4).forEach((actionText) => pushSummaryLine(model.sections.actions, actionText));

  model.meta = {
    ...model.meta,
    sprintName,
    boardName,
    verdict,
    dateRangeLabel,
    doneStories,
    totalStories,
    pctDone,
    remainingDays,
    meta,
    headerLine,
    limitedHistory,
    justStarting,
    isHistorical,
  };

  return model;
}

function renderSummaryModelToClipboard(model, options = {}) {
  const mode = options.mode || model.meta.mode || 'markdownEnhanced';
  const linesOut = [];
  const summary = model.sections.summary || [];

  summary.slice(0, 1).forEach((line, index) => {
    const rendered = renderClipboardLine(line, index, mode);
    if (rendered) linesOut.push(rendered);
  });

  const order = ['health', 'blockers', 'scope', 'flowLogging', 'actions'];
  order.forEach((sectionKey) => {
    const section = model.sections[sectionKey] || [];
    if (!section.length) return;
    linesOut.push('');
    linesOut.push(mode === 'markdownEnhanced' ? `**${SECTION_TITLES[sectionKey]}**` : SECTION_TITLES[sectionKey]);
    section.forEach((line) => {
      if (!line?.text) return;
      linesOut.push(`- ${normalizeBulletText(line.text)}`);
    });
  });

  return linesOut.join('\n').trim();
}

function renderSummaryModelToClipboardHtml(model) {
  let html = '<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.4;color:#142334;max-width:760px">';
  const summary = model.sections.summary || [];
  if (summary[0]?.text) {
    html += '<div style="font-size:16px;font-weight:700;margin:0 0 6px">' + escapeHtmlText(summary[0].text) + '</div>';
  }

  const order = ['health', 'blockers', 'scope', 'flowLogging', 'actions'];
  let hasSections = false;
  order.forEach((sectionKey) => {
    const section = model.sections[sectionKey] || [];
    if (!section.length) return;
    hasSections = true;
    html += '<div style="margin:10px 0 0">';
    html += '<div style="font-weight:700;margin:0 0 4px">' + escapeHtmlText(SECTION_TITLES[sectionKey]) + '</div>';
    html += '<ul style="margin:0;padding-left:18px">';
    section.forEach((line) => {
      if (!line?.text) return;
      html += '<li style="margin:0 0 4px">' + escapeHtmlText(normalizeBulletText(line.text)) + '</li>';
    });
    html += '</ul></div>';
  });
  if (!hasSections) {
    html += '<div style="margin-top:8px;color:#5a6b7f">No additional details.</div>';
  }
  html += '</div>';
  return html;
}

function renderSummaryModelToMarkdown(model, data) {
  const { meta = {}, headerLine } = model.meta || {};
  const lines = [];

  lines.push(`# ${model.meta?.sprintName || 'Sprint'}`);
  lines.push('');
  if (headerLine) lines.push(`> **${headerLine}**`);

  if (meta.generatedAt || meta.snapshotAt || meta.windowStart || meta.windowEnd) {
    const freshness = meta.generatedAt || meta.snapshotAt ? formatDate(meta.generatedAt || meta.snapshotAt) : '-';
    lines.push(`> Data freshness: ${freshness}${meta.windowStart && meta.windowEnd ? ` | ${buildReportRangeLabel(meta.windowStart, meta.windowEnd)}` : ''}`);
  }

  lines.push('');
  renderSectionToMarkdown(lines, 'Health', model.sections.health);
  renderSectionToMarkdown(lines, 'Work risks', model.sections.blockers);
  renderSectionToMarkdown(lines, 'Scope', model.sections.scope);
  renderSectionToMarkdown(lines, 'Capacity', model.sections.flowLogging);
  renderSectionToMarkdown(lines, 'Actions', model.sections.actions);

  return `${lines.join('\n').trim()}\n\n${exportRisksInsightsAsMarkdown(data || {})}`;
}

function setLastExportStatus(actionLabel, detail) {
  const statusEl = document.querySelector('.export-dashboard-container .export-status-text');
  if (!statusEl) return;
  const ts = new Date().toLocaleTimeString();
  const labelHtml = escapeHtmlText(actionLabel || 'Export');
  let compactDetail = detail ? String(detail).trim() : '';
  try {
    const snapshotBadge = document.querySelector('.current-sprint-header-bar .status-badge.status-snapshot');
    const updatedText = (document.querySelector('.current-sprint-header-bar .last-updated')?.textContent || '').trim();
    if (snapshotBadge) {
      compactDetail = compactDetail
        ? `${compactDetail} | Snapshot${updatedText ? ` (${updatedText})` : ''}`
        : `Snapshot${updatedText ? ` (${updatedText})` : ''}`;
    }
  } catch (_) {}
  const metaHtml = `${ts}${compactDetail ? ` ${SUMMARY_SEPARATOR}${compactDetail}` : ''}`;
  statusEl.innerHTML = `${labelHtml} ${SUMMARY_SEPARATOR}<span class="export-status-meta">${escapeHtmlText(metaHtml)}</span>`;
  statusEl.setAttribute('data-last-action', actionLabel);
  statusEl.setAttribute('data-last-timestamp', ts);
  statusEl.setAttribute('data-last-detail', compactDetail);
  return;
  statusEl.innerHTML = `${labelHtml} · <span class="export-status-meta">${metaHtml}</span>`;
  statusEl.setAttribute('data-last-action', actionLabel);
  statusEl.setAttribute('data-last-timestamp', ts);
  statusEl.setAttribute('data-last-detail', compactDetail);
}

try {
  if (typeof window !== 'undefined') {
    window.__setCurrentSprintLastExportStatus = setLastExportStatus;
  }
} catch (_) {}
export function renderExportButton(inline = false) {
  const containerClass = 'export-dashboard-container' + (inline ? ' header-export-inline' : '');
  let html = '<div class="' + containerClass + '">';
  html += '<span class="export-split-group">';
  html += '<button class="btn btn-secondary btn-compact export-dashboard-btn export-default-action" type="button" aria-label="Copy sprint summary" aria-live="polite">Copy summary</button>';
  if (!inline) {
    html += '<button class="btn btn-secondary btn-compact export-dashboard-secondary" type="button" aria-label="Export sprint summary as Markdown">Markdown</button>';
  }
  html += '<button class="btn btn-secondary btn-compact export-menu-toggle" type="button" aria-label="More export options" aria-haspopup="true" aria-expanded="false">&#9662;</button>';
  html += '</span>';
  html += '<div class="export-menu hidden" id="export-menu" role="menu" aria-hidden="true">';
  html += '<button class="export-option" data-action="copy-text" role="menuitem">Copy as Text</button>';
  html += '<button class="export-option" data-action="copy-standup" role="menuitem">Copy stand-up script</button>';
  html += '<button class="export-option" data-action="export-markdown" role="menuitem">Markdown</button>';
  html += '<button class="export-option" data-action="export-png" role="menuitem">PNG snapshot</button>';
  html += '<button class="export-option" data-action="copy-link" role="menuitem">Copy link</button>';
  html += '<button class="export-option" data-action="email" role="menuitem">Email</button>';
  html += '</div>';
  html += '<div class="export-status-text" aria-live="polite"></div>';
  html += '</div>';
  return html;
}
function setButtonStatus(btn, text, originalText, disabled = false, resetAfterMs = 2000) {
  if (!btn) return;
  btn.textContent = text;
  btn.disabled = disabled;
  if (!originalText) return;
  window.setTimeout(() => {
    btn.textContent = originalText;
    btn.disabled = false;
  }, resetAfterMs);
}
async function writeTextToClipboardWithFallback(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', 'true');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('Clipboard copy unavailable');
}

async function writeRichClipboardWithFallback(html, text) {
  const plain = String(text || '').trim();
  const rich = String(html || '').trim();
  try {
    if (navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem !== 'undefined' && rich) {
      const item = new ClipboardItem({
        'text/plain': new Blob([plain], { type: 'text/plain' }),
        'text/html': new Blob([rich], { type: 'text/html' }),
      });
      await navigator.clipboard.write([item]);
      return;
    }
  } catch (_) {}
  await writeTextToClipboardWithFallback(plain);
}
export function wireExportHandlers(data) {
  const container = document.querySelector('.export-dashboard-container');
  if (!container) return;
  if (container.dataset.wiredExportHandlers === '1') return;
  container.dataset.wiredExportHandlers = '1';
  const btn = container.querySelector('.export-dashboard-btn');
  const secondaryBtn = container.querySelector('.export-dashboard-secondary');
  const menuToggle = container.querySelector('.export-menu-toggle');
  const menu = container.querySelector('#export-menu');
  if (!menu) return;
  const effectiveBtn = btn || menuToggle;
  if (!effectiveBtn) return;
  // Primary button: direct copy-text action (1-click export)
  if (btn) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyDashboardAsText(data, btn);
    });
  }
  if (secondaryBtn) {
    secondaryBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      exportDashboardAsMarkdown(data, secondaryBtn);
    });
  }
  // Menu toggle: expand/collapse the full options menu
  if (menuToggle) {
    menuToggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      menu.classList.toggle('hidden');
      const expanded = !menu.classList.contains('hidden');
      menuToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      menu.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    });
  }
  if (!window.__currentSprintExportOutsideClickBound) {
    window.__currentSprintExportOutsideClickBound = true;
    document.addEventListener('click', (event) => {
      const activeContainer = document.querySelector('.export-dashboard-container');
      const activeMenu = activeContainer?.querySelector('#export-menu');
      const activeToggle = activeContainer?.querySelector('.export-menu-toggle');
      if (!activeContainer || !activeMenu) return;
      if (!activeContainer.contains(event.target) && !activeMenu.classList.contains('hidden')) {
        activeMenu.classList.add('hidden');
        if (activeToggle) activeToggle.setAttribute('aria-expanded', 'false');
        activeMenu.setAttribute('aria-hidden', 'true');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const activeContainer = document.querySelector('.export-dashboard-container');
      const activeMenu = activeContainer?.querySelector('#export-menu');
      const activeToggle = activeContainer?.querySelector('.export-menu-toggle');
      if (!activeMenu || activeMenu.classList.contains('hidden')) return;
      activeMenu.classList.add('hidden');
      activeMenu.setAttribute('aria-hidden', 'true');
      if (activeToggle) activeToggle.setAttribute('aria-expanded', 'false');
    });
  }
  const options = container.querySelectorAll('.export-option');
  options.forEach((option) => {
    option.addEventListener('click', () => {
      const action = option.dataset.action;
      menu.classList.add('hidden');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      if (action === 'copy-text') {
        copyDashboardAsText(data, btn || menuToggle);
      } else if (action === 'copy-standup') {
        copyDashboardAsStandup(data, btn || menuToggle);
      } else if (action === 'export-markdown') {
        exportDashboardAsMarkdown(data, btn || menuToggle);
      } else if (action === 'export-png') {
        exportDashboardAsPng(data, btn || menuToggle);
      } else if (action === 'copy-link') {
        copyDashboardLink(data, btn || menuToggle);
      } else if (action === 'email') {
        emailDashboard(data, btn || menuToggle);
      }
    });
  });
  if (!window.__currentSprintExportCopyTextActionBound) {
    window.__currentSprintExportCopyTextActionBound = true;
    document.addEventListener('click', (event) => {
      const actionTarget = event.target?.closest?.('[data-action="copy-export-text"]');
      if (!actionTarget) return;
      const activeContainer = document.querySelector('.export-dashboard-container');
      const activeBtn = activeContainer?.querySelector('.export-dashboard-btn')
        || activeContainer?.querySelector('.export-menu-toggle');
      copyDashboardAsText(data, activeBtn);
    });
  }
}
async function exportDashboardAsPng(data, btn) {
  const originalText = btn.textContent;
  setButtonStatus(btn, 'Rendering...', null, true, 4000);
  try {
    // Prefer header bar (compact, answers key questions) then grid layout, then fallback
    const headerBar = document.querySelector('.current-sprint-header-bar');
    const gridLayout = document.querySelector('.current-sprint-grid-layout');
    const target = headerBar || gridLayout || document.getElementById('current-sprint-content') || document.body;
    if (!target) throw new Error('Snapshot target not found');
    // Temporarily expand any collapsed sections within the target for a complete snapshot
    const collapsedDetails = target.querySelectorAll('details:not([open])');
    collapsedDetails.forEach((d) => d.setAttribute('open', ''));
    const hiddenRegions = Array.from(target.querySelectorAll('[aria-hidden="true"]'))
      .map((el) => ({ el, prev: el.getAttribute('aria-hidden') }));
    hiddenRegions.forEach(({ el }) => el.setAttribute('aria-hidden', 'false'));
    const module = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
    const html2canvas = module?.default;
    if (typeof html2canvas !== 'function') throw new Error('Snapshot renderer unavailable');
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });
    const sprint = data?.sprint || {};
    const fileName = 'sprint-summary-' + String(sprint.name || 'snapshot').replace(/[^a-zA-Z0-9-_]+/g, '-') + '.png';
    // Restore collapsed state after render
    collapsedDetails.forEach((d) => d.removeAttribute('open'));
    hiddenRegions.forEach(({ el, prev }) => {
      if (prev == null) {
        el.removeAttribute('aria-hidden');
      } else {
        el.setAttribute('aria-hidden', prev);
      }
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = fileName;
    a.click();
    setButtonStatus(btn, 'Downloaded!', originalText);
  } catch (error) {
    console.error('PNG snapshot export error:', error);
    const errorEl = document.getElementById('current-sprint-error');
    if (errorEl) {
      setActionErrorOnEl(errorEl, {
        title: 'PNG snapshot unavailable.',
        message: 'Could not render screenshot. Try copy text or markdown export.',
        primaryLabel: 'Copy as text',
        primaryAction: 'copy-export-text',
      });
    }
    setButtonStatus(btn, 'PNG failed', originalText);
  }
}
async function copyDashboardAsText(data, btn) {
  const originalText = btn?.textContent || '';
  setButtonStatus(btn, 'Copying...', null, true);
  try {
    const model = await buildSprintSummaryModel(data, { mode: 'markdownEnhanced' });
    const text = renderSummaryModelToClipboard(model, { mode: 'plain' });
    const html = renderSummaryModelToClipboardHtml(model);
    await writeRichClipboardWithFallback(html, text);
    setButtonStatus(btn, 'Copied!', originalText);
    setLastExportStatus('Share state', 'Rich text copied (HTML + plain text fallback)');
  } catch (error) {
    console.error('Copy text error:', error);
    setButtonStatus(btn, 'Copy failed', originalText);
  }
}
function renderSummaryModelToStandupScript(model) {
  const meta = model?.meta || {};
  const risks = [];
  const actions = [];

  (model.sections.blockers || []).forEach((line) => {
    if (line?.text) risks.push(normalizeBulletText(line.text));
  });
  (model.sections.scope || []).forEach((line) => {
    if (line?.text) risks.push(normalizeBulletText(line.text));
  });
  (model.sections.actions || []).forEach((line) => {
    if (line?.text) actions.push(normalizeBulletText(line.text));
  });

  const script = [
    meta.isHistorical ? 'Historical snapshot - read only.' : `${meta.verdict || 'Sprint'} sprint health.`,
    meta.justStarting
      ? `Sprint just started, ${meta.doneStories || 0}/${meta.totalStories || 0} stories in play.`
      : `${meta.pctDone || 0}% done, ${meta.doneStories || 0}/${meta.totalStories || 0} stories.`,
    risks.slice(0, 2).join(' '),
    meta.isHistorical ? '' : actions.slice(0, 2).join(' '),
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  return script.slice(0, 480).trim();
}

async function copyDashboardAsStandup(data, btn) {
  const originalText = btn?.textContent || '';
  setButtonStatus(btn, 'Copying...', null, true);
  try {
    const model = await buildSprintSummaryModel(data, { mode: 'markdownEnhanced' });
    const text = renderSummaryModelToStandupScript(model);
    await writeTextToClipboardWithFallback(text);
    setButtonStatus(btn, 'Copied!', originalText);
    setLastExportStatus('Stand-up script', text);
  } catch (error) {
    console.error('Copy stand-up script error:', error);
    setButtonStatus(btn, 'Copy failed', originalText);
  }
}
async function exportDashboardAsMarkdown(data, btn) {
  const originalText = btn?.textContent || '';
  setButtonStatus(btn, 'Generating...', null, true);
  try {
    const model = await buildSprintSummaryModel(data, { mode: 'markdownEnhanced' });
    const markdown = renderSummaryModelToMarkdown(model, data);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sprint-${model.meta.sprintName || 'export'}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
    setButtonStatus(btn, 'Exported!', originalText);
    setLastExportStatus('Markdown', `File sprint-${model.meta.sprintName || 'export'}.md`);
  } catch (error) {
    console.error('Markdown export error:', error);
    setButtonStatus(btn, 'Export failed', originalText);
  }
}
async function copyDashboardLink(data, btn) {
  const originalText = btn?.textContent || '';
  try {
    const sprint = data.sprint || {};
    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;
    const boardSelect = document.querySelector('#board-select');
    const boardId = boardSelect?.value;
    let url = baseUrl + currentPath;
    if (boardId) {
      url += '?boardId=' + encodeURIComponent(boardId) + '&sprintId=' + encodeURIComponent(String(sprint.id || ''));
    }
    await writeTextToClipboardWithFallback(url);
    setButtonStatus(btn, 'Link copied!', originalText);
    setLastExportStatus('Copy link', url);
  } catch (error) {
    console.error('Copy link error:', error);
    setButtonStatus(btn, 'Copy failed', originalText);
    setLastExportStatus('Copy link failed', 'Try Copy summary instead.');
  }
}
async function emailDashboard(data, btn) {
  const originalText = btn?.textContent || '';
  setButtonStatus(btn, 'Sending...', null, true);
  try {
    const sprint = data.sprint || {};
    const response = await fetch('/api/current-sprint/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sprintId: sprint.id,
        sprintName: sprint.name,
      }),
    });
    if (response.ok) {
      setButtonStatus(btn, 'Sent!', originalText);
      setLastExportStatus('Email', 'Sent to configured distribution');
    } else {
      setButtonStatus(btn, 'Send failed', originalText);
      setLastExportStatus('Email failed', 'Use Copy summary or Markdown export instead.');
    }
  } catch (error) {
    console.error('Email error:', error);
    setButtonStatus(btn, 'Email unavailable', originalText);
    setLastExportStatus('Email unavailable', 'Share via Copy summary or Markdown.');
  }
}
