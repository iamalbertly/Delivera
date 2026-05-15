import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { buildHumanNudgeDraft } from './Delivera-CurrentSprint-JiraNudge-01HumanText-SSOT.js';
import {
  isSprintCommentSendAllowed,
  postIssueCommentToJira,
  showSprintActionToast,
} from './Delivera-CurrentSprint-Action-Bridge.js';
import { showJiraNudgeSendReceipt, markIssueNudged } from './Delivera-CurrentSprint-JiraNudge-03SendReceipt-01UI.js';

function asText(v) {
  return String(v == null ? '' : v).trim();
}

function ensureSheet() {
  let sheet = document.getElementById('delivera-jira-nudge-review-sheet');
  if (sheet) return sheet;
  sheet = document.createElement('div');
  sheet.id = 'delivera-jira-nudge-review-sheet';
  sheet.className = 'jira-nudge-review-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'jira-nudge-review-title');
  sheet.hidden = true;
  document.body.appendChild(sheet);
  return sheet;
}

function closeSheet(sheet) {
  sheet.hidden = true;
  sheet.innerHTML = '';
  document.body.classList.remove('jira-nudge-review-open');
}

/**
 * @param {object} opts
 * @param {string} opts.issueKey
 * @param {string} [opts.issueSummary]
 * @param {string} [opts.issueStatus]
 * @param {string} [opts.issueUrl]
 * @param {string} [opts.useCase]
 * @param {number} [opts.staleHours]
 * @param {boolean} [opts.readOnly]
 * @param {object} [opts.meta]
 * @param {object} [opts.sprint]
 */
export function openJiraNudgeReviewSheet({
  issueKey = '',
  issueSummary = '',
  issueStatus = '',
  issueUrl = '',
  useCase = '',
  staleHours = null,
  readOnly = false,
  meta = null,
  sprint = null,
} = {}) {
  const key = asText(issueKey);
  if (!key) return;
  const sheet = ensureSheet();
  const sendAllowed = !readOnly && isSprintCommentSendAllowed(meta, sprint);
  const draft = buildHumanNudgeDraft({
    issueKey: key,
    issueSummary,
    issueStatus,
    useCase,
    staleHours,
  });
  const url = asText(issueUrl);
  let html = '<div class="jira-nudge-review-backdrop" data-review-close tabindex="-1"></div>';
  html += '<div class="jira-nudge-review-panel">';
  html += '<h2 id="jira-nudge-review-title" class="jira-nudge-review-title"><span aria-hidden="true">✏️</span> Review message</h2>';
  html += '<p class="jira-nudge-review-sub">' + escapeHtml(key) + (issueStatus ? ' · ' + escapeHtml(issueStatus) : '') + '</p>';
  if (!sendAllowed) {
    html += '<p class="jira-nudge-review-trust" role="alert">Live sprint required to post. Switch to live data or pick an active sprint.</p>';
  }
  const roster = Array.isArray(meta?.teamRoster) ? meta.teamRoster.slice(0, 8) : [];
  if (roster.length && sendAllowed) {
    html += '<div class="jira-nudge-mention-row" role="group" aria-label="Mention teammates">';
    roster.forEach((person) => {
      const name = asText(person?.displayName);
      if (!name) return;
      const short = name.split(/\s+/)[0] || name;
      html += '<button type="button" class="jira-nudge-mention-chip" data-mention-name="' + escapeHtml(name) + '">@' + escapeHtml(short) + '</button>';
    });
    html += '<button type="button" class="jira-nudge-mention-chip" data-mention-all="1">@team</button>';
    html += '</div>';
  }
  html += '<label class="jira-nudge-review-label" for="jira-nudge-review-text">Edit before sending</label>';
  html += '<textarea id="jira-nudge-review-text" class="jira-nudge-review-textarea" rows="4" maxlength="280"'
    + (sendAllowed ? '' : ' disabled')
    + '>' + escapeHtml(draft) + '</textarea>';
  html += '<p class="jira-nudge-review-count" data-char-count aria-live="polite"></p>';
  html += '<p class="jira-nudge-review-status" data-review-status aria-live="polite"></p>';
  html += '<div class="jira-nudge-review-actions">';
  if (url) {
    html += '<a class="btn btn-secondary btn-compact" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">↗ Jira</a>';
  }
  html += '<button type="button" class="btn btn-secondary btn-compact" data-review-cancel>Cancel</button>';
  html += '<button type="button" class="btn btn-primary btn-compact" data-review-send'
    + (sendAllowed ? '' : ' disabled')
    + ' aria-label="Send comment to Jira">✉️ Send</button>';
  html += '</div></div>';
  sheet.innerHTML = html;
  sheet.hidden = false;
  document.body.classList.add('jira-nudge-review-open');
  const textarea = sheet.querySelector('#jira-nudge-review-text');
  const countEl = sheet.querySelector('[data-char-count]');
  const statusEl = sheet.querySelector('[data-review-status]');
  const sendBtn = sheet.querySelector('[data-review-send]');
  const updateCount = () => {
    const len = (textarea?.value || '').length;
    if (countEl) countEl.textContent = `${len}/280`;
    if (sendBtn) sendBtn.disabled = !sendAllowed || len < 8;
  };
  updateCount();
  textarea?.addEventListener('input', updateCount);
  const insertMention = (token) => {
    if (!textarea || !token) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const before = textarea.value.slice(0, start);
    const needsSpace = before.length > 0 && !/\s$/.test(before);
    const insert = (needsSpace ? ' ' : '') + token + ' ';
    textarea.value = before + insert + textarea.value.slice(end);
    textarea.focus();
    updateCount();
  };
  sheet.querySelectorAll('[data-mention-name]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const name = chip.getAttribute('data-mention-name') || '';
      if (name) insertMention('@' + name);
    });
  });
  sheet.querySelector('[data-mention-all]')?.addEventListener('click', () => {
    const tokens = roster
      .map((p) => asText(p?.displayName))
      .filter(Boolean)
      .slice(0, 4)
      .map((n) => '@' + n);
    if (tokens.length) insertMention(tokens.join(' '));
  });
  textarea?.focus();
  const onClose = () => closeSheet(sheet);
  sheet.querySelector('[data-review-cancel]')?.addEventListener('click', onClose);
  sheet.querySelector('[data-review-close]')?.addEventListener('click', onClose);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', esc);
      onClose();
    }
  });
  sendBtn?.addEventListener('click', async () => {
    const body = asText(textarea?.value);
    if (!body || body.length < 8) {
      if (statusEl) statusEl.textContent = 'Add a short message first (at least 8 characters).';
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    if (statusEl) statusEl.textContent = '';
    try {
      const result = await postIssueCommentToJira(key, body, { teamRoster: roster });
      markIssueNudged(key);
      showJiraNudgeSendReceipt({
        issueKey: key,
        bodyPreview: body,
        jiraUrl: url,
        auditId: result?.auditId || result?.activityId || '',
      });
      showSprintActionToast('Sent to ' + key, 'success');
      try {
        window.dispatchEvent(new CustomEvent('delivera:jira-nudge-sent', { detail: { issueKey: key, body, result } }));
      } catch (_) {}
      onClose();
    } catch (err) {
      sendBtn.disabled = false;
      sendBtn.textContent = '✉️ Send';
      const msg = err?.message || 'Could not post comment.';
      if (statusEl) statusEl.textContent = msg;
      showSprintActionToast(msg, 'error');
    }
  });
}

export function initJiraNudgeReviewSheetGlobal() {
  ensureSheet();
}
