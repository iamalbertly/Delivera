import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function cleanTitle(title = '', issueKey = '') {
  const raw = String(title || issueKey || 'Open work item').replace(/\s+/g, ' ').trim();
  return raw || 'Open work item';
}

/**
 * Render a Jira browse link when host URL is known.
 * Never fake `#work-item-KEY` hrefs that look clickable but go nowhere.
 */
export function renderJiraWorkItemLink({
  issueKey = '',
  title = '',
  issueUrl = '',
  kind = 'story',
  className = '',
} = {}) {
  const key = String(issueKey || '').trim().toUpperCase();
  // Squad keys (no numeric id) must not be rendered as epic browse links.
  if (kind === 'squad' || (key && !/-\d+$/.test(key) && !issueUrl)) {
    const fullTitle = cleanTitle(title, key);
    return `<span class="jira-work-item-link jira-work-item-link--plain ${escapeHtml(className)}" data-jira-work-kind="squad">${escapeHtml(fullTitle || key)}</span>`;
  }
  const fullTitle = cleanTitle(title, key);
  const label = key ? `${key}: ${fullTitle}` : fullTitle;
  if (issueUrl) {
    return `
    <a class="jira-work-item-link ${escapeHtml(className)}"
      href="${escapeHtml(issueUrl)}"
      target="_blank"
      rel="noopener noreferrer"
      data-jira-work-item-link="1"
      data-jira-issue-key="${escapeHtml(key)}"
      data-jira-work-kind="${escapeHtml(kind)}"
      title="${escapeHtml(label)}">
      ${key ? `<span class="jira-work-item-key">${escapeHtml(key)}</span>` : ''}
      <span class="jira-work-item-title">${escapeHtml(fullTitle)}</span>
    </a>`;
  }
  if (key) {
    return `
    <span class="jira-work-item-link jira-work-item-link--disabled ${escapeHtml(className)}"
      data-jira-issue-key="${escapeHtml(key)}"
      data-jira-work-kind="${escapeHtml(kind)}"
      title="Connect Jira to open ${escapeHtml(key)}">
      <span class="jira-work-item-key">${escapeHtml(key)}</span>
      <span class="jira-work-item-title">${escapeHtml(fullTitle)}</span>
      <span class="jira-work-item-hint"> · Connect Jira to open</span>
    </span>`;
  }
  return `<span class="${escapeHtml(className)}">${escapeHtml(fullTitle)}</span>`;
}
