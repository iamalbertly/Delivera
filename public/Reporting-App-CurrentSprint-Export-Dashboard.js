/**
 * Export Dashboard Component
 * Copy as Text, Markdown, PNG snapshot, Share URL, Email options
 */

import { formatDate } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { exportRisksInsightsAsMarkdown } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { setActionErrorOnEl } from './Reporting-App-Shared-Status-Helpers.js';

export function renderExportButton(inline = false) {
  const containerClass = 'export-dashboard-container' + (inline ? ' header-export-inline' : '');
  let html = '<div class="' + containerClass + '">';
  html += '<span class="export-split-group">';
  html += '<button class="btn btn-secondary btn-compact export-dashboard-btn export-default-action" type="button" aria-label="Copy sprint summary to clipboard" aria-live="polite">Copy summary</button>';
  html += '<button class="btn btn-secondary btn-compact export-menu-toggle" type="button" aria-label="More export options" aria-haspopup="true" aria-expanded="false">&#9662;</button>';
  html += '</span>';
  html += '<div class="export-menu hidden" id="export-menu" role="menu">';
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
      menu.classList.remove('hidden');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
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
    });
  }

  document.addEventListener('click', (event) => {
    if (!container.contains(event.target) && !menu.classList.contains('hidden')) {
      menu.classList.add('hidden');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    }
  });

  const options = container.querySelectorAll('.export-option');
  options.forEach((option) => {
    option.addEventListener('click', () => {
      const action = option.dataset.action;
      menu.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');

      if (action === 'copy-text') {
        copyDashboardAsText(data, btn);
      } else if (action === 'export-markdown') {
        exportDashboardAsMarkdown(data, btn);
      } else if (action === 'export-png') {
        exportDashboardAsPng(data, btn);
      } else if (action === 'copy-link') {
        copyDashboardLink(data, btn);
      } else if (action === 'email') {
        emailDashboard(data, btn);
      }
    });
  });

  document.addEventListener('click', (event) => {
    const actionTarget = event.target?.closest?.('[data-action="copy-export-text"]');
    if (!actionTarget) return;
    copyDashboardAsText(data, btn);
  });
}

async function exportDashboardAsPng(data, btn) {
  const originalText = btn.textContent;
  setButtonStatus(btn, 'Rendering...', null, true, 4000);
  try {
    const target = document.getElementById('current-sprint-content') || document.querySelector('.current-sprint-grid-layout') || document.body;
    if (!target) throw new Error('Snapshot target not found');
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
    const fileName = 'sprint-' + String(sprint.name || 'snapshot').replace(/[^a-zA-Z0-9-_]+/g, '-') + '.png';
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
  const originalText = btn.textContent;
  setButtonStatus(btn, 'Copying...', null, true);

  try {
    const sprint = data.sprint || {};
    const summary = data.summary || {};
    const stuck = data.stuckCandidates || [];

    let text = `Sprint: ${sprint.name || 'N/A'}\n`;
    text += `Dates: ${formatDate(sprint.startDate) || 'N/A'} - ${formatDate(sprint.endDate) || 'N/A'}\n\n`;
    text += `Stories: ${summary.doneStories || 0} of ${summary.totalStories || 0} done\n`;
    text += `Story Points: ${summary.doneSP || 0} of ${summary.totalSP || 0} (${summary.percentDone || 0}%)\n`;

    if (stuck.length > 0) {
      text += `\nStuck Items (${stuck.length}):\n`;
      stuck.forEach((item) => {
        text += `  - ${(item && item.key) || 'N/A'}: ${(item && item.summary) || 'N/A'} (${(item && item.hoursInStatus) ?? 'N/A'}h)\n`;
      });
    }

    await writeTextToClipboardWithFallback(text);
    setButtonStatus(btn, 'Copied!', originalText);
  } catch (error) {
    console.error('Copy text error:', error);
    setButtonStatus(btn, 'Copy failed', originalText);
  }
}

async function exportDashboardAsMarkdown(data, btn) {
  const originalText = btn.textContent;
  setButtonStatus(btn, 'Generating...', null, true);

  try {
    const sprint = data.sprint || {};
    const summary = data.summary || {};

    let markdown = `# Sprint: ${sprint.name || 'N/A'}\n\n`;
    markdown += `**Date:** ${formatDate(sprint.startDate) || 'N/A'} -> ${formatDate(sprint.endDate) || 'N/A'}\n`;
    markdown += `**Date Generated:** ${new Date().toLocaleString()}\n\n`;

    markdown += '## Overview\n';
    markdown += `- **Stories:** ${summary.doneStories || 0} of ${summary.totalStories || 0} done\n`;
    markdown += `- **Story Points:** ${summary.doneSP || 0} of ${summary.totalSP || 0} done (${summary.percentDone || 0}%)\n`;
    markdown += `- **New Features:** ${summary.newFeaturesSP || 0} SP\n`;
    markdown += `- **Support & Ops:** ${summary.supportOpsSP || 0} SP\n\n`;

    const tracking = data.subtaskTracking || {};
    const trackingSummary = tracking.summary || {};
    markdown += '## Sub-task Tracking\n';
    markdown += `- **Estimated:** ${trackingSummary.totalEstimateHours || 0} hours\n`;
    markdown += `- **Logged:** ${trackingSummary.totalLoggedHours || 0} hours\n`;
    markdown += `- **Remaining:** ${trackingSummary.totalRemainingHours || 0} hours\n\n`;

    const stuck = data.stuckCandidates || [];
    if (stuck.length > 0) {
      markdown += '## Stuck Items (>24h)\n';
      stuck.forEach((item) => {
        markdown += `- ${(item && item.key) || 'N/A'}: ${(item && item.summary) || 'N/A'} (${(item && item.hoursInStatus) ?? 'N/A'} hours)\n`;
      });
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
  const originalText = btn.textContent;
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
  const originalText = btn.textContent;
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
