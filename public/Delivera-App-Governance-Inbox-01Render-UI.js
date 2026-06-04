/**
 * Agent queue — grouped fingerprint cards in drawer.
 */
import { GOVERNANCE_INBOX_LAST_SEEN_KEY } from './Delivera-Shared-Storage-Keys.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { groupInboxByFingerprint } from './Delivera-App-Governance-Inbox-Group-01SSOT.js';

function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function writeLastSeen() {
  try { localStorage.setItem(GOVERNANCE_INBOX_LAST_SEEN_KEY, new Date().toISOString()); } catch (_) {}
}

function renderGroupedDrawer(items, showAll = false) {
  const groups = groupInboxByFingerprint(items);
  const visible = showAll ? groups : groups.slice(0, 8);
  const hidden = showAll ? 0 : Math.max(0, groups.length - 8);
  if (!groups.length) return '<p class="gov-inbox-empty-tab">None right now.</p>';

  const cards = visible.map((g) => `
    <li class="gov-inbox-group-card" data-fingerprint="${escapeHtml(g.fingerprint)}">
      <div class="gov-inbox-group-head">
        <strong>${escapeHtml(g.owner)}</strong>
        <span class="gov-inbox-group-meta">${g.count} similar · ${escapeHtml(g.board || 'Portfolio')}</span>
      </div>
      <p class="gov-inbox-group-reason">${escapeHtml(g.exampleItem?.summary || g.reason || g.type)}</p>
      <div class="gov-inbox-group-actions">
        ${g.count === 1 && g.ids[0] ? `<button type="button" class="btn btn-primary btn-compact" data-inbox-approve="${escapeHtml(g.ids[0])}">Approve</button>` : ''}
        <button type="button" class="btn btn-primary btn-compact" data-group-review="${escapeHtml(g.fingerprint)}">Review</button>
        <select class="gov-inbox-dismiss-reason" data-group-reason="${escapeHtml(g.fingerprint)}" aria-label="Dismiss reason">
          <option value="irrelevant">Irrelevant</option>
          <option value="handled">Handled</option>
          <option value="wrong-owner">Wrong owner</option>
          <option value="bad-data">Bad data</option>
        </select>
        <button type="button" class="btn btn-secondary btn-compact" data-group-dismiss="${escapeHtml(g.fingerprint)}">Dismiss similar</button>
      </div>
    </li>`).join('');

  const more = hidden > 0
    ? `<button type="button" class="btn btn-link btn-compact" id="gov-inbox-show-more">+${hidden} more groups</button>`
    : '';

  return `<ul class="gov-inbox-group-list">${cards}</ul>${more}`;
}

const TAB_META = [
  ['briefs', 'Ready'],
  ['nudges', 'Nudges'],
  ['piDrift', 'PI drift'],
  ['confirm', 'Confirm'],
  ['impact', 'Impact'],
  ['poReadiness', 'PO readiness'],
];

export function mountGovernanceInbox({ mount, getProjectsCsv, onFocusConfirm }) {
  if (!mount) return { refresh: async () => {}, getConfirmCount: () => 0 };

  let lastData = null;
  let drawerClose = null;
  let expandedDrawer = false;

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
  }

  async function resolveGroup(fingerprint, resolution, dismissReason, tabKey) {
    const items = lastData?.[tabKey] || [];
    const groups = groupInboxByFingerprint(items);
    const g = groups.find((x) => x.fingerprint === fingerprint);
    if (!g) return;
    await Promise.all(g.ids.map((id) => resolveItem(id, resolution, dismissReason)));
    drawerClose?.();
  }

  function openTabDrawer(tabKey) {
    const data = lastData || {};
    const items = data[tabKey] || [];
    const label = TAB_META.find(([k]) => k === tabKey)?.[1] || tabKey;
    if (tabKey === 'confirm') onFocusConfirm?.();
    writeLastSeen();
    expandedDrawer = false;

    const { close, el } = openRightDrawer({
      title: `Agent queue — ${label} (${items.length})`,
      bodyHtml: renderGroupedDrawer(items, false),
    });
    drawerClose = close;

    el.querySelectorAll('[data-group-dismiss]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fp = btn.getAttribute('data-group-dismiss');
        const reason = el.querySelector(`[data-group-reason="${fp}"]`)?.value || 'irrelevant';
        resolveGroup(fp, 'dismissed', reason, tabKey);
      });
    });
    el.querySelectorAll('[data-inbox-approve]').forEach((btn) => {
      btn.addEventListener('click', () => resolveItem(btn.getAttribute('data-inbox-approve'), 'approved'));
    });
    el.querySelectorAll('[data-group-review]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fp = btn.getAttribute('data-group-review');
        const g = groupInboxByFingerprint(items).find((x) => x.fingerprint === fp);
        if (g?.exampleItem?.id) resolveItem(g.exampleItem.id, 'approved');
      });
    });
    el.querySelector('#gov-inbox-show-more')?.addEventListener('click', () => {
      expandedDrawer = true;
      const body = el.querySelector('.gov-right-drawer-body');
      if (body) body.innerHTML = renderGroupedDrawer(items, true);
    });
  }

  function render() {
    const data = lastData || { briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [], total: 0 };
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
    getInboxTotal: () => TAB_META.reduce((n, [k]) => n + (lastData?.[k]?.length || 0), 0),
  };
}
