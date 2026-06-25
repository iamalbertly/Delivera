import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function cleanTitle(title = '', issueKey = '') {
  const raw = String(title || issueKey || 'Open work item').replace(/\s+/g, ' ').trim();
  return raw || 'Open work item';
}

export function renderJiraWorkItemLink({
  issueKey = '',
  title = '',
  issueUrl = '',
  kind = 'story',
  className = '',
} = {}) {
  const key = String(issueKey || '').trim().toUpperCase();
  const fullTitle = cleanTitle(title, key);
  const label = key ? `${key}: ${fullTitle}` : fullTitle;
  const href = issueUrl || (key ? `#work-item-${encodeURIComponent(key)}` : '#');
  return `
    <a class="jira-work-item-link ${escapeHtml(className)}"
      href="${escapeHtml(href)}"
      data-jira-work-item-link="1"
      data-jira-issue-key="${escapeHtml(key)}"
      data-jira-work-kind="${escapeHtml(kind)}"
      title="${escapeHtml(label)}">
      ${key ? `<span class="jira-work-item-key">${escapeHtml(key)}</span>` : ''}
      <span class="jira-work-item-title">${escapeHtml(fullTitle)}</span>
    </a>`;
}
