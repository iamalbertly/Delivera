/**
 * Shared agent queue UI renderer — used by inbox and top-chrome bell.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

const TASK_ICONS = {
  'governance-narration': '✎',
  'pi-baseline-classify': '📋',
  'epic-hygiene-suggest': '🏷',
  'feedback-triage': '💬',
  'simple-mode-copy': '🌐',
  'action-plan': '→',
  'brief': '📄',
  'nudge': '✉',
  'pi-drift': '↔',
};

function iconForTask(taskType = '') {
  return TASK_ICONS[String(taskType).toLowerCase()] || '•';
}

/**
 * @param {object[]} items from readAgentQueueItems
 * @param {{ compact?: boolean }} [opts]
 */
export function renderAgentQueueList(items = [], { compact = false } = {}) {
  if (!items.length) {
    return `<p class="agent-queue-empty">No pending agent items.</p>`;
  }
  const rows = items.map((item) => {
    const icon = iconForTask(item.taskType || item.agentType);
    const aiBadge = item.aiContributed ? '<span class="agent-queue-ai-badge" title="AI helped">AI</span>' : '';
    const approval = item.approvalRequired ? '<span class="agent-queue-approval">Needs approval</span>' : '';
    if (compact) {
      return `<li class="agent-queue-item agent-queue-item--compact">${icon} ${escapeHtml(item.summary || '')} ${aiBadge}</li>`;
    }
    return `<li class="agent-queue-item" data-queue-id="${escapeHtml(item.id || '')}">
      <span class="agent-queue-icon">${icon}</span>
      <span class="agent-queue-summary">${escapeHtml(item.summary || '')}</span>
      ${aiBadge}${approval}
    </li>`;
  }).join('');
  return `<ul class="agent-queue-list" role="list">${rows}</ul>`;
}

/**
 * AI contribution receipt strip for Brief worker rail.
 */
export function renderAiContributionStrip(summary = {}) {
  const chips = Array.isArray(summary.chips) ? summary.chips : [];
  if (!chips.length && !summary.count) return '';
  const chipHtml = chips.map((c) => {
    const icon = iconForTask(c.taskType || c.label);
    const label = c.label || c.taskType || 'AI task';
    return `<span class="gov-ai-receipt-chip" title="${escapeHtml(c.summary || '')}">${icon} ${escapeHtml(label)}</span>`;
  }).join('');
  const noJira = summary.noJiraChangesMade !== false
    ? '<span class="gov-ai-receipt-safe">No Jira changes made</span>'
    : '';
  return `<div class="gov-ai-receipt-strip" role="status">
    <span class="gov-ai-receipt-label">AI helped with:</span>
    ${chipHtml}
    ${noJira}
  </div>`;
}
