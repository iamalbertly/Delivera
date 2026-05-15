import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function asText(v) {
  return String(v == null ? '' : v).trim();
}

function statusSymbol(status) {
  const s = asText(status).toLowerCase();
  if (s === 'undone') return '↩';
  if (s === 'undo_failed') return '⚠';
  return '✓';
}

async function fetchActivity() {
  const resp = await fetch('/api/jira-activity?limit=40');
  if (resp.status === 401) return { unauthorized: true, entries: [] };
  if (!resp.ok) throw new Error('Could not load activity');
  const data = await resp.json();
  return { entries: Array.isArray(data?.entries) ? data.entries : [] };
}

async function undoActivity(id) {
  const resp = await fetch(`/api/jira-activity/${encodeURIComponent(id)}/undo`, { method: 'POST' });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error || 'Undo failed');
  return data;
}

function renderRows(entries) {
  if (!entries.length) {
    return '<p class="jira-activity-empty">No Jira comments sent from Delivera yet.</p>';
  }
  let html = '<table class="jira-activity-table"><thead><tr>';
  html += '<th scope="col"></th><th scope="col">Issue</th><th scope="col">When</th><th scope="col">Preview</th><th scope="col"></th>';
  html += '</tr></thead><tbody>';
  entries.forEach((row) => {
    const sym = statusSymbol(row.status);
    const when = row.ts ? new Date(row.ts).toLocaleString() : '';
    const preview = asText(row.bodyPreview);
    const canUndo = row.status === 'sent' && row.commentId;
    html += '<tr data-activity-id="' + escapeHtml(row.id) + '">';
    html += '<td class="jira-activity-sym" aria-hidden="true">' + sym + '</td>';
    html += '<td><strong>' + escapeHtml(row.issueKey || '') + '</strong></td>';
    html += '<td>' + escapeHtml(when) + '</td>';
    html += '<td class="jira-activity-preview">' + escapeHtml(preview.length > 80 ? preview.slice(0, 79) + '…' : preview) + '</td>';
    html += '<td>';
    if (canUndo) {
      html += '<button type="button" class="btn btn-secondary btn-compact" data-activity-undo="' + escapeHtml(row.id) + '">↩ Undo</button>';
    } else if (row.status === 'undo_failed') {
      html += '<span class="jira-activity-fail">Open in Jira</span>';
    }
    html += '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

export async function initSettingsJiraActivityPanel() {
  const host = document.getElementById('jira-activity-panel');
  if (!host) return;
  host.innerHTML = '<p class="jira-activity-loading">Loading activity…</p>';
  try {
    const { unauthorized, entries } = await fetchActivity();
    if (unauthorized) {
      host.innerHTML = '<p class="jira-activity-empty">Sign in to view Jira activity.</p>';
      return;
    }
    host.innerHTML = renderRows(entries);
    host.querySelectorAll('[data-activity-undo]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-activity-undo');
        btn.disabled = true;
        btn.textContent = '…';
        try {
          await undoActivity(id);
          await initSettingsJiraActivityPanel();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = '↩ Undo';
          host.insertAdjacentHTML('afterbegin', '<p class="jira-activity-error" role="alert">' + escapeHtml(err.message) + '</p>');
        }
      });
    });
  } catch (err) {
    host.innerHTML = '<p class="jira-activity-error" role="alert">' + escapeHtml(err.message) + '</p>';
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initSettingsJiraActivityPanel());
  } else {
    initSettingsJiraActivityPanel();
  }
}
