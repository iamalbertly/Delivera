/**
 * Agent queue — grouped fingerprint cards in drawer.
 */
import { GOVERNANCE_INBOX_LAST_SEEN_KEY } from './Delivera-Shared-Storage-Keys.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { groupInboxByFingerprint } from './Delivera-App-Governance-Inbox-Group-01SSOT.js';
import { isSyntheticInboxId } from './Delivera-App-Governance-Inbox-01Fingerprint-SSOT.js';
import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';

function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function writeLastSeen() {
  try { localStorage.setItem(GOVERNANCE_INBOX_LAST_SEEN_KEY, new Date().toISOString()); } catch (_) {}
}

function isResolvableItem(item) {
  if (!item?.id || isSyntheticInboxId(item.id)) return false;
  if (item.payload?.synthetic) return false;
  return true;
}

function renderGroupedDrawer(items, showAll = false, drawerHost = null) {
  const groups = groupInboxByFingerprint(items);
  const visible = showAll ? groups : groups.slice(0, 8);
  const hidden = showAll ? 0 : Math.max(0, groups.length - 8);
  if (!groups.length) {
    return `<p class="gov-inbox-empty-tab">${escapeHtml(COPY.inboxPreparing)}</p>
      <button type="button" class="btn btn-secondary btn-compact" id="gov-inbox-refresh-brief">${escapeHtml(COPY.refreshBrief)}</button>`;
  }

  const cards = visible.map((g) => {
    const ex = g.exampleItem || {};
    const canResolve = isResolvableItem(ex);
    const approveBtn = canResolve && g.count === 1 && g.ids[0]
      ? `<button type="button" class="btn btn-primary btn-compact gov-inbox-btn-icon" data-inbox-approve="${escapeHtml(g.ids[0])}" title="${escapeHtml(COPY.inboxApprove)}" aria-label="${escapeHtml(COPY.inboxApprove)}">✓</button>`
      : '';
    const reviewBtn = canResolve
      ? `<button type="button" class="btn btn-secondary btn-compact gov-inbox-btn-icon" data-group-review="${escapeHtml(g.fingerprint)}" title="${escapeHtml(COPY.inboxReview)}" aria-label="${escapeHtml(COPY.inboxReview)}">👁</button>`
      : '';
    const dismissChips = canResolve
      ? `<div class="gov-inbox-dismiss-chips" role="group" aria-label="${escapeHtml(COPY.inboxDismiss)}">
          <button type="button" class="gov-inbox-dismiss-chip" data-dismiss-reason="irrelevant" data-group-dismiss="${escapeHtml(g.fingerprint)}" title="${escapeHtml(COPY.dismissIrrelevant)}">✕</button>
          <button type="button" class="gov-inbox-dismiss-chip" data-dismiss-reason="handled" data-group-dismiss="${escapeHtml(g.fingerprint)}" title="${escapeHtml(COPY.dismissHandled)}">✓̸</button>
        </div>`
      : `<span class="gov-inbox-hint">${escapeHtml(COPY.inboxCachedHint)}</span>`;
    return `
    <li class="gov-inbox-group-card" data-fingerprint="${escapeHtml(g.fingerprint)}">
      <div class="gov-inbox-group-head">
        <strong>${escapeHtml(g.owner)}</strong>
        <span class="gov-inbox-group-meta">${g.count} · ${escapeHtml(g.board || 'Portfolio')}</span>
      </div>
      <p class="gov-inbox-group-reason">${escapeHtml(g.exampleItem?.summary || g.reason || g.type)}</p>
      <div class="gov-inbox-group-actions">
        ${approveBtn}
        ${reviewBtn}
        ${dismissChips}
      </div>
    </li>`;
  }).join('');

  const more = hidden > 0
    ? `<button type="button" class="btn btn-link btn-compact" id="gov-inbox-show-more">+${hidden} ${escapeHtml(COPY.inboxMoreGroups)}</button>`
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

export function mountGovernanceInbox({ mount, getProjectsCsv, onFocusConfirm, onRefreshBrief }) {
  if (!mount) return { refresh: async () => {}, getConfirmCount: () => 0, getInboxTotal: () => 0 };

  let lastData = null;
  let drawerClose = null;
  let drawerEl = null;
  let activeTabKey = 'briefs';

  async function fetchInbox() {
    const csv = getProjectsCsv?.() || 'MPSA,MAS';
    return fetchJson(`/api/governance/inbox.json?projects=${encodeURIComponent(csv)}`);
  }

  async function resolveItem(id, resolution, dismissReason = '') {
    if (!id || isSyntheticInboxId(id)) return;
    try {
      await fetchJson(`/api/governance/inbox/${encodeURIComponent(id)}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, dismissReason }),
      });
      await refresh();
      drawerClose?.();
    } catch (err) {
      const msg = err?.status === 400 ? COPY.inboxAlreadyHandled : (err?.message || COPY.inboxResolveFailed);
      showInlineToast(drawerEl || mount, msg, 'error');
    }
  }

  async function resolveGroup(fingerprint, resolution, dismissReason, tabKey) {
    const items = lastData?.[tabKey] || [];
    const groups = groupInboxByFingerprint(items);
    const g = groups.find((x) => x.fingerprint === fingerprint);
    if (!g) return;
    const ids = g.ids.filter((id) => !isSyntheticInboxId(id));
    await Promise.all(ids.map((id) => resolveItem(id, resolution, dismissReason)));
  }

  function bindDrawerActions(el, tabKey) {
    const items = lastData?.[tabKey] || [];
    el.querySelectorAll('[data-group-dismiss]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fp = btn.getAttribute('data-group-dismiss');
        const reason = btn.getAttribute('data-dismiss-reason') || 'irrelevant';
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
        if (g?.exampleItem?.id && isResolvableItem(g.exampleItem)) {
          resolveItem(g.exampleItem.id, 'approved');
        }
      });
    });
    el.querySelector('#gov-inbox-show-more')?.addEventListener('click', () => {
      const body = el.querySelector('.gov-right-drawer-body');
      if (body) body.innerHTML = renderGroupedDrawer(items, true, el);
      bindDrawerActions(el, tabKey);
    });
    el.querySelector('#gov-inbox-refresh-brief')?.addEventListener('click', () => {
      drawerClose?.();
      onRefreshBrief?.();
    });
  }

  function openQueueDrawer(tabKey) {
    const data = lastData || {};
    const items = data[tabKey] || [];
    const label = TAB_META.find(([k]) => k === tabKey)?.[1] || tabKey;
    if (tabKey === 'confirm') onFocusConfirm?.();
    writeLastSeen();
    activeTabKey = tabKey;

    const { close, el } = openRightDrawer({
      title: `${COPY.agentQueue} — ${label} (${items.length})`,
      bodyHtml: renderGroupedDrawer(items, false),
    });
    drawerClose = close;
    drawerEl = el;
    bindDrawerActions(el, tabKey);
  }

  function openCombinedDrawer() {
    const total = TAB_META.reduce((n, [k]) => n + (lastData?.[k]?.length || 0), 0);
    const firstTab = TAB_META.find(([k]) => (lastData?.[k]?.length || 0) > 0)?.[0] || 'briefs';
    openQueueDrawer(firstTab);
  }

  function render() {
    const total = TAB_META.reduce((n, [k]) => n + (lastData?.[k]?.length || 0), 0);
    const chip = total > 0
      ? `<button type="button" class="gov-queue-chip gov-queue-chip--primary" data-queue-open="1" aria-label="${escapeHtml(COPY.seeQueue)}">
          <span class="gov-queue-chip-icon" aria-hidden="true">📋</span>
          ${escapeHtml(COPY.seeQueue)} (${total})
        </button>`
      : `<span class="gov-inbox-hint">${escapeHtml(COPY.inboxPreparing)}</span>`;
    mount.innerHTML = `
      <div class="gov-agent-queue" role="group" aria-label="${escapeHtml(COPY.agentQueue)}">
        ${chip}
      </div>`;
    mount.querySelector('[data-queue-open]')?.addEventListener('click', openCombinedDrawer);
  }

  async function refresh() {
    try {
      lastData = await fetchInbox();
      render();
    } catch (_) {
      mount.innerHTML = `<p class="gov-inbox-hint">${escapeHtml(COPY.inboxUnavailable)}</p>`;
    }
  }

  refresh();
  return {
    refresh,
    getConfirmCount: () => (lastData?.confirm || []).length,
    getInboxTotal: () => TAB_META.reduce((n, [k]) => n + (lastData?.[k]?.length || 0), 0),
    openQueue: openCombinedDrawer,
  };
}
