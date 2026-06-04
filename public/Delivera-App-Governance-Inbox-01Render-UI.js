/**
 * Agent queue strip — chips open right drawer (no inline expansion).
 */
import { GOVERNANCE_INBOX_LAST_SEEN_KEY } from './Delivera-Shared-Storage-Keys.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';

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

function renderDrawerRows(items, onResolve) {
  if (!items?.length) return '<p class="gov-inbox-empty-tab">None right now.</p>';
  const rows = items.map((item) => `
    <li class="gov-inbox-row" data-inbox-id="${escapeHtml(item.id)}">
      <span class="gov-inbox-row-summary">${escapeHtml(item.summary)}</span>
      <span class="gov-inbox-row-meta">${item.safeToSend ? 'Ready' : 'Confirm first'}</span>
      <div class="gov-inbox-row-actions">
        ${item.approvalRequired !== false ? `<button type="button" class="btn btn-primary btn-compact" data-inbox-approve="${escapeHtml(item.id)}">Approve</button>` : ''}
        <select class="gov-inbox-dismiss-reason" data-inbox-reason="${escapeHtml(item.id)}" aria-label="Dismiss reason">
          <option value="irrelevant">Irrelevant</option>
          <option value="handled">Handled</option>
          <option value="wrong-owner">Wrong owner</option>
          <option value="bad-data">Bad data</option>
        </select>
        <button type="button" class="btn btn-secondary btn-compact" data-inbox-dismiss="${escapeHtml(item.id)}">Dismiss</button>
      </div>
    </li>`).join('');
  return `<ul class="gov-inbox-list">${rows}</ul>`;
}

const TAB_META = [
  ['briefs', 'Ready'],
  ['nudges', 'Nudges'],
  ['piDrift', 'PI drift'],
  ['confirm', 'Confirm'],
  ['impact', 'Impact'],
];

export function mountGovernanceInbox({ mount, getProjectsCsv, onFocusConfirm }) {
  if (!mount) return { refresh: async () => {}, getConfirmCount: () => 0 };

  let lastData = null;
  let drawerClose = null;

  async function fetchInbox() {
    const csv = getProjectsCsv?.() || 'MPSA,MAS';
    const res = await fetch(`/api/governance/inbox.json?projects=${encodeURIComponent(csv)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function resolveItem(id, resolution, dismissReason) {
    await fetch(`/api/governance/inbox/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, dismissReason }),
    });
    await refresh();
    drawerClose?.();
  }

  function openTabDrawer(tabKey) {
    const data = lastData || {};
    const items = data[tabKey] || [];
    const label = TAB_META.find(([k]) => k === tabKey)?.[1] || tabKey;
    if (tabKey === 'confirm') onFocusConfirm?.();
    writeLastSeen();
    const { close, el } = openRightDrawer({
      title: `Agent queue — ${label}`,
      bodyHtml: renderDrawerRows(items),
    });
    drawerClose = close;
    el.querySelectorAll('[data-inbox-approve]').forEach((btn) => {
      btn.addEventListener('click', () => resolveItem(btn.getAttribute('data-inbox-approve'), 'approved'));
    });
    el.querySelectorAll('[data-inbox-dismiss]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-inbox-dismiss');
        const reason = el.querySelector(`[data-inbox-reason="${id}"]`)?.value || 'irrelevant';
        resolveItem(id, 'dismissed', reason);
      });
    });
  }

  function render() {
    const data = lastData || { briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 };
    const chips = TAB_META.map(([key, label]) => {
      const count = (data[key] || []).length;
      if (!count) return '';
      return `<button type="button" class="gov-queue-chip" data-queue-tab="${key}">${escapeHtml(label)}: ${count}</button>`;
    }).filter(Boolean).join('');
    mount.innerHTML = `
      <div class="gov-agent-queue" role="group" aria-label="Agent queue">
        <span class="gov-agent-queue-label">Queue</span>
        <div class="gov-agent-queue-chips">${chips || '<span class="gov-inbox-hint">Brief will be ready shortly after startup.</span>'}</div>
      </div>`;
    mount.querySelectorAll('[data-queue-tab]').forEach((btn) => {
      btn.addEventListener('click', () => openTabDrawer(btn.getAttribute('data-queue-tab')));
    });
  }

  async function refresh() {
    try {
      lastData = await fetchInbox();
      render();
    } catch (_) {
      mount.innerHTML = '<p class="gov-inbox-hint">Queue unavailable — refresh the brief.</p>';
    }
  }

  refresh();
  return {
    refresh,
    getConfirmCount: () => (lastData?.confirm || []).length,
  };
}
