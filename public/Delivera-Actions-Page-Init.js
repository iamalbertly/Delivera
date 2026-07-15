import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { addTitleForTruncatedCells } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY, formatHumanAge } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { showSurfaceError, showSurfaceEmpty, renderSurfaceState } from './Delivera-Shared-Surface-State-01SSOT.js';
import {
  listCases,
  loadCase,
  approveDraft,
  renderActionsCaseCard,
} from './Delivera-App-Governance-InterventionCase-02Client-SSOT.js';
import { fetchSprintBlockerSignal } from './Delivera-CurrentSprint-Action-Bridge.js';
import { openJiraNudgeReviewSheet } from './Delivera-CurrentSprint-JiraNudge-02ReviewSheet-01UI.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { resolveProjectDisplay } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import { showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { paintInstantShell, clearInstantShell, rememberSurfaceHtml, setDeliveraSurfaceState } from './Delivera-Shared-Instant-Shell-01UI.js';
import { mountSharedStickyScope, ensureSharedStickyScopeMount } from './Delivera-Shared-Sticky-Scope-01Mount-UI.js';
import {
  filterCasesByTab,
  resolveActionsProjectFromQuery,
} from './Delivera-App-Actions-Case-01Scope-Filter-SSOT.js';

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

function formatBlockerAge(hours = 0) {
  const h = Number(hours) || 0;
  if (h <= 0) return '';
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.max(1, Math.round(h / 24))}d`;
}

function renderBlockerQueueHtml(signal = {}) {
  const items = [...(signal.items || [])].sort((a, b) => (Number(b.hoursInStatus) || 0) - (Number(a.hoursInStatus) || 0));
  if (!items.length) return '';
  const count = items.length;
  const rows = items.map((item) => {
    const summary = item.summary || item.reason || 'Needs review';
    const age = formatBlockerAge(item.hoursInStatus);
    return `
    <li class="actions-blocker-inline-row" data-blocker-key="${escapeHtml(item.issueKey || '')}">
      <div class="actions-blocker-row-main">
        <strong>${escapeHtml(item.issueKey || item.key || 'Blocker')}</strong>
        ${age ? `<span class="actions-blocker-age">${escapeHtml(age)} stale</span>` : ''}
        <span class="actions-blocker-summary" title="${escapeHtml(summary)}">${escapeHtml(summary)}</span>
      </div>
      ${item.issueKey ? `<button type="button" class="btn btn-primary btn-compact actions-blocker-nudge" data-actions-nudge="${escapeHtml(item.issueKey)}">Nudge</button>` : '<span class="actions-blocker-age">No key</span>'}
    </li>`;
  }).join('');
  const cacheNote = signal.source === 'cache'
    ? '<p class="actions-blocker-queue-note">From cached brief — refresh Squads for live state.</p>'
    : '';
  const nudgeAll = count > 1
    ? `<button type="button" class="btn btn-secondary btn-compact actions-nudge-all" data-actions-nudge-all="1">Nudge all ${count}</button>`
    : '';
  return `
    <section class="actions-blocker-queue" data-testid="actions-blocker-queue" aria-label="Sprint blockers">
      <div class="actions-blocker-queue-head">
        <h2 class="actions-blocker-queue-title">Sprint blockers (${count})</h2>
        ${nudgeAll}
      </div>
      ${cacheNote}
      <ul class="actions-blocker-inline-list">${rows}</ul>
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

function caseUrgencyScore(row = {}) {
  let score = 0;
  if (row.needsApproval) score += 50;
  if (String(row.state || '').includes('escalation')) score += 40;
  if (String(row.state || '').includes('clarification')) score += 30;
  if (String(row.state || '').includes('decision')) score += 25;
  return score;
}

function sortCasesByUrgency(cases = []) {
  return [...cases].sort((a, b) => caseUrgencyScore(b) - caseUrgencyScore(a));
}

function readPortfolioVerdictLine() {
  try {
    const raw = sessionStorage.getItem('delivera:portfolio-decision:cache:v1');
    if (!raw) return '';
    const map = JSON.parse(raw);
    const first = Object.values(map || {}).find((e) => e?.payload?.decision?.narrative?.headline);
    return first?.payload?.decision?.narrative?.headline
      || first?.payload?.decision?.recommendation?.label
      || '';
  } catch (_) {
    return '';
  }
}

function renderActionsH1(readyCount = 0, blockerCount = 0) {
  const h1 = document.querySelector('.actions-header h1');
  if (!h1) return;
  if (blockerCount > 0 && readyCount > 0) {
    h1.textContent = `${blockerCount} blocker${blockerCount === 1 ? '' : 's'} · ${readyCount} decision${readyCount === 1 ? '' : 's'}`;
  } else if (blockerCount > 0) {
    h1.textContent = `${blockerCount} sprint blocker${blockerCount === 1 ? '' : 's'} need nudge`;
  } else if (readyCount > 0) {
    h1.textContent = `${readyCount} action${readyCount === 1 ? '' : 's'} need you`;
  } else {
    h1.textContent = 'Actions';
  }
}

function renderActionsSubtitle(readyCount = 0, blockerCount = 0) {
  const mount = document.querySelector('.actions-subtitle');
  if (!mount) return;
  const verdict = readPortfolioVerdictLine();
  if (blockerCount > 0) {
    mount.textContent = `${blockerCount} blocker${blockerCount === 1 ? '' : 's'} in sprint · ${readyCount} governance decision${readyCount === 1 ? '' : 's'}${verdict ? ` · ${verdict}` : ''}`;
  } else if (readyCount > 0) {
    mount.textContent = `${readyCount} decision${readyCount === 1 ? '' : 's'} waiting on you${verdict ? ` · Portfolio: ${verdict}` : ''}`;
  } else {
    mount.textContent = 'All clear — nudges and decisions appear here when needed.';
  }
}

function renderProjectChip(project = '') {
  if (!project) return '';
  const label = resolveProjectDisplay(project, { displayMode: 'both' }).full || project;
  return `<p class="actions-project-chip" data-testid="actions-project-chip">Scope: <strong>${escapeHtml(label)}</strong></p>`;
}

function resolveActionsProject() {
  return resolveActionsProjectFromQuery(readQuery(), readSharedProjectsCsv());
}

function activeTab() {
  return readQuery().get('tab') || 'ready';
}

function filterCases(cases = [], tab = 'ready', project = '') {
  return filterCasesByTab(cases, tab, project);
}

function tabCounts(cases = [], project = '') {
  return TABS.reduce((acc, tab) => {
    acc[tab.id] = filterCases(cases, tab.id, project).length;
    return acc;
  }, {});
}

function renderTabs(tab, counts = {}) {
  const mount = document.getElementById('actions-tabs');
  if (!mount) return;
  const visibleTabs = TABS.filter((t) => (counts[t.id] || 0) > 0 || t.id === tab);
  const tabs = visibleTabs.length ? visibleTabs : TABS.filter((t) => t.id === 'ready');
  mount.innerHTML = tabs.map((t) => {
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
  if (safe.length < 3) {
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
  const verdict = readPortfolioVerdictLine();
  const verdictLine = verdict
    ? `<p class="actions-preview-portfolio-verdict" data-testid="actions-preview-portfolio-verdict">Portfolio: ${escapeHtml(verdict)}</p>`
    : '';
  return `
    <div class="actions-preview-panel">
      <p class="actions-preview-eyebrow">Case preview</p>
      ${verdictLine}
      <h2 title="${escapeHtml(row.title || `${row.project} scope review`)}">${escapeHtml(row.title || `${row.project} scope review`)}</h2>
      <p class="actions-case-kind"><strong>${escapeHtml(COPY.actionsCaseNudgeLabel)}</strong></p>
      <p><strong>State:</strong> ${escapeHtml(row.state || 'open')}</p>
      <p><strong>Issues:</strong> ${escapeHtml(issues || '—')}</p>
      <p>${escapeHtml(row.primaryAction?.action || 'Review facts and approve the next nudge when ready.')}</p>
      <div class="actions-case-inline-actions">
        ${canApprove ? `<button type="button" class="btn btn-primary btn-compact" data-approve-case="${escapeHtml(row.id)}">${escapeHtml(COPY.actionsApproveInline)}</button>` : ''}
        <button type="button" class="btn btn-secondary btn-compact" data-decline-case="${escapeHtml(row.id)}">${escapeHtml(COPY.actionsDeclineInline)}</button>
        <a class="btn btn-link btn-compact" href="/governance${row.project ? `?project=${encodeURIComponent(row.project)}` : ''}" data-testid="actions-view-portfolio">View in Portfolio</a>
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
  const project = resolveActionsProject();
  if (project && !readQuery().get('project')) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('project', project);
      window.history.replaceState({}, '', url);
    } catch (_) { /* ignore */ }
  }
  let cases = [];
  const blockerSignalPromise = fetchSprintBlockerSignal().catch(() => ({ hasBlockers: false, items: [], source: 'unavailable' }));
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
    setDeliveraSurfaceState('actions', 'error', { scopeLabel: project });
    return;
  }
  const counts = tabCounts(cases, project);
  const signal = await applyBlockerUx(counts.ready || 0, await blockerSignalPromise);
  const blockerCount = (signal.items || []).length;
  renderActionsH1(counts.ready || 0, blockerCount);
  renderActionsSubtitle(counts.ready || 0, blockerCount);
  renderTabs(tab, counts);
  const list = document.getElementById('actions-list');
  const highlightId = readQuery().get('case') || readQuery().get('caseId') || '';
  const visible = sortCasesByUrgency(filterCases(cases, tab, project));
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
    list.innerHTML = `${project ? renderProjectChip(project) : ''}<section class="actions-do-now-stream" data-testid="actions-do-now-stream">${inner}</section>`;
    if (!inner) {
      if (signal.source === 'unavailable') {
        renderSurfaceState(list.querySelector('.actions-do-now-stream'), {
          variant: 'unavailable',
          title: 'Sprint blockers cannot be verified',
          message: 'The action queue loaded, but Jira blocker evidence is unavailable. Delivera will not call this squad all clear.',
          hint: 'Check Jira connection; the selected squad and quarter are preserved.',
          compact: true,
        });
      } else {
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
      }
      await showCasePreview('', cases);
    } else if (defaultId) {
      await showCasePreview(defaultId, cases);
    }
    renderBatchBar(visible, tab);
    if (highlightId && !visible.some((c) => c.id === highlightId) && signal.hasBlockers) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('case');
        url.searchParams.delete('caseId');
        window.history.replaceState({}, '', url);
      } catch (_) { /* ignore */ }
    }
    if (highlightId) {
      document.getElementById(`case-${highlightId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    addTitleForTruncatedCells('.actions-blocker-summary, .actions-case-card h2, .actions-preview-panel h2');
  }
  const actionState = signal.source === 'unavailable'
    ? (visible.length ? 'partial' : 'unavailable')
    : (visible.length || signal.hasBlockers ? 'live' : 'empty');
  setDeliveraSurfaceState('actions', actionState, { scopeLabel: project });
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
  // P0 FIX: Paint instant skeleton shell — no blank white page.
  paintInstantShell('actions', { scopeLabel: resolveActionsProject() });
  window.addEventListener('delivera:surface-retry', (event) => {
    if (event.detail?.surface === 'actions') void paint();
  });
  try {
    mountSharedStickyScope({
      mount: ensureSharedStickyScopeMount(document.querySelector('.actions-header')),
      profile: 'compact',
      onRefresh: () => { void paint(); },
    });
  } catch (_) { /* non-fatal */ }
  if (window.matchMedia('(min-width: 1024px)').matches) {
    document.body.classList.add('actions-preview-desktop');
  }
  await paint();
  clearInstantShell();
  const actionsMount = document.getElementById('actions-list');
  if (actionsMount) {
    actionsMount.removeAttribute('aria-busy');
    actionsMount.setAttribute('aria-busy', 'false');
  }
  const list = document.getElementById('actions-list');
  if (list) rememberSurfaceHtml('actions', list.innerHTML, { scopeLabel: resolveActionsProject() });
  const shell = document.querySelector('[data-testid="instant-shell"], [data-testid="instant-shell-stale"]');
  if (shell) shell.remove();
  const reviewId = readQuery().get('case') || readQuery().get('caseId');
  if (readQuery().get('review') === '1' && reviewId) await openCaseReview(reviewId);
  document.getElementById('actions-list')?.addEventListener('click', async (ev) => {
    const nudgeAllBtn = ev.target.closest('[data-actions-nudge-all]');
    if (nudgeAllBtn) {
      const keys = [...document.querySelectorAll('[data-actions-nudge]')]
        .map((el) => el.getAttribute('data-actions-nudge'))
        .filter(Boolean);
      if (keys[0]) {
        openJiraNudgeReviewSheet({ issueKey: keys[0], prefillContext: `Unblock ${keys.length} sprint blockers today.` });
        showInlineToast(document.querySelector('.actions-blocker-queue') || document.body, `Opening nudge for ${keys[0]} (${keys.length} blockers queued)`, 'info');
      }
      return;
    }
    const nudgeBtn = ev.target.closest('[data-actions-nudge]');
    if (nudgeBtn) {
      const issueKey = nudgeBtn.getAttribute('data-actions-nudge');
      if (issueKey) {
        openJiraNudgeReviewSheet({ issueKey, prefillContext: `Unblock ${issueKey} today.` });
        showInlineToast(nudgeBtn.closest('.actions-blocker-queue') || document.body, `Nudge ready · ${issueKey}`, 'success');
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
        showInlineToast(document.body, 'Nudge approved', 'success');
        await paint(activeTab());
      } catch (err) {
        const msg = err?.status === 422 || /422|unprocessable/i.test(String(err?.message || ''))
          ? 'Approve blocked — case needs clarification before send. Open Review case.'
          : (err?.message || 'Approve failed');
        if (status) { status.hidden = false; status.textContent = msg; }
        showInlineToast(document.body, msg, 'error');
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
      showInlineToast(document.body, 'Nudge approved', 'success');
      await paint(activeTab());
    } catch (err) {
      const msg = err?.status === 422 || /422|unprocessable/i.test(String(err?.message || ''))
        ? 'Approve blocked — case needs clarification before send.'
        : (err?.message || 'Approve failed');
      if (status) { status.hidden = false; status.textContent = msg; }
      showInlineToast(document.body, msg, 'error');
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
