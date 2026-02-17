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
  html += '<button class="btn btn-secondary btn-compact export-menu-toggle" type="button" aria-label="More export options" aria-haspopup="true" aria-expanded="false">&#9662;</button>';
  html += '</span>';
  html += '<div class="export-menu hidden" id="export-menu" role="menu" aria-hidden="true">';
  html += '<button class="export-option" data-action="copy-text" role="menuitem">Copy as Text</button>';
  html += '<button class="export-option" data-action="export-markdown" role="menuitem">Markdown</button>';
  html += '<button class="export-option" data-action="export-png" role="menuitem">PNG snapshot</button>';
  html += '<button class="export-option" data-action="copy-link" role="menuitem">Copy link</button>';
  html += '<button class="export-option" data-action="email" role="menuitem">Email</button>';
  html += '</div>';
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
    const summary = data.summary || {};
    const days = data.daysMeta || {};
    const stuck = data.stuckCandidates || [];
    const tracking = data?.subtaskTracking?.summary || {};
    const scopeChanges = data.scopeChanges || [];
    const stories = data.stories || [];
    const meta = data.meta || {};
    const excludedParents = Number(data?.summary?.stuckExcludedParentsWithActiveSubtasks || 0);

    const doneStories = summary.doneStories || 0;
    const totalStories = summary.totalStories || 0;
    const pctDone = summary.percentDone || 0;
    const remainingDays = days.daysRemainingWorking != null ? days.daysRemainingWorking : days.daysRemainingCalendar;

    // Derive verdict inline for copy context
    let verdict = 'Healthy';
    if (stuck.length >= 5 || pctDone < 20) verdict = 'Critical';
    else if (stuck.length >= 3 || pctDone < 40) verdict = 'At Risk';
    else if (stuck.length >= 1) verdict = 'Caution';

    let text = '';
    // 1. Status headline
    text += `${sprint.name || 'Sprint'} - ${verdict.toUpperCase()}\n`;
    text += `${pctDone}% done | ${doneStories}/${totalStories} stories | ${remainingDays != null ? remainingDays + 'd left' : 'ended'}\n`;
    text += `${formatDate(sprint.startDate) || '?'} -> ${formatDate(sprint.endDate) || '?'}\n`;
    text += `Generated: ${new Date().toLocaleString()}\n`;
    if (meta.generatedAt || meta.snapshotAt) {
      const sourceTs = new Date(meta.generatedAt || meta.snapshotAt);
      if (!Number.isNaN(sourceTs.getTime())) {
        text += `Data freshness: ${sourceTs.toLocaleString()}\n`;
      }
    }
    if (meta.windowStart || meta.windowEnd) {
      text += `${buildReportRangeLabel(meta.windowStart, meta.windowEnd)}\n`;
    }
    text += '\n';

    // 2. Blockers - actionable list grouped by assignee
    if (stuck.length > 0) {
      text += `BLOCKERS (${stuck.length}): in progress >24h with no recent subtask activity.\n`;
      const byAssignee = new Map();
      stuck.forEach((item) => {
        const assignee = (item && item.assignee) || 'Unassigned';
        if (!byAssignee.has(assignee)) byAssignee.set(assignee, []);
        byAssignee.get(assignee).push(item);
      });
      for (const [assignee, items] of byAssignee) {
        text += `  ${assignee}:\n`;
        items.forEach((item) => {
          const key = (item && (item.issueKey || item.key)) || '?';
          const hrs = (item && item.hoursInStatus) != null ? Math.round(item.hoursInStatus) + 'h stuck' : '';
          const status = (item && item.status) || '';
          text += `    ${key} - ${(item && item.summary) || '?'}`;
          if (status || hrs) text += ` [${[status, hrs].filter(Boolean).join(', ')}]`;
          text += '\n';
        });
      }
      text += '\n';
    }

    // 3. Scope changes
    if (scopeChanges.length > 0) {
      const scopeSP = scopeChanges.reduce((sum, r) => sum + (Number(r.storyPoints) || 0), 0);
      text += `SCOPE: +${scopeChanges.length} items added mid-sprint (+${scopeSP} SP)\n\n`;
    }

    // 4. Time tracking pulse
    const estHrs = tracking.totalEstimateHours || 0;
    const logHrs = tracking.totalLoggedHours || 0;
    if (estHrs > 0 || logHrs > 0) {
      text += `TIME: ${logHrs}h logged / ${estHrs}h estimated\n\n`;
    }

    // 5. Unassigned work
    const unassigned = stories.filter((s) => !s.assignee || s.assignee === 'Unassigned');
    if (unassigned.length > 0) {
      text += `UNASSIGNED (${unassigned.length}): ${unassigned.map((s) => s.issueKey || s.key || '?').join(', ')}\n\n`;
    }

    // 6. Action needed summary
    const actions = [];
    if (stuck.length > 0) actions.push(`Unblock ${stuck.length} stuck item${stuck.length > 1 ? 's' : ''}`);
    if (excludedParents > 0) actions.push(`${excludedParents} parent stor${excludedParents === 1 ? 'y' : 'ies'} flowing via subtasks (not counted as blockers)`);
    if (unassigned.length > 0) actions.push(`Assign ${unassigned.length} unowned stor${unassigned.length > 1 ? 'ies' : 'y'}`);
    if (pctDone < 30 && remainingDays != null && remainingDays < 5) actions.push('Velocity behind - consider scope cut');
    if (actions.length > 0) {
      text += `ACTION NEEDED:\n`;
      actions.forEach((a) => { text += `  -> ${a}\n`; });
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
  } catch (error) {
    console.error('Copy link error:', error);
    setButtonStatus(btn, 'Copy failed', originalText);
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
    } else {
      setButtonStatus(btn, 'Send failed', originalText);
    }
  } catch (error) {
    console.error('Email error:', error);
    setButtonStatus(btn, 'Email unavailable', originalText);
  }
}
