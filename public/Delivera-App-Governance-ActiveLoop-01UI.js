import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openRightDrawer, closeAllGovernanceOverlays } from './Delivera-App-Shared-RightDrawer-01UI.js';

const CACHE_PREFIX = 'delivera:governance:active-loop:v2';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
let requestSequence = 0;
let activeAnswer = null;
let pendingAnswer = null;
let decisionInProgress = false;
let persistentPreview = null;
let spotlightKey = '';

const actionLabels = {
  'send-nudge': 'Send nudge',
  'pull-fresh-evidence': 'Pull fresh proof for this promise',
  'approve-match': 'Approve match',
  'amend-contract': 'Amend contract',
  'assign-owner': 'Assign owner',
  'accept-risk': 'Accept risk',
  'recheck-promise': 'Re-check this promise',
  'escalate-owner': 'Escalate owner',
};

function scopeKey(projects, quarter) {
  return `${CACHE_PREFIX}:${String(projects || '').toUpperCase()}:${String(quarter || 'current')}`;
}

function readCachedAnswer(projects, quarter) {
  try {
    const legacyKey = `delivera:governance:active-loop:v1:${String(projects || '').toUpperCase()}:${String(quarter || 'current')}`;
    const envelope = JSON.parse(localStorage.getItem(scopeKey(projects, quarter)) || localStorage.getItem(legacyKey) || 'null');
    if (![1, 2].includes(envelope?.answer?.schemaVersion) || !envelope?.savedAt) return null;
    if (Date.now() - new Date(envelope.savedAt).getTime() > CACHE_MAX_AGE_MS) return null;
    return { ...envelope.answer, servedFromLocalCache: true };
  } catch (_) { return null; }
}

function writeCachedAnswer(projects, quarter, answer) {
  try { localStorage.setItem(scopeKey(projects, quarter), JSON.stringify({ savedAt: new Date().toISOString(), answer })); } catch (_) { /* quota/privacy */ }
}

function tone(state) {
  if (['matched', 'aligned-amended', 'resolved-matched'].includes(state)) return 'safe';
  if (['partly-matched', 'done-not-accepted', 'awaiting-owner', 'reply-received-ready-to-recheck'].includes(state)) return 'watch';
  if (['cannot-verify', 'missing'].includes(state)) return 'unknown';
  return 'risk';
}

function currentFreshness(answer) {
  const verified = new Date(answer?.verifiedAt);
  const age = Number.isFinite(verified.getTime()) ? Math.max(0, Math.floor((Date.now() - verified.getTime()) / 60000)) : null;
  if (answer?.freshness?.state === 'failed') return { state: 'failed', copy: 'Showing last verified state. Jira refresh failed.' };
  if (answer?.scope?.complete === false) return { state: 'partial', copy: `${answer.scope.verifiedSquads} of ${answer.scope.expectedSquads} squads verified. Portfolio conclusion limited.` };
  if (age == null || age >= 60) return { state: 'stale', copy: 'Showing last verified state. Freshness-dependent decisions are paused.' };
  if (age > 15) return { state: 'paused', copy: `Sync paused ${age}m ago.` };
  return { state: 'calm', copy: `Last verified ${verified.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` };
}

function matrixRow(squad) {
  const baseline = squad.baselineCoverage || (activeAnswer?.contract ? { state: 'verified', sourceLabel: activeAnswer.contract.source || 'Approved PI contract', copy: 'Contract source confirmed.' } : { state: 'missing', copy: 'Baseline missing.' });
  const split = squad.workSplit || {};
  const alignment = baseline.state === 'missing' ? 'Cannot verify' : `${squad.piPct == null ? 'Unknown' : `${squad.piPct}% PI contract`} · ${squad.topState || 'unknown'}`;
  const action = squad.nextAction?.label || (baseline.state === 'missing' ? 'Save baseline to compare' : 'Review evidence');
  return `<button type="button" role="row" class="gov-story-row gov-story-row--${tone(baseline.state === 'missing' ? 'missing' : squad.topState)}" data-story-squad="${escapeHtml(squad.squad)}" data-loop-squad="${escapeHtml(squad.squad)}" aria-current="${spotlightKey === squad.squad ? 'true' : 'false'}">
    <span role="cell" class="gov-story-squad"><strong>${escapeHtml(squad.squad)}</strong><small>${escapeHtml(squad.attentionCount ? `${squad.attentionCount} needs attention` : 'calm') }</small></span>
    <span role="cell"><strong>${escapeHtml(alignment)}</strong><small>${escapeHtml(squad.amendmentSentence || '')}</small></span>
    <span role="cell"><strong>${escapeHtml(baseline.sourceLabel || 'Baseline missing')}</strong><small>${escapeHtml(baseline.copy || '')}</small></span>
    <span role="cell"><strong>${escapeHtml(squad.sprintReality?.state || 'unknown')}</strong><small>${escapeHtml(squad.sprintReality?.copy || 'Sprint reality unavailable.')}</small></span>
    <span role="cell"><strong>${escapeHtml(squad.doingInstead?.major?.title || (squad.doingInstead?.operationalNoise?.ticketCount ? 'Operational noise' : 'No major diversion'))}</strong><small>${escapeHtml(squad.doingInstead?.copy || split.explanation || '')}</small></span>
    <span role="cell"><strong>${escapeHtml(squad.proofState || 'unknown')}</strong><small>${escapeHtml(action)}</small></span>
  </button>`;
}

function portfolioMatrix(answer) {
  return `<section class="gov-story-matrix" aria-labelledby="gov-story-matrix-title">
    <div class="gov-story-matrix-head"><div><span class="gov-loop-kicker">Portfolio Status Matrix</span><h2 id="gov-story-matrix-title">Squad comparison</h2></div><button type="button" class="btn btn-link btn-compact" data-story-all aria-current="${spotlightKey ? 'false' : 'true'}">All Squads</button></div>
    <div class="gov-story-table" role="table" aria-label="PI governance by squad">
      <div class="gov-story-columns" role="row"><span>Squad</span><span>PI alignment</span><span>Baseline</span><span>Sprint reality</span><span>Doing instead</span><span>Proof / next</span></div>
      ${(answer.squads || []).map(matrixRow).join('')}
    </div>
  </section>`;
}

function renderHero(answer) {
  const mount = document.getElementById('gov-active-loop-mount');
  if (!mount) return;
  const freshness = currentFreshness(answer);
  const noBaseline = !answer.contract;
  const nextLabel = noBaseline ? 'Recover PI contract' : (answer.nextDecisionPromiseId ? 'Review and decide' : 'Review aligned promises');
  mount.innerHTML = `<section class="gov-active-loop-hero gov-story-v2 is-${freshness.state}" data-testid="governance-active-loop" aria-labelledby="gov-loop-answer">
    <div class="gov-story-mission"><span>Portfolio mission</span><strong>${escapeHtml(answer.missionHeader || 'Active PI contract governance')}</strong><small>${escapeHtml(freshness.copy)}</small></div>
    <div class="gov-loop-copy"><div class="gov-loop-kicker"><span>PI contract answer</span><span class="gov-loop-cache-badge${answer.servedFromLocalCache ? '' : ' gov-loop-cache-badge--live'}">${answer.servedFromLocalCache ? 'Last verified answer' : 'Quietly refreshed'}</span></div><h1 id="gov-loop-answer">${escapeHtml(answer.answer)}</h1><p class="gov-loop-source" data-testid="governance-source-line">${escapeHtml(answer.sourceLine)}</p><p class="gov-loop-did"><span aria-hidden="true">✓</span> ${escapeHtml(answer.deliveraDid)}</p></div>
    <div class="gov-loop-decision-bento"><div class="gov-loop-progress" aria-label="Governance loop completion ${Number(answer.loopCompletion) || 0}%"><span class="gov-loop-progress-ring" style="--loop-progress:${Number(answer.loopCompletion) || 0}"><strong>${Number(answer.loopCompletion) || 0}%</strong></span><span><strong>Loop coverage</strong><small>Promises with an explicit decision</small></span></div><button type="button" class="btn btn-primary gov-loop-primary" data-loop-primary>${escapeHtml(nextLabel)} →</button><p>One safe next step. No silent writes.</p></div>
    ${portfolioMatrix(answer)}
    <div class="gov-story-update" role="status" hidden>New evidence ready. <button type="button" class="btn btn-link btn-compact" data-story-apply>Refresh view</button></div>
    <div id="gov-squad-spotlight" class="gov-squad-spotlight" aria-live="polite"></div>
  </section>`;
  document.body.classList.add('governance-active-loop-ready', 'governance-story-v2-ready');
  bindStory(answer, mount);
  if (spotlightKey) void showSpotlight(spotlightKey, { pushHistory: false });
}

function bindStory(answer, mount) {
  mount.querySelector('[data-loop-primary]')?.addEventListener('click', () => {
    if (!answer.contract) return document.querySelector('[data-setup-baseline-ssot="1"]')?.click();
    if (answer.nextDecisionPromiseId) void openPromiseDrawer(answer.nextDecisionPromiseId);
  });
  mount.querySelector('[data-story-all]')?.addEventListener('click', () => clearSpotlight(true));
  mount.querySelectorAll('[data-story-squad]').forEach((row) => {
    const squad = row.getAttribute('data-story-squad');
    row.addEventListener('focus', () => openPreview(row, squad));
    row.addEventListener('click', () => void showSpotlight(squad, { pushHistory: true }));
  });
  mount.querySelector('[data-story-apply]')?.addEventListener('click', applyPendingAnswer);
}

function closePreview() { persistentPreview?.remove(); persistentPreview = null; }

function openPreview(trigger, squad) {
  closePreview();
  const summary = activeAnswer?.squads?.find((item) => item.squad === squad);
  if (!summary) return;
  const pop = document.createElement('div');
  pop.className = 'gov-loop-proof-popover'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', `${squad} proof preview`);
  const promiseRows = (activeAnswer?.promises || []).filter((item) => item.squad === squad).slice(0, 4).map((item) => `<p><strong>${escapeHtml(item.matchLabel || item.matchState || '')}</strong><br><span>${escapeHtml(item.originalText || '')}</span></p>`).join('');
  pop.innerHTML = `<div class="gov-loop-popover-head"><strong>${escapeHtml(squad)} proof preview</strong><button type="button" aria-label="Close proof preview">×</button></div><p>${escapeHtml(summary.baselineCoverage?.copy || '')}</p><p>${escapeHtml(summary.proofState || '')}</p>${promiseRows}<p>${escapeHtml(summary.nextAction?.label || 'Open squad spotlight')}</p>`;
  document.body.appendChild(pop);
  const rect = trigger.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 388, rect.left)) + window.scrollX}px`;
  pop.style.top = `${rect.bottom + window.scrollY + 6}px`;
  persistentPreview = pop;
  pop.querySelector('button')?.addEventListener('click', () => { closePreview(); trigger.focus(); });
}

function updateUrl(squad, push) {
  const url = new URL(location.href);
  if (squad) url.searchParams.set('spotlight', squad); else url.searchParams.delete('spotlight');
  history[push ? 'pushState' : 'replaceState']({ spotlight: squad }, '', url);
}

function clearSpotlight(pushHistory = false) {
  spotlightKey = ''; closePreview(); updateUrl('', pushHistory);
  document.getElementById('gov-squad-spotlight')?.replaceChildren();
  document.querySelectorAll('[data-story-squad]').forEach((row) => row.setAttribute('aria-current', 'false'));
  document.querySelector('[data-story-all]')?.setAttribute('aria-current', 'true');
}

function spotlightHtml(detail) {
  const squad = detail.squad || {};
  const promises = detail.promises || [];
  const work = detail.currentWork || [];
  return `<div class="gov-spotlight-head"><div><span class="gov-loop-kicker">Synchronized Squad Spotlight</span><h2>${escapeHtml(squad.squad)}</h2></div><button type="button" class="btn btn-secondary btn-compact" data-force-squad>Force ${escapeHtml(squad.squad)} squad sync</button></div>
  <div class="gov-spotlight-grid">
    <section><h3>Current Work Reality</h3>${work.length ? work.slice(0, 5).map((item) => `<p class="gov-work-theme"><span><strong>${escapeHtml(item.title)}</strong>${item.systemDerived ? ' <small>system-derived label</small>' : ''}</span>${item.systemDerived || item.title === 'Unclear work theme' ? `<button type="button" class="btn btn-secondary btn-compact" data-theme-rename data-theme-id="${escapeHtml(item.themeId || item.title)}" data-theme-version="${Number(item.version) || 1}">Rename theme</button>` : ''}</p>`).join('') : '<p>No current work themes are available.</p>'}</section>
    <section><h3>Sprint Reality</h3><p>${escapeHtml(detail.sprintReality?.copy || 'Sprint reality unavailable.')}</p></section>
    <section><h3>Doing Instead &amp; Work Split</h3><p>${escapeHtml(squad.doingInstead?.copy || 'No major diversion is proven.')}</p><p>${escapeHtml(squad.workSplit?.explanation || '')}</p><p>Unknown: ${squad.workSplit?.unknownPct == null ? 'not calculated' : `${squad.workSplit.unknownPct}%`}</p></section>
    <section><h3>Promise Evidence</h3>${promises.length ? promises.map((promise) => `<button type="button" class="gov-spotlight-promise" data-loop-promise="${escapeHtml(promise.promiseId)}"><strong>${escapeHtml(promise.originalText)}</strong><small>${escapeHtml(promise.matchLabel)} · ${escapeHtml(promise.proofAge?.copy || '')}</small>${promise.amendmentSentence ? `<span class="gov-amendment-sentence"><s aria-hidden="true">${escapeHtml(promise.originalText)}</s><span class="sr-only">Original promise: ${escapeHtml(promise.originalText)}.</span> → ${escapeHtml(promise.amendmentSentence.split('→').slice(1).join('→').trim())}</span>` : ''}</button>`).join('') : '<p>Cannot verify, baseline missing. Save baseline to compare.</p>'}</section>
    <section class="gov-spotlight-actions"><h3>Action Trail</h3>${promises.length ? promises.map((promise) => `<div class="gov-action-lifecycle"><p>${escapeHtml(promise.actionLifecycle)}</p>${promise.nextAction ? `<button type="button" class="btn btn-secondary btn-compact" data-loop-promise="${escapeHtml(promise.promiseId)}">${escapeHtml(promise.nextAction.label)}</button>` : ''}</div>`).join('') : '<p>No action trail exists.</p>'}</section>
  </div><div class="gov-loop-action-status" aria-live="polite"></div>`;
}

async function showSpotlight(squad, { pushHistory = false } = {}) {
  spotlightKey = squad; closePreview(); updateUrl(squad, pushHistory);
  document.querySelectorAll('[data-story-squad]').forEach((row) => row.setAttribute('aria-current', String(row.getAttribute('data-story-squad') === squad)));
  document.querySelector('[data-story-all]')?.setAttribute('aria-current', 'false');
  const mount = document.getElementById('gov-squad-spotlight');
  if (!mount) return;
  mount.innerHTML = '<p aria-busy="true">Loading squad story…</p>';
  try {
    const projects = activeAnswer?.scope?.projects?.length ? activeAnswer.scope.projects.join(',') : squad;
    const res = await fetch(`/api/governance/squads/${encodeURIComponent(squad)}/detail.json?projects=${encodeURIComponent(projects)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const detail = await res.json();
    if (spotlightKey !== squad) return;
    mount.innerHTML = spotlightHtml(detail);
    mount.querySelectorAll('[data-loop-promise]').forEach((button) => button.addEventListener('click', () => void openPromiseDrawer(button.getAttribute('data-loop-promise'))));
    mount.querySelectorAll('[data-theme-rename]').forEach((button) => button.addEventListener('click', () => beginThemeRename(button, squad, mount)));
    mount.querySelector('[data-force-squad]')?.addEventListener('click', (event) => targetedRefresh('squad', squad, event.currentTarget, mount));
  } catch (_) { mount.innerHTML = '<p role="status">Squad details are unavailable. The portfolio answer remains valid.</p>'; }
}

function beginThemeRename(button, squad, container) {
  const row = button.closest('.gov-work-theme');
  if (!row || row.querySelector('form')) return;
  const original = button.previousElementSibling?.querySelector('strong')?.textContent || '';
  button.hidden = true;
  const form = document.createElement('form');
  form.className = 'gov-theme-rename-form';
  form.innerHTML = `<label>Clear work theme name<input name="name" minlength="3" maxlength="180" required value="${escapeHtml(original)}"></label><button class="btn btn-primary btn-compact" type="submit">Save name</button><button class="btn btn-secondary btn-compact" type="button">Cancel</button><span role="status"></span>`;
  row.append(form);
  form.querySelector('input')?.focus();
  form.querySelector('[type="button"]')?.addEventListener('click', () => { form.remove(); button.hidden = false; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('[role="status"]');
    const name = form.elements.name.value.trim();
    status.textContent = 'Saving version-protected name…';
    try {
      const res = await fetch(`/api/governance/squads/${encodeURIComponent(squad)}/work-themes/${encodeURIComponent(button.dataset.themeId || original)}/rename`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'If-Match': `"${button.dataset.themeVersion || 1}"` }, body: JSON.stringify({ name, expectedVersion: Number(button.dataset.themeVersion) || 1 }) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) throw new Error(data.message || data.error || 'This theme changed. Reload the latest squad story before renaming.');
      if (!res.ok) throw new Error(data.error || `Rename failed (${res.status})`);
      row.querySelector('strong').textContent = data.name;
      row.querySelector('small')?.remove();
      button.dataset.themeVersion = String(data.version || Number(button.dataset.themeVersion) + 1);
      form.remove(); button.hidden = false; button.textContent = 'Rename theme';
    } catch (err) { status.textContent = err.message || 'Rename failed. Nothing changed.'; }
  });
}

function readLocked() {
  return decisionInProgress || Boolean(persistentPreview || document.querySelector('.gov-loop-drawer') || document.querySelector('.gov-story-row:focus'));
}

function announcePending() {
  const banner = document.querySelector('.gov-story-update');
  if (banner) banner.hidden = false;
}

function applyPendingAnswer() {
  if (!pendingAnswer) return;
  const next = pendingAnswer; pendingAnswer = null;
  const y = window.scrollY; renderActiveGovernanceLoop(next, { forceApply: true });
  requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'auto' }));
}

function amendmentFormHtml() {
  return `<form class="gov-loop-amend-form"><label>Approved change<select name="type"><option value="mutually-agreed-descope">Mutually agreed descope</option><option value="move-to-next-quarter">Move to next quarter</option><option value="split-into-new-promise">Split into new promise</option><option value="replace-with-urgent-work">Replace with approved urgent work</option><option value="mark-as-support-obligation">Mark as support obligation</option></select></label><label>Business reason<textarea name="reason" minlength="8" required></textarea></label><label>Approval proof reference<input name="approvalProofRef"></label><button class="btn btn-primary" type="submit">Approve amendment</button></form>`;
}

function recipientEditor(promise) {
  const route = promise.ownerRoute || {};
  return `<div class="gov-recipient-review"><p>${route.unresolved ? 'Owner unknown. Assign a recipient before sending.' : `Nudge will go to ${escapeHtml(route.role || 'owner')}: ${escapeHtml(route.displayName || '')}.`}</p><label>Recipient<input data-recipient-name value="${escapeHtml(route.unresolved ? '' : route.displayName || '')}" placeholder="Choose recipient"></label><label>Role<input data-recipient-role value="${escapeHtml(route.role || 'Selected recipient')}"></label><label class="gov-recipient-default"><input type="checkbox" data-recipient-default> Save as squad default</label></div>`;
}

function drawerHtml(promise, squad) {
  const actions = (promise.allowedActions || []).filter((action) => action.allowed);
  return `<div class="gov-loop-drawer" data-loop-promise-version="${Number(promise.version) || 1}"><section class="gov-loop-drawer-verdict gov-loop-tone-${tone(promise.matchState)}"><span>${escapeHtml(promise.matchLabel)}</span><strong>${escapeHtml(promise.originalText)}</strong><p>${escapeHtml(promise.proofAge?.copy || '')}</p>${promise.amendmentSentence ? `<p class="gov-amendment-sentence"><s aria-hidden="true">${escapeHtml(promise.originalText)}</s><span class="sr-only">Original promise: ${escapeHtml(promise.originalText)}.</span> → ${escapeHtml(promise.amendmentSentence.split('→').slice(1).join('→').trim())}</p>` : ''}</section>
  <div class="gov-loop-drawer-grid"><section><h3>PI promise source</h3><p>${escapeHtml(promise.source || promise.baselineCoverage?.sourceLabel || 'Approved PI baseline')}</p><p>${escapeHtml(promise.sourceReference || promise.quarter || '')}</p></section><section><h3>Matched Jira work</h3><p><strong>${escapeHtml(promise.issueKey || 'No Jira proof')}</strong> · ${escapeHtml(promise.statusNow || '')}</p></section><section><h3>Proof age</h3><p>${escapeHtml(promise.proofAge?.state || 'unknown')} · ${escapeHtml(promise.proofAge?.copy || '')}</p></section><section><h3>Work Split</h3><p>${squad?.workSplit?.unplannedPct == null ? 'Unplanned work unknown' : `${squad.workSplit.unplannedPct}% unplanned work`}</p><p>${escapeHtml(squad?.workSplit?.largestUnmappedCluster ? `Largest unmapped cluster: ${squad.workSplit.largestUnmappedCluster}.` : '')}</p><p>${escapeHtml(squad?.workSplit?.explanation || '')}</p><p>Unknown: ${squad?.workSplit?.unknownPct == null ? 'not calculated' : `${squad.workSplit.unknownPct}%`}</p></section><section><h3>Action state</h3><p>${escapeHtml(promise.actionLifecycle || '')}</p></section><section><h3>Owner path</h3>${recipientEditor(promise)}</section><section><h3>Ready to Promise</h3><p>${escapeHtml(promise.readiness?.copy || 'Readiness was not captured in the original baseline.')}</p></section><section><h3>Trade-off Guardrail</h3><p>${escapeHtml(promise.tradeOffGuardrail?.copy || 'No trustworthy percentage is available.')}</p></section></div>
  <details class="gov-loop-history" open><summary>Nudge and reaction history (${promise.actionHistory?.length || 0})</summary><ol>${(promise.actionHistory || []).map((item) => `<li><strong>${escapeHtml(String(item.type || '').replace(/-/g, ' '))}</strong><small>${escapeHtml(item.replyExcerpt || item.messagePreview || '')}</small></li>`).join('') || '<li>No action has been sent yet.</li>'}</ol></details>
  <div class="gov-loop-stale-warning" hidden role="alert"></div><div class="gov-loop-action-status" aria-live="polite"></div><div class="gov-loop-actions">${actions.map((action) => `<button type="button" class="btn ${action.id === 'send-nudge' || action.id === 'recheck-promise' ? 'btn-primary' : 'btn-secondary'} btn-compact" data-loop-action="${escapeHtml(action.id)}">${escapeHtml(action.id === 'send-nudge' && promise.ownerRoute?.displayName ? `Nudge ${promise.ownerRoute.role}: ${promise.ownerRoute.displayName}` : actionLabels[action.id] || action.id)}</button>`).join('')}</div></div>`;
}

async function fetchPromiseDetail(promiseId) {
  const projects = activeAnswer?.scope?.projects || [];
  const res = await fetch(`/api/governance/cases/${encodeURIComponent(promiseId)}/detail.json?projects=${encodeURIComponent(projects.join(','))}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Promise detail unavailable (${res.status})`);
  return res.json();
}

export async function openPromiseDrawer(promiseId) {
  closePreview(); closeAllGovernanceOverlays();
  let detail;
  const localPromise = activeAnswer?.promises?.find((item) => item.promiseId === promiseId);
  if (localPromise?.allowedActions) detail = { promise: localPromise, squad: activeAnswer?.squads?.find((item) => item.squad === localPromise.squad) || null };
  else try { detail = await fetchPromiseDetail(promiseId); } catch (err) { return; }
  const promise = detail.promise; const squad = detail.squad;
  const { el } = openRightDrawer({ title: `${promise.squad} · ${promise.matchLabel}`, bodyHtml: drawerHtml(promise, squad), panelClass: 'active-loop' });
  const drawer = el?.querySelector('.gov-loop-drawer');
  drawer?.querySelectorAll('[data-loop-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.getAttribute('data-loop-action'), promise, drawer)));
  const updateRecipientLabel = () => {
    const button = drawer?.querySelector('[data-loop-action="send-nudge"]');
    if (!button) return;
    const recipient = reviewedRecipient(drawer, promise);
    button.textContent = recipient.displayName ? `Nudge ${recipient.role}: ${recipient.displayName}` : 'Choose recipient to nudge';
  };
  drawer?.querySelectorAll('[data-recipient-name], [data-recipient-role]').forEach((input) => input.addEventListener('input', updateRecipientLabel));
}

function reviewedRecipient(drawer, promise) {
  return { displayName: drawer.querySelector('[data-recipient-name]')?.value.trim() || '', role: drawer.querySelector('[data-recipient-role]')?.value.trim() || 'Selected recipient', accountId: promise.ownerRoute?.accountId || '', source: 'case-review' };
}

async function versionedPost(url, promise, body) {
  return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'If-Match': `"${promise.version}"` }, body: JSON.stringify({ ...body, expectedVersion: promise.version }) });
}

async function handleAction(action, promise, drawer) {
  if (decisionInProgress) return;
  const status = drawer.querySelector('.gov-loop-action-status');
  if (action === 'amend-contract') {
    status.innerHTML = amendmentFormHtml();
    status.querySelector('form').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; await submit(action, promise, drawer, { promiseId: promise.promiseId, type: form.elements.type.value, reason: form.elements.reason.value, approvalProofRef: form.elements.approvalProofRef.value }); });
    return;
  }
  if (action === 'pull-fresh-evidence') return targetedRefresh('promise', promise.promiseId, null, drawer);
  if (action === 'recheck-promise') return submit(action, promise, drawer, {});
  const recipient = reviewedRecipient(drawer, promise);
  if (['send-nudge', 'escalate-owner'].includes(action) && !recipient.displayName) { status.textContent = 'Choose the recipient before sending.'; return; }
  if (action === 'send-nudge') {
    if (drawer.querySelector('[data-recipient-default]')?.checked) {
      status.textContent = 'Saving the reviewed route as the squad default…';
      const routeRes = await versionedPost(`/api/governance/cases/${encodeURIComponent(promise.promiseId)}/owner-route`, promise, { recipient, saveAsSquadDefault: true });
      const routeData = await routeRes.json().catch(() => ({}));
      if (routeRes.status === 412) { drawer.querySelector('.gov-loop-stale-warning').hidden = false; drawer.querySelector('.gov-loop-stale-warning').textContent = routeData.message || routeData.error || 'The owner route changed. Reload latest state before sending.'; status.textContent = 'Your reviewed recipient is preserved.'; return; }
      if (!routeRes.ok) { status.textContent = routeData.error || `Owner route update failed (${routeRes.status}). Nothing was sent.`; return; }
      promise.version = routeData.version || promise.version + 1;
    }
    return submit(action, promise, drawer, { channel: promise.issueKey ? 'jira' : 'pi-team-queue', recipient });
  }
  if (action === 'escalate-owner') return submit(action, promise, drawer, { decision: action, recipient, reason: 'Response window elapsed; PI Team approved escalation.' });
  return submit(action, promise, drawer, { decision: action, contractId: promise.contractId, reason: `PI Team selected ${action}` });
}

async function submit(action, promise, drawer, body) {
  decisionInProgress = true; const status = drawer.querySelector('.gov-loop-action-status'); status.textContent = 'Recording the version-protected transition…';
  const url = action === 'send-nudge' ? `/api/governance/cases/${encodeURIComponent(promise.promiseId)}/nudges?projects=${encodeURIComponent((activeAnswer?.scope?.projects || []).join(','))}` : action === 'amend-contract' ? `/api/governance/contracts/${encodeURIComponent(promise.contractId)}/amendments` : action === 'recheck-promise' ? `/api/governance/cases/${encodeURIComponent(promise.promiseId)}/recheck?projects=${encodeURIComponent((activeAnswer?.scope?.projects || []).join(','))}` : `/api/governance/cases/${encodeURIComponent(promise.promiseId)}/decisions`;
  try {
    const res = await versionedPost(url, promise, body); const data = await res.json().catch(() => ({}));
    if (res.status === 412) { drawer.querySelector('.gov-loop-stale-warning').hidden = false; drawer.querySelector('.gov-loop-stale-warning').textContent = data.message || data.error || 'This item was updated by another PI Team user. Reload latest state before deciding.'; status.textContent = 'Your draft is preserved.'; return; }
    if (!res.ok) throw new Error(data.error || `Action failed (${res.status})`);
    promise.version = data.version || promise.version + 1; status.textContent = action === 'recheck-promise' ? (data.aligned ? 'Re-check complete. Promise is Matched.' : 'Owner reply received, proof still missing.') : action === 'send-nudge' ? `Nudge queued with reference ${data.deliveraRef}.` : action === 'amend-contract' ? 'Decision recorded without changing the original promise.' : 'Transition recorded.';
  } catch (err) { status.textContent = err.message || 'Action failed. Nothing changed.'; } finally { decisionInProgress = false; }
}

async function targetedRefresh(scopeType, scopeId, button, container) {
  if (button) button.disabled = true;
  const status = container.querySelector('.gov-loop-action-status') || container;
  try {
    const res = await fetch('/api/governance/refreshes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scopeType, scopeId, quarter: activeAnswer?.contract?.piName || '', expectedStoryVersion: activeAnswer?.answerVersion }) });
    const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || `Refresh failed (${res.status})`);
    status.textContent = data.attached ? 'Joined the targeted sync already in progress.' : `Targeted ${scopeType} sync started.`;
  } catch (err) { status.textContent = err.message || 'Targeted sync failed.'; } finally { if (button) button.disabled = false; }
}

export function renderActiveGovernanceLoop(answer, { forceApply = false } = {}) {
  if (!answer || ![1, 2].includes(answer.schemaVersion) || !answer.answer || !answer.scope || !Array.isArray(answer.squads)) return;
  if (!forceApply && activeAnswer && answer.answerVersion !== activeAnswer.answerVersion && readLocked()) { pendingAnswer = answer; announcePending(); return; }
  activeAnswer = answer; renderHero(answer);
}

export async function loadActiveGovernanceLoop({ projects, quarter = '', force = false } = {}) {
  const seq = ++requestSequence; spotlightKey = new URL(location.href).searchParams.get('spotlight') || '';
  const cached = force ? null : readCachedAnswer(projects, quarter); if (cached) renderActiveGovernanceLoop(cached);
  const qs = new URLSearchParams({ projects: String(projects || '') }); if (quarter) qs.set('quarter', quarter);
  try {
    const res = await fetch(`/api/governance/active-loop.json?${qs}`, { credentials: 'same-origin' }); if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const answer = await res.json(); if (seq !== requestSequence) return null; writeCachedAnswer(projects, quarter, answer); renderActiveGovernanceLoop(answer); return answer;
  } catch (_) {
    if (!cached && seq === requestSequence) document.getElementById('gov-active-loop-mount').innerHTML = '<section class="gov-active-loop-hero is-limited" role="status"><h1>Last verified PI answer is unavailable.</h1><p>Decisions requiring fresh evidence are paused.</p></section>';
    return cached;
  }
}

window.addEventListener('popstate', () => {
  const next = new URL(location.href).searchParams.get('spotlight') || '';
  if (next) void showSpotlight(next, { pushHistory: false }); else clearSpotlight(false);
});

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePreview(); });
document.addEventListener('pointerdown', (event) => { if (persistentPreview && !persistentPreview.contains(event.target) && !event.target.closest('[data-story-squad]')) closePreview(); });
