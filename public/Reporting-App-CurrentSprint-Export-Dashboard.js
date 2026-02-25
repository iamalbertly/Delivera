/**
 * Export Dashboard Component
 * Copy as Text, Markdown, PNG snapshot, Share URL, Email options
 */
import { formatDate } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { exportRisksInsightsAsMarkdown } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { setActionErrorOnEl } from './Reporting-App-Shared-Status-Helpers.js';
import { buildReportRangeLabel } from './Reporting-App-Shared-Context-From-Storage.js';
export function renderExportButton(inline = false) {
  const containerClass = 'export-dashboard-container' + (inline ? ' header-export-inline' : '');
  let html = '<div class="' + containerClass + '">';
  html += '<span class="export-split-group">';
  html += '<button class="btn btn-secondary btn-compact export-dashboard-btn export-default-action" type="button" aria-label="Copy sprint summary to clipboard" aria-live="polite">Copy summary</button>';
  html += '<button class="btn btn-secondary btn-compact export-dashboard-secondary" type="button" aria-label="Export sprint summary as Markdown">Markdown</button>';
  html += '<button class="btn btn-secondary btn-compact export-menu-toggle" type="button" aria-label="More export options" aria-haspopup="true" aria-expanded="false">&#9662;</button>';
  html += '</span>';
  html += '<div class="export-menu hidden" id="export-menu" role="menu" aria-hidden="true">';
  html += '<button class="export-option" data-action="copy-text" role="menuitem">Copy as Text</button>';
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
    const sprint = data.sprint || {};
    const board = data.board || {};
    const summary = data.summary || {};
    const days = data.daysMeta || {};
    const stuck = data.stuckCandidates || [];
    const tracking = data?.subtaskTracking?.summary || {};
    const trackingRows = Array.isArray(data?.subtaskTracking?.subtasks) ? data.subtaskTracking.subtasks : [];
    const scopeChanges = data.scopeChanges || [];
    const stories = data.stories || [];
    const meta = data.meta || {};
    const excludedParents = Number(data?.summary?.stuckExcludedParentsWithActiveSubtasks || 0);

    const doneStories = summary.doneStories || 0;
    const totalStories = summary.totalStories || 0;
    const pctDone = summary.percentDone || 0;
    const remainingDays = days.daysRemainingWorking != null
      ? days.daysRemainingWorking
      : days.daysRemainingCalendar;

    // Use the real verdict from the shared SSOT
    const { deriveSprintVerdict } = await import('./Reporting-App-CurrentSprint-Alert-Banner.js');
    const verdictInfo = deriveSprintVerdict(data);
    const verdict = verdictInfo.verdict;

    // Categorize stories by issue type for the summary
    const byType = new Map();
    stories.forEach((s) => {
      const t = (s.issueType || 'Unknown').toLowerCase().includes('bug') ? 'Bug'
        : (s.issueType || 'Unknown').toLowerCase().includes('task') ? 'Task'
          : (s.issueType || 'Unknown').toLowerCase().includes('story') ? 'Story' : (s.issueType || 'Other');
      byType.set(t, (byType.get(t) || 0) + 1);
    });
    function pluralizeIssueType(type, count) {
      if (count === 1) return type;
      if (String(type).toLowerCase() === 'story') return 'Stories';
      return `${type}s`;
    }
    const typeBreakdown = [...byType.entries()].map(([t, c]) => `${c} ${pluralizeIssueType(t, c)}`).join(', ');

    // Separate blocked items (In Progress >24h) from not-started items (To Do)
    const inProgressStuck = stuck.filter((s) => {
      const st = (s && s.status || '').toLowerCase();
      return st !== 'to do' && st !== 'open' && st !== 'backlog';
    });
    const notStartedStuck = stuck.filter((s) => {
      const st = (s && s.status || '').toLowerCase();
      return st === 'to do' || st === 'open' || st === 'backlog';
    });

    let text = '';

    // 1. Short summary (4-line contract)
    const boardName = board.name || '';
    const periodLabel = sprint.name || 'Sprint';
    const healthLabel = verdict ? `${verdict} sprint health` : 'Sprint health';
    const topLineParts = [];
    if (periodLabel) topLineParts.push(periodLabel);
    if (boardName) topLineParts.push(boardName);
    topLineParts.push(healthLabel);
    text += `${topLineParts.join(' · ')}\n`;

    let timeLeftLabel = '';
    if (remainingDays == null) {
      timeLeftLabel = 'Sprint ended';
    } else if (remainingDays <= 0) {
      timeLeftLabel = 'Sprint ended';
    } else if (remainingDays < 1) {
      timeLeftLabel = '<1 day left';
    } else {
      timeLeftLabel = `${remainingDays} day${remainingDays === 1 ? '' : 's'} left`;
    }

    const startLabel = formatDate(sprint.startDate) || '?';
    const endLabel = formatDate(sprint.endDate) || '?';
    let dateRangeLabel = '';
    if (startLabel && endLabel && startLabel !== '?' && endLabel !== '?') {
      dateRangeLabel = `${startLabel}–${endLabel}`;
    } else if (startLabel && startLabel !== '?') {
      dateRangeLabel = `Starts ${startLabel}`;
    } else if (endLabel && endLabel !== '?') {
      dateRangeLabel = `Ends ${endLabel}`;
    }

    if (totalStories === 0 && !dateRangeLabel) {
      text += 'No active sprint data yet for this board.\n';
    } else {
      text += `${pctDone}% complete · ${doneStories} of ${totalStories} stories done · ${timeLeftLabel}${dateRangeLabel ? ` (${dateRangeLabel})` : ''}\n`;
    }

    // 2. Flow movement and logging - one plain-language line
    const estHrs = tracking.totalEstimateHours || 0;
    const logHrs = tracking.totalLoggedHours || 0;
    const remainHrs = tracking.totalRemainingHours || 0;
    const recentSubtaskMovement = trackingRows.filter((r) => Number(r?.hoursInStatus) >= 0 && Number(r?.hoursInStatus) < 24).length;
    const parentKeysWithRecentMovement = new Set(
      trackingRows
        .filter((r) => Number(r?.hoursInStatus) >= 0 && Number(r?.hoursInStatus) < 24)
        .map((r) => r.parentKey)
        .filter(Boolean)
    ).size;

    let movementLoggingLine = '';
    if (trackingRows.length === 0 && estHrs === 0 && logHrs === 0) {
      movementLoggingLine = 'No recent activity or time logging captured for this sprint yet.';
    } else if (recentSubtaskMovement > 0 && estHrs > 0 && logHrs === 0) {
      movementLoggingLine = `Flow is moving (${recentSubtaskMovement} subtasks changed) but 0h of ${estHrs}h estimated is logged.`;
    } else if (recentSubtaskMovement > 0 && estHrs === 0 && logHrs === 0) {
      movementLoggingLine = `Recent activity on ${recentSubtaskMovement} subtasks; no estimates or time logs captured yet.`;
    } else if (recentSubtaskMovement === 0 && estHrs > 0 && logHrs === estHrs && estHrs > 0) {
      movementLoggingLine = 'Time is fully logged on estimated work, but no issues have moved in the last 24 hours.';
    } else if (recentSubtaskMovement === 0 && estHrs > 0) {
      movementLoggingLine = `No issues moved in the last 24 hours; ${logHrs}h of ${estHrs}h estimated is logged.`;
    } else if (estHrs > 0 || logHrs > 0 || recentSubtaskMovement > 0) {
      const logPct = estHrs > 0 ? Math.round((logHrs / estHrs) * 100) : 0;
      movementLoggingLine = `Recent activity on ${recentSubtaskMovement}/${trackingRows.length || 0} subtasks; ${logHrs}h logged of ${estHrs}h estimated (${logPct}%).`;
    }

    if (movementLoggingLine) {
      text += `${movementLoggingLine}\n`;
    } else {
      text += 'Sprint signals are not yet available (no movement or logging data).\n';
    }

    // 3. Compact risk / composition line
    const blockersCount = inProgressStuck.length;
    const notStartedCount = notStartedStuck.length;
    const unassigned = stories.filter((s) => !s.assignee || s.assignee === 'Unassigned');
    const riskParts = [];
    riskParts.push(`${blockersCount} blocker${blockersCount === 1 ? '' : 's'}`);
    if (notStartedCount > 0) riskParts.push(`${notStartedCount} not started`);
    if (unassigned.length > 0) riskParts.push(`${unassigned.length} key stor${unassigned.length === 1 ? 'y' : 'ies'} unassigned`);
    if (scopeChanges.length > 0) riskParts.push(`Scope +${scopeChanges.length} mid-sprint`);
    text += `${riskParts.join(' · ')}\n`;
    text += '\n';

    // 4. Detailed section beneath separator
    text += '--- More detail below ---\n\n';

    // Detailed recent activity and logging notes
    if (trackingRows.length > 0 || estHrs > 0 || logHrs > 0) {
      text += 'RECENT ACTIVITY & TIME LOGGING\n';
      if (trackingRows.length > 0) {
        text += `- Recent subtask activity: ${recentSubtaskMovement}/${trackingRows.length} subtasks moved in the last 24h`;
        if (parentKeysWithRecentMovement > 0) {
          text += ` (${parentKeysWithRecentMovement} parent stor${parentKeysWithRecentMovement === 1 ? 'y' : 'ies'} moving)`;
        }
        text += '.\n';
      }
      if (estHrs > 0 || logHrs > 0) {
        const logPct = estHrs > 0 ? Math.round((logHrs / estHrs) * 100) : 0;
        const noLogFlag = logHrs === 0 && estHrs > 0 ? ' No time has been logged against estimated work.' : '';
        const noEstimatesFlag = estHrs === 0 && logHrs > 0 ? ' Time is logged but estimates are missing.' : '';
        text += `- Time logging: ${logHrs}h logged / ${estHrs}h estimated (${logPct}%).${noLogFlag}${noEstimatesFlag}\n`;
        if (remainHrs > 0) text += `- Remaining estimate: ${remainHrs}h.\n`;
      }
      if (trackingRows.length > 0 && estHrs === 0 && logHrs === 0) {
        text += '- Interpretation: movement is happening, but no estimates or worklogs are captured yet.\n';
      }
      text += '\n';
    }

    // 5. Actively blocked items - the real blockers (In Progress but stuck)
    if (inProgressStuck.length > 0) {
      text += `Blockers (${inProgressStuck.length})\n`;
      text += '  In-progress items stuck >24h with stale status movement:\n';
      const byAssignee = new Map();
      inProgressStuck.forEach((item) => {
        const assignee = (item && item.assignee) || 'Unassigned';
        if (!byAssignee.has(assignee)) byAssignee.set(assignee, []);
        byAssignee.get(assignee).push(item);
      });
      for (const [assignee, items] of byAssignee) {
        text += `  ${assignee}:\n`;
        items.forEach((item) => {
          const key = (item && (item.issueKey || item.key)) || '?';
          const hrs = (item && item.hoursInStatus) != null ? Math.round(item.hoursInStatus) + 'h' : '';
          text += `    ${key} - ${(item && item.summary) || '?'} [${hrs}]\n`;
        });
      }
      text += '\n';
    }

    // 6. Not started work - separate from blockers
    if (notStartedStuck.length > 0) {
      text += `Not started (${notStartedStuck.length})\n`;
      const maxNotStartedExamples = 5;
      const head = notStartedStuck.slice(0, maxNotStartedExamples);
      head.forEach((item) => {
        const key = (item && (item.issueKey || item.key)) || '?';
        const owner = (item && item.assignee) || 'Unassigned';
        text += `  ${key} - ${(item && item.summary) || '?'} [${owner}]\n`;
      });
      if (notStartedStuck.length > maxNotStartedExamples) {
        const remaining = notStartedStuck.length - maxNotStartedExamples;
        text += `  +${remaining} more not started…\n`;
      }
      text += '\n';
    }

    // 7. Scope changes with type breakdown
    if (scopeChanges.length > 0) {
      const scopeSP = scopeChanges.reduce((sum, r) => sum + (Number(r.storyPoints) || 0), 0);
      const scopeByType = new Map();
      scopeChanges.forEach((r) => {
        const t = r.classification || 'other';
        scopeByType.set(t, (scopeByType.get(t) || 0) + 1);
      });
      const scopeTypeStr = [...scopeByType.entries()].map(([t, c]) => `${c} ${t}`).join(', ');
      text += 'Scope added mid-sprint\n';
      text += `  +${scopeChanges.length} items added mid-sprint (${scopeTypeStr})${scopeSP > 0 ? ' +' + scopeSP + ' SP' : ''}\n\n`;
    }

    // 8. Per-story subtask summary for scrum master context
    const storiesWithSubtasks = stories.filter((s) => Array.isArray(s.subtasks) && s.subtasks.length > 0);
    if (storiesWithSubtasks.length > 0) {
      text += `Work breakdown (${storiesWithSubtasks.length} stories with subtasks)\n`;
      storiesWithSubtasks.forEach((s) => {
        const subs = s.subtasks || [];
        const subDone = subs.filter((st) => (st.status || '').toLowerCase().includes('done')).length;
        const subEst = subs.reduce((sum, st) => sum + (st.estimateHours || 0), 0);
        const subLog = subs.reduce((sum, st) => sum + (st.loggedHours || 0), 0);
        text += `  ${s.issueKey} (${s.assignee || 'Unassigned'}): ${subDone}/${subs.length} subtasks done`;
        if (subEst > 0 || subLog > 0) text += ` | ${subLog}h/${subEst}h`;
        text += '\n';
      });
      text += '\n';
    }

    // 9. Unassigned work (reuse unassigned collection from compact risk line)
    if (unassigned.length > 0) {
      text += `Unassigned (${unassigned.length})\n`;
      text += `  ${unassigned.map((s) => s.issueKey || s.key || '?').join(', ')}\n\n`;
    }

    // 10. Action needed summary - prioritized
    const actions = [];
    if (logHrs === 0 && estHrs > 0) actions.push(`Log actual work - ${estHrs}h estimated but 0h captured in timetracking`);
    if (recentSubtaskMovement > 0 && logHrs === 0) actions.push(`Flow is moving (${recentSubtaskMovement} subtasks changed <24h) but logs are missing`);
    if (inProgressStuck.length > 0) actions.push(`Unblock ${inProgressStuck.length} stuck item${inProgressStuck.length > 1 ? 's' : ''}`);
    if (notStartedStuck.length > 0) actions.push(`Start ${notStartedStuck.length} item${notStartedStuck.length > 1 ? 's' : ''} still in To Do`);
    if (excludedParents > 0) actions.push(`${excludedParents} parent stor${excludedParents === 1 ? 'y' : 'ies'} flowing via subtasks (not counted as stuck)`);
    if (unassigned.length > 0) actions.push(`Assign ${unassigned.length} unowned stor${unassigned.length > 1 ? 'ies' : 'y'}`);
    if (pctDone < 30 && remainingDays != null && remainingDays < 5) actions.push('Velocity behind - consider scope cut');
    if (actions.length > 0) {
      text += 'ACTION NEEDED:\n';
      actions.forEach((a, i) => { text += `  ${i + 1}. ${a}\n`; });
    }

    await writeTextToClipboardWithFallback(text);
    setButtonStatus(btn, 'Copied!', originalText);
  } catch (error) {
    console.error('Copy text error:', error);
    setButtonStatus(btn, 'Copy failed', originalText);
  }
}
async function exportDashboardAsMarkdown(data, btn) {
  const originalText = btn?.textContent || '';
  setButtonStatus(btn, 'Generating...', null, true);
  try {
    const sprint = data.sprint || {};
    const summary = data.summary || {};
    const days = data.daysMeta || {};
    const stuck = data.stuckCandidates || [];
    const tracking = data.subtaskTracking || {};
    const trackingSummary = tracking.summary || {};
    const trackingRows = Array.isArray(tracking.subtasks) ? tracking.subtasks : [];
    const scopeChanges = data.scopeChanges || [];
    const stories = data.stories || [];
    const meta = data.meta || {};
    const excludedParents = Number(data?.summary?.stuckExcludedParentsWithActiveSubtasks || 0);
    const remainingDays = days.daysRemainingWorking != null ? days.daysRemainingWorking : days.daysRemainingCalendar;
    const pctDone = summary.percentDone || 0;

    let markdown = `# ${sprint.name || 'Sprint'}\n\n`;
    markdown += `> **${pctDone}% done** | ${summary.doneStories || 0}/${summary.totalStories || 0} stories | ${remainingDays != null ? remainingDays + ' days left' : 'ended'}  \n`;
    markdown += `> ${formatDate(sprint.startDate) || '?'} -> ${formatDate(sprint.endDate) || '?'} | Generated ${new Date().toLocaleString()}\n\n`;
    if (meta.generatedAt || meta.snapshotAt || meta.windowStart || meta.windowEnd) {
      const freshness = meta.generatedAt || meta.snapshotAt ? formatDate(meta.generatedAt || meta.snapshotAt) : '-';
      markdown += `> Data freshness: ${freshness} | ${buildReportRangeLabel(meta.windowStart, meta.windowEnd)}\n\n`;
    }

    markdown += '## Overview\n';
    markdown += `| Metric | Value |\n|---|---|\n`;
    markdown += `| Stories | ${summary.doneStories || 0} of ${summary.totalStories || 0} done |\n`;
    if (summary.totalSP > 0) markdown += `| Story Points | ${summary.doneSP || 0} / ${summary.totalSP || 0} (${pctDone}%) |\n`;
    markdown += `| New Features | ${summary.newFeaturesSP || 0} SP |\n`;
    markdown += `| Support & Ops | ${summary.supportOpsSP || 0} SP |\n`;
    if (trackingSummary.totalEstimateHours > 0 || trackingSummary.totalLoggedHours > 0) {
      markdown += `| Time Logged | ${trackingSummary.totalLoggedHours || 0}h / ${trackingSummary.totalEstimateHours || 0}h estimated |\n`;
    }
    if (trackingRows.length > 0) {
      const recentMovement = trackingRows.filter((r) => Number(r?.hoursInStatus) >= 0 && Number(r?.hoursInStatus) < 24).length;
      markdown += `| Subtask movement (24h) | ${recentMovement} / ${trackingRows.length} |\n`;
    }
    markdown += '\n';

    if (stuck.length > 0) {
      markdown += `## Blockers (${stuck.length})\n\n`;
      markdown += '> Blockers = in progress >24h with no recent subtask activity. Parents with active subtasks are excluded.\n\n';
      markdown += '| Issue | Summary | Assignee | Status | Stuck |\n|---|---|---|---|---|\n';
      stuck.forEach((item) => {
        const key = (item && (item.issueKey || item.key)) || '?';
        const hrs = (item && item.hoursInStatus) != null ? Math.round(item.hoursInStatus) + 'h' : '?';
        markdown += `| ${key} | ${(item && item.summary) || '?'} | ${(item && item.assignee) || 'Unassigned'} | ${(item && item.status) || '?'} | ${hrs} |\n`;
      });
      markdown += '\n';
    }

    if (excludedParents > 0) {
      markdown += `> Note: ${excludedParents} parent stor${excludedParents === 1 ? 'y' : 'ies'} are flowing via subtasks and are not counted as blockers.\n\n`;
    }

    if (scopeChanges.length > 0) {
      const scopeSP = scopeChanges.reduce((sum, r) => sum + (Number(r.storyPoints) || 0), 0);
      markdown += `## Scope Changes\n+${scopeChanges.length} items added mid-sprint (+${scopeSP} SP)\n\n`;
    }

    const unassigned = stories.filter((s) => !s.assignee || s.assignee === 'Unassigned');
    if (unassigned.length > 0) {
      markdown += `## Unassigned Work (${unassigned.length})\n`;
      unassigned.forEach((s) => { markdown += `- ${s.issueKey || '?'}: ${s.summary || '?'}\n`; });
      markdown += '\n';
    }

    markdown += exportRisksInsightsAsMarkdown(data);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sprint-${sprint.name || 'export'}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
    setButtonStatus(btn, 'Exported!', originalText);
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
    const statusEl = document.querySelector('.export-dashboard-container .export-status-text');
    if (statusEl) {
      const ts = new Date().toLocaleString();
      statusEl.textContent = 'Link copied at ' + ts + ': ' + url;
    }
  } catch (error) {
    console.error('Copy link error:', error);
    setButtonStatus(btn, 'Copy failed', originalText);
    const statusEl = document.querySelector('.export-dashboard-container .export-status-text');
    if (statusEl) {
      statusEl.textContent = 'Copy link failed. Try Copy summary instead.';
    }
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
    const statusEl = document.querySelector('.export-dashboard-container .export-status-text');
    if (response.ok) {
      setButtonStatus(btn, 'Sent!', originalText);
      if (statusEl) {
        const ts = new Date().toLocaleString();
        statusEl.textContent = 'Sprint summary emailed to the configured distribution at ' + ts + '.';
      }
    } else {
      setButtonStatus(btn, 'Send failed', originalText);
      if (statusEl) {
        statusEl.textContent = 'Email send failed. Use Copy summary or Markdown export instead.';
      }
    }
  } catch (error) {
    console.error('Email error:', error);
    setButtonStatus(btn, 'Email unavailable', originalText);
    const statusEl = document.querySelector('.export-dashboard-container .export-status-text');
    if (statusEl) {
      statusEl.textContent = 'Email temporarily unavailable. Share via Copy summary or Markdown.';
    }
  }
}
