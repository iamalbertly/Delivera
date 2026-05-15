import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function asText(v) {
  return String(v == null ? '' : v).trim();
}

function ensureReceiptHost() {
  let host = document.getElementById('delivera-jira-nudge-receipt');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'delivera-jira-nudge-receipt';
  host.className = 'jira-nudge-receipt-host';
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);
  return host;
}

export function showJiraNudgeSendReceipt({
  issueKey = '',
  bodyPreview = '',
  jiraUrl = '',
  auditId = '',
} = {}) {
  const host = ensureReceiptHost();
  const key = asText(issueKey);
  const preview = asText(bodyPreview);
  const url = asText(jiraUrl);
  const when = new Date().toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
  const parts = [
    '<div class="jira-nudge-receipt" role="status">',
    '<p class="jira-nudge-receipt-title"><span aria-hidden="true">✓</span> Sent to ',
    escapeHtml(key),
    ' · ',
    escapeHtml(when),
    '</p>',
  ];
  if (preview) {
    const short = preview.length > 160 ? `${preview.slice(0, 159)}…` : preview;
    parts.push('<p class="jira-nudge-receipt-preview"><strong>Posted:</strong> ', escapeHtml(short), '</p>');
  }
  parts.push('<div class="jira-nudge-receipt-actions">');
  if (url) {
    parts.push('<a class="btn btn-secondary btn-compact" href="', escapeHtml(url), '" target="_blank" rel="noopener" aria-label="Open in Jira">↗ Jira</a>');
  }
  parts.push('<button type="button" class="btn btn-secondary btn-compact" data-receipt-copy>Copy</button>');
  if (auditId) {
    parts.push('<a class="btn btn-secondary btn-compact" href="/settings#jira-activity">Activity</a>');
  }
  parts.push('<button type="button" class="btn btn-tertiary btn-compact" data-receipt-dismiss>Dismiss</button>');
  parts.push('</div></div>');
  host.innerHTML = parts.join('');
  const copyBtn = host.querySelector('[data-receipt-copy]');
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(preview || key);
      copyBtn.textContent = 'Copied';
      window.setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    } catch (_) {}
  }, { once: true });
  host.querySelector('[data-receipt-dismiss]')?.addEventListener('click', () => {
    host.innerHTML = '';
  }, { once: true });
}

const LAST_NUDGE_PREFIX = 'delivera.lastNudge.v1.';

export function markIssueNudged(issueKey) {
  const key = asText(issueKey).toUpperCase();
  if (!key) return;
  try {
    sessionStorage.setItem(`${LAST_NUDGE_PREFIX}${key}`, String(Date.now()));
  } catch (_) {}
}

export function getIssueNudgedLabel(issueKey) {
  const key = asText(issueKey).toUpperCase();
  if (!key) return '';
  try {
    const ts = Number(sessionStorage.getItem(`${LAST_NUDGE_PREFIX}${key}`) || 0);
    if (!ts) return '';
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return '✓ Nudged just now';
    if (mins < 60) return `✓ Nudged ${mins}m ago`;
    return `✓ Nudged ${Math.round(mins / 60)}h ago`;
  } catch (_) {
    return '';
  }
}
