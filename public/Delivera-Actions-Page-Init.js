import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { showSurfaceError, showSurfaceEmpty } from './Delivera-Shared-Surface-State-01SSOT.js';
import {
  listCases,
  loadCase,
  approveDraft,
  renderActionsCaseCard,
} from './Delivera-App-Governance-InterventionCase-02Client-SSOT.js';
import { fetchSprintBlockerSignal } from './Delivera-CurrentSprint-Action-Bridge.js';
import { openJiraNudgeReviewSheet } from './Delivera-CurrentSprint-JiraNudge-02ReviewSheet-01UI.js';

const TABS = [
  { id: 'ready', label: 'Action needed' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'closed', label: 'Done' },
];

let selectedCaseId = '';

function readQuery() {
  try {
    return new URLSearchParams(window.location.search);
  } catch (_) {
    return new URLSearchParams();
  }
}

function renderBlockerQueueHtml(signal = {}) {
  const items = signal.items || [];
  if (!items.length) return '';
  const count = items.length;
  const top = items.slice(0, 3).map((item) => `
    <li class="actions-blocker-inline-row">
      <strong>${escapeHtml(item.issueKey || item.key || 'Blocker')}</strong>
      <span>${escapeHtml(item.summary || item.reason || 'Needs review')}</span>
      ${item.issueKey ? `<button type="button" class="btn btn-link btn-compact" data-actions-nudge="${escapeHtml(item.issueKey)}">Nudge</button>` : ''}
    </li>`).join('');
  const cacheNote = signal.source === 'cache'
    ? '<p class="actions-blocker-queue-note">From cached brief — refresh Squads for live state.</p>'
    : '';
  return `
    <section class="actions-blocker-queue" data-testid="actions-blocker-queue" aria-label="Sprint blockers">
      <h2 class="actions-blocker-queue-title">Sprint blockers (${count})</h2>
      ${cacheNote}
      <ul class="actions-blocker-inline-list">${top}</ul>
      <a href="/current-sprint#stuck-card" class="btn btn-secondary btn-compact">Open in Squads</a>
    </section>`;
}

async function applyBlockerUx(readyCount = 0, signal = null) {
  const resolved = signal || await fetchSprintBlockerSignal();
  const hasBlockers = Boolean(resolved.hasBlockers);
  document.body.classList.toggle('actions-empty-ready', readyCount === 0);
  document.body.classList.toggle('actions-has-blockers', hasBlockers);
  document.getElementById('actions-blocker-banner')?.remove();
  return resolved;
}

function activeTab() {
  return readQuery().get('tab') || 'ready';
}

function filterCases(cases = [], tab = 'ready') {
  if (tab === 'closed') return cases.filter((c) => c.state === 'closed' || c.state !== 'closed');
  if (tab === 'escalations') return cases.filter((c) => String(c.state || '').includes('escalation'));
  if (tab === 'ready') return cases.filter((c) => c.state !== 'closed' && (c.needsApproval || String(c.state || '').includes('clarification') || String(c.state || '').includes('decision')));
  return cases.filter((c) => c.state !== 'closed');
}

function tabCounts(cases = []) {
  return TABS.reduce((acc, tab) => {
    acc[tab.id] = filterCases(cases, tab.id).length;
    return acc;
  }, {});
}

function renderTabs(tab, counts = {}) {
  const mount = document.getElementById('actions-tabs');
  if (!mount) return;
  mount.innerHTML = TABS.map((t) => {
    const n = counts[t.id] || 0;
    const badge = n > 0 ? ` <span class="actions-tab-count">${n}</span>` : '';
    return `<button type="button" class="actions-tab${t.id === tab ? ' is-active' : ''}" data-tab="${t.id}">${escapeHtml(t.label)}${badge}</button>`;
  }).join('');
  mount.onclick = (ev) => {
    const btn = ev.target.closest('[data-tab]');
    if (!btn) return;
    const next = btn.getAttribute('data-tab');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState({}, '', url);
    paint(next);
  };
}

async function batchApproveSafe(cases = []) {
  const safe = cases.filter((c) => c.needsApproval && c.state !== 'closed' && c.safeToSend !== false);
  for (const row of safe) {
    try { await approveDraft(row.id, true); } catch (_) {}
  }
  await paint('ready');
}

function renderBatchBar(cases = [], tab = 'ready') {
  const bar = document.getElementById('actions-batch-bar');
  if (!bar || tab !== 'ready') {
    if (bar) bar.hidden = true;
    return;
  }
  const safe = cases.filter((c) => c.needsApproval && c.state !== 'closed');
  if (safe.length < 2) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  bar.innerHTML = `<button type="button" class="btn btn-primary btn-compact" data-batch-approve="1">Approve ${safe.length} safe nudges</button>`;
  bar.onclick = async (ev) => {
    if (!ev.target.closest('[data-batch-approve]')) return;
    await batchApproveSafe(safe);
  };
}

function renderCasePreview(row = {}) {
  const issues = (row.issueKeys || []).join(', ');
  const canApprove = Boolean(row.needsApproval);
  return `
    <div class="actions-preview-panel">
      <p class="actions-preview-eyebrow">Case preview</p>
      <h2>${escapeHtml(row.title || `${row.project} scope review`)}</h2>
      <p class="actions-case-kind"><strong>${escapeHtml(COPY.actionsCaseNudgeLabel)}</strong></p>
      <p><strong>State:</strong> ${escapeHtml(row.state || 'open')}</p>
      <p><strong>Issues:</strong> ${escapeHtml(issues || '—')}</p>
      <p>${escapeHtml(row.primaryAction?.action || 'Review facts and approve the next nudge when ready.')}</p>
      <div class="actions-case-inline-actions">
        ${canApprove ? `<button type="button" class="btn btn-primary btn-compact" data-approve-case="${escapeHtml(row.id)}">${escapeHtml(COPY.actionsApproveInline)}</button>` : ''}
        <button type="button" class="btn btn-secondary btn-compact" data-decline-case="${escapeHtml(row.id)}">${escapeHtml(COPY.actionsDeclineInline)}</button>
        <a class="btn btn-link btn-compact" href="/governance">Portfolio context</a>
      </div>
      <p class="actions-case-status" data-case-status hidden></p>
    </div>`;
}

async function showCasePreview(caseId, cases = []) {
  const preview = document.getElementById('actions-preview-rail');
  if (!preview) return;
  selectedCaseId = caseId || '';
  document.querySelectorAll('.actions-case-card').forEach((card) => {
    card.classList.toggle('is-selected', card.getAttribute('data-case-id') === caseId);
  });
  if (!caseId) {
    preview.hidden = true;
    preview.innerHTML = '';
    return;
  }
  let row = cases.find((c) => c.id === caseId);
  if (!row) {
    try { row = await loadCase(caseId); } catch (_) { return; }
  }
  preview.hidden = false;
  preview.innerHTML = renderCasePreview(row);
}

async function paint(tab = activeTab()) {
  const project = readQuery().get('project') || '';
  let cases = [];
  try {
    cases = await listCases({ project, status: 'open' });
  } catch (err) {
    const list = document.getElementById('actions-list');
    if (list) {
      list.hidden = false;
      list.innerHTML = `<section class="actions-do-now-stream" data-testid="actions-do-now-stream"></section>`;
      showSurfaceError(list.querySelector('.actions-do-now-stream'), 'Couldn\'t load cases right now.', {
        retry: () => paint(tab),
        compact: true,
      });
    }
    document.getElementById('actions-preview-rail')?.setAttribute('hidden', '');
    renderTabs(tab, {});
    return;
  }
  const counts = tabCounts(cases);
  renderTabs(tab, counts);
  const list = document.getElementById('actions-list');
  const highlightId = readQuery().get('caseId') || '';
  const visible = filterCases(cases, tab);
  const signal = await applyBlockerUx(counts.ready || 0);
  if (list) {
    list.hidden = false;
    const defaultId = highlightId || selectedCaseId || visible[0]?.id || '';
    const caseHtml = visible.length
      ? visible.map((row) => renderActionsCaseCard(row, {
        highlight: row.id === highlightId,
        selected: row.id === defaultId,
      })).join('')
      : '';
    const blockerHtml = signal.hasBlockers ? renderBlockerQueueHtml(signal) : '';
    const inner = `${blockerHtml}${caseHtml}` || '';
    list.innerHTML = `<section class="actions-do-now-stream" data-testid="actions-do-now-stream">${inner}</section>`;
    if (!inner) {
      showSurfaceEmpty(list.querySelector('.actions-do-now-stream'), {
        title: 'No action needed now',
        message: 'All clear — no nudges, decisions, or escalations pending.',
        whyMatters: 'When issues arise, they appear here so you can act before they escalate.',
        compact: true,
        actions: [
          { label: 'Portfolio decision', href: '/governance', primary: true },
          { label: 'View squad sprint', href: '/current-sprint' },
        ],
      });
      await showCasePreview('', cases);
    } else if (defaultId) {
      await showCasePreview(defaultId, cases);
    }
    renderBatchBar(visible, tab);
    if (highlightId) {
      document.getElementById(`case-${highlightId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

async function openCaseReview(caseId) {
  if (!caseId) return;
  const url = new URL(window.location.href);
  url.searchParams.set('caseId', caseId);
  url.searchParams.set('review', '1');
  window.history.replaceState({}, '', url);
  const cases = await listCases({ project: readQuery().get('project') || '', status: 'open' });
  await showCasePreview(caseId, cases);
}

async function init() {
  document.title = 'Actions | Delivera';
  if (window.matchMedia('(min-width: 1024px)').matches) {
    document.body.classList.add('actions-preview-desktop');
  }
  await paint();
  const reviewId = readQuery().get('caseId');
  if (readQuery().get('review') === '1' && reviewId) await openCaseReview(reviewId);
  document.getElementById('actions-list')?.addEventListener('click', async (ev) => {
    const nudgeBtn = ev.target.closest('[data-actions-nudge]');
    if (nudgeBtn) {
      const issueKey = nudgeBtn.getAttribute('data-actions-nudge');
      if (issueKey) {
        openJiraNudgeReviewSheet({ issueKey, prefillContext: `Unblock ${issueKey} today.` });
      }
      return;
    }
    const card = ev.target.closest('.actions-case-card');
    if (card && !ev.target.closest('button, a')) {
      await openCaseReview(card.getAttribute('data-case-id'));
      return;
    }
    const approve = ev.target.closest('[data-approve-case]');
    if (approve) {
      const id = approve.getAttribute('data-approve-case');
      const status = approve.closest('.actions-preview-panel, .actions-case-detail')?.querySelector('[data-case-status]');
      try {
        await approveDraft(id, true);
        if (status) { status.hidden = false; status.textContent = 'Approved'; }
        await paint(activeTab());
      } catch (err) {
        if (status) { status.hidden = false; status.textContent = err?.message || 'Approve failed'; }
      }
      return;
    }
    const decline = ev.target.closest('[data-decline-case]');
    if (decline) {
      selectedCaseId = '';
      document.getElementById('actions-preview-rail')?.setAttribute('hidden', '');
      decline.closest('.actions-case-card')?.classList.remove('is-selected');
      return;
    }
    const btn = ev.target.closest('[data-open-case]');
    if (!btn) return;
    await openCaseReview(btn.getAttribute('data-open-case'));
  });
  document.getElementById('actions-preview-rail')?.addEventListener('click', async (ev) => {
    const approve = ev.target.closest('[data-approve-case]');
    if (!approve) return;
    const id = approve.getAttribute('data-approve-case');
    const status = approve.closest('.actions-preview-panel')?.querySelector('[data-case-status]');
    try {
      await approveDraft(id, true);
      if (status) { status.hidden = false; status.textContent = 'Approved'; }
      await paint(activeTab());
    } catch (err) {
      if (status) { status.hidden = false; status.textContent = err?.message || 'Approve failed'; }
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
