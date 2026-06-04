/**
 * Action Inbox — collapsed pill, expandable tabs (Ready / Nudges / PI Drift / Confirm / Impact).
 */
import { GOVERNANCE_INBOX_LAST_SEEN_KEY } from './Delivera-Shared-Storage-Keys.js';

function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function readLastSeen() {
  try { return localStorage.getItem(GOVERNANCE_INBOX_LAST_SEEN_KEY) || ''; } catch (_) { return ''; }
}

function writeLastSeen() {
  try { localStorage.setItem(GOVERNANCE_INBOX_LAST_SEEN_KEY, new Date().toISOString()); } catch (_) {}
}

function isNewItem(item, lastSeenIso) {
  if (!lastSeenIso) return true;
  const t = new Date(item.createdAt).getTime();
  const ls = new Date(lastSeenIso).getTime();
  return Number.isFinite(t) && Number.isFinite(ls) && t > ls;
}

function badgeLabel(data) {
  const parts = [];
  if (data.briefs?.length) parts.push(`${data.briefs.length} brief`);
  if (data.nudges?.length) parts.push(`${data.nudges.length} nudge${data.nudges.length > 1 ? 's' : ''}`);
  if (data.confirm?.length) parts.push(`${data.confirm.length} review`);
  if (data.piDrift?.length) parts.push(`${data.piDrift.length} PI drift`);
  if (data.impact?.length) parts.push('impact pack');
  return parts.length ? parts.join(' · ') : 'Nothing pending';
}

function renderRows(items, max = 4) {
  if (!items?.length) return '<p class="gov-inbox-empty-tab">None right now.</p>';
  const visible = items.slice(0, max);
  const more = items.length > max ? `<button type="button" class="btn btn-link btn-compact gov-inbox-more" data-more-count="${items.length - max}">Show ${items.length - max} more</button>` : '';
  const rows = visible.map((item) => `
    <li class="gov-inbox-row" data-inbox-id="${escapeHtml(item.id)}">
      <span class="gov-inbox-row-summary">${escapeHtml(item.summary)}</span>
      <span class="gov-inbox-row-meta">${item.safeToSend ? 'Ready' : 'Confirm first'}</span>
      <div class="gov-inbox-row-actions">
        ${item.approvalRequired !== false ? `<button type="button" class="btn btn-primary btn-compact" data-inbox-approve="${escapeHtml(item.id)}">Approve</button>` : ''}
        <button type="button" class="btn btn-secondary btn-compact" data-inbox-dismiss="${escapeHtml(item.id)}">Dismiss</button>
      </div>
    </li>`).join('');
  return `<ul class="gov-inbox-list">${rows}</ul>${more}`;
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.mount
 * @param {() => string} opts.getProjectsCsv
 * @param {(tab: string) => void} [opts.onFocusConfirm]
 */
export function mountGovernanceInbox({ mount, getProjectsCsv, onFocusConfirm }) {
  if (!mount) return { refresh: async () => {}, getConfirmCount: () => 0 };

  let expanded = false;
  let lastData = null;
  let activeTab = 'briefs';

  async function fetchInbox() {
    const csv = getProjectsCsv?.() || 'MPSA,MAS';
    const res = await fetch(`/api/governance/inbox.json?projects=${encodeURIComponent(csv)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function render() {
    const data = lastData || { briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 };
    const lastSeen = readLastSeen();
    const newCount = ['briefs', 'nudges', 'confirm', 'piDrift', 'impact'].reduce((n, key) => {
      const arr = data[key] || data[key === 'briefs' ? 'briefs' : key] || [];
      return n + (Array.isArray(arr) ? arr.filter((i) => isNewItem(i, lastSeen)).length : 0);
    }, 0);
    const badge = badgeLabel(data);
    const pillExtra = newCount > 0 && !expanded ? ` <span class="gov-inbox-badge">${newCount}</span>` : '';

    if (!expanded) {
      mount.innerHTML = `
        <button type="button" class="gov-inbox-pill" aria-expanded="false" id="gov-inbox-toggle">
          <span class="gov-inbox-pill-label">Action inbox</span>
          <span class="gov-inbox-pill-meta">${escapeHtml(badge)}${pillExtra}</span>
        </button>
        <p class="gov-inbox-hint">${data.total ? '' : 'Brief will be ready shortly after startup.'}</p>`;
      mount.querySelector('#gov-inbox-toggle')?.addEventListener('click', () => {
        expanded = true;
        writeLastSeen();
        render();
      });
      return;
    }

    const tabs = [
      ['briefs', 'Ready'],
      ['nudges', 'Nudges'],
      ['piDrift', 'PI drift'],
      ['confirm', 'Confirm'],
      ['impact', 'Impact'],
    ];
    const tabBtns = tabs.map(([k, label]) => {
      const count = (data[k] || []).length;
      return `<button type="button" class="gov-inbox-tab${activeTab === k ? ' is-active' : ''}" data-tab="${k}">${escapeHtml(label)}${count ? ` (${count})` : ''}</button>`;
    }).join('');

    mount.innerHTML = `
      <div class="gov-inbox-panel">
        <div class="gov-inbox-head">
          <button type="button" class="gov-inbox-pill gov-inbox-pill--open" aria-expanded="true" id="gov-inbox-toggle">
            <span class="gov-inbox-pill-label">Action inbox</span>
            <span class="gov-inbox-pill-meta">${escapeHtml(badge)}</span>
          </button>
        </div>
        <div class="gov-inbox-tabs" role="tablist">${tabBtns}</div>
        <div class="gov-inbox-body" id="gov-inbox-body">${renderRows(data[activeTab] || [])}</div>
      </div>`;

    mount.querySelector('#gov-inbox-toggle')?.addEventListener('click', () => {
      expanded = false;
      render();
    });
    mount.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab') || 'briefs';
        if (activeTab === 'confirm') onFocusConfirm?.();
        render();
      });
    });
    bindActions();
  }

  async function resolveItem(id, resolution) {
    await fetch(`/api/governance/inbox/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    });
    await refresh();
  }

  function bindActions() {
    mount.querySelectorAll('[data-inbox-approve]').forEach((btn) => {
      btn.addEventListener('click', () => resolveItem(btn.getAttribute('data-inbox-approve'), 'approved'));
    });
    mount.querySelectorAll('[data-inbox-dismiss]').forEach((btn) => {
      btn.addEventListener('click', () => resolveItem(btn.getAttribute('data-inbox-dismiss'), 'dismissed'));
    });
  }

  async function refresh() {
    try {
      lastData = await fetchInbox();
      render();
    } catch (_) {
      mount.innerHTML = '<p class="gov-inbox-hint">Inbox unavailable — refresh the brief.</p>';
    }
  }

  refresh();
  return {
    refresh,
    getConfirmCount: () => (lastData?.confirm || []).length,
  };
}
