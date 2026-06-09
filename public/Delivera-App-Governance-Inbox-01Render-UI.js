/**
 * Agent queue — grouped fingerprint cards in drawer with icon tab picker.
 */
import { GOVERNANCE_INBOX_LAST_SEEN_KEY } from './Delivera-Shared-Storage-Keys.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { groupInboxByFingerprint } from './Delivera-App-Governance-Inbox-Group-01SSOT.js';
import { isSyntheticInboxId } from './Delivera-App-Governance-Inbox-01Fingerprint-SSOT.js';
import { buildGuidedNudgeText } from './Delivera-CurrentSprint-Action-Bridge.js';
import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function writeLastSeen() {
  try { localStorage.setItem(GOVERNANCE_INBOX_LAST_SEEN_KEY, new Date().toISOString()); } catch (_) {}
}

function isResolvableItem(item) {
  if (!item?.id || isSyntheticInboxId(item.id)) return false;
  if (item.payload?.synthetic) return false;
  return true;
}

const TAB_META = [
  ['doNow', '✉', 'queueTabDoNow', ['nudges', 'confirm']],
  ['background', '📋', 'queueTabBackground', ['briefs', 'piDrift', 'impact', 'poReadiness']],
];

function itemsForTab(data, key) {
  const meta = TAB_META.find(([k]) => k === key);
  if (!meta) return data?.[key] || [];
  const sources = meta[3] || [key];
  return sources.flatMap((src) => data?.[src] || []);
}

function tabCount(data, key) {
  return itemsForTab(data, key).length;
}

function sourceTabForItem(item, unifiedTab) {
  if (unifiedTab === 'doNow') {
    const t = String(item?.type || item?.payload?.type || '').toLowerCase();
    if (t.includes('nudge') || t.includes('confirm')) return t.includes('confirm') ? 'confirm' : 'nudges';
    return 'nudges';
  }
  return 'briefs';
}

function renderDrawerTabs(data, activeTabKey) {
  const tabs = TAB_META.map(([key, icon, copyKey]) => {
    const count = tabCount(data, key);
    const active = key === activeTabKey ? ' is-active' : '';
    const empty = count === 0 ? ' is-empty' : '';
    const label = COPY[copyKey] || key;
    return `<button type="button" class="gov-inbox-drawer-tab${active}${empty}" data-queue-tab="${key}" role="tab" aria-selected="${key === activeTabKey}" aria-label="${escapeHtml(label)} (${count})"${count === 0 ? ' disabled' : ''}>
      <span class="gov-inbox-drawer-tab-icon" aria-hidden="true">${icon}</span>
      <span class="gov-inbox-drawer-tab-count">${count || '·'}</span>
    </button>`;
  }).join('');
  return `<nav class="gov-inbox-drawer-tabs" role="tablist" aria-label="${escapeHtml(COPY.agentQueue)}">${tabs}</nav>`;
}

function nudgeDraftExcerpt(item) {
  const payload = item?.payload || {};
  const raw = String(payload.draftText || '').trim();
  if (raw) return raw.slice(0, 160);
  const issueKey = payload.issueKey || item?.issueKey;
  if (!issueKey) return '';
  return buildGuidedNudgeText({
    issueKey,
    issueSummary: payload.summary || item?.summary,
    issueStatus: payload.status,
    issueUrl: payload.issueUrl,
    staleHours: payload.ageHours,
  }).slice(0, 160);
}

function renderGroupedDrawer(items, showAll = false, tabKey = '') {
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
      : `<span class="gov-inbox-hint gov-inbox-cached-hint">${escapeHtml(COPY.inboxCachedHint)}</span>`;
    const draftLine = (tabKey === 'doNow' || tabKey === 'nudges') && ex?.id
      ? (() => {
        const excerpt = nudgeDraftExcerpt(ex);
        return excerpt
          ? `<p class="gov-inbox-draft-excerpt">${escapeHtml(excerpt)}</p>`
          : '';
      })()
      : '';
    return `
    <li class="gov-inbox-group-card" data-fingerprint="${escapeHtml(g.fingerprint)}">
      <div class="gov-inbox-group-head">
        <strong>${escapeHtml(g.owner)}</strong>
        <span class="gov-inbox-group-meta">${g.count} · ${escapeHtml(g.board || 'Portfolio')}</span>
      </div>
      <p class="gov-inbox-group-reason">${escapeHtml(g.exampleItem?.summary || g.reason || g.type)}</p>
      ${draftLine}
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

function drawerBodyHtml(data, tabKey, showAll = false) {
  const items = itemsForTab(data, tabKey);
  return `${renderDrawerTabs(data, tabKey)}<div class="gov-inbox-drawer-pane" role="tabpanel">${renderGroupedDrawer(items, showAll, tabKey)}</div>`;
}

export function mountGovernanceInbox({ mount, getProjectsCsv, onFocusConfirm, onRefreshBrief, onOpenNudgeReview, briefLoading }) {
  if (!mount) return { refresh: async () => {}, getConfirmCount: () => 0, getInboxTotal: () => 0, openQueueTab: () => {} };

  let lastData = null;
  let drawerClose = null;
  let drawerEl = null;
  let activeTabKey = 'doNow';

  async function fetchInbox() {
    const csv = getProjectsCsv?.() || 'MPSA,MAS';
    return fetchJson(`/api/governance/inbox.json?projects=${encodeURIComponent(csv)}`, {}, 'governance-inbox');
  }

  async function resolveItem(id, resolution, dismissReason = '') {
    if (!id || isSyntheticInboxId(id)) return;
    try {
      await fetchJson(`/api/governance/inbox/${encodeURIComponent(id)}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, dismissReason }),
      }, 'inbox-resolve');
      await refresh();
      drawerClose?.();
    } catch (err) {
      const msg = err?.status === 400 ? COPY.inboxAlreadyHandled : (err?.message || COPY.inboxResolveFailed);
      showInlineToast(drawerEl || mount, msg, 'error');
    }
  }

  async function resolveGroup(fingerprint, resolution, dismissReason, tabKey) {
    const items = itemsForTab(lastData, tabKey);
    const groups = groupInboxByFingerprint(items);
    const g = groups.find((x) => x.fingerprint === fingerprint);
    if (!g) return;
    const ids = g.ids.filter((id) => !isSyntheticInboxId(id));
    await Promise.all(ids.map((id) => resolveItem(id, resolution, dismissReason)));
  }

  function bindDrawerActions(el, tabKey) {
    const items = itemsForTab(lastData, tabKey);
    const openReview = onOpenNudgeReview;
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
        const ex = g?.exampleItem;
        if (!ex) return;
        if ((tabKey === 'doNow' || tabKey === 'nudges') && openReview) {
          drawerClose?.();
          openReview(ex);
          return;
        }
        if (ex.id && isResolvableItem(ex)) resolveItem(ex.id, 'approved');
      });
    });
    el.querySelector('#gov-inbox-show-more')?.addEventListener('click', () => {
      const pane = el.querySelector('.gov-inbox-drawer-pane');
      if (pane) pane.innerHTML = renderGroupedDrawer(items, true, tabKey);
      bindDrawerActions(el, tabKey);
    });
    el.querySelector('#gov-inbox-refresh-brief')?.addEventListener('click', () => {
      drawerClose?.();
      onRefreshBrief?.();
    });
  }

  function bindDrawerTabs(el) {
    el.querySelectorAll('[data-queue-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-queue-tab');
        if (!key || tabCount(lastData, key) === 0) return;
        switchDrawerTab(el, key);
      });
    });
  }

  function switchDrawerTab(el, tabKey) {
    activeTabKey = tabKey;
    if (tabKey === 'confirm' || tabKey === 'doNow') onFocusConfirm?.();
    const body = el.querySelector('.gov-right-drawer-body');
    if (!body) return;
    body.innerHTML = drawerBodyHtml(lastData, tabKey, false);
    bindDrawerTabs(el);
    bindDrawerActions(el, tabKey);
  }

  function openQueueDrawer(tabKey) {
    const data = lastData || {};
    const items = data[tabKey] || [];
    const label = COPY[TAB_META.find(([k]) => k === tabKey)?.[2]] || tabKey;
    writeLastSeen();
    activeTabKey = tabKey;
    if (tabKey === 'confirm' || tabKey === 'doNow') onFocusConfirm?.();

    const { close, el } = openRightDrawer({
      title: `${COPY.agentQueue} — ${label} (${items.length})`,
      bodyHtml: drawerBodyHtml(data, tabKey, false),
    });
    drawerClose = close;
    drawerEl = el;
    bindDrawerTabs(el);
    bindDrawerActions(el, tabKey);
  }

  function openCombinedDrawer(preferredTab) {
    const data = lastData || {};
    const tabKey = preferredTab && tabCount(data, preferredTab) > 0
      ? preferredTab
      : (TAB_META.find(([k]) => tabCount(data, k) > 0)?.[0] || 'doNow');
    openQueueDrawer(tabKey);
  }

  function renderInlinePreview(data, total) {
    const items = itemsForTab(data, 'doNow');
    const groups = groupInboxByFingerprint(items).slice(0, 3);
    if (!groups.length) return { preview: '', chip: '' };
    const rows = groups.map((g) => `
      <li class="gov-inbox-inline-row">
        <button type="button" class="gov-inbox-inline-open" data-inline-open="${escapeHtml(g.fingerprint)}" aria-label="${escapeHtml(g.owner)} — ${g.count} items">
          <strong class="gov-inbox-inline-owner">${escapeHtml(g.owner)}</strong>
          <span class="gov-inbox-inline-summary">${escapeHtml(g.exampleItem?.summary || g.reason || g.type || '')}</span>
          <em class="gov-inbox-inline-count">${g.count}</em>
        </button>
      </li>`).join('');
    const preview = `<ul class="gov-inbox-inline-preview" data-inbox-inline="1" aria-label="Top queue items">${rows}</ul>`;
    const chip = `<button type="button" class="gov-queue-chip gov-queue-chip--secondary" data-queue-open="1" aria-label="Open full agent queue">All queue (${total})</button>`;
    return { preview, chip };
  }

  function render() {
    const total = TAB_META.reduce((n, [k]) => n + tabCount(lastData, k), 0);
    const preparing = total === 0 && briefLoading?.();
    const inline = total > 0 ? renderInlinePreview(lastData, total) : { preview: '', chip: '' };
    const chip = total > 0
      ? (inline.chip || `<button type="button" class="gov-queue-chip gov-queue-chip--primary" data-queue-open="1" aria-label="${escapeHtml(COPY.seeQueue)}">
          <span class="gov-queue-chip-icon" aria-hidden="true">📋</span>
          ${escapeHtml(COPY.seeQueue)} (${total})
        </button>`)
      : `<span class="gov-inbox-hint">${escapeHtml(preparing ? COPY.inboxPreparing : COPY.inboxUnavailable)}</span>`;
    mount.innerHTML = `
      <div class="gov-agent-queue" role="group" aria-label="${escapeHtml(COPY.agentQueue)}">
        ${inline.preview}
        ${chip}
      </div>`;
    mount.querySelector('[data-queue-open]')?.addEventListener('click', () => openCombinedDrawer());
    mount.querySelectorAll('[data-inline-open]').forEach((btn) => {
      btn.addEventListener('click', () => openCombinedDrawer('doNow'));
    });
    const rightRail = document.getElementById('gov-right-rail-mount');
    if (rightRail) {
      if (total > 0) rightRail.setAttribute('data-right-rail-has-queue', 'true');
      else rightRail.removeAttribute('data-right-rail-has-queue');
    }
  }

  async function refresh() {
    try {
      lastData = await fetchInbox();
      render();
    } catch (_) {
      mount.innerHTML = `<p class="gov-inbox-hint">${escapeHtml(COPY.inboxUnavailable)}</p>`;
    }
  }

  render();
  return {
    refresh,
    getConfirmCount: () => tabCount(lastData, 'doNow'),
    getInboxTotal: () => TAB_META.reduce((n, [k]) => n + tabCount(lastData, k), 0),
    openQueue: () => openCombinedDrawer(),
    openQueueTab: (tabKey) => {
      const unified = tabKey === 'confirm' || tabKey === 'nudges' ? 'doNow'
        : (tabKey === 'briefs' || tabKey === 'piDrift' || tabKey === 'impact' || tabKey === 'poReadiness' ? 'background' : tabKey);
      document.getElementById('gov-right-rail-mount')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      openCombinedDrawer(unified);
    },
  };
}
