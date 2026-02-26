import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

function ensurePreviewContainer() {
  let container = document.getElementById('current-sprint-issue-preview');
  if (container) return container;
  container = document.createElement('div');
  container.id = 'current-sprint-issue-preview';
  container.className = 'issue-preview-drawer';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

function buildPreviewHtml(targetRow) {
  if (!targetRow) return '';
  const link = targetRow.querySelector('a[href*="/browse/"]');
  const key = link ? (link.textContent || '').trim() : (targetRow.getAttribute('data-issue-key') || '');
  const url = link ? link.href : '';
  const summaryCell = targetRow.querySelector('td:nth-child(4), td.subtask-child-summary');
  const statusCell = targetRow.querySelector('td[data-label="Status"], td:nth-child(4)');
  const assigneeCell = targetRow.querySelector('td[data-label="Assignee"], td:nth-child(9)');
  const reporterCell = targetRow.querySelector('td[data-label="Reporter"], td:nth-child(8)');
  const hoursCell = targetRow.querySelector('td[data-label="Logged Hrs"]');
  const updatedCell = targetRow.querySelector('td[data-label="Updated"]');

  const summary = summaryCell ? (summaryCell.textContent || '').trim() : '';
  const status = statusCell ? (statusCell.textContent || '').trim() : '';
  const assignee = assigneeCell ? (assigneeCell.textContent || '').trim() : '';
  const reporter = reporterCell ? (reporterCell.textContent || '').trim() : '';
  const logged = hoursCell ? (hoursCell.textContent || '').trim() : '';
  const updated = updatedCell ? (updatedCell.textContent || '').trim() : '';
  const riskTags = (targetRow.getAttribute('data-risk-tags') || '').split(/\s+/).filter(Boolean);
  const riskReasons = [];
  if (riskTags.includes('blocker')) riskReasons.push('Blocked or stalled flow');
  if (riskTags.includes('no-log')) riskReasons.push('Estimated work has no time logged');
  if (riskTags.includes('missing-estimate')) riskReasons.push('Logged work has no estimate baseline');
  if (riskTags.includes('scope')) riskReasons.push('Mid-sprint scope change');
  if (riskTags.includes('unassigned')) riskReasons.push('No clear owner assigned');
  const riskWhy = riskReasons.length ? riskReasons.join(' · ') : '';

  let html = '<div class="issue-preview-inner">';
  html += '<p class="issue-preview-breadcrumb">Work risks > ' + escapeHtml(key || 'Issue') + '</p>';
  html += '<div class="issue-preview-header">';
  if (key) {
    if (url) {
      html += '<a class="issue-preview-key" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(key) + '</a>';
    } else {
      html += '<span class="issue-preview-key">' + escapeHtml(key) + '</span>';
    }
  }
  if (status) {
    html += '<span class="issue-preview-status">' + escapeHtml(status) + '</span>';
  }
  html += '<button type="button" class="issue-preview-close" aria-label="Close issue details">✕</button>';
  html += '</div>';
  if (summary) {
    html += '<p class="issue-preview-summary">' + escapeHtml(summary) + '</p>';
  }
  if (riskWhy) {
    html += '<p class="issue-preview-risk-why"><strong>Why this is risky:</strong> ' + escapeHtml(riskWhy) + '</p>';
  }
  html += '<dl class="issue-preview-meta">';
  if (assignee) {
    html += '<div><dt>Assignee</dt><dd>' + escapeHtml(assignee) + '</dd></div>';
  }
  if (reporter) {
    html += '<div><dt>Reporter</dt><dd>' + escapeHtml(reporter) + '</dd></div>';
  }
  if (logged) {
    html += '<div><dt>Logged</dt><dd>' + escapeHtml(logged) + '</dd></div>';
  }
  if (updated) {
    html += '<div><dt>Updated</dt><dd>' + escapeHtml(updated) + '</dd></div>';
  }
  html += '</dl>';
  if (url) {
    html += '<div class="issue-preview-actions">';
    html += '<a class="btn btn-secondary btn-compact" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Open in Jira</a>';
    html += '<button type="button" class="btn btn-secondary btn-compact" data-issue-preview-action="copy-link" data-url="' + escapeHtml(url) + '">Copy link</button>';
    html += '<button type="button" class="btn btn-secondary btn-compact" data-issue-preview-action="copy-nudge" data-url="' + escapeHtml(url) + '" data-key="' + escapeHtml(key) + '" data-summary="' + escapeHtml(summary) + '" data-status="' + escapeHtml(status) + '">Copy nudge</button>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

export function wireIssuePreviewHandlers() {
  const content = document.getElementById('current-sprint-content');
  if (!content) return;
  if (content.dataset.wiredIssuePreview === '1') return;
  content.dataset.wiredIssuePreview = '1';

  const container = ensurePreviewContainer();

  function closePreview() {
    container.classList.remove('issue-preview-open');
    container.innerHTML = '';
  }

  container.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('.issue-preview-close');
    if (!closeBtn) return;
    event.preventDefault();
    closePreview();
  });
  container.addEventListener('click', async (event) => {
    const actionBtn = event.target.closest('[data-issue-preview-action]');
    if (!actionBtn) return;
    event.preventDefault();
    const action = actionBtn.getAttribute('data-issue-preview-action') || '';
    const url = actionBtn.getAttribute('data-url') || '';
    const key = actionBtn.getAttribute('data-key') || '';
    const summary = actionBtn.getAttribute('data-summary') || '';
    const status = actionBtn.getAttribute('data-status') || '';
    let text = '';
    if (action === 'copy-link') {
      text = url;
    } else if (action === 'copy-nudge') {
      text = key ? `[Nudge] ${key}: ${summary || 'Please review'} (${status || 'status unknown'}) ${url}` : url;
    } else {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      const original = actionBtn.textContent;
      actionBtn.textContent = 'Copied';
      window.setTimeout(() => { actionBtn.textContent = original; }, 1200);
    } catch (_) {}
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePreview();
    }
  });

  content.addEventListener('click', (event) => {
    const tableRow = event.target.closest('#work-risks-table tbody tr, #stories-table tbody tr');
    if (!tableRow) return;
    const issueLink = event.target.closest('a[href*="/browse/"]');
    if (issueLink && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1)) {
      return;
    }
    if (issueLink) {
      event.preventDefault();
    }
    const html = buildPreviewHtml(tableRow);
    if (!html) return;
    container.innerHTML = html;
    container.classList.add('issue-preview-open');
  });
}
