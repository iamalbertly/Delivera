import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openRightDrawer, closeAllGovernanceOverlays } from './Delivera-App-Shared-RightDrawer-01UI.js';

const CACHE_PREFIX = 'delivera:governance:active-loop:v2:20260719b';
const PRESENTATION_CONTRACT_VERSION = 3;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const sharedStoryState = globalThis.__deliveraGovernanceActiveLoopState ||= {
  activeAnswer: null,
  pendingAnswer: null,
  pendingReason: 'New evidence ready.',
};
let requestSequence = 0;
let activeAnswer = sharedStoryState.activeAnswer;
let pendingAnswer = sharedStoryState.pendingAnswer;
let decisionInProgress = false;
let persistentPreview = null;
let previewPersistent = false;
let spotlightKey = '';
let activeSpotlightDetail = null;
let activeLens = new URL(location.href).searchParams.get('view') || 'overall';
let activeDrawerContext = null;
let pendingReason = sharedStoryState.pendingReason || 'New evidence ready.';
const activeLoopLoads = new Map();

const lenses = [
  ['overall', 'Portfolio'],
  ['squad', 'Selected squad'],
  ['evidence', 'Evidence'],
];

const actionLabels = {
  'send-nudge': 'Send nudge',
  'pull-fresh-evidence': 'Pull fresh proof for this promise',
  'approve-match': 'Approve match',
  'amend-contract': 'Amend contract',
  'assign-owner': 'Resolve owner route',
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
    if (envelope.answer.schemaVersion === 2 && Number(envelope.answer.presentationContractVersion) !== PRESENTATION_CONTRACT_VERSION) return null;
    if (envelope.answer.schemaVersion === 2 && (!envelope.answer.decisionCoverage
      || !(envelope.answer.squads || []).every((squad) => squad.displayName && squad.contractState && squad.trustFactor))) return null;
    if (envelope.answer.schemaVersion === 2) {
      const checked = Number(String(envelope.answer.sourceLine || '').match(/(\d+)\s+promises?\s+checked/i)?.[1] || 0);
      const coverageTotal = Number(envelope.answer.decisionCoverage?.total || 0);
      if (checked > 0 && coverageTotal === 0) return null;
    }
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

function promisesChecked(answer) {
  return Number(String(answer?.sourceLine || '').match(/(\d+)\s+promises?\s+checked/i)?.[1] || 0);
}

function normalizedDecisionCoverage(answer) {
  const supplied = answer?.decisionCoverage || {};
  const total = Number(supplied.total) || promisesChecked(answer) || (answer?.promises || []).length || 0;
  const closed = Math.min(total, Number(supplied.closed) || 0);
  const preparedOwnerAsks = Math.max(0, Number(supplied.preparedOwnerAsks) || 0);
  return {
    closed,
    total,
    preparedOwnerAsks,
    copy: supplied.copy || `Decision coverage: ${closed} of ${total} gaps closed`,
  };
}

function matrixRow(squad) {
  const baseline = squad.baselineCoverage || (activeAnswer?.contract ? { state: 'verified', sourceLabel: activeAnswer.contract.source || 'Approved PI contract', copy: 'Contract source confirmed.' } : { state: 'missing', copy: 'Baseline missing.' });
  const split = squad.workSplit || {};
  const contract = squad.contractState || { label: baseline.state === 'missing' ? 'Cannot verify' : squad.topState || 'Unknown', detail: baseline.copy || '' };
  const sprint = squad.sprintReality || {};
  const trust = squad.trustFactor || { label: 'Limited, evidence incomplete', level: 'limited' };
  const action = squad.nextAction?.label || (baseline.state === 'missing' ? 'Save baseline to compare' : 'Review evidence');
  const rework = squad.possibleRework?.promoted;
  const sprintLabel = sprint.state === 'active'
    ? `${sprint.sprint?.name || sprint.sprintName || 'Active sprint'}${sprint.daysRemaining != null ? ` · ${sprint.daysRemaining} days` : ''}`
    : (sprint.state === 'unavailable' ? 'Sprint status unavailable' : String(sprint.state || 'Unverified').replace(/-/g, ' '));
  const currentReality = `${contract.label}${sprintLabel ? ` · ${sprintLabel}` : ''}`;
  const piImpact = squad.unknownWork?.promoted ? squad.unknownWork.copy : squad.doingInstead?.major?.title || (rework ? squad.possibleRework.copy : 'No material PI diversion proven');
  return `<button type="button" role="row" class="gov-story-row gov-story-row--${tone(baseline.state === 'missing' ? 'missing' : squad.topState)}" data-story-squad="${escapeHtml(squad.squad)}" data-loop-squad="${escapeHtml(squad.squad)}" data-has-rollover="${Number(squad.sprintReality?.carryoverCount) > 0}" data-sprint-risk="${Boolean(squad.sprintReality?.endedWithoutReplacement || squad.sprintReality?.state === 'watch' || sprint.state === 'unverified')}" data-operational-risk="${Boolean(squad.doingInstead?.major)}" data-unknown-risk="${Boolean(squad.unknownWork?.promoted)}" data-rework-risk="${Boolean(rework)}" data-trust="${escapeHtml(trust.level || 'limited')}" aria-label="Open ${escapeHtml(squad.displayName || squad.squad)} spotlight" aria-current="${spotlightKey === squad.squad ? 'true' : 'false'}">
    <span role="cell" class="gov-story-squad"><strong>${escapeHtml(squad.displayName || squad.squad)}</strong><small>${escapeHtml(squad.attentionCount ? `${squad.attentionCount} need attention` : 'No contract variance proven')}</small></span>
    <span role="cell" data-context-help="${escapeHtml(sprint.copy || contract.detail || 'Open the squad evidence rail for source detail.')}"><strong>${escapeHtml(currentReality)}</strong><small>${escapeHtml(sprint.copy || contract.detail || '')}</small></span>
    <span role="cell" data-context-help="${escapeHtml(split.explanation || trust.label)}"><strong>${escapeHtml(piImpact)}</strong><small>${escapeHtml(split.explanation || trust.label)}</small></span>
    <span role="cell"><strong>${escapeHtml(action)}</strong><small>${escapeHtml(`${squad.proofState || 'Evidence unverified'} · ${baseline.sourceLabel || 'Baseline missing'}`)}</small></span>
  </button>`;
}

function excludedOperationalGroups(answer) {
  const groups = answer.excludedOperationalGroups || [];
  if (!groups.length) return '';
  return `<details class="gov-operating-firewall" data-operating-firewall><summary>Excluded operational usage <span>${groups.length}</span></summary><div>${groups.map((squad) => `<button type="button" data-operating-model="${escapeHtml(squad.squad)}"><strong>${escapeHtml(squad.displayName || squad.squad)}</strong><span>${escapeHtml(squad.operatingModel?.label || 'Operational Jira Group')} · ${Number(squad.operatingModel?.confidence) || 0}% confidence</span><small>${escapeHtml(squad.operatingModel?.copy || '')}</small></button>`).join('')}</div></details>`;
}

function portfolioMatrix(answer) {
  return `<section class="gov-story-matrix" aria-labelledby="gov-story-matrix-title">
    <div class="gov-story-matrix-head"><div><span class="gov-loop-kicker">Portfolio comparison</span><h2 id="gov-story-matrix-title">Squads ordered by decision urgency</h2><p class="gov-lens-summary" data-lens-summary>${escapeHtml(answer.lensSummaries?.overall || 'Select a squad to keep its Jira work, sprint, promises and actions isolated.')}</p></div><button type="button" class="btn btn-link btn-compact" data-story-all aria-current="${spotlightKey ? 'false' : 'true'}">Clear squad</button></div>
    <div class="gov-story-lenses" role="toolbar" aria-label="Governance view">${lenses.map(([id, label]) => `<button type="button" class="btn btn-compact ${id === activeLens ? 'btn-secondary' : 'btn-link'}" data-story-lens="${id}" aria-pressed="${id === activeLens}">${label}</button>`).join('')}</div>
    <div class="gov-story-table" role="table" aria-label="PI governance by squad">
      <div class="gov-story-columns" role="row"><span>Squad</span><span>Current reality</span><span>PI impact</span><span>Next move</span></div>
      ${(answer.squads || []).map(matrixRow).join('')}
    </div>
    ${excludedOperationalGroups(answer)}
  </section>`;
}

function renderHero(answer) {
  const mount = document.getElementById('gov-active-loop-mount');
  if (!mount) return;
  const loading = document.getElementById('gov-loading');
  if (loading) {
    loading.hidden = true;
    loading.setAttribute('aria-hidden', 'true');
  }
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
  const freshness = currentFreshness(answer);
  const noBaseline = !answer.contract;
  const coverage = normalizedDecisionCoverage(answer);
  const selectedPromise = decisionPromiseForAnswer(answer);
  const nextLabel = noBaseline ? 'Recover PI contract' : (selectedPromise ? `Review ${selectedPromise.squadDisplayName || selectedPromise.squad}` : 'Review aligned promises');
  mount.innerHTML = `<section class="gov-active-loop-hero gov-story-v2 is-${freshness.state}" data-active-lens="${escapeHtml(activeLens)}" data-testid="governance-active-loop" aria-labelledby="gov-loop-answer">
    <div class="gov-story-mission"><span>Portfolio mission</span><strong>${escapeHtml(answer.missionHeader || 'Active PI contract governance')}</strong><button type="button" class="gov-hero-evidence-link" data-hero-freshness>${escapeHtml(freshness.copy)}</button></div>
    <div class="gov-loop-copy"><div class="gov-loop-kicker"><span>PI contract answer</span><span class="gov-loop-cache-badge${answer.servedFromLocalCache ? '' : ' gov-loop-cache-badge--live'}">${answer.servedFromLocalCache ? 'Last verified answer' : 'Quietly refreshed'}</span></div><h1 id="gov-loop-answer">${escapeHtml(answer.answer)}</h1><p class="gov-loop-source" data-testid="governance-source-line">${escapeHtml(answer.sourceLine)}</p><p class="gov-loop-did"><span aria-hidden="true">✓</span> ${escapeHtml(answer.deliveraDid)}</p></div>
    <div class="gov-loop-decision-bento"><div class="gov-loop-progress" aria-label="${escapeHtml(coverage.copy)}"><span class="gov-loop-decision-count"><strong>${coverage.closed}</strong><small>of ${coverage.total}</small></span><span><strong>Decision coverage</strong><small>${coverage.preparedOwnerAsks} owner asks prepared · ${coverage.closed} decided</small></span></div><button type="button" class="btn btn-primary gov-loop-primary" data-loop-primary>${escapeHtml(nextLabel)}</button></div>
    ${portfolioMatrix(answer)}
    <div class="gov-story-update" role="status" hidden><span data-story-update-copy>New evidence ready.</span> <button type="button" class="btn btn-link btn-compact" data-story-apply>Review changes</button><button type="button" class="btn btn-link btn-compact" data-story-keep-draft>Keep my edits as a new decision draft</button></div>
    <div id="gov-squad-spotlight" class="gov-squad-spotlight" aria-live="polite"></div>
    <footer class="gov-story-footer"><button type="button" class="gov-diagnostics-trigger" data-governance-diagnostics aria-label="Open authorized diagnostics">Diagnostics</button></footer>
  </section>`;
  document.body.classList.add('governance-active-loop-ready', 'governance-story-v2-ready');
  ['gov-action-clusters-mount', 'gov-compare-rail-mount', 'gov-sticky-answer-mount'].forEach((id) => {
    const legacy = document.getElementById(id);
    if (!legacy || legacy === mount) return;
    legacy.replaceChildren();
    legacy.hidden = true;
    legacy.setAttribute('aria-hidden', 'true');
    legacy.setAttribute('inert', '');
  });
  bindStory(answer, mount);
  if (spotlightKey) void showSpotlight(spotlightKey, { pushHistory: false });
}

function decisionPromiseForAnswer(answer) {
  const spotlightPromises = activeSpotlightDetail?.promises || [];
  const promises = spotlightKey && spotlightPromises.length ? spotlightPromises : (answer?.promises || []);
  if (spotlightKey) {
    const selected = promises.find((promise) => promise.squad === spotlightKey && (promise.nextAction || promise.caseState !== 'aligned'));
    if (selected) return selected;
  }
  return promises.find((promise) => promise.promiseId === answer?.nextDecisionPromiseId)
    || promises.find((promise) => promise.nextAction || promise.caseState !== 'aligned')
    || null;
}

function bindStory(answer, mount) {
  mount.querySelector('[data-loop-primary]')?.addEventListener('click', () => {
    if (!answer.contract) return document.querySelector('[data-setup-baseline-ssot="1"]')?.click();
    const promise = decisionPromiseForAnswer(answer);
    if (promise?.promiseId) void openPromiseDrawer(promise.promiseId);
  });
  mount.querySelector('[data-story-all]')?.addEventListener('click', () => clearSpotlight(true));
  const source = mount.querySelector('.gov-loop-source');
  if (source) {
    source.setAttribute('role', 'button');
    source.setAttribute('tabindex', '0');
    source.setAttribute('aria-label', 'Open PI contract source evidence');
    source.addEventListener('click', () => openContractSourceDrawer(answer));
    source.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openContractSourceDrawer(answer); } });
    const evidenceLinks = document.createElement('div');
    evidenceLinks.className = 'gov-hero-evidence-links';
    evidenceLinks.setAttribute('aria-label', 'Open portfolio evidence');
    evidenceLinks.innerHTML = (answer.squads || []).filter((squad) => Number(squad.attentionCount) > 0).slice(0, 3)
      .map((squad) => `<button type="button" class="gov-hero-evidence-link" data-hero-squad="${escapeHtml(squad.squad)}">${escapeHtml(squad.displayName || squad.squad)} evidence</button>`).join('');
    source.insertAdjacentElement('afterend', evidenceLinks);
    evidenceLinks.querySelectorAll('[data-hero-squad]').forEach((button) => button.addEventListener('click', () => {
      void showSpotlight(button.dataset.heroSquad, { pushHistory: true });
      document.getElementById('gov-squad-spotlight')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }));
  }
  mount.querySelector('[data-hero-freshness]')?.addEventListener('click', () => openFreshnessDrawer(answer));
  mount.querySelectorAll('[data-story-squad]').forEach((row) => {
    const squad = row.getAttribute('data-story-squad');
    row.addEventListener('focus', () => openPreview(row, squad, { persistent: true }));
    row.addEventListener('pointerenter', (event) => { if (event.pointerType !== 'touch' && !previewPersistent) openPreview(row, squad, { persistent: false }); });
    row.addEventListener('pointerleave', () => { if (!previewPersistent) closePreview(); });
    row.addEventListener('click', () => void showSpotlight(squad, { pushHistory: true }));
  });
  mount.querySelectorAll('[data-operating-model]').forEach((button) => button.addEventListener('click', () => openOperatingModelDrawer(button.dataset.operatingModel)));
  mount.querySelector('[data-story-apply]')?.addEventListener('click', applyPendingAnswer);
  mount.querySelector('[data-story-keep-draft]')?.addEventListener('click', keepDecisionDraft);
  mount.querySelectorAll('[data-story-lens]').forEach((button) => button.addEventListener('click', () => selectLens(button.dataset.storyLens, answer, mount)));
  mount.querySelector('[data-story-lens-select]')?.addEventListener('change', (event) => selectLens(event.target.value, answer, mount));
  const diagnosticTrigger = mount.querySelector('[data-governance-diagnostics]');
  diagnosticTrigger?.addEventListener('dblclick', openDiagnostics);
  let lastDiagnosticTap = 0;
  diagnosticTrigger?.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'touch') return;
    const now = Date.now();
    if (now - lastDiagnosticTap < 450) void openDiagnostics();
    lastDiagnosticTap = now;
  });
  diagnosticTrigger?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openDiagnostics(); } });
}

function selectLens(lens, answer, mount) {
  if (!lenses.some(([id]) => id === lens)) return;
  activeLens = lens;
  mount.querySelector('.gov-story-v2')?.setAttribute('data-active-lens', lens);
  mount.querySelectorAll('[data-story-lens]').forEach((button) => {
    const selected = button.dataset.storyLens === lens;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('btn-secondary', selected);
    button.classList.toggle('btn-link', !selected);
  });
  const summary = mount.querySelector('[data-lens-summary]');
  if (summary) summary.textContent = answer.lensSummaries?.[lens] || '';
  if (lens === 'squad' && spotlightKey) document.getElementById('gov-squad-spotlight')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (lens === 'evidence') mount.querySelector('.gov-loop-source')?.focus?.({ preventScroll: true });
  const url = new URL(location.href); url.searchParams.set('view', lens); url.searchParams.delete('lens'); history.replaceState({ ...(history.state || {}), spotlight: spotlightKey, view: lens }, '', url);
}

async function openDiagnostics() {
  try {
    const res = await fetch('/api/governance/diagnostics.json', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Diagnostics are restricted.');
    const rows = Object.entries(data).filter(([key]) => key !== 'activeRefreshJobs').map(([key, value]) => `<dt>${escapeHtml(key.replace(/([A-Z])/g, ' $1'))}</dt><dd>${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value)}</dd>`).join('');
    openRightDrawer({ title: 'Governance diagnostics', bodyHtml: `<section class="gov-diagnostics-drawer"><p>Hidden operational detail for UAT and authorized support.</p><dl>${rows}</dl></section>`, panelClass: 'governance-diagnostics' });
  } catch (error) {
    const trigger = document.querySelector('[data-governance-diagnostics]');
    if (trigger) {
      trigger.setAttribute('title', error.message || 'Diagnostics unavailable');
      trigger.setAttribute('aria-label', error.message || 'Diagnostics unavailable');
      trigger.textContent = 'Diagnostics restricted';
      window.setTimeout(() => { trigger.textContent = '0.0.0.1 UAT'; trigger.setAttribute('aria-label', 'Open UAT diagnostics'); }, 2400);
    }
  }
}

function openContractSourceDrawer(answer) {
  const rows = (answer.squads || []).map((squad) => `<li><strong>${escapeHtml(squad.displayName || squad.squad)}</strong> — ${escapeHtml(squad.baselineCoverage?.copy || 'Baseline missing.')}</li>`).join('');
  openRightDrawer({ title: 'PI contract comparison source', panelClass: 'active-loop', bodyHtml: `<section class="gov-resolution-sheet"><p>${escapeHtml(answer.sourceLine || 'Source unavailable.')}</p><ul>${rows}</ul><p>The promise drawer contains the immutable artifact reference used for each decision.</p></section>` });
}

function openFreshnessDrawer(answer) {
  const freshness = currentFreshness(answer);
  openRightDrawer({ title: 'Evidence freshness', panelClass: 'active-loop', bodyHtml: `<section class="gov-resolution-sheet"><p><strong>${escapeHtml(freshness.copy)}</strong></p><p>Verified at ${escapeHtml(answer.verifiedAt || 'unknown')}. Delivera serves the last compatible projection first and refreshes affected squads in the background.</p>${freshness.state === 'stale' || freshness.state === 'failed' ? '<p>Evidence-dependent decisions remain disabled until targeted proof refresh succeeds.</p>' : ''}</section>` });
}

function closePreview() { persistentPreview?.remove(); persistentPreview = null; previewPersistent = false; }

function openPreview(trigger, squad, { persistent = false } = {}) {
  closePreview();
  const summary = [...(activeAnswer?.squads || []), ...(activeAnswer?.excludedOperationalGroups || [])].find((item) => item.squad === squad);
  if (!summary) return;
  const pop = document.createElement('div');
  pop.className = 'gov-loop-proof-popover'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', `${summary.displayName || squad} proof preview`);
  const promises = (activeAnswer?.promises || []).filter((item) => item.squad === squad);
  const matched = promises.filter((item) => ['matched', 'aligned-amended'].includes(item.matchState)).length;
  const missing = promises.filter((item) => item.matchState === 'no-jira-proof').length;
  const amended = promises.filter((item) => item.matchState === 'aligned-amended').length;
  pop.innerHTML = `<div class="gov-loop-popover-head"><strong>${escapeHtml(summary.displayName || squad)} · proof preview</strong><button type="button" aria-label="Close proof preview">×</button></div><dl class="gov-proof-preview-grid"><dt>PI contract</dt><dd>${promises.length} commitments · ${matched} matched · ${missing} no proof · ${amended} amended<br><small>${escapeHtml(summary.baselineCoverage?.copy || 'Baseline unavailable')}</small></dd><dt>Sprint reality</dt><dd>${escapeHtml(summary.sprintCadence?.label || summary.sprintReality?.state || 'Unverified')}<br><small>${escapeHtml(summary.sprintReality?.copy || 'No sprint evidence')}</small></dd><dt>Work diversion</dt><dd>${escapeHtml(summary.doingInstead?.major?.title || summary.unknownWork?.copy || 'No major diversion proven')}<br><small>${escapeHtml(summary.workSplit?.explanation || '')}</small></dd><dt>Proof age / action</dt><dd>${escapeHtml(summary.proofState || 'Unknown')}<br><small>${escapeHtml(summary.nextAction?.label || 'Open squad spotlight')}</small></dd><dt>Trust basis</dt><dd>${escapeHtml(summary.trustFactor?.label || 'Limited')}</dd></dl>`;
  const missingCopy = missing === 1 ? '1 No Jira proof' : `${missing} No Jira proof`;
  pop.innerHTML = pop.innerHTML.replace(`${missing} no proof`, missingCopy);
  document.body.appendChild(pop);
  const rect = trigger.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - popRect.width - 8, rect.left));
  const below = rect.bottom + 6;
  const top = below + popRect.height <= window.innerHeight - 8 ? below : Math.max(64, rect.top - popRect.height - 6);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  persistentPreview = pop;
  previewPersistent = persistent;
  pop.querySelector('button')?.addEventListener('click', () => { closePreview(); trigger.focus(); });
}

function openOperatingModelDrawer(squadKey) {
  const squad = [...(activeAnswer?.squads || []), ...(activeAnswer?.excludedOperationalGroups || [])].find((item) => item.squad === squadKey);
  if (!squad) return;
  const evidence = squad.operatingModel?.evidence || squad.operatingModelEvidence?.classificationSignals || [];
  const { el, close } = openRightDrawer({
    title: `${squad.displayName || squad.squad} · operating model`,
    panelClass: 'active-loop',
    bodyHtml: `<section class="gov-resolution-sheet"><p><strong>${escapeHtml(squad.operatingModel?.label || 'Classification review')}</strong> · ${Number(squad.operatingModel?.confidence) || 0}% confidence</p><p>${escapeHtml(squad.operatingModel?.copy || '')}</p><h3>Deterministic evidence</h3><ul>${evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>Evidence is incomplete; keep this classification under review.</li>'}</ul><div class="gov-loop-actions"><button type="button" class="btn btn-primary" data-operating-save="operational-group">Keep as operational group</button><button type="button" class="btn btn-secondary" data-operating-save="pi-governed">Confirm PI-governed squad</button></div><p role="status" data-operating-status></p></section>`,
  });
  el.querySelectorAll('[data-operating-save]').forEach((button) => button.addEventListener('click', async () => {
    const status = el.querySelector('[data-operating-status]');
    button.disabled = true;
    try {
      const response = await fetch('/api/governance/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ scope: `project:${squad.squad}`, key: 'operatingModel', aliasKey: squad.squad, value: button.dataset.operatingSave }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Operating model could not be saved.');
      if (status) status.textContent = 'Decision recorded. The next targeted refresh will apply it without changing other squads.';
      setTimeout(close, 900);
    } catch (error) {
      if (status) status.textContent = error.message;
      button.disabled = false;
    }
  }));
}

function openBoardAliasDrawer(squad) {
  if (!squad?.squad) return;
  const { el, close } = openRightDrawer({
    title: `${squad.displayName || squad.squad} · squad name`,
    panelClass: 'active-loop',
    bodyHtml: `<form class="gov-resolution-sheet" data-alias-form><p>Use the operating name PI users recognize. The Jira key remains available in proof metadata.</p><label>Squad display name<input name="alias" required minlength="3" maxlength="180" value="${escapeHtml(squad.displayName || squad.squad)}"></label><div class="gov-loop-actions"><button type="submit" class="btn btn-primary">Save site-wide name</button><button type="button" class="btn btn-secondary" data-drawer-close>Cancel</button></div><p role="status"></p></form>`,
  });
  const form = el.querySelector('[data-alias-form]');
  form?.querySelector('input')?.focus();
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('[role="status"]');
    const value = form.elements.alias.value.trim();
    status.textContent = 'Saving the shared squad name…';
    try {
      const response = await fetch('/api/governance/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ scope: `project:${squad.squad}`, key: 'boardAlias', aliasKey: squad.squad, value }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Squad name could not be saved.');
      status.textContent = 'Squad name saved. It will apply on the next targeted refresh.';
      setTimeout(close, 900);
    } catch (error) { status.textContent = error.message; }
  });
}

function updateUrl(squad, push) {
  const url = new URL(location.href);
  if (squad) url.searchParams.set('spotlight', squad); else url.searchParams.delete('spotlight');
  url.searchParams.set('view', activeLens);
  url.searchParams.delete('lens');
  history[push ? 'pushState' : 'replaceState']({ spotlight: squad, view: activeLens }, '', url);
}

function clearSpotlight(pushHistory = false) {
  spotlightKey = ''; activeSpotlightDetail = null; closePreview(); updateUrl('', pushHistory);
  document.body.classList.remove('governance-squad-selected');
  document.getElementById('gov-squad-spotlight')?.replaceChildren();
  document.querySelectorAll('[data-story-squad]').forEach((row) => row.setAttribute('aria-current', 'false'));
  document.querySelector('[data-story-all]')?.setAttribute('aria-current', 'true');
}

function spotlightHtml(detail) {
  const squad = detail.squad || {};
  const promises = detail.promises || [];
  const work = detail.currentWork || [];
  const unknown = detail.unknownWork || squad.unknownWork || {};
  const rework = detail.possibleRework || squad.possibleRework || {};
  const displayName = squad.displayName || squad.squad;
  return `<div class="gov-spotlight-head"><div><span class="gov-loop-kicker">Synchronized Squad Spotlight</span><h2>${escapeHtml(displayName)}</h2></div><div class="gov-spotlight-head-actions"><button type="button" class="btn btn-link btn-compact" data-edit-alias>Edit squad name</button><button type="button" class="btn btn-secondary btn-compact" data-force-squad>Force ${escapeHtml(displayName)} sync</button></div></div>
  <div class="gov-spotlight-readout"><span><small>PI contract</small><strong>${escapeHtml(squad.contractState?.label || squad.topState || 'Cannot verify')}</strong></span><span><small>Sprint reality</small><strong>${escapeHtml(squad.sprintCadence?.label || squad.sprintReality?.state || 'Unverified')}</strong></span><span><small>Trust basis</small><strong>${escapeHtml(squad.trustFactor?.label || 'Limited')}</strong></span><span><small>Next safe action</small><strong>${escapeHtml(squad.nextAction?.label || 'Review evidence')}</strong></span></div>
  <div class="gov-spotlight-grid">
    <section><h3>Current Work Reality</h3>${work.length ? work.slice(0, 5).map((item) => `<p class="gov-work-theme"><span><strong>${escapeHtml(item.title)}</strong>${item.systemDerived ? ' <small>system-derived label</small>' : ''}</span>${item.systemDerived || item.title === 'Unclear work theme' ? `<button type="button" class="btn btn-secondary btn-compact" data-theme-rename data-theme-id="${escapeHtml(item.themeId || item.title)}" data-theme-version="${Number(item.version) || 1}">Rename theme</button>` : ''}</p>`).join('') : '<p>No current work themes are available.</p>'}</section>
    <section><h3>Sprint Reality</h3><p>${escapeHtml(detail.sprintReality?.copy || 'Sprint reality unavailable.')}</p></section>
    <section><h3>Evidence Signals</h3><p>${escapeHtml(rework.copy || 'No evidence-backed rework signal is promoted.')}</p>${rework.promoted ? `<details><summary>Why Delivera raised this</summary><ul>${(rework.promoted.paths || []).map((path) => `<li>${escapeHtml(path.label)}</li>`).join('')}</ul></details>` : '<p class="gov-calm-note">Low-confidence follow-up work stays out of risk totals.</p>'}${unknown.promoted ? `<div class="gov-unknown-clusters"><p><strong>${escapeHtml(unknown.copy)}</strong></p>${(unknown.clusters || []).slice(0, 3).map((cluster) => `<article><strong>${escapeHtml(cluster.title)}</strong><small>${cluster.ticketCount} issues · ${cluster.percentage}% · ${escapeHtml(cluster.sharedEvidence?.join(', ') || 'shared work evidence')}</small><button type="button" class="btn btn-secondary btn-compact" data-classify-cluster="${escapeHtml(cluster.id)}" data-cluster-version="${Number(cluster.version) || 1}" data-classification="${escapeHtml(cluster.recommendation)}">${escapeHtml(cluster.recommendation === 'ad-hoc-feature' ? 'Mark as Ad Hoc Feature Work' : cluster.recommendation === 'operational-group-candidate' ? 'Mark as Operational Group candidate' : 'Mark cluster as Operational')}</button></article>`).join('')}</div>` : ''}</section>
    <section><h3>Doing Instead &amp; Work Split</h3><p>${escapeHtml(squad.doingInstead?.copy || 'No major diversion is proven.')}</p><p>${escapeHtml(squad.workSplit?.explanation || '')}</p><p>Unknown: ${squad.workSplit?.unknownPct == null ? 'not calculated' : `${squad.workSplit.unknownPct}%`}</p></section>
    <section><h3>Promise Evidence</h3>${promises.length ? promises.map((promise) => `<button type="button" class="gov-spotlight-promise" data-loop-promise="${escapeHtml(promise.promiseId)}"><strong>${escapeHtml(promise.originalText)}</strong><small>${escapeHtml(promise.matchLabel)} · ${escapeHtml(promise.proofAge?.copy || '')}</small>${promise.amendmentSentence ? `<span class="gov-amendment-sentence"><s aria-hidden="true">${escapeHtml(promise.originalText)}</s><span class="sr-only">Original promise: ${escapeHtml(promise.originalText)}.</span> → ${escapeHtml(promise.amendmentSentence.split('→').slice(1).join('→').trim())}</span>` : ''}</button>`).join('') : '<p>Cannot verify, baseline missing. Save baseline to compare.</p>'}</section>
    <section class="gov-spotlight-actions"><h3>Action Trail</h3>${actionTrailHtml(promises)}</section>
  </div><div class="gov-loop-action-status" aria-live="polite"></div>`;
}

async function showSpotlight(squad, { pushHistory = false } = {}) {
  spotlightKey = squad; activeSpotlightDetail = null; closePreview(); updateUrl(squad, pushHistory);
  document.body.classList.add('governance-squad-selected');
  const primary = document.querySelector('[data-loop-primary]');
  const selectedPromise = decisionPromiseForAnswer(activeAnswer);
  if (primary && selectedPromise) {
    primary.textContent = `Review ${selectedPromise.squadDisplayName || selectedPromise.squad}`;
    primary.dataset.promiseId = selectedPromise.promiseId;
    primary.dataset.squadId = selectedPromise.squad;
  }
  document.querySelectorAll('[data-story-squad]').forEach((row) => row.setAttribute('aria-current', String(row.getAttribute('data-story-squad') === squad)));
  document.querySelector('[data-story-all]')?.setAttribute('aria-current', 'false');
  const mount = document.getElementById('gov-squad-spotlight');
  if (!mount) return;
  mount.innerHTML = '<p aria-busy="true">Loading squad story…</p>';
  try {
    const res = await fetch(`/api/governance/squads/${encodeURIComponent(squad)}/detail.json?projects=${encodeURIComponent(squad)}&squad=${encodeURIComponent(squad)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const detail = await res.json();
    if (spotlightKey !== squad) return;
    activeSpotlightDetail = detail;
    const currentDecision = decisionPromiseForAnswer(activeAnswer);
    if (primary && currentDecision) {
      primary.textContent = `Review ${currentDecision.squadDisplayName || detail.squad?.displayName || currentDecision.squad}`;
      primary.dataset.promiseId = currentDecision.promiseId;
    }
    mount.innerHTML = spotlightHtml(detail);
    mount.querySelectorAll('[data-loop-promise]').forEach((button) => button.addEventListener('click', () => void openPromiseDrawer(button.getAttribute('data-loop-promise'))));
    mount.querySelectorAll('[data-theme-rename]').forEach((button) => button.addEventListener('click', () => beginThemeRename(button, squad, mount)));
    mount.querySelectorAll('[data-classify-cluster]').forEach((button) => button.addEventListener('click', () => classifyUnknownCluster(button, detail, mount)));
    mount.querySelector('[data-force-squad]')?.addEventListener('click', (event) => targetedRefresh('squad', squad, event.currentTarget, mount));
    mount.querySelector('[data-edit-alias]')?.addEventListener('click', () => openBoardAliasDrawer(detail.squad));
  } catch (_) { mount.innerHTML = '<p role="status">Squad details are unavailable. The portfolio answer remains valid.</p>'; }
}

async function classifyUnknownCluster(button, detail, container) {
  const squad = detail.squad || {};
  const status = container.querySelector('.gov-loop-action-status');
  const clusterVersion = Number(button.dataset.clusterVersion) || 1;
  const idempotencyKey = `classify:${squad.squad}:${button.dataset.classifyCluster}:${clusterVersion}`;
  button.disabled = true;
  status.textContent = 'Recording the grouped decision and queueing the Jira source write…';
  try {
    const res = await fetch(`/api/governance/squads/${encodeURIComponent(squad.squad)}/unknown-clusters/${encodeURIComponent(button.dataset.classifyCluster)}/classification`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'If-Match': `"${clusterVersion}"`, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ classification: button.dataset.classification, expectedVersion: clusterVersion, squadPayloadHash: squad.payloadHash || detail.squadPayloadHash || '', idempotencyKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 412) throw new Error(data.error || 'This squad changed. Review the latest evidence before classifying.');
    if (!res.ok) throw new Error(data.error || `Classification failed (${res.status})`);
    status.textContent = `Decision recorded · ${data.writeState}. Jira confirmation is pending; the governance state remains open.`;
    button.textContent = 'Recorded, sync pending';
  } catch (error) {
    button.disabled = false;
    status.textContent = error.message || 'Classification failed. Nothing changed.';
  }
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

function actionTrailHtml(promises = []) {
  if (!promises.length) return '<p>No action trail exists.</p>';
  const groups = new Map();
  for (const promise of promises) {
    const lifecycle = promise.actionLifecycle || 'No governance action has been sent yet.';
    const actionLabel = promise.nextAction?.label || '';
    const key = `${lifecycle}::${actionLabel}`;
    const group = groups.get(key) || { lifecycle, actionLabel, promises: [] };
    group.promises.push(promise);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const first = group.promises[0];
    const scope = group.promises.length > 1 ? `<small>${group.promises.length} promises share this state.</small>` : '';
    const button = group.actionLabel
      ? `<button type="button" class="btn btn-secondary btn-compact" data-loop-promise="${escapeHtml(first.promiseId)}">${escapeHtml(group.actionLabel)}</button>`
      : '';
    return `<div class="gov-action-lifecycle"><p>${escapeHtml(group.lifecycle)}</p>${scope}${button}</div>`;
  }).join('');
}

function readLocked() {
  return decisionInProgress || Boolean(persistentPreview || document.querySelector('.gov-loop-drawer') || document.querySelector('.gov-story-row:focus'));
}

function announcePending() {
  const banner = document.querySelector('.gov-story-update');
  if (banner) {
    const copy = banner.querySelector('[data-story-update-copy]');
    if (copy) copy.textContent = sharedStoryState.pendingReason || pendingReason;
    banner.hidden = false;
  }
}

function applyPendingAnswer() {
  const next = pendingAnswer || sharedStoryState.pendingAnswer;
  if (!next) return;
  pendingAnswer = null;
  sharedStoryState.pendingAnswer = null;
  const y = window.scrollY; renderActiveGovernanceLoop(next, { forceApply: true });
  requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'auto' }));
}

function keepDecisionDraft() {
  const draft = activeDrawerContext ? { ...activeDrawerContext, retainedAt: new Date().toISOString() } : null;
  if (draft) {
    try { sessionStorage.setItem(`delivera:governance:decision-draft:${draft.promiseId}`, JSON.stringify(draft)); } catch (_) { /* privacy mode */ }
  }
  const banner = document.querySelector('.gov-story-update');
  if (banner) banner.hidden = true;
  const warning = document.querySelector('.gov-loop-stale-warning');
  if (warning) { warning.hidden = false; warning.textContent = 'Your edits are preserved as a new decision draft. Review the latest evidence before submitting.'; }
}

function amendmentFormHtml() {
  return `<form class="gov-loop-amend-form"><label>Approved change<select name="type"><option value="mutually-agreed-descope">Mutually agreed descope</option><option value="move-to-next-quarter">Move to next quarter</option><option value="split-into-new-promise">Split into new promise</option><option value="replace-with-urgent-work">Replace with approved urgent work</option><option value="mark-as-support-obligation">Mark as support obligation</option></select></label><label>Business reason<textarea name="reason" minlength="8" required></textarea></label><label>Approval proof reference<input name="approvalProofRef"></label><button class="btn btn-primary" type="submit">Approve amendment</button></form>`;
}

function sourceWriteLabel(state) {
  return ({ 'local-receipt': 'Recorded in Delivera', queued: 'Jira update queued', 'source-pending': 'Pending Jira confirmation', 'source-confirmed': 'Confirmed in Jira', 'projection-reconciled': 'Reconciled into projection', 'source-failed': 'Failed · retry available' })[state] || String(state || 'Drafted').replace(/-/g, ' ');
}

function recipientEditor(promise) {
  const route = promise.ownerRoute || {};
  return `<div class="gov-recipient-review"><p>${route.unresolved ? 'No epic owner found. Use the PI Team assignment queue or choose the correct recipient before sending.' : `Nudge will go to ${escapeHtml(route.role || 'owner')}: ${escapeHtml(route.displayName || '')}.`}</p><label>Recipient<input data-recipient-name value="${escapeHtml(route.displayName || 'PI Team queue')}" placeholder="Choose recipient"></label><label>Role<input data-recipient-role value="${escapeHtml(route.role || 'PI Team queue')}"></label><label class="gov-recipient-default"><input type="checkbox" data-recipient-default> Save as squad default</label></div>`;
}

function scopedPromiseSourceReference(promise, squad) {
  const raw = String(promise.sourceReference || promise.quarter || '').trim();
  if (!raw.includes('+')) return raw;
  const projectKeys = squad?.context?.projectKeys || [];
  const project = projectKeys[0] || promise.issueKey?.split('-')[0] || promise.squad;
  return [promise.squadDisplayName || squad?.displayName || promise.squad, project ? `Jira project ${project}` : ''].filter(Boolean).join(' · ');
}

function drawerHtml(promise, squad) {
  const actions = promise.allowedActions || [];
  return `<div class="gov-loop-drawer" data-loop-promise-version="${Number(promise.version) || 1}"><section class="gov-loop-drawer-verdict gov-loop-tone-${tone(promise.matchState)}"><span>${escapeHtml(promise.matchLabel)}</span><strong>${escapeHtml(promise.originalText)}</strong><p>${escapeHtml(promise.proofAge?.copy || '')}</p>${promise.amendmentSentence ? `<p class="gov-amendment-sentence"><s aria-hidden="true">${escapeHtml(promise.originalText)}</s><span class="sr-only">Original promise: ${escapeHtml(promise.originalText)}.</span> → ${escapeHtml(promise.amendmentSentence.split('→').slice(1).join('→').trim())}</p>` : ''}</section>
  <div class="gov-loop-drawer-grid"><section><h3>PI promise source</h3><p>${escapeHtml(promise.source || promise.baselineCoverage?.sourceLabel || 'Approved PI baseline')}</p><p>${escapeHtml(scopedPromiseSourceReference(promise, squad))}</p></section><section><h3>Matched Jira work</h3><p><strong>${escapeHtml(promise.issueKey || 'No Jira proof')}</strong> · ${escapeHtml(promise.statusNow || '')}</p></section><section><h3>Proof age</h3><p>${escapeHtml(promise.proofAge?.state || 'unknown')} · ${escapeHtml(promise.proofAge?.copy || '')}</p></section><section><h3>Work Split</h3><p>${squad?.workSplit?.unplannedPct == null ? 'Unplanned work unknown' : `${squad.workSplit.unplannedPct}% unplanned work`}</p><p>${escapeHtml(squad?.workSplit?.largestUnmappedCluster ? `Largest unmapped cluster: ${squad.workSplit.largestUnmappedCluster}.` : '')}</p><p>${escapeHtml(squad?.workSplit?.explanation || '')}</p><p>Unknown: ${squad?.workSplit?.unknownPct == null ? 'not calculated' : `${squad.workSplit.unknownPct}%`}</p></section><section><h3>Action state</h3><p>${escapeHtml(promise.actionLifecycle || '')}</p></section><section><h3>Owner path</h3>${recipientEditor(promise)}</section><section><h3>Ready to Promise</h3><p>${escapeHtml(promise.readiness?.copy || 'Readiness was not captured in the original baseline.')}</p></section><section><h3>Trade-off Guardrail</h3><p>${escapeHtml(promise.tradeOffGuardrail?.copy || 'No trustworthy percentage is available.')}</p></section></div>
  <details class="gov-loop-history" open><summary>Nudge and reaction history (${promise.actionHistory?.length || 0})</summary><ol>${(promise.actionHistory || []).map((item) => `<li><strong>${escapeHtml(String(item.type || '').replace(/-/g, ' '))}</strong><small>${escapeHtml(item.replyExcerpt || item.messagePreview || '')}</small></li>`).join('') || '<li>No action has been sent yet.</li>'}</ol></details>
  ${(promise.sourceWrites || []).length ? `<details class="gov-loop-history"><summary>Source write status (${promise.sourceWrites.length})</summary><ol>${promise.sourceWrites.map((write) => `<li><strong>${escapeHtml(sourceWriteLabel(write.state))}</strong><small>${escapeHtml(write.failureReason || write.correctionPath || `${write.targetSystem || 'source'} · ${write.targetObject || ''}`)}</small></li>`).join('')}</ol></details>` : ''}
  <div class="gov-loop-stale-warning" hidden role="alert"></div><div class="gov-loop-action-status" aria-live="polite"></div><div class="gov-loop-actions">${actions.map((action) => `<span class="gov-loop-action-wrap"><button type="button" class="btn ${action.id === 'send-nudge' || action.id === 'recheck-promise' ? 'btn-primary' : 'btn-secondary'} btn-compact" data-loop-action="${escapeHtml(action.id)}" ${action.allowed ? '' : 'disabled aria-disabled="true"'} title="${escapeHtml(action.reason || '')}">${escapeHtml(action.id === 'send-nudge' && promise.ownerRoute?.displayName ? `Nudge ${promise.ownerRoute.role}: ${promise.ownerRoute.displayName}` : actionLabels[action.id] || action.id)}</button>${action.allowed ? '' : `<small>${escapeHtml(action.reason || 'This action is not currently safe.')}</small>`}</span>`).join('')}</div></div>`;
}

async function fetchPromiseDetail(promiseId, detailHref = '') {
  const projects = activeAnswer?.scope?.projects || [];
  const url = detailHref || `/api/governance/cases/${encodeURIComponent(promiseId)}/detail.json?projects=${encodeURIComponent(projects.join(','))}`;
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Promise detail unavailable (${res.status})`);
  return res.json();
}

export async function openPromiseDrawer(promiseId, { detailHref = '' } = {}) {
  closePreview(); closeAllGovernanceOverlays();
  let detail;
  const spotlightPromise = activeSpotlightDetail?.promises?.find((item) => item.promiseId === promiseId);
  const localPromise = activeAnswer?.promises?.find((item) => item.promiseId === promiseId);
  if (spotlightPromise?.allowedActions) detail = { promise: spotlightPromise, squad: activeSpotlightDetail.squad };
  else if (localPromise?.allowedActions) detail = { promise: localPromise, squad: activeAnswer?.squads?.find((item) => item.squad === localPromise.squad) || null };
  else try { detail = await fetchPromiseDetail(promiseId, detailHref); } catch (err) { return; }
  const promise = detail.promise; const squad = detail.squad;
  const { el } = openRightDrawer({ title: `${promise.squadDisplayName || squad?.displayName || promise.squad} · ${promise.matchLabel}`, bodyHtml: drawerHtml(promise, squad), panelClass: 'active-loop' });
  const drawer = el?.querySelector('.gov-loop-drawer');
  if (drawer) {
    drawer.dataset.drawerStateHash = promise.drawerStateHash || '';
    drawer.dataset.squadPayloadHash = squad?.payloadHash || '';
  }
  activeDrawerContext = { promiseId: promise.promiseId, squad: promise.squad, promiseVersion: promise.version, drawerStateHash: promise.drawerStateHash || '', squadPayloadHash: squad?.payloadHash || '', storyVersion: activeAnswer?.answerVersion };
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
  const idempotencyKey = body?.idempotencyKey || `${promise.promiseId}:${promise.version}:${url.split('?')[0]}`;
  return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'If-Match': `"${promise.version}"`, 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ ...body, expectedVersion: promise.version, idempotencyKey, squadPayloadHash: activeDrawerContext?.squadPayloadHash || '' }) });
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
  if (action === 'assign-owner') {
    if (!recipient.displayName) { status.textContent = 'Choose a recipient or use the PI Team assignment queue.'; return; }
    status.textContent = 'Saving the version-protected owner route…';
    const routeRes = await versionedPost(`/api/governance/cases/${encodeURIComponent(promise.promiseId)}/owner-route`, promise, { recipient, saveAsSquadDefault: drawer.querySelector('[data-recipient-default]')?.checked === true });
    const routeData = await routeRes.json().catch(() => ({}));
    if (routeRes.status === 412) { drawer.querySelector('.gov-loop-stale-warning').hidden = false; drawer.querySelector('.gov-loop-stale-warning').textContent = routeData.message || routeData.error || 'The owner route changed. Review the latest state.'; status.textContent = 'Your recipient choice is preserved.'; return; }
    if (!routeRes.ok) { status.textContent = routeData.error || `Owner route update failed (${routeRes.status}).`; return; }
    promise.version = routeData.version || promise.version + 1;
    status.textContent = 'Owner route saved. Review the named recipient before sending.';
    return;
  }
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
    if (!data.jobId) return;
    const completed = await waitForTargetedRefresh(data.jobId);
    if (completed.status === 'failed') throw new Error(completed.error || 'Targeted sync failed.');
    applyTargetedRefreshPatch(completed);
    const refreshedStatus = document.querySelector('.gov-loop-action-status');
    if (refreshedStatus) refreshedStatus.textContent = completed.squadPatch?.sprintReality?.copy || `Targeted ${scopeType} evidence is verified.`;
  } catch (err) { status.textContent = err.message || 'Targeted sync failed.'; } finally { if (button) button.disabled = false; }
}

async function waitForTargetedRefresh(jobId) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    const res = await fetch(`/api/governance/refreshes/${encodeURIComponent(jobId)}`, { credentials: 'same-origin', cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Targeted sync status failed (${res.status})`);
    if (data.status !== 'running') return data;
  }
  throw new Error('Targeted sync is still running. Delivera kept the existing verified view; try again shortly.');
}

function applyTargetedRefreshPatch(result) {
  if (!activeAnswer || !result) return;
  const next = { ...activeAnswer, answerVersion: result.answerVersion || activeAnswer.answerVersion };
  if (result.squadPatch?.squad) {
    const patchList = (rows = []) => rows.map((row) => row.squad === result.squadPatch.squad ? result.squadPatch : row);
    const inGoverned = (next.squads || []).some((row) => row.squad === result.squadPatch.squad);
    next.squads = inGoverned ? patchList(next.squads) : next.squads;
    next.excludedOperationalGroups = inGoverned ? next.excludedOperationalGroups : patchList(next.excludedOperationalGroups);
  }
  if (result.promisePatch?.promiseId && Array.isArray(next.promises)) {
    next.promises = next.promises.map((row) => row.promiseId === result.promisePatch.promiseId ? result.promisePatch : row);
  }
  renderActiveGovernanceLoop(next, { forceApply: true });
  if (spotlightKey) void showSpotlight(spotlightKey, { pushHistory: false });
}

export function renderActiveGovernanceLoop(answer, { forceApply = false } = {}) {
  if (!answer || ![1, 2].includes(answer.schemaVersion) || !answer.answer || !answer.scope || !Array.isArray(answer.squads)) return;
  activeAnswer ||= sharedStoryState.activeAnswer;
  if (!forceApply && activeAnswer && answer.answerVersion !== activeAnswer.answerVersion && readLocked()) {
    pendingAnswer = answer;
    sharedStoryState.pendingAnswer = answer;
    const nextSquad = activeDrawerContext ? [...answer.squads, ...(answer.excludedOperationalGroups || [])].find((squad) => squad.squad === activeDrawerContext.squad) : null;
    const nextPromise = activeDrawerContext ? answer.promises?.find((promise) => promise.promiseId === activeDrawerContext.promiseId) : null;
    if (nextPromise && nextPromise.drawerStateHash !== activeDrawerContext.drawerStateHash) pendingReason = 'This squad’s Jira evidence changed. Review changes before saving.';
    else if (nextSquad && nextSquad.payloadHash !== activeDrawerContext?.squadPayloadHash) pendingReason = 'New squad evidence is available. Your active item and edits remain unchanged.';
    else pendingReason = 'New evidence is ready for another squad. Your current meeting view is unchanged.';
    sharedStoryState.pendingReason = pendingReason;
    announcePending(); return;
  }
  activeAnswer = answer; sharedStoryState.activeAnswer = answer; renderHero(answer);
}

export async function loadActiveGovernanceLoop({ projects, quarter = '', force = false } = {}) {
  const seq = ++requestSequence; spotlightKey = new URL(location.href).searchParams.get('spotlight') || '';
  const cached = force ? null : readCachedAnswer(projects, quarter); if (cached) renderActiveGovernanceLoop(cached);
  const qs = new URLSearchParams({
    projects: String(projects || ''),
    presentationContractVersion: String(PRESENTATION_CONTRACT_VERSION),
  }); if (quarter) qs.set('quarter', quarter);
  const activeMount = document.getElementById('gov-active-loop-mount');
  if (activeMount) activeMount.dataset.activeLoopRequest = qs.toString();
  const loadKey = `${String(projects || '').toUpperCase()}|${quarter || 'current'}|${force ? 'force' : 'normal'}`;
  try {
    if (!activeLoopLoads.has(loadKey)) {
      activeLoopLoads.set(loadKey, fetch(`/api/governance/active-loop.json?${qs}`, { credentials: 'same-origin', cache: 'no-store' })
        .then(async (res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
        .finally(() => activeLoopLoads.delete(loadKey)));
    }
    const answer = await activeLoopLoads.get(loadKey); if (seq !== requestSequence) return null;
    if (Number(answer?.presentationContractVersion) !== PRESENTATION_CONTRACT_VERSION) throw new Error(`Presentation contract mismatch (${String(answer?.presentationContractVersion || 'missing')})`);
    writeCachedAnswer(projects, quarter, answer); renderActiveGovernanceLoop(answer); window.setTimeout(() => {
      const loading = document.getElementById('gov-loading');
      if (loading && document.body.classList.contains('governance-story-v2-ready')) {
        loading.hidden = true;
        loading.setAttribute('aria-hidden', 'true');
      }
    }, 0); return answer;
  } catch (error) {
    const mount = document.getElementById('gov-active-loop-mount');
    if (mount) mount.dataset.activeLoopError = String(error?.message || error || 'Unknown active-loop error').slice(0, 240);
    if (!cached && seq === requestSequence) mount.innerHTML = '<section class="gov-active-loop-hero is-limited" role="status"><h1>Last verified PI answer is unavailable.</h1><p>Decisions requiring fresh evidence are paused.</p></section>';
    return cached;
  }
}

window.addEventListener('popstate', () => {
  const lens = new URL(location.href).searchParams.get('view') || 'overall';
  if (lens !== activeLens && activeAnswer) selectLens(lens, activeAnswer, document.getElementById('gov-active-loop-mount'));
  const next = new URL(location.href).searchParams.get('spotlight') || '';
  if (next) void showSpotlight(next, { pushHistory: false }); else clearSpotlight(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePreview();
  if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'd') { event.preventDefault(); void openDiagnostics(); }
});
document.addEventListener('pointerdown', (event) => { if (persistentPreview && !persistentPreview.contains(event.target) && !event.target.closest('[data-story-squad]')) closePreview(); });
