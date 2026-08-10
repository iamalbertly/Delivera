import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openRightDrawer, closeAllGovernanceOverlays } from './Delivera-App-Shared-RightDrawer-01UI.js';
import {
  currentSprintSquadHref,
  persistLastFocusSquad,
  readContinuityTokens,
  renderIdentityLinkRow,
  resolveReturnToHref,
} from './Delivera-Shared-Continuity-Link-01Build.js';
import { isOwnerMissing } from './Delivera-Shared-Attention-Queue.js';
import { DELIVERA_CLIENT_RELEASE_SCHEMA, clearGovernanceClientCaches } from './Delivera-Shared-Release-Cache-Guard-01SSOT.js';
import {
  buildDeliveryH1,
  buildDeliveryPortfolioKpis,
  buildDeliverySquadKpis,
  buildEpicRailChips,
  buildPiCommitmentPack,
  commitmentPackControlsHtml,
  clusterFirstUnknownImpact,
  honestUnknownPctLine,
  primaryVerbLabel,
  promiseAlignmentSummary,
} from './Delivera-Governance-PI-Commitment-Pack-01Build-SSOT.js';
import { renderEpicCommitmentRailHtml } from './Delivera-App-Governance-Brief-19Render-PIConfidenceStrip-UI.js';
import { bindEpicHygieneInteractions, renderAdHocChip } from './Delivera-App-Governance-Brief-20Render-EpicHygienePanel-UI.js';
import { renderIssueIdentityHtml, renderSprintIdentityHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { businessTitleFromSummary } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

// SIZE-EXEMPT: cohesive ActiveLoop story orchestrator (load/cache, spotlight URL, decision drawers); helpers live in Commitment-Pack / Continuity / Cache Guard SSOTs.

const CACHE_PREFIX = `delivera:governance:active-loop:v2:${DELIVERA_CLIENT_RELEASE_SCHEMA}`;
const PRESENTATION_CONTRACT_VERSION = 5;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const sharedStoryState = globalThis.__deliveraGovernanceActiveLoopState ||= {
  activeAnswer: null,
  pendingAnswer: null,
  pendingReason: 'New evidence ready.',
  lastBrief: null,
};
let requestSequence = 0;
let activeAnswer = sharedStoryState.activeAnswer;
let pendingAnswer = sharedStoryState.pendingAnswer;
let decisionInProgress = false;
let lockedAccordionSquad = '';
let peekAccordionSquad = '';
let peekDwellTimer = null;
let isMatrixScrolling = false;
let scrollPeekGuardTimer = null;
let spotlightKey = '';
let activeSpotlightDetail = null;
let activeLens = new URL(location.href).searchParams.get('view') || 'overall';
let activeDrawerContext = null;
let pendingReason = sharedStoryState.pendingReason || 'New evidence ready.';
let quarterPulseTimer = null;
let spotlightSequence = 0;

let quarterPulseCleanupBound = false;
function bindQuarterPulseCleanup() {
  if (quarterPulseCleanupBound) return;
  quarterPulseCleanupBound = true;
  const clear = () => {
    if (quarterPulseTimer) {
      clearInterval(quarterPulseTimer);
      quarterPulseTimer = null;
    }
  };
  window.addEventListener('beforeunload', clear);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clear();
  });
}

const activeLoopLoads = new Map();

const lenses = [
  ['overall', 'Portfolio'],
  ['squad', 'Selected squad'],
];

function broadcastFocus() {
  if (spotlightKey) persistLastFocusSquad(spotlightKey);
  window.dispatchEvent(new CustomEvent('delivera:governance-focus', {
    detail: {
      spotlightKey,
      activeLens,
      mode: activeLens === 'squad' && spotlightKey ? 'selected-squad' : 'portfolio',
    },
  }));
}

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

function normalizedScope(value) {
  return (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(',');
}

function answerMatchesScope(answer, projects) {
  const requested = normalizedScope(projects);
  const received = normalizedScope(answer?.scope?.projects || answer?.projects || []);
  return Boolean(requested && received && requested === received);
}

function readCachedAnswer(projects, quarter) {
  try {
    const key = scopeKey(projects, quarter);
    const envelope = JSON.parse(localStorage.getItem(key) || 'null');
    if (envelope?.answer?.schemaVersion !== 2 || !envelope?.savedAt) return null;
    if (envelope.answer.cacheRelease !== DELIVERA_CLIENT_RELEASE_SCHEMA) {
      localStorage.removeItem(key);
      return null;
    }
    if (!answerMatchesScope(envelope.answer, projects)) {
      localStorage.removeItem(key);
      return null;
    }
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
  if (answer?.cacheRelease !== DELIVERA_CLIENT_RELEASE_SCHEMA) return;
  if (!answerMatchesScope(answer, projects)) return;
  try { localStorage.setItem(scopeKey(projects, quarter), JSON.stringify({ savedAt: new Date().toISOString(), answer })); } catch (_) { /* quota/privacy */ }
}

/** Clear client active-loop cache keys and in-memory answer after reconnect / registry. */
export function clearActiveLoopCaches() {
  clearGovernanceClientCaches();
  activeAnswer = null;
  pendingAnswer = null;
  sharedStoryState.activeAnswer = null;
  sharedStoryState.pendingAnswer = null;
}

function answerHasAccessBlock(answer) {
  const codes = new Set(
    (answer?.promises || [])
      .map((promise) => String(promise?.diagnosisCode || '').toLowerCase())
      .filter(Boolean),
  );
  (answer?.squads || []).forEach((squad) => {
    (squad?.diagnosisGroups || []).forEach((group) => {
      if (group?.code) codes.add(String(group.code).toLowerCase());
      if (group?.diagnosisCode) codes.add(String(group.diagnosisCode).toLowerCase());
    });
  });
  return codes.has('access-blocked');
}

function tone(state) {
  if (['matched', 'aligned-amended', 'resolved-matched'].includes(state)) return 'safe';
  if (['partly-matched', 'done-not-accepted', 'awaiting-owner', 'reply-received-ready-to-recheck'].includes(state)) return 'watch';
  if (['cannot-verify', 'missing'].includes(state)) return 'unknown';
  return 'risk';
}

/** Map Domain freshness SSOT onto UI elevate — do not re-age from verifiedAt. */
function currentFreshness(answer) {
  const f = answer?.freshness || {};
  if (f.state === 'failed') {
    return { state: 'failed', copy: f.copy || 'Showing the last verified answer. A fresh Jira check did not finish — tap Refresh.', elevate: true };
  }
  if (answer?.scope?.complete === false) {
    return {
      state: 'partial',
      copy: `${answer.scope.verifiedSquads} of ${answer.scope.expectedSquads} squads verified. Portfolio conclusion limited.`,
      elevate: true,
    };
  }
  if (f.state === 'stale') {
    return { state: 'stale', copy: f.copy || 'Showing last verified state. Freshness-dependent decisions are paused.', elevate: true };
  }
  if (f.state === 'paused') {
    return { state: 'paused', copy: f.copy || 'Verified recently', elevate: Boolean(f.restrictFreshActions) };
  }
  if (f.copy) return { state: f.state || 'calm', copy: f.copy, elevate: Boolean(f.restrictFreshActions) };
  return { state: 'calm', copy: 'Last verified recently.', elevate: false };
}

/**
 * Compute working hours elapsed in the current Vodacom quarter (client-side, zero API calls).
 * Excludes weekends. Holiday exclusion is best-effort (reads from a global if available).
 * Returns a label like "⏱ 312 working hours elapsed in Q2".
 */
function quarterPulseLabel() {
  try {
    const now = new Date();
    const m = now.getUTCMonth();
    let qNum, qYear;
    if (m <= 2) { qNum = 4; qYear = now.getUTCFullYear(); }
    else if (m <= 5) { qNum = 1; qYear = now.getUTCFullYear(); }
    else if (m <= 8) { qNum = 2; qYear = now.getUTCFullYear(); }
    else { qNum = 3; qYear = now.getUTCFullYear(); }
    const startMonth = { 1: 3, 2: 6, 3: 9, 4: 0 }[qNum];
    const startDay = 1;
    const start = new Date(Date.UTC(qYear, startMonth, startDay, 0, 0, 0, 0));
    if (now < start) return '';
    // Count working days from quarter start to now (inclusive of today)
    let workingDays = 0;
    const cursor = new Date(start);
    const end = new Date(now);
    // Best-effort holiday set (populated by Delivera-Data-TanzaniaHolidays client bridge if loaded)
    const holidaySet = (globalThis.__DELIVERA_TZ_HOLIDAYS && Array.isArray(globalThis.__DELIVERA_TZ_HOLIDAYS))
      ? new Set(globalThis.__DELIVERA_TZ_HOLIDAYS.map((d) => String(d).slice(0, 10)))
      : null;
    while (cursor <= end) {
      const dow = cursor.getUTCDay();
      if (dow !== 0 && dow !== 6) {
        const iso = cursor.toISOString().slice(0, 10);
        if (!holidaySet || !holidaySet.has(iso)) workingDays++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const hours = workingDays * 8;
    return `⏱ ${hours} working hours elapsed in Q${qNum}`;
  } catch (error) {
    return '';
  }
}

function promisesChecked(answer) {
  return Number(String(answer?.sourceLine || '').match(/(\d+)\s+promises?\s+checked/i)?.[1] || 0);
}

function normalizedDecisionCoverage(answer) {
  const supplied = answer?.decisionCoverage || {};
  const total = Number(supplied.total) || promisesChecked(answer) || (answer?.promises || []).length || 0;
  const closed = Math.min(total, Number(supplied.closed) || 0);
  const preparedOwnerAsks = Math.max(0, Number(supplied.preparedOwnerAsks) || 0);
  const open = Math.max(0, total - closed);
  return {
    closed,
    total,
    preparedOwnerAsks,
    open,
    copy: supplied.copy || (total
      ? `${closed} decided · ${open} open · ${total} in scope`
      : 'No promises in scope yet'),
  };
}

function matrixRow(squad, { preferredKey = '' } = {}) {
  const baseline = squad.baselineCoverage || (activeAnswer?.contract ? { state: 'verified', sourceLabel: activeAnswer.contract.source || 'Approved PI contract', copy: 'Contract source confirmed.' } : { state: 'missing', copy: 'Baseline missing.' });
  const split = squad.workSplit || {};
  const contract = squad.contractState || { label: baseline.state === 'missing' ? 'Cannot verify' : squad.topState || 'Unknown', detail: baseline.copy || '' };
  const sprint = squad.sprintReality || {};
  const trust = squad.trustFactor || { label: 'Limited, evidence incomplete', level: 'limited' };
  const noBaseline = baseline.state === 'missing';
  const rework = squad.possibleRework?.promoted;
  const isPreferred = preferredKey && preferredKey === squad.squad;
  const isCurrent = spotlightKey === squad.squad || isPreferred;
  const actionFull = squad.nextAction?.label
    || (noBaseline
      ? (baseline.copy || 'Baseline missing — save baseline to compare')
      : (sprint.state === 'unavailable' || sprint.state === 'unverified'
        ? (sprint.copy || 'Sprint evidence unavailable')
        : 'Open spotlight'));
  // Sole-verb SSOT: preferred/current → Open; else short verb (no mid-word slice).
  const actionId = squad.nextAction?.id || squad.nextAction?.action || '';
  const fromLabels = actionLabels[actionId] || '';
  const rawVerb = fromLabels
    || String(squad.nextAction?.label || '').split(/[:·]/)[0].trim()
    || 'Open';
  const keyMatch = rawVerb.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  const verbFromSsot = fromLabels
    || (keyMatch && /confirm|whether|moved/i.test(rawVerb) ? `Confirm ${keyMatch[1]}` : rawVerb.split(/\s+/).slice(0, 4).join(' '))
    || 'Open';
  const actionShort = (isPreferred || isCurrent) ? 'Open' : verbFromSsot;
  const piPct = Number(squad.piPct);
  const evidencedLabel = Number.isFinite(piPct) ? `${piPct}% evidenced` : (noBaseline ? 'Cannot score' : '—');
  const divertPct = Number(squad.doingInstead?.major?.percentage ?? split.unplannedPct);
  const divertTitle = squad.doingInstead?.major?.title
    || (Number.isFinite(divertPct) && divertPct > 0 ? `${divertPct}% unplanned` : '')
    || honestUnknownPctLine(squad, squad.unknownWork)
    || 'No diversion proven';
  const divertLabel = squad.doingInstead?.major?.title
    || (Number.isFinite(divertPct) && divertPct > 0 ? `${divertPct}% unplanned` : '—');
  const divertVisible = squad.doingInstead?.major?.title
    || (Number.isFinite(divertPct) && divertPct > 0 ? `${divertPct}% unplanned` : '');
  const slipTitle = sprint.copy || baseline.copy || sprint.sprint?.name || sprint.sprintName || '';
  const slipLabel = sprint.daysRemaining != null
    ? `${sprint.daysRemaining}d left`
    : (sprint.state === 'unavailable' || sprint.state === 'unverified'
      ? 'Sprint unverified'
      : (sprint.sprint?.name || sprint.sprintName || '—'));
  const nextCell = (isPreferred || isCurrent)
    ? `<span role="cell" title="${escapeHtml(actionFull)}"><strong>Open</strong><small class="sr-only">${escapeHtml(verbFromSsot)}</small></span>`
    : noBaseline
      ? `<span role="cell" title="${escapeHtml(actionFull)}"><strong>Save baseline</strong></span>`
      : `<span role="cell" title="${escapeHtml(actionFull)}"><strong>${escapeHtml(actionShort)}</strong></span>`;
  const settingsHref = '/settings#gov-settings-registry-mount';
  const rowTag = noBaseline ? 'div' : 'button';
  const rowType = noBaseline ? '' : ' type="button"';
  const missingActions = noBaseline
    ? `<span role="cell"><a class="btn btn-compact btn-secondary" href="${escapeHtml(settingsHref)}" data-cannot-verify-settings data-setup-baseline-ssot="1">Save baseline</a></span>`
    : nextCell;
  return `<div class="gov-story-row-wrap" data-story-squad-wrap="${escapeHtml(squad.squad)}" data-accordion-state="closed">
  <${rowTag}${rowType} role="row" class="gov-story-row gov-story-row--${tone(noBaseline ? 'missing' : squad.topState)}${isPreferred ? ' is-focus-preferred' : ''}" data-story-squad="${escapeHtml(squad.squad)}" data-loop-squad="${escapeHtml(squad.squad)}" data-focus-preferred="${isPreferred ? 'true' : 'false'}" data-has-rollover="${Number(squad.sprintReality?.carryoverCount) > 0}" data-sprint-risk="${Boolean(squad.sprintReality?.endedWithoutReplacement || squad.sprintReality?.state === 'watch' || sprint.state === 'unverified')}" data-operational-risk="${Boolean(squad.doingInstead?.major)}" data-unknown-risk="${Boolean(squad.unknownWork?.promoted)}" data-rework-risk="${Boolean(rework)}" data-trust="${escapeHtml(trust.level || 'limited')}" aria-label="Expand ${escapeHtml(squad.displayName || squad.squad)} summary" aria-expanded="false" aria-current="${isCurrent ? 'true' : 'false'}">
    <span role="cell" class="gov-story-squad"><strong>${escapeHtml(squad.displayName || squad.squad)}</strong><small>${escapeHtml(squad.attentionCount ? `${squad.attentionCount} need attention` : 'No contract variance proven')}</small></span>
    <span role="cell" data-matrix-evidenced="1"><strong>${escapeHtml(evidencedLabel)}</strong><small>${escapeHtml(contract.label || '')}</small></span>
    <span role="cell" data-matrix-diverted="1" title="${escapeHtml(divertTitle)}" data-context-help="${escapeHtml(split.explanation || trust.label)}"><strong>${escapeHtml(divertVisible || divertLabel)}</strong><small>${escapeHtml(Number.isFinite(divertPct) && divertPct > 0 && squad.doingInstead?.major?.title ? `${divertPct}%` : '')}</small></span>
    <span role="cell" data-matrix-slip="1" title="${escapeHtml(slipTitle)}"><strong>${escapeHtml(slipLabel)}</strong></span>
    ${missingActions}
  </${rowTag}>
  <div class="gov-squad-accordion" data-squad-accordion="${escapeHtml(squad.squad)}" hidden></div>
  </div>`;
}

function cannotVerifySummaryRow(squads) {
  if (!squads.length) return '';
  const first = squads[0];
  const label = squads.length === 1
    ? (first.displayName || first.squad)
    : `Cannot verify · ${squads.length} squads`;
  const names = squads.map((s) => s.displayName || s.squad).join(', ');
  const reason = first.baselineCoverage?.copy || first.contractState?.detail || 'Baseline missing or incomplete';
  const settingsHref = '/settings#gov-settings-registry-mount';
  return `<div role="row" class="gov-story-row gov-story-row--unknown gov-story-row--grouped" data-cannot-verify-group="${squads.map((s) => s.squad).join(',')}" aria-label="${escapeHtml(label)}">
    <span role="cell" class="gov-story-squad"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(names)}</small></span>
    <span role="cell"><strong>Cannot score</strong><small>${escapeHtml(reason)}</small></span>
    <span role="cell"><strong>No diversion claim</strong><small>Evidence incomplete</small></span>
    <span role="cell"><strong>—</strong></span>
    <span role="cell"><a class="btn btn-compact btn-secondary" href="${escapeHtml(settingsHref)}" data-cannot-verify-settings data-setup-baseline-ssot="1">Save baseline</a></span>
  </div>`;
}


function excludedOperationalGroups(answer) {
  const organization = answer.organizationParticipation || {};
  const groups = organization.globallyExcludedSquads || answer.excludedOperationalGroups || [];
  if (!groups.length) return '';
  const count = Number(organization.globallyExcludedCount) || groups.length;
  // Settings owns exception policy — Governance only shows a count chip (no duplicate list).
  return `<a class="gov-exceptions-chip" href="/settings#gov-settings-registry-mount" data-exceptions-chip aria-label="${count} participation exceptions — open Settings">${count} exception${count === 1 ? '' : 's'}</a>`;
}

function portfolioMatrix(answer) {
  const isSquadView = activeLens === 'squad' && spotlightKey;
  // Hard squad tunnel: no peer matrix — spotlight owns the deep dive.
  if (isSquadView) {
    return `<div class="gov-squad-tunnel-bar" data-squad-tunnel-bar>
      <span class="gov-loop-kicker">Selected squad</span>
      <p class="gov-calm-note">This squad’s work, promises, and actions only.</p>
      <button type="button" class="btn btn-link btn-compact" data-story-all aria-current="false">Back to portfolio</button>
      ${excludedOperationalGroups(answer)}
    </div>`;
  }
  const visibleSquads = answer.squads || [];
  const baselineMissing = visibleSquads.filter((s) => s.baselineCoverage?.state === 'missing');
  const baselineVerified = visibleSquads.filter((s) => s.baselineCoverage?.state !== 'missing');
  const matrixHeadTitle = 'Squads by delivery urgency';
  const matrixHeadKicker = 'Portfolio comparison';
  // Typical PI portfolios ≤12 — expand by default (zero click).
  const needsExpand = visibleSquads.length > 12;
  const preferredKey = preferredFocusSquadKey(answer);
  const visibleLenses = lenses.filter(([id]) => id !== 'squad');
  const lensesToolbar = (visibleLenses.length > 1)
    ? `<div class="gov-story-lenses" role="toolbar" aria-label="Governance view">${visibleLenses.map(([id, label]) => `<button type="button" class="btn btn-compact ${id === activeLens ? 'btn-secondary' : 'btn-link'}" data-story-lens="${id}" aria-pressed="${id === activeLens}">${label}</button>`).join('')}</div>`
    : '';
  // Why lives once in the hero — matrix head stays structural only.
  return `<section class="gov-story-matrix${needsExpand ? '' : ' is-expanded'}" aria-labelledby="gov-story-matrix-title" data-matrix-expandable="${needsExpand ? 'true' : 'false'}">
    <div class="gov-story-matrix-head"><div><span class="gov-loop-kicker">${escapeHtml(matrixHeadKicker)}</span><h2 id="gov-story-matrix-title">${escapeHtml(matrixHeadTitle)}</h2></div></div>
    ${lensesToolbar}
    <div class="gov-story-table" role="table" aria-label="PI governance by squad">
      <div class="gov-story-columns" role="row"><span>Squad</span><span>Evidenced</span><span>Diverted</span><span>Slip</span><span>Next</span></div>
      ${baselineMissing.length ? cannotVerifySummaryRow(baselineMissing) : ''}
      ${baselineVerified.map((squad) => matrixRow(squad, { preferredKey })).join('')}
    </div>
    ${needsExpand ? `<button type="button" class="btn btn-link btn-compact gov-matrix-expand" data-matrix-expand>Show more squads</button>` : ''}
    ${excludedOperationalGroups(answer)}
  </section>`;
}

function heroIdentityLinks(answer) {
  // One Sprint continuity link only — matrix rows own squad selection.
  const focusKey = preferredFocusSquadKey(answer);
  const focused = (answer.squads || []).find((squad) => squad.squad === focusKey)
    || (answer.squads || [])[0];
  if (!focused) return '';
  const short = String(focused.displayName || focused.squad).split(' ')[0];
  return renderIdentityLinkRow([{
    key: focused.squad,
    label: `${short} today`,
    secondaryLabel: `${short} today`,
    mode: 'link',
    secondary: true,
    href: currentSprintSquadHref(focused.squad),
  }]);
}

function returnToActionsControl() {
  const tokens = readContinuityTokens();
  const href = resolveReturnToHref(tokens.returnTo, { squad: spotlightKey || tokens.squad });
  if (!href || !tokens.returnTo.startsWith('/actions')) return '';
  return `<a class="btn btn-link btn-compact gov-return-to-actions" data-return-to-actions href="${escapeHtml(href)}">Back to Actions</a>`;
}

function preferredFocusSquadKey(answer) {
  const tokens = readContinuityTokens();
  const fromUrl = spotlightKey || tokens.spotlight || tokens.squad;
  if (fromUrl) return fromUrl;
  const ranked = [...(answer?.squads || [])].sort((a, b) => Number(b.attentionCount || 0) - Number(a.attentionCount || 0));
  return ranked[0]?.squad || '';
}

/** Continuity SSOT: tunnel → accordion lock → attention-ranked portfolio focus. */
function activeRailSquadKey(answer) {
  if (activeLens === 'squad' && spotlightKey) return spotlightKey;
  if (lockedAccordionSquad) return lockedAccordionSquad;
  return preferredFocusSquadKey(answer);
}

function nextMoveRailHtml(answer) {
  const focusKey = activeRailSquadKey(answer);
  const squad = (answer?.squads || []).find((item) => item.squad === focusKey) || (answer?.squads || [])[0];
  if (!squad) return '';
  const isFocused = Boolean(spotlightKey && spotlightKey === squad.squad);
  // Portfolio first fold: primary CTA + epic rail own attention. Proof tools only in squad tunnel.
  if (!isFocused) return '';
  const packPromises = (answer?.promises || []).filter((item) => item.squad === squad.squad);
  const packHtml = commitmentPackControlsHtml({ disabled: !packPromises.length });
  const sprint = squad.sprintReality?.sprint || {};
  const sprintHtml = renderSprintIdentityHtml(sprint, {
    name: squad.sprintReality?.sprintName || sprint.name || '',
    sprintId: sprint.id,
    href: currentSprintSquadHref(squad.squad),
  });
  // Identity lives once in tunnel bar — rail shows sprint + pack only.
  return `<aside class="gov-next-move-rail" aria-label="Proof tools for selected squad" data-rail-squad="${escapeHtml(squad.squad || '')}">
    <span class="gov-loop-kicker">Proof tools</span>
    <p class="gov-next-move-sprint">${sprintHtml}</p>
    ${packHtml}
  </aside>`;
}

function deliveryBentoHtml(answer, coverage) {
  const railKey = activeRailSquadKey(answer);
  const inTunnel = activeLens === 'squad' && Boolean(spotlightKey);
  const isSquadScoped = Boolean(railKey) && (inTunnel || Boolean(lockedAccordionSquad));
  const kpis = isSquadScoped
    ? buildDeliverySquadKpis(answer, railKey)
    : buildDeliveryPortfolioKpis(answer);
  const evidenced = kpis.promiseTotal
    ? `${kpis.evidencedCount}/${kpis.promiseTotal}`
    : (kpis.evidencedPct != null ? `${kpis.evidencedPct}%` : '—');
  const evidencedDetail = (!inTunnel && (kpis.storiesDone || kpis.epicsClosed))
    ? `${kpis.storiesDone} stories · ${kpis.epicsClosed} epics closed`
    : '';
  const divertedDetail = (!inTunnel && kpis.topDivertTitle)
    ? kpis.topDivertTitle.slice(0, 36)
    : '';
  const topDecision = isSquadScoped ? decisionPromiseForAnswer(answer) : null;
  const decisionInline = topDecision
    ? `<p class="gov-delivery-decision-inline" data-delivery-top-decision="1"><strong>Top decision</strong> · ${escapeHtml(businessTitleFromSummary(topDecision.originalText || topDecision.summary || topDecision.issueKey || '', 72))}</p>`
    : '';
  const attentionCell = inTunnel
    ? ''
    : `<div class="gov-delivery-cell" data-delivery-cell="attention"><strong>${kpis.attentionCount}</strong><small>At risk</small></div>`;
  return `<div class="gov-delivery-bento" data-gov-delivery-bento="1" data-bento-scope="${isSquadScoped ? 'squad' : 'portfolio'}" data-bento-squad="${escapeHtml(isSquadScoped ? railKey : '')}" aria-label="PI delivery pulse">
    <div class="gov-delivery-cell" data-delivery-cell="evidenced"><strong>${escapeHtml(evidenced)}</strong><small>Evidenced${evidencedDetail ? ` · ${escapeHtml(evidencedDetail)}` : ''}</small></div>
    <div class="gov-delivery-cell" data-delivery-cell="diverted"><strong>${kpis.divertingCount}</strong><small>Diverting${divertedDetail ? ` · ${escapeHtml(divertedDetail)}` : ''}</small></div>
    ${attentionCell}
    <div class="gov-delivery-cell" data-delivery-cell="unverified"><strong>${kpis.unverifiedCount}</strong><small>Unverified</small></div>
    ${decisionInline}
    <p class="gov-delivery-meta" data-decision-coverage-meta="${escapeHtml(coverage.copy)}">${coverage.closed} decided this PI · ${coverage.open} open</p>
  </div>`;
}

function epicRailMountHtml(answer, focusKey) {
  const brief = sharedStoryState.lastBrief || null;
  const railKey = focusKey || activeRailSquadKey(answer) || '';
  const chips = buildEpicRailChips({
    brief,
    answer,
    squadKey: railKey,
  });
  const emptyCopy = railKey
    ? `No PI epics verified for ${railKey}`
    : 'Epic dates appear when PI baseline chips or linked promises are available.';
  if (chips.length) return renderEpicCommitmentRailHtml(chips);
  const scopedPromises = railKey
    ? (answer?.promises || []).filter((p) => String(p.squad || '').toUpperCase() === String(railKey).toUpperCase())
    : (answer?.promises || []);
  const hasActivity = Boolean(brief?.meta?.boardEpicIndex?.length || brief?.baselineComparison?.items?.length);
  if (!hasActivity && scopedPromises.length) {
    return `<aside class="gov-epic-commitment-rail" data-epic-commitment-rail="1" data-epic-rail-loading="true" data-rail-squad="${escapeHtml(railKey)}" aria-label="PI epic commitments" aria-live="polite">
      <span class="gov-loop-kicker">PI epic commitments</span>
      <p class="gov-calm-note">Loading epic dates and child counts…</p>
    </aside>`;
  }
  return renderEpicCommitmentRailHtml(chips, { emptyCopy });
}

/** Patch bento / primary CTA / epic rail for accordion lock without URL or full hero remount. */
function refreshDecisionSurface(answer = activeAnswer) {
  if (!answer) return;
  const hero = document.querySelector('.gov-active-loop-hero');
  const bentoHost = hero?.querySelector('.gov-loop-decision-bento');
  if (!bentoHost) return;
  const coverage = normalizedDecisionCoverage(answer);
  const railKey = activeRailSquadKey(answer);
  const focusSquad = (answer?.squads || []).find((item) => item.squad === railKey);
  const isSquadView = activeLens === 'squad' && Boolean(spotlightKey) && Boolean(focusSquad);
  const noBaseline = !answer.contract;
  const nextLabel = primaryVerbLabel(focusSquad, {
    noBaseline,
    isSquadView: isSquadView || Boolean(lockedAccordionSquad && focusSquad),
    actionLabels,
  });

  const bento = bentoHost.querySelector('[data-gov-delivery-bento]');
  if (bento) {
    const wrap = document.createElement('div');
    wrap.innerHTML = deliveryBentoHtml(answer, coverage);
    const node = wrap.firstElementChild;
    if (node) bento.replaceWith(node);
  }

  const primary = bentoHost.querySelector('[data-loop-primary]');
  if (primary && nextLabel) {
    primary.textContent = nextLabel;
    const promise = decisionPromiseForAnswer(answer);
    if (promise?.promiseId) {
      primary.dataset.promiseId = promise.promiseId;
      primary.dataset.squadId = promise.squad || railKey;
    } else {
      delete primary.dataset.promiseId;
      if (railKey) primary.dataset.squadId = railKey;
    }
  }

  const rail = bentoHost.querySelector('[data-epic-commitment-rail]');
  if (rail) {
    const wrap = document.createElement('div');
    wrap.innerHTML = epicRailMountHtml(answer, railKey);
    const node = wrap.firstElementChild;
    if (node) {
      node.setAttribute('data-rail-squad', railKey || '');
      rail.replaceWith(node);
    }
  }

  document.body.classList.toggle('gov-accordion-locked', Boolean(lockedAccordionSquad));
  document.body.classList.toggle('gov-pack-column-wide', Boolean(lockedAccordionSquad || (activeLens === 'squad' && spotlightKey)));
}

/** Inject format-alignment chip when brief arrives after hero paint (zero extra click). */
function hydrateAdHocChip(brief = null) {
  const b = brief || sharedStoryState.lastBrief;
  if (!b || spotlightKey || activeLens === 'squad') return;
  const hero = document.querySelector('.gov-active-loop-hero');
  const copy = hero?.querySelector('.gov-loop-copy');
  if (!copy || copy.querySelector('[data-adhoc-open], .gov-adhoc-chip')) return;
  const chip = renderAdHocChip(b);
  if (!chip) return;
  const anchor = copy.querySelector('[data-gov-why-once="1"]');
  if (anchor) anchor.insertAdjacentHTML('afterend', chip);
  else copy.insertAdjacentHTML('beforeend', chip);
  bindEpicHygieneInteractions(hero || copy, b);
}

/** Re-render epic rail only when brief arrives after Active Loop (no second H1). */
export function hydrateEpicCommitmentRail(brief = null) {
  if (brief) sharedStoryState.lastBrief = brief;
  const rail = document.querySelector('[data-epic-commitment-rail]');
  if (!rail || !activeAnswer) return;
  const focusKey = activeRailSquadKey(activeAnswer);
  const chips = buildEpicRailChips({ brief: sharedStoryState.lastBrief || brief, answer: activeAnswer, squadKey: focusKey });
  const emptyCopy = focusKey
    ? `No PI epics verified for ${focusKey}`
    : 'Epic dates appear when PI baseline chips or linked promises are available.';
  const next = renderEpicCommitmentRailHtml(chips, { emptyCopy });
  const wrap = document.createElement('div');
  wrap.innerHTML = next;
  const node = wrap.firstElementChild;
  if (node) {
    if (focusKey) node.setAttribute('data-rail-squad', focusKey);
    rail.replaceWith(node);
  }
  hydrateAdHocChip(brief || sharedStoryState.lastBrief);
  const strip = document.getElementById('gov-pi-strip-mount');
  if (strip) {
    strip.replaceChildren();
    strip.toggleAttribute('data-pi-strip-empty', true);
    strip.hidden = true;
  }
}

function heroFreshnessMeta(answer) {
  const freshness = currentFreshness(answer);
  const pulse = quarterPulseLabel();
  // Elevate only blocking freshness — soft pause stays out of the mission strip.
  if (!freshness.elevate) {
    const quiet = [pulse, freshness.state === 'paused' ? freshness.copy : ''].filter(Boolean).join(' · ');
    if (!quiet && freshness.state === 'calm') {
      return `<button type="button" class="gov-hero-evidence-link gov-hero-freshness-meta gov-hero-freshness-meta--quiet" data-hero-freshness data-quarter-pulse data-freshness-elevate="false" aria-label="Evidence freshness">${escapeHtml(freshness.copy)}</button>`;
    }
    return quiet
      ? `<button type="button" class="gov-hero-evidence-link gov-hero-freshness-meta gov-hero-freshness-meta--quiet" data-hero-freshness data-quarter-pulse data-freshness-elevate="false" aria-label="Evidence freshness">${escapeHtml(quiet)}</button>`
      : '';
  }
  const parts = [pulse, freshness.copy].filter(Boolean);
  return `<button type="button" class="gov-hero-evidence-link gov-hero-freshness-meta" data-hero-freshness data-quarter-pulse data-freshness-elevate="true" aria-label="Evidence freshness">${escapeHtml(parts.join(' · '))}</button>`;
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
  const focusKey = activeRailSquadKey(answer);
  const focusSquad = (answer?.squads || []).find((item) => item.squad === focusKey);
  const isSquadView = activeLens === 'squad' && Boolean(spotlightKey) && Boolean(focusSquad);
  const nextLabel = primaryVerbLabel(focusSquad, {
    noBaseline,
    isSquadView: isSquadView || Boolean(lockedAccordionSquad && focusSquad),
    actionLabels,
  });
  const sourceLine = String(answer.sourceLine || '').replace(/\s*·\s*last verified[^·]*$/i, '').trim() || answer.sourceLine;
  const missionKicker = isSquadView ? 'Selected squad' : 'Portfolio mission';
  const squadVerdict = buildDeliveryH1(answer, { isSquadView, focusSquad });
  const causeLine = isSquadView
    ? (focusSquad.contractState?.detail || focusSquad.sprintReality?.copy || 'Squad evidence remains isolated from portfolio peers.')
    : (answer.lensSummaries?.overall || sourceLine || 'Stored squad truth is compared across the included portfolio.');
  const quietMeta = [sourceLine, answer.deliveraDid ? `✓ ${answer.deliveraDid}` : ''].filter(Boolean).join(' · ');
  const adHocChip = !isSquadView && sharedStoryState.lastBrief ? renderAdHocChip(sharedStoryState.lastBrief) : '';
  const jiraDegraded = freshness.state === 'failed' || answerHasAccessBlock(answer);
  const degradeBanner = jiraDegraded
    ? '<p class="gov-loop-stale-warning" role="alert" data-jira-degraded="1">Jira access limited — showing last verified proof. Refresh when access restores.</p>'
    : '';
  mount.innerHTML = `<section class="gov-active-loop-hero gov-story-v2 is-${freshness.state}" data-active-lens="${escapeHtml(activeLens)}" data-fiscal-period="${escapeHtml(answer.contract?.piName || '')}" data-testid="governance-active-loop" data-gov-value-first="1" aria-labelledby="gov-loop-answer">
    ${degradeBanner}
    <div class="gov-story-mission"><span>${escapeHtml(missionKicker)}</span><strong>${escapeHtml(answer.missionHeader || 'Active PI contract governance')}</strong>${heroFreshnessMeta(answer)}</div>
    <div class="gov-loop-copy"><div class="gov-loop-kicker"><span>${isSquadView ? 'Selected squad delivery' : 'PI delivery answer'}</span></div><h1 id="gov-loop-answer" data-gov-delivery-h1="1">${escapeHtml(squadVerdict)}</h1><p class="gov-loop-cause" data-gov-why-once="1"><strong>Why:</strong> ${escapeHtml(causeLine)}</p>${adHocChip}${spotlightKey ? '' : heroIdentityLinks(answer)}<p class="gov-loop-source gov-loop-meta-quiet" data-testid="governance-source-line">${escapeHtml(quietMeta)}</p></div>
    <div class="gov-loop-decision-bento">
      ${deliveryBentoHtml(answer, coverage)}
      <div class="gov-loop-decision-actions"><button type="button" class="btn btn-primary gov-loop-primary" data-loop-primary data-squad-id="${escapeHtml(focusKey || '')}">${escapeHtml(nextLabel)}</button>${returnToActionsControl()}</div>
      ${epicRailMountHtml(answer, focusKey)}
      ${nextMoveRailHtml(answer)}
    </div>
    ${portfolioMatrix(answer)}
    <div class="gov-story-update" role="status" hidden><span data-story-update-copy>New evidence ready.</span> <button type="button" class="btn btn-link btn-compact" data-story-apply>Review changes</button><button type="button" class="btn btn-link btn-compact" data-story-keep-draft>Keep my edits as a new decision draft</button></div>
    <div id="gov-squad-spotlight" class="gov-squad-spotlight" aria-live="polite"></div>
    <footer class="gov-story-footer"><button type="button" class="gov-diagnostics-trigger" data-governance-diagnostics aria-label="Open authorized diagnostics">Diagnostics</button></footer>
  </section>`;
  document.body.classList.add('governance-active-loop-ready', 'governance-story-v2-ready');
  document.body.classList.toggle('gov-accordion-locked', Boolean(lockedAccordionSquad));
  document.body.classList.toggle('gov-pack-column-wide', Boolean(lockedAccordionSquad || (activeLens === 'squad' && spotlightKey)));
  if (spotlightKey) document.body.classList.add('governance-squad-selected');
  else document.body.classList.remove('governance-squad-selected');
  const strip = document.getElementById('gov-pi-strip-mount');
  if (strip) {
    strip.replaceChildren();
    strip.toggleAttribute('data-pi-strip-empty', true);
    strip.hidden = true;
  }
  ['gov-action-clusters-mount', 'gov-compare-rail-mount', 'gov-sticky-answer-mount'].forEach((id) => {
    const legacy = document.getElementById(id);
    if (!legacy || legacy === mount) return;
    legacy.replaceChildren();
    legacy.hidden = true;
    legacy.setAttribute('aria-hidden', 'true');
    legacy.setAttribute('inert', '');
  });
  bindStory(answer, mount);
  if (sharedStoryState.lastBrief) bindEpicHygieneInteractions(mount, sharedStoryState.lastBrief);
  // Live-update the merged freshness meta every 60 seconds (zero API cost, client-side math)
  if (quarterPulseTimer) clearInterval(quarterPulseTimer);
  quarterPulseTimer = setInterval(() => {
    const el = document.querySelector('[data-hero-freshness]');
    if (!el || !activeAnswer) return;
    const pulse = quarterPulseLabel();
    const nextFreshness = currentFreshness(activeAnswer);
    el.textContent = [pulse, nextFreshness.copy].filter(Boolean).join(' · ');
  }, 60000);
  bindQuarterPulseCleanup();
  if (spotlightKey) void showSpotlight(spotlightKey, { pushHistory: false });
}

function decisionPromiseForAnswer(answer) {
  const focusKey = activeRailSquadKey(answer);
  const spotlightPromises = activeSpotlightDetail?.promises || [];
  const promises = focusKey && spotlightPromises.length && spotlightKey === focusKey
    ? spotlightPromises
    : (answer?.promises || []);
  if (focusKey) {
    const selected = promises.find((promise) => promise.squad === focusKey && (promise.nextAction || promise.caseState !== 'aligned'))
      || (answer?.promises || []).find((promise) => promise.squad === focusKey && (promise.nextAction || promise.caseState !== 'aligned'));
    if (selected) return selected;
  }
  return promises.find((promise) => promise.promiseId === answer?.nextDecisionPromiseId)
    || promises.find((promise) => promise.nextAction || promise.caseState !== 'aligned')
    || null;
}

function bindStory(answer, mount) {
  mount.querySelector('[data-loop-primary]')?.addEventListener('click', () => {
    if (!answer.contract) {
      const setup = document.querySelector('[data-setup-baseline-ssot="1"]') || mount.querySelector('[data-cannot-verify-setup]');
      if (setup) return setup.click();
      window.location.href = '/settings#gov-settings-registry-mount';
      return;
    }
    const focusKey = activeRailSquadKey(answer);
    const promise = decisionPromiseForAnswer(answer);
    if (promise?.promiseId) return void openPromiseDrawer(promise.promiseId);
    if (focusKey) {
      void showSpotlight(focusKey, { pushHistory: true });
      document.getElementById('gov-squad-spotlight')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });
  mount.querySelector('[data-story-all]')?.addEventListener('click', () => clearSpotlight(true));
  mount.querySelector('[data-cannot-verify-setup]')?.addEventListener('click', (event) => {
    event.preventDefault();
    const setup = document.querySelector('[data-setup-baseline-ssot="1"]:not([data-cannot-verify-setup])');
    if (setup) return setup.click();
    window.location.href = '/settings#gov-settings-registry-mount';
  });
  const source = mount.querySelector('.gov-loop-source');
  if (source) {
    source.setAttribute('role', 'button');
    source.setAttribute('tabindex', '0');
    source.setAttribute('aria-label', 'Open PI contract source evidence');
    source.addEventListener('click', () => openContractSourceDrawer(answer));
    source.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openContractSourceDrawer(answer); } });
  }
  mount.querySelector('[data-matrix-expand]')?.addEventListener('click', (event) => {
    const matrix = mount.querySelector('.gov-story-matrix');
    if (!matrix) return;
    matrix.classList.add('is-expanded');
    event.currentTarget.hidden = true;
  });
  mount.querySelector('[data-hero-freshness]')?.addEventListener('click', () => openFreshnessDrawer(answer));
  mount.querySelectorAll('[data-all-proof]').forEach((button) => button.addEventListener('click', () => {
    const pack = mount.querySelector('[data-commitment-pack-preview]');
    if (pack) {
      pack.hidden = false;
      pack.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    openAllProofDrawer(answer, button.dataset.allProof);
  }));
  const railSquad = mount.querySelector('[data-rail-squad]')?.getAttribute('data-rail-squad') || spotlightKey;
  if (railSquad) wireCommitmentPackCopy(mount, answer, railSquad);
  bindMatrixScrollGuard(mount);
  mount.querySelectorAll('[data-story-squad]').forEach((row) => {
    const squad = row.getAttribute('data-story-squad');
    if (!squad || row.tagName === 'DIV' && row.querySelector('[data-cannot-verify-settings]')) {
      // no-baseline rows keep Save baseline link; skip accordion lock on wrapper clicks from anchors
    }
    row.addEventListener('focus', () => {
      if (lockedAccordionSquad === squad) return;
      scheduleSquadPeek(row, squad);
    });
    row.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch' || lockedAccordionSquad === squad || isMatrixScrolling) return;
      scheduleSquadPeek(row, squad);
    });
    row.addEventListener('pointerleave', () => {
      clearPeekDwell();
      if (lockedAccordionSquad !== squad) closeSquadAccordion({ onlyPeek: true, squad });
    });
    row.addEventListener('blur', () => {
      clearPeekDwell();
      window.setTimeout(() => {
        if (lockedAccordionSquad === squad) return;
        const wrap = row.closest('[data-story-squad-wrap]');
        if (wrap?.contains(document.activeElement)) return;
        closeSquadAccordion({ onlyPeek: true, squad });
      }, 0);
    });
    row.addEventListener('click', (event) => {
      if (event.target.closest('[data-cannot-verify-settings], a, [data-full-squad-detail]')) return;
      event.preventDefault();
      clearPeekDwell();
      toggleSquadAccordion(row, squad);
    });
    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('[data-cannot-verify-settings], a')) return;
      event.preventDefault();
      clearPeekDwell();
      toggleSquadAccordion(row, squad);
    });
  });
  mount.querySelectorAll('[data-operating-model]').forEach((button) => button.addEventListener('click', () => openOperatingModelDrawer(button.dataset.operatingModel)));
  mount.querySelector('[data-story-apply]')?.addEventListener('click', applyPendingAnswer);
  mount.querySelector('[data-story-keep-draft]')?.addEventListener('click', keepDecisionDraft);
  mount.querySelectorAll('[data-story-lens]').forEach((button) => button.addEventListener('click', () => selectLens(button.dataset.storyLens, answer, mount)));
  mount.querySelector('[data-story-lens-select]')?.addEventListener('change', (event) => selectLens(event.target.value, answer, mount));
  const diagnosticTrigger = mount.querySelector('[data-governance-diagnostics]');
  diagnosticTrigger?.addEventListener('click', () => void openDiagnostics());
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
  const url = new URL(location.href); url.searchParams.set('view', lens); url.searchParams.delete('lens'); history.replaceState({ ...(history.state || {}), squad: spotlightKey, view: lens }, '', url);
  broadcastFocus();
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

function wireCommitmentPackCopy(root, answer, squadKey) {
  const packRoot = root?.querySelector?.('[data-commitment-pack]');
  const copyBtn = packRoot?.querySelector?.('[data-copy-commitment-pack]') || root?.querySelector?.('[data-copy-commitment-pack]');
  if (!copyBtn || copyBtn.dataset.packBound === '1') return;
  copyBtn.dataset.packBound = '1';
  const status = (packRoot || root).querySelector('[data-commitment-pack-status]');
  const preview = (packRoot || root).querySelector('[data-commitment-pack-preview]');
  const squad = [...(answer?.squads || []), ...(answer?.excludedOperationalGroups || [])].find((item) => item.squad === squadKey);
  const promises = (answer?.promises || []).filter((item) => item.squad === squadKey);
  const pack = buildPiCommitmentPack({ promises, squad });
  const empty = !promises.length;
  if (preview && pack.text) {
    preview.hidden = false;
    preview.textContent = pack.text;
  }
  if (empty) {
    copyBtn.disabled = true;
    copyBtn.setAttribute('aria-disabled', 'true');
    if (status) status.textContent = 'No verified promises to pack';
    if (preview) preview.hidden = true;
    return;
  }
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pack.text);
      if (status) status.textContent = 'Copied — ready to paste for PI follow-up.';
    } catch (_) {
      if (status) status.textContent = 'Copy failed — select the pack preview and copy manually.';
    }
  });
}

function openAllProofDrawer(answer, squadKey) {
  const squad = [...(answer?.squads || []), ...(answer?.excludedOperationalGroups || [])].find((item) => item.squad === squadKey);
  const promises = (answer?.promises || []).filter((item) => item.squad === squadKey);
  const pack = buildPiCommitmentPack({ promises, squad });
  const rows = promises.map((promise) => {
    const title = businessTitleFromSummary(promise.originalText || promise.summary || '', 64);
    return `<li><button type="button" class="btn btn-link" data-all-proof-promise="${escapeHtml(promise.promiseId)}">${renderIssueIdentityHtml(promise.issueKey || '', { title })}</button><small>${escapeHtml(promise.proofAge?.copy || promise.customerOrPiImpact || promise.statusNow || '')}</small></li>`;
  }).join('');
  const { el } = openRightDrawer({
    title: `${squad?.displayName || squadKey} · proof audit`,
    panelClass: 'active-loop',
    bodyHtml: `<section class="gov-resolution-sheet" data-proof-audit-squad="${escapeHtml(squadKey)}"><pre class="gov-commitment-pack-preview" data-commitment-pack-preview>${escapeHtml(pack.text)}</pre><p>${escapeHtml(squad?.baselineCoverage?.copy || 'Approved PI contract evidence')}</p><ol class="gov-proof-audit-list">${rows || '<li>No verified promise evidence is available for this squad.</li>'}</ol></section>`,
  });
  el.querySelectorAll('[data-all-proof-promise]').forEach((button) => button.addEventListener('click', () => void openPromiseDrawer(button.dataset.allProofPromise)));
}

function clearPeekDwell() {
  if (peekDwellTimer) {
    clearTimeout(peekDwellTimer);
    peekDwellTimer = null;
  }
}

function bindMatrixScrollGuard(mount) {
  const table = mount.querySelector('.gov-story-table');
  if (!table || table.dataset.scrollGuardBound === '1') return;
  table.dataset.scrollGuardBound = '1';
  const mark = () => {
    isMatrixScrolling = true;
    clearPeekDwell();
    if (scrollPeekGuardTimer) clearTimeout(scrollPeekGuardTimer);
    scrollPeekGuardTimer = setTimeout(() => { isMatrixScrolling = false; }, 180);
  };
  table.addEventListener('wheel', mark, { passive: true });
  table.addEventListener('touchmove', mark, { passive: true });
  table.addEventListener('scroll', mark, { passive: true });
}

function squadAccordionHtml(squadKey, { locked = false } = {}) {
  const summary = [...(activeAnswer?.squads || []), ...(activeAnswer?.excludedOperationalGroups || [])]
    .find((item) => item.squad === squadKey);
  if (!summary) return '<p class="gov-calm-note">Squad summary unavailable.</p>';
  const promises = (activeAnswer?.promises || []).filter((item) => item.squad === squadKey);
  const piPct = Number(summary.piPct);
  const evidenced = Number.isFinite(piPct) ? `${piPct}% evidenced` : (summary.contractState?.label || 'Evidence pending');
  const divert = summary.doingInstead?.major?.title
    || (Number(summary.workSplit?.unplannedPct) > 0 ? `${summary.workSplit.unplannedPct}% unplanned` : 'No diversion proven');
  const sprint = summary.sprintCadence?.label
    || summary.sprintReality?.copy
    || (summary.sprintReality?.daysRemaining != null ? `${summary.sprintReality.daysRemaining}d left` : 'Sprint unverified');
  const epicLines = promises.slice(0, 2).map((promise) => {
    const title = businessTitleFromSummary(promise.originalText || promise.summary || '', 56);
    const key = promise.issueKey || 'Unlinked';
    return `<li><strong>${escapeHtml(key)}</strong> · ${escapeHtml(title)}</li>`;
  }).join('') || '<li>No verified PI commitments yet.</li>';
  const baselineMissing = summary.baselineCoverage?.state === 'missing';
  return `<div class="gov-squad-accordion-body" data-accordion-locked="${locked ? 'true' : 'false'}">
    <div class="gov-squad-accordion-pulse" data-accordion-pulse="1">
      <span data-accordion-evidenced="1"><strong>${escapeHtml(evidenced)}</strong><small>Delivered</small></span>
      <span data-accordion-diverted="1"><strong>${escapeHtml(divert)}</strong><small>Diverted</small></span>
      <span data-accordion-sprint="1"><strong>${escapeHtml(sprint)}</strong><small>Sprint</small></span>
    </div>
    <ul class="gov-squad-accordion-epics">${epicLines}</ul>
    ${baselineMissing
      ? `<a class="btn btn-compact btn-secondary" href="/settings#gov-settings-registry-mount" data-setup-baseline-ssot="1">Save baseline</a>`
      : `<button type="button" class="btn btn-primary btn-compact" data-full-squad-detail="${escapeHtml(squadKey)}">Full squad detail</button>`}
  </div>`;
}

function closeSquadAccordion({ onlyPeek = false, squad = '' } = {}) {
  const mount = document.getElementById('gov-active-loop-mount');
  if (!mount) return;
  mount.querySelectorAll('[data-story-squad-wrap]').forEach((wrap) => {
    const key = wrap.getAttribute('data-story-squad-wrap');
    const panel = wrap.querySelector('[data-squad-accordion]');
    const row = wrap.querySelector('[data-story-squad]');
    const locked = lockedAccordionSquad === key;
    if (onlyPeek) {
      if (locked) return;
      if (squad && key !== squad) return;
      if (peekAccordionSquad === key) peekAccordionSquad = '';
      if (panel) {
        panel.hidden = true;
        panel.replaceChildren();
      }
      wrap.dataset.accordionState = 'closed';
      row?.setAttribute('aria-expanded', 'false');
      return;
    }
    if (panel) {
      panel.hidden = true;
      panel.replaceChildren();
    }
    wrap.dataset.accordionState = 'closed';
    row?.setAttribute('aria-expanded', 'false');
  });
  if (!onlyPeek) {
    lockedAccordionSquad = '';
    peekAccordionSquad = '';
    refreshDecisionSurface(activeAnswer);
  }
}

function openSquadAccordion(row, squadKey, { locked = false } = {}) {
  const wrap = row?.closest?.('[data-story-squad-wrap]')
    || document.querySelector(`[data-story-squad-wrap="${String(squadKey).replace(/"/g, '')}"]`);
  if (!wrap) return;
  if (locked && lockedAccordionSquad && lockedAccordionSquad !== squadKey) {
    closeSquadAccordion({ onlyPeek: false });
  } else if (!locked) {
    document.querySelectorAll('[data-story-squad-wrap][data-accordion-state="peek"]').forEach((other) => {
      const key = other.getAttribute('data-story-squad-wrap');
      if (key === squadKey || key === lockedAccordionSquad) return;
      const panel = other.querySelector('[data-squad-accordion]');
      if (panel) {
        panel.hidden = true;
        panel.replaceChildren();
      }
      other.dataset.accordionState = 'closed';
      other.querySelector('[data-story-squad]')?.setAttribute('aria-expanded', 'false');
    });
  }
  const panel = wrap.querySelector('[data-squad-accordion]');
  const trigger = wrap.querySelector('[data-story-squad]');
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = squadAccordionHtml(squadKey, { locked });
  wrap.dataset.accordionState = locked ? 'locked' : 'peek';
  trigger?.setAttribute('aria-expanded', locked ? 'true' : 'true');
  if (locked) {
    lockedAccordionSquad = squadKey;
    peekAccordionSquad = '';
    panel.querySelector('[data-full-squad-detail]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void showSpotlight(squadKey, { pushHistory: true });
    });
    refreshDecisionSurface(activeAnswer);
  } else {
    peekAccordionSquad = squadKey;
    panel.querySelector('[data-full-squad-detail]')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void showSpotlight(squadKey, { pushHistory: true });
    });
  }
}

function scheduleSquadPeek(row, squadKey) {
  clearPeekDwell();
  if (lockedAccordionSquad === squadKey || isMatrixScrolling) return;
  peekDwellTimer = setTimeout(() => {
    peekDwellTimer = null;
    if (isMatrixScrolling || lockedAccordionSquad === squadKey) return;
    openSquadAccordion(row, squadKey, { locked: false });
  }, 150);
}

function toggleSquadAccordion(row, squadKey) {
  if (lockedAccordionSquad === squadKey) {
    closeSquadAccordion({ onlyPeek: false });
    return;
  }
  openSquadAccordion(row, squadKey, { locked: true });
}

function closePreview() {
  closeSquadAccordion({ onlyPeek: !lockedAccordionSquad });
}

function openPreview(trigger, squad) {
  openSquadAccordion(trigger, squad, { locked: false });
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
  if (squad) {
    url.searchParams.set('squad', squad);
    url.searchParams.set('projects', squad);
    url.searchParams.delete('spotlight');
  } else {
    url.searchParams.delete('spotlight');
    url.searchParams.delete('squad');
    url.searchParams.delete('projects');
  }
  url.searchParams.set('view', activeLens);
  url.searchParams.delete('lens');
  // Preserve returnTo continuity token when present.
  history[push ? 'pushState' : 'replaceState']({ squad, view: activeLens, returnTo: url.searchParams.get('returnTo') || '' }, '', url);
  broadcastFocus();
}

function syncClearSquadControl() {
  const head = document.querySelector('.gov-story-matrix-head');
  if (!head) return;
  let btn = head.querySelector('[data-story-all]');
  if (spotlightKey) {
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-link btn-compact';
      btn.setAttribute('data-story-all', '');
      btn.textContent = 'Back to portfolio';
      btn.addEventListener('click', () => clearSpotlight(true));
      head.appendChild(btn);
    }
    btn.setAttribute('aria-current', 'false');
  } else if (btn) {
    btn.remove();
  }
}

function syncSpotlightTodayLink(answer = activeAnswer) {
  const copy = document.querySelector('.gov-loop-copy');
  if (!copy || !answer) return;
  const existing = copy.querySelector('.gov-loop-identity-links');
  if (spotlightKey) {
    existing?.remove();
    return;
  }
  const html = heroIdentityLinks(answer);
  if (!html) {
    existing?.remove();
    return;
  }
  if (existing) existing.outerHTML = html;
  else {
    const h1 = copy.querySelector('#gov-loop-answer');
    if (h1) h1.insertAdjacentHTML('afterend', html);
  }
}

function clearSpotlight(pushHistory = false) {
  spotlightKey = ''; activeSpotlightDetail = null; closePreview(); closeAllGovernanceOverlays();
  if (pushHistory && activeLens === 'squad' && activeAnswer) {
    activeLens = 'overall';
    updateUrl('', true);
    renderHero(activeAnswer);
    return;
  }
  updateUrl('', pushHistory);
  document.body.classList.remove('governance-squad-selected');
  document.getElementById('gov-squad-spotlight')?.replaceChildren();
  document.querySelectorAll('[data-story-squad]').forEach((row) => row.setAttribute('aria-current', 'false'));
  syncClearSquadControl();
  syncSpotlightTodayLink();
}

function spotlightHtml(detail) {
  const squad = detail.squad || {};
  const promises = detail.promises || [];
  const work = detail.currentWork || [];
  const unknown = detail.unknownWork || squad.unknownWork || {};
  const rework = detail.possibleRework || squad.possibleRework || {};
  const displayName = squad.displayName || squad.squad;
  const squadKey = squad.squad || '';
  const diagnosisGroups = squad.diagnosisGroups || [];
  const nextActionHtml = squad.nextAction?.action === 'set-baseline'
    ? `<button type="button" class="btn btn-link btn-compact gov-spotlight-action-btn" data-setup-baseline-ssot="1" data-squad="${escapeHtml(squadKey)}">${escapeHtml(squad.nextAction?.label || 'Save baseline to compare')}</button>`
    : escapeHtml(squad.nextAction?.label || 'Review evidence');
  const rebaselineBtn = squad.baselineCoverage?.state === 'verified'
    ? `<button type="button" class="btn btn-link btn-compact" data-setup-baseline-ssot="1" data-squad="${escapeHtml(squadKey)}" data-rebaseline="1" title="Upload a new PI slide to replace the current baseline">Rebaseline</button>`
    : '';
  const unknownEvidenceCopy = (() => {
    const line = clusterFirstUnknownImpact(squad, rework);
    if (!unknown.promoted && !squad.doingInstead?.major) return '';
    const clusters = unknown.clusters || [];
    if (clusters[0]?.issueKeys?.[0]) {
      const key = clusters[0].issueKeys[0];
      const title = clusters[0].title || '';
      return title ? `Classify ${key} · ${title}` : `Classify ${key}`;
    }
    return line;
  })();
  const inTunnel = Boolean(spotlightKey) && activeLens === 'squad';
  const h1OwnsDiagnosis = Boolean(String(squad.contractState?.label || '').trim());
  const showDiagnosisGroups = !inTunnel && !h1OwnsDiagnosis && diagnosisGroups.length > 0;
  const piPct = Number(squad.piPct);
  const deliveredLabel = Number.isFinite(piPct) ? `${piPct}% evidenced` : (squad.contractState?.label || 'Evidence pending');
  const divertLabel = squad.doingInstead?.major?.title
    || (Number(squad.workSplit?.unplannedPct) > 0 ? `${squad.workSplit.unplannedPct}% unplanned` : 'No diversion proven');
  const riskLabel = Number(squad.attentionCount) > 0 ? `${squad.attentionCount} at risk` : 'None at risk';
  const trustSecondary = squad.trustFactor?.label || 'Limited';
  const sprintLine = squad.sprintCadence?.label
    || detail.sprintReality?.copy
    || squad.sprintReality?.copy
    || 'Sprint reality unavailable.';
  const nextSafeCell = inTunnel
    ? ''
    : `<span><small>Next safe action</small><strong>${nextActionHtml}</strong></span>`;
  const scopeNote = inTunnel
    ? '<p class="gov-spotlight-scope-note sr-only">Selected squad work, PI promises, and actions only.</p>'
    : '<p class="gov-spotlight-scope-note">Selected squad work, PI promises, and actions only.</p>';
  const trail = actionTrailHtml(promises);
  const hasRealTrail = promises.some((p) => {
    const life = String(p.actionLifecycle || '');
    return life && !/No governance action has been sent yet/i.test(life);
  });
  // Epic rail lives in sticky decision bento — spotlight shows face-up promise rows only (no second rail).
  const commitmentFace = promises.length
    ? `<div class="gov-spotlight-commitments" data-spotlight-commitments="1">${promises.map((promise) => {
      const envelope = promise.expectedVsActual?.expected || {};
      const actual = promise.expectedVsActual?.actual || {};
      const start = envelope.startDate || promise.fiscalStart || '';
      const end = envelope.endDate || promise.fiscalEnd || '';
      const childHint = Number(actual.childTotal) > 0
        ? `${actual.doneChildCount || 0}/${actual.childTotal} children`
        : '';
      const dateHint = [start, end].filter(Boolean).map((value) => {
        const d = new Date(value);
        return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
      }).filter(Boolean).join(' → ');
      return `<button type="button" class="gov-spotlight-promise" data-loop-promise="${escapeHtml(promise.promiseId)}" title="${escapeHtml(promiseAlignmentSummary(promise))}"><span class="gov-spotlight-promise-id">${renderIssueIdentityHtml(promise.issueKey || '', { title: businessTitleFromSummary(promise.originalText || '', 72) })}</span><small>${escapeHtml([dateHint, childHint, promise.proofAge?.copy || promise.statusNow || 'Open evidence'].filter(Boolean).join(' · '))}</small></button>`;
    }).join('')}</div>`
    : `<button type="button" class="btn btn-link gov-spotlight-baseline-cta" data-setup-baseline-ssot="1" data-squad="${escapeHtml(squadKey)}">Cannot verify, baseline missing. Save baseline to compare.</button>`;
  const divertedClusters = (unknown.clusters || []).slice(0, 3).map((cluster) => {
    const leadKey = Array.isArray(cluster.issueKeys) && cluster.issueKeys[0] ? cluster.issueKeys[0] : '';
    const leadTitle = cluster.title || '';
    const classifyLabel = cluster.recommendation === 'ad-hoc-feature' ? 'Ad hoc' : cluster.recommendation === 'operational-group-candidate' ? 'Ops group' : 'Operational';
    const classified = cluster.classificationState === 'classified';
    return `<article class="gov-cluster-card"><span class="gov-cluster-identity">${leadKey ? renderIssueIdentityHtml(leadKey, { title: leadTitle }) : escapeHtml(cluster.title)}</span><small>${cluster.ticketCount} issues · ${cluster.percentage}% · ${escapeHtml(cluster.sharedEvidence?.join(', ') || 'shared work evidence')}</small>${classified ? '<span class="gov-cluster-classified">Classified</span>' : `<button type="button" class="btn btn-link btn-compact gov-cluster-classify" data-classify-cluster="${escapeHtml(cluster.id)}" data-cluster-version="${Number(cluster.version) || 1}" data-classification="${escapeHtml(cluster.recommendation)}">${escapeHtml(classifyLabel)}</button>`}</article>`;
  }).join('');
  return `<div class="gov-spotlight-head"><div>${scopeNote}</div></div>
  <div class="gov-spotlight-outcome" data-spotlight-outcome="1">
    <span data-outcome-delivered="1"><strong>${escapeHtml(deliveredLabel)}</strong><small>Delivered</small></span>
    <span data-outcome-diverted="1"><strong>${escapeHtml(divertLabel)}</strong><small>Diverted</small></span>
    <span data-outcome-risk="1"><strong>${escapeHtml(riskLabel)}</strong><small>At risk</small></span>
  </div>
  <p class="gov-spotlight-sprint-line" data-spotlight-sprint="1">${escapeHtml(sprintLine)}</p>
  <p class="gov-spotlight-trust-secondary"><small>Trust · ${escapeHtml(trustSecondary)}</small></p>
  ${!inTunnel ? `<div class="gov-spotlight-readout"><span><small>PI contract</small><strong>${escapeHtml(squad.contractState?.detail || squad.topState || 'Needs decision')}</strong></span><span><small>Sprint reality</small><strong>${escapeHtml(squad.sprintCadence?.label || squad.sprintReality?.state || 'Unverified')}</strong></span>${nextSafeCell}</div>` : ''}
  ${showDiagnosisGroups ? `<section class="gov-diagnosis-groups" aria-label="Evidence-backed root causes"><h3>Why proof is missing</h3>${diagnosisGroups.map((group) => {
    const keyBits = (group.issueKeys || []).slice(0, 3).map((k) => {
      const promise = promises.find((p) => p.issueKey === k);
      return renderIssueIdentityHtml(k, { title: businessTitleFromSummary(promise?.originalText || '', 48) });
    }).join(', ');
    return `<article><strong>${group.count} · ${keyBits || escapeHtml(group.label)}</strong><p>${escapeHtml(group.customerOrPiImpact || '')}</p><small>${Math.round((Number(group.confidence) || 0) * 100)}% confidence</small></article>`;
  }).join('')}</section>` : ''}
  <div class="gov-spotlight-grid">
    <section><h3>Current Work Reality</h3>${work.length ? work.slice(0, 5).map((item) => `<p class="gov-work-theme"><span><strong>${escapeHtml(item.title)}</strong></span></p>`).join('') : '<p>No current work themes are available.</p>'}</section>
    <section><h3>Diverted work</h3><p>${escapeHtml(squad.doingInstead?.copy || rework.copy || 'No major diversion is proven.')}</p><p>${escapeHtml(squad.workSplit?.explanation || '')}</p><p>${escapeHtml(honestUnknownPctLine(squad, unknown))}</p>${unknownEvidenceCopy ? `<div class="gov-unknown-clusters"><p><strong>${escapeHtml(unknownEvidenceCopy)}</strong></p>${divertedClusters}</div>` : ''}${rework.promoted ? `<details><summary>Why Delivera raised this</summary><ul>${(rework.promoted.paths || []).map((path) => `<li>${escapeHtml(path.label)}</li>`).join('')}</ul></details>` : ''}</section>
    <section><h3>PI commitments</h3>${commitmentFace}</section>
    ${hasRealTrail ? `<section class="gov-spotlight-actions"><h3>Action Trail</h3>${trail}</section>` : ''}
  </div>
  <details class="gov-spotlight-maintain"><summary>Maintain squad</summary><div class="gov-spotlight-head-actions"><button type="button" class="btn btn-link btn-compact" data-edit-alias>Edit squad name</button>${rebaselineBtn}<button type="button" class="btn btn-secondary btn-compact" data-force-squad>Refresh ${escapeHtml(displayName)}</button>${work.some((item) => item.systemDerived || item.title === 'Unclear work theme') ? work.filter((item) => item.systemDerived || item.title === 'Unclear work theme').slice(0, 1).map((item) => `<button type="button" class="btn btn-link btn-compact gov-theme-rename-btn" data-theme-rename data-theme-id="${escapeHtml(item.themeId || item.title)}" data-theme-version="${Number(item.version) || 1}" title="Rename theme">Rename theme</button>`).join('') : ''}</div></details>
  <div class="gov-loop-action-status" aria-live="polite"></div>`;
}

async function showSpotlight(squad, { pushHistory = false } = {}) {
  const sequence = ++spotlightSequence;
  spotlightKey = squad; activeSpotlightDetail = null; closePreview();
  if (pushHistory && activeLens !== 'squad' && activeAnswer) {
    activeLens = 'squad';
    updateUrl(squad, true);
    renderHero(activeAnswer);
    return;
  }
  updateUrl(squad, pushHistory);
  document.body.classList.add('governance-squad-selected');
  syncClearSquadControl();
  syncSpotlightTodayLink();
  const primary = document.querySelector('[data-loop-primary]');
  const selectedPromise = decisionPromiseForAnswer(activeAnswer);
  if (primary) {
    if (activeLens === 'squad' && spotlightKey) {
      const actionId = selectedPromise?.nextAction?.id || selectedPromise?.nextAction?.action || '';
      const writeVerb = actionLabels[actionId] || (selectedPromise?.issueKey ? `Review ${selectedPromise.issueKey}` : 'Review commitment');
      primary.textContent = writeVerb;
      if (selectedPromise?.promiseId) {
        primary.dataset.promiseId = selectedPromise.promiseId;
        primary.dataset.squadId = selectedPromise.squad || squad;
      }
    } else if (selectedPromise) {
      primary.textContent = `Review ${selectedPromise.squadDisplayName || selectedPromise.squad}`;
      primary.dataset.promiseId = selectedPromise.promiseId;
      primary.dataset.squadId = selectedPromise.squad;
    }
  }
  document.querySelectorAll('[data-story-squad]').forEach((row) => row.setAttribute('aria-current', String(row.getAttribute('data-story-squad') === squad)));
  document.querySelector('[data-story-all]')?.setAttribute('aria-current', 'false');
  const mount = document.getElementById('gov-squad-spotlight');
  if (!mount) return;
  // Instant render from cached brief data (kills the "Loading squad story…" state)
  const cachedSquad = (activeAnswer?.squads || []).find((s) => s.squad === squad);
  const cachedPromises = (activeAnswer?.promises || []).filter((promise) => promise.squad === squad);
  if (cachedSquad) {
    const cachedDetail = { squad: cachedSquad, promises: cachedPromises, currentWork: cachedSquad.currentWork || [], unknownWork: cachedSquad.unknownWork, possibleRework: cachedSquad.possibleRework, sprintReality: cachedSquad.sprintReality };
    mount.innerHTML = spotlightHtml(cachedDetail);
    mount.querySelectorAll('[data-loop-promise]').forEach((button) => button.addEventListener('click', () => void openPromiseDrawer(button.getAttribute('data-loop-promise'))));
    mount.querySelectorAll('[data-theme-rename]').forEach((button) => button.addEventListener('click', () => beginThemeRename(button, squad, mount)));
    mount.querySelectorAll('[data-force-squad]').forEach((button) => button.addEventListener('click', () => forceSquadSync(squad, button)));
    mount.querySelectorAll('[data-edit-alias]').forEach((button) => button.addEventListener('click', () => openAliasEditor(squad, mount)));
    mount.querySelectorAll('[data-classify-cluster]').forEach((button) => button.addEventListener('click', () => classifyUnknownCluster(button, cachedDetail, mount)));
  }
  // Fetch full detail in the background to enrich the cached render
  try {
    const res = await fetch(`/api/governance/squads/${encodeURIComponent(squad)}/detail.json?projects=${encodeURIComponent(squad)}&squad=${encodeURIComponent(squad)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fetchedDetail = await res.json();
    if (spotlightKey !== squad || sequence !== spotlightSequence) return;
    // The targeted-refresh projection can be newer than the independently cached
    // detail endpoint. Keep the verified story patch authoritative while the
    // detail projection catches up.
    const projectedSquad = [...(activeAnswer?.squads || []), ...(activeAnswer?.excludedOperationalGroups || [])]
      .find((item) => item.squad === squad);
    const expectedContext = projectedSquad?.context || cachedPromises[0]?.context || null;
    const receivedContext = fetchedDetail.context || fetchedDetail.squad?.context || null;
    const contextKeys = ['truthHash', 'fiscalPeriod', 'squadKey', 'organizationRevision', 'sprintId'];
    const contextConflict = Boolean(expectedContext && receivedContext && contextKeys.some((key) => (
      expectedContext[key] != null && receivedContext[key] != null
      && String(expectedContext[key]) !== String(receivedContext[key])
    )));
    const fetchedPromises = contextConflict ? [] : (fetchedDetail.promises || []);
    const verifiedPromises = cachedPromises.length ? cachedPromises : fetchedPromises;
    const detail = projectedSquad
      ? {
        ...fetchedDetail,
        squad: { ...(fetchedDetail.squad || {}), ...projectedSquad },
        promises: verifiedPromises,
        currentWork: contextConflict ? (projectedSquad.currentWork || []) : (fetchedDetail.currentWork || projectedSquad.currentWork || []),
        sprintReality: projectedSquad.sprintReality || fetchedDetail.sprintReality,
        contextQuarantined: contextConflict,
      }
      : fetchedDetail;
    activeSpotlightDetail = detail;
    const currentDecision = decisionPromiseForAnswer(activeAnswer);
    if (primary) {
      // Squad focus owns the decision rail — write verb, not wallpaper CTA.
      if (activeLens === 'squad' && spotlightKey) {
        const actionId = currentDecision?.nextAction?.id || currentDecision?.nextAction?.action || '';
        primary.textContent = actionLabels[actionId] || (currentDecision?.issueKey ? `Review ${currentDecision.issueKey}` : 'Review commitment');
        if (currentDecision?.promiseId) primary.dataset.promiseId = currentDecision.promiseId;
      } else if (currentDecision) {
        primary.textContent = `Review ${currentDecision.squadDisplayName || detail.squad?.displayName || currentDecision.squad}`;
        primary.dataset.promiseId = currentDecision.promiseId;
      }
    }
    mount.innerHTML = `${contextConflict ? '<p class="gov-loop-stale-warning gov-loop-stale-warning--quiet" role="status" data-stale-quiet="true">Showing last verified ' + escapeHtml(squad) + ' proof · newer mismatched context was quarantined · peer squad fill-in is blocked</p>' : ''}${spotlightHtml(detail)}`;
    mount.querySelectorAll('[data-loop-promise]').forEach((button) => button.addEventListener('click', () => void openPromiseDrawer(button.getAttribute('data-loop-promise'))));
    mount.querySelectorAll('[data-theme-rename]').forEach((button) => button.addEventListener('click', () => beginThemeRename(button, squad, mount)));
    mount.querySelectorAll('[data-classify-cluster]').forEach((button) => button.addEventListener('click', () => classifyUnknownCluster(button, detail, mount)));
    mount.querySelector('[data-force-squad]')?.addEventListener('click', (event) => targetedRefresh('squad', squad, event.currentTarget, mount));
    mount.querySelector('[data-edit-alias]')?.addEventListener('click', () => openBoardAliasDrawer(detail.squad));
  } catch (error) {
    // Keep the cached render if the fetch fails — only show error if no cached render exists
    if (!cachedSquad) mount.innerHTML = '<p role="status">Squad details are unavailable. The portfolio answer remains valid.</p>';
    else mount.insertAdjacentHTML('afterbegin', `<p class="gov-loop-stale-warning gov-loop-stale-warning--quiet" role="status" data-stale-quiet="true">Detail refresh unavailable · verified proof stays usable</p>`);
  }
}

async function classifyUnknownCluster(button, detail, container) {
  const squad = detail.squad || {};
  const status = container.querySelector('.gov-loop-action-status');
  const clusterVersion = Number(button.dataset.clusterVersion) || 1;
  const idempotencyKey = `classify:${squad.squad}:${button.dataset.classifyCluster}:${clusterVersion}`;
  const priorLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Classified';
  button.dataset.optimistic = '1';
  status.textContent = 'Saved locally — confirming Jira write…';
  try {
    const res = await fetch(`/api/governance/squads/${encodeURIComponent(squad.squad)}/unknown-clusters/${encodeURIComponent(button.dataset.classifyCluster)}/classification`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'If-Match': `"${clusterVersion}"`, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ classification: button.dataset.classification, expectedVersion: clusterVersion, squadPayloadHash: squad.payloadHash || detail.squadPayloadHash || '', idempotencyKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 412) throw new Error(data.error || 'This squad changed. Review the latest evidence before classifying.');
    if (!res.ok) throw new Error(data.error || `Classification failed (${res.status})`);
    status.textContent = data.writeState === 'confirmed'
      ? 'Classification confirmed in Jira.'
      : `Classification saved · ${data.writeState || 'queued'}.`;
    button.textContent = 'Classified';
    delete button.dataset.optimistic;
    const squadKey = squad.squad || '';
    if (squadKey) void showSpotlight(squadKey, { pushHistory: false });
  } catch (error) {
    button.disabled = false;
    button.textContent = priorLabel;
    delete button.dataset.optimistic;
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
      form.remove(); button.hidden = false; button.textContent = 'Rename';
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
    const scope = group.promises.length > 1 ? `<small>${group.promises.length} promises share this state.</small>` : '';
    const next = group.actionLabel ? `<small>Next: ${escapeHtml(group.actionLabel)}</small>` : '';
    return `<div class="gov-action-lifecycle"><p>${escapeHtml(group.lifecycle)}</p>${scope}${next}</div>`;
  }).join('');
}

function readLocked() {
  return decisionInProgress || Boolean(document.querySelector('.gov-loop-drawer'));
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
  return `<form class="gov-loop-amend-form"><label>Approved change<select name="type"><option value="mutually-agreed-descope">Mutually agreed descope</option><option value="move-to-next-quarter">Move to next quarter</option><option value="split-into-new-promise">Split into new promise</option><option value="replace-with-urgent-work">Replace with approved urgent work</option><option value="mark-as-support-obligation">Mark as support obligation</option></select></label><label>Why this call?<textarea name="reason" minlength="8" required></textarea></label><label>Trade-off<textarea name="tradeOff" minlength="3" required></textarea></label><label>Approved by<input name="approvedBy" autocomplete="off" required></label><label>Approval proof reference<input name="approvalProofRef"></label><button class="btn btn-primary" type="submit">Approve amendment</button></form>`;
}

function decisionReasonFormHtml(action) {
  return `<form class="gov-loop-amend-form"><label>Why this call?<textarea name="reason" minlength="8" required></textarea></label><label>Trade-off<textarea name="tradeOff" minlength="3" required></textarea></label><label>Approved by<input name="approvedBy" autocomplete="off" required></label><button class="btn btn-primary" type="submit">Record ${escapeHtml(action.replace(/-/g, ' '))}</button></form>`;
}

function sourceWriteLabel(state) {
  return ({ 'local-receipt': 'Recorded in Delivera', queued: 'Jira update queued', 'source-pending': 'Pending Jira confirmation', 'source-confirmed': 'Confirmed in Jira', 'projection-reconciled': 'Reconciled into projection', 'source-failed': 'Failed · retry available' })[state] || String(state || 'Drafted').replace(/-/g, ' ');
}

function recipientEditor(promise) {
  const route = promise.ownerRoute || {};
  const ownerMissing = isOwnerMissing({ ownerRoute: route });
  return `<div class="gov-recipient-review"><p>${ownerMissing ? 'No epic owner found. Use the PI Team assignment queue or choose the correct recipient before sending.' : `Nudge will go to ${escapeHtml(route.role || 'owner')}: ${escapeHtml(route.displayName || '')}.`}</p><label>Recipient<input data-recipient-name autocomplete="off" data-1p-ignore data-lpignore="true" value="${escapeHtml(route.displayName || 'PI Team queue')}" placeholder="Choose recipient"></label><label>Role<input data-recipient-role autocomplete="off" data-1p-ignore data-lpignore="true" value="${escapeHtml(route.role || 'PI Team queue')}"></label><label class="gov-recipient-default"><input type="checkbox" data-recipient-default> Save as squad default</label></div>`;
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
  const diagnosisEvidence = (promise.diagnosisEvidence || []).map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</li>`).join('');
  const comparison = promise.expectedVsActual || {};
  const actualKeys = comparison.actual?.issueKeys || [];
  const allowed = actions.filter((action) => action.allowed);
  const blocked = actions.filter((action) => !action.allowed);
  const primary = allowed.find((action) => action.id === 'send-nudge')
    || allowed.find((action) => action.id === 'pull-fresh-evidence')
    || allowed[0]
    || null;
  const secondaryAllowed = allowed.filter((action) => action !== primary);
  const verdictLabel = promise.verdictLabel || promise.matchLabel || promise.diagnosisLabel || 'Cannot verify';
  const verdictTone = promise.matchState || 'cannot-verify';
  const renderAction = (action, { primaryBtn = false } = {}) => {
    const label = action.id === 'send-nudge' && promise.ownerRoute?.displayName
      ? `Nudge ${promise.ownerRoute.role}: ${promise.ownerRoute.displayName}`
      : (actionLabels[action.id] || action.id);
    const cls = primaryBtn || action.id === 'send-nudge' || action.id === 'recheck-promise' || action.id === 'pull-fresh-evidence'
      ? 'btn btn-primary btn-compact'
      : 'btn btn-secondary btn-compact';
    return `<span class="gov-loop-action-wrap"><button type="button" class="${cls}" data-loop-action="${escapeHtml(action.id)}" ${action.allowed ? '' : 'disabled aria-disabled="true"'} title="${escapeHtml(action.reason || '')}">${escapeHtml(label)}</button>${action.allowed ? '' : `<small>${escapeHtml(action.reason || 'This action is not currently safe.')}</small>`}</span>`;
  };
  const moreActions = [...secondaryAllowed, ...blocked];
  const actionsHtml = primary
    ? `${renderAction(primary, { primaryBtn: true })}${moreActions.length ? `<details class="gov-loop-more-actions"><summary>More decisions (${moreActions.length})</summary><div class="gov-loop-actions gov-loop-actions--more">${moreActions.map((action) => renderAction(action)).join('')}</div></details>` : ''}`
    : `<div class="gov-loop-actions">${actions.map((action) => renderAction(action)).join('')}</div>`;
  const h1Label = String((activeAnswer?.squads || []).find((s) => s.squad === promise.squad)?.contractState?.label || '');
  const diagLabel = String(promise.diagnosisLabel || '');
  const diagChip = diagLabel && diagLabel !== verdictLabel && diagLabel !== h1Label
    ? `<span class="gov-loop-diag-chip">${escapeHtml(diagLabel)}</span>`
    : '';
  const childKeysHtml = (actualKeys.length ? actualKeys : (promise.issueKey ? [promise.issueKey] : []))
    .map((k) => renderIssueIdentityHtml(k, { title: businessTitleFromSummary(promise.originalText || '', 48) }))
    .join(', ') || 'No verified key';
  return `<div class="gov-loop-drawer" data-loop-promise-version="${Number(promise.version) || 1}" data-decision-rail="primary" data-verdict-label="${escapeHtml(verdictLabel)}"><section class="gov-loop-drawer-verdict gov-loop-tone-${tone(verdictTone)}">${renderIssueIdentityHtml(promise.issueKey || '', { title: businessTitleFromSummary(promise.originalText || '', 80) })}<p class="gov-loop-verdict-label"><strong>${escapeHtml(verdictLabel)}</strong></p>${diagChip}<p>${escapeHtml(promise.customerOrPiImpact || promise.proofAge?.copy || '')}</p>${promise.amendmentSentence ? `<p class="gov-amendment-sentence"><s aria-hidden="true">${escapeHtml(promise.originalText)}</s><span class="sr-only">Original promise: ${escapeHtml(promise.originalText)}.</span> → ${escapeHtml(promise.amendmentSentence.split('→').slice(1).join('→').trim())}</p>` : ''}</section>
  <section class="gov-resolution-sheet"><h3>Expected vs happening</h3><p>${escapeHtml(promiseAlignmentSummary(promise))}</p><dl><div><dt>Expected</dt><dd>${escapeHtml(comparison.expected?.commitment || promise.originalText)} · ${escapeHtml(comparison.expected?.fiscalPeriod || promise.quarter || '')}${comparison.expected?.startDate || comparison.expected?.endDate ? ` · ${escapeHtml([comparison.expected?.startDate, comparison.expected?.endDate].filter(Boolean).join(' → '))}` : ''}</dd></div><div><dt>Live Jira evidence</dt><dd>${childKeysHtml} · ${escapeHtml(comparison.actual?.status || promise.statusNow || '')}${comparison.actual?.childTotal ? ` · ${comparison.actual.doneChildCount || 0}/${comparison.actual.childTotal} children` : ''}</dd></div><div><dt>Mapping</dt><dd>${escapeHtml(comparison.actual?.matchedThrough === 'epic-child' ? 'Current story delivers the approved PI epic' : comparison.actual?.matchedThrough || 'Unresolved')}</dd></div></dl></section>
  ${diagnosisEvidence ? `<details class="gov-loop-history gov-loop-diagnosis-details"><summary>Why Delivera reached this diagnosis</summary><ul>${diagnosisEvidence}</ul><p><strong>Confidence:</strong> ${Math.round((Number(promise.diagnosisConfidence) || 0) * 100)}%</p><p><strong>Recommended:</strong> ${escapeHtml(promise.recommendedAction || '')}</p></details>` : ''}
  <div class="gov-loop-drawer-grid"><section><h3>PI promise source</h3><p>${escapeHtml(promise.source || promise.baselineCoverage?.sourceLabel || 'Approved PI baseline')}</p><p>${escapeHtml(scopedPromiseSourceReference(promise, squad))}</p></section><section><h3>Matched Jira work</h3><p>${renderIssueIdentityHtml(promise.issueKey || '', { title: businessTitleFromSummary(promise.originalText || '', 64) })} · ${escapeHtml(promise.statusNow || '')}</p></section><section><h3>Proof age</h3><p>${escapeHtml(promise.proofAge?.state || 'unknown')} · ${escapeHtml(promise.proofAge?.copy || '')}</p></section><section><h3>Work Split</h3><p>${squad?.workSplit?.unplannedPct == null ? 'Unplanned work unknown' : `${squad.workSplit.unplannedPct}% unplanned work`}</p><p>${escapeHtml(squad?.workSplit?.largestUnmappedCluster ? `Largest unmapped cluster: ${squad.workSplit.largestUnmappedCluster}.` : '')}</p><p>${escapeHtml(squad?.workSplit?.explanation || '')}</p><p>${escapeHtml(honestUnknownPctLine(squad, squad?.unknownWork))}</p></section><section><h3>Action state</h3><p>${escapeHtml(promise.actionLifecycle || '')}</p></section><section><h3>Owner path</h3>${recipientEditor(promise)}</section><section><h3>Ready to Promise</h3><p>${escapeHtml(promise.readiness?.copy || 'Readiness was not captured in the original baseline.')}</p></section><section><h3>Trade-off Guardrail</h3><p>${escapeHtml(promise.tradeOffGuardrail?.copy || 'No trustworthy percentage is available.')}</p></section></div>
  <details class="gov-loop-history" open><summary>Human Why and action history (${promise.actionHistory?.length || 0})</summary><ol>${[...(promise.amendmentHistory || []), ...(promise.actionHistory || [])].map((item) => `<li><strong>${escapeHtml(String(item.type || '').replace(/-/g, ' '))}</strong><small>${escapeHtml(item.rationale || item.reason || item.replyExcerpt || item.messagePreview || '')}</small></li>`).join('') || '<li>No human decision has been recorded yet.</li>'}</ol></details>
  ${(promise.sourceWrites || []).length ? `<details class="gov-loop-history"><summary>Source write status (${promise.sourceWrites.length})</summary><ol>${promise.sourceWrites.map((write) => `<li><strong>${escapeHtml(sourceWriteLabel(write.state))}</strong><small>${escapeHtml(write.failureReason || write.correctionPath || `${write.targetSystem || 'source'} · ${write.targetObject || ''}`)}</small></li>`).join('')}</ol></details>` : ''}
  <div class="gov-loop-stale-warning" hidden role="alert"></div><div class="gov-loop-action-status" aria-live="polite"></div><div class="gov-loop-actions gov-loop-actions--decision-rail" data-decision-rail-primary="${escapeHtml(primary?.id || '')}">${actionsHtml}</div></div>`;
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
  else try {
    detail = await fetchPromiseDetail(promiseId, detailHref);
  } catch (err) {
    openRightDrawer({
      title: 'Action detail unavailable',
      panelClass: 'active-loop',
      bodyHtml: `<section class="gov-resolution-sheet" role="alert"><p>${escapeHtml(err.message || 'The action could not be opened.')}</p><p>The case remains in the queue. Retry when verified evidence is available.</p></section>`,
    });
    return;
  }
  const promise = detail.promise; const squad = detail.squad;
  const { el } = openRightDrawer({ title: `${promise.squadDisplayName || squad?.displayName || promise.squad} · ${promise.verdictLabel || promise.matchLabel}`, bodyHtml: drawerHtml(promise, squad), panelClass: 'active-loop' });
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
  const route = promise.ownerRoute || {};
  const displayName = drawer.querySelector('[data-recipient-name]')?.value.trim() || '';
  const role = drawer.querySelector('[data-recipient-role]')?.value.trim() || 'Selected recipient';
  const nameChanged = displayName && route.displayName && displayName !== route.displayName;
  return {
    displayName,
    role,
    accountId: nameChanged ? '' : (route.accountId || ''),
    source: 'case-review',
  };
}

async function versionedPost(url, promise, body) {
  const idempotencyKey = body?.idempotencyKey || `${promise.promiseId}:${promise.version}:${url.split('?')[0]}`;
  return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'If-Match': `"${promise.version}"`, 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ ...body, expectedVersion: promise.version, idempotencyKey, squadPayloadHash: activeDrawerContext?.squadPayloadHash || '', truthHash: promise.context?.truthHash || '', originalPromiseRevision: promise.version }) });
}

async function handleAction(action, promise, drawer) {
  if (decisionInProgress) return;
  const status = drawer.querySelector('.gov-loop-action-status');
  if (action === 'amend-contract') {
    status.innerHTML = amendmentFormHtml();
    status.querySelector('form').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; await submit(action, promise, drawer, { promiseId: promise.promiseId, type: form.elements.type.value, reason: form.elements.reason.value, rationale: form.elements.reason.value, tradeOff: form.elements.tradeOff.value, approvedBy: form.elements.approvedBy.value, approvalProofRef: form.elements.approvalProofRef.value }); });
    return;
  }
  if (action === 'accept-risk') {
    status.innerHTML = decisionReasonFormHtml(action);
    status.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      await submit(action, promise, drawer, {
        decision: action, contractId: promise.contractId, reason: form.elements.reason.value,
        rationale: form.elements.reason.value, tradeOff: form.elements.tradeOff.value,
        approvedBy: form.elements.approvedBy.value,
      });
    });
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
  let delayMs = 400;
  while (Date.now() < deadline) {
    const res = await fetch(`/api/governance/refreshes/${encodeURIComponent(jobId)}`, { credentials: 'same-origin', cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Targeted sync status failed (${res.status})`);
    if (data.status !== 'running') return data;
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    delayMs = Math.min(2000, Math.round(delayMs * 1.5));
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
  activeAnswer = answer; sharedStoryState.activeAnswer = answer; renderHero(answer); broadcastFocus();
}

export async function loadActiveGovernanceLoop({ projects, quarter = '', force = false } = {}) {
  const seq = ++requestSequence; spotlightKey = new URL(location.href).searchParams.get('squad')
    || new URL(location.href).searchParams.get('spotlight')
    || '';
  const cached = force ? null : readCachedAnswer(projects, quarter);
  const loadingEl = document.getElementById('gov-loading');
  const loadingTitle = loadingEl?.querySelector('[data-gov-loading-title]');
  const loadingMsg = loadingEl?.querySelector('.gov-loading-msg');
  if (cached) {
    if (loadingTitle) loadingTitle.textContent = 'Restoring the last verified delivery answer';
    if (loadingMsg) loadingMsg.textContent = 'Portfolio comparison and squad evidence are refreshing quietly. Decisions wait for verified Jira truth.';
    if (loadingEl) loadingEl.dataset.govLoadingMode = 'restore';
    renderActiveGovernanceLoop(cached);
  } else {
    if (loadingTitle) loadingTitle.textContent = 'Building first verified answer…';
    if (loadingMsg) loadingMsg.textContent = 'Portfolio comparison and squad evidence are preparing. Decisions wait for verified Jira truth.';
    if (loadingEl) loadingEl.dataset.govLoadingMode = 'cold';
  }
  const qs = new URLSearchParams({
    projects: String(projects || ''),
    presentationContractVersion: String(PRESENTATION_CONTRACT_VERSION),
  });
  if (quarter) qs.set('quarter', quarter);
  if (force) qs.set('force', '1');
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
    if (!answerMatchesScope(answer, projects)) throw new Error(`Active-loop scope mismatch (${normalizedScope(answer?.scope?.projects)} != ${normalizedScope(projects)})`);
    if (force || !answerHasAccessBlock(answer)) {
      // Drop stale ACCESS_BLOCKED ghost envelopes after reconnect / successful evidence pull.
      try {
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
          const key = localStorage.key(i);
          if (key && String(key).startsWith('delivera:governance:active-loop:') && key !== scopeKey(projects, quarter)) {
            localStorage.removeItem(key);
          }
        }
      } catch (_) { /* privacy / quota */ }
    }
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
    if (!cached && seq === requestSequence && mount) mount.innerHTML = '<section class="gov-active-loop-hero is-limited" role="status"><h1>No Jira data yet</h1><p>Check the Jira connection in Settings, then tap Refresh.</p></section>';
    return cached;
  }
}

window.addEventListener('popstate', () => {
  const lens = new URL(location.href).searchParams.get('view') || 'overall';
  if (lens !== activeLens && activeAnswer) selectLens(lens, activeAnswer, document.getElementById('gov-active-loop-mount'));
  const next = new URL(location.href).searchParams.get('squad')
    || new URL(location.href).searchParams.get('spotlight')
    || '';
  if (next) void showSpotlight(next, { pushHistory: false }); else clearSpotlight(false);
});

// Same-tab + cross-tab registry continuity (Settings broadcasts StorageEvent).
window.addEventListener('storage', (event) => {
  if (event.key !== 'delivera:registry-version' || !event.newValue) return;
  const projects = String(activeAnswer?.scope?.projects || new URL(location.href).searchParams.get('projects') || '').trim();
  const quarter = String(activeAnswer?.scope?.quarter || new URL(location.href).searchParams.get('quarter') || '').trim();
  void loadActiveGovernanceLoop({ projects, quarter, force: true });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSquadAccordion({ onlyPeek: false });
  if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'd') { event.preventDefault(); void openDiagnostics(); }
});
document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('[data-story-squad-wrap], [data-squad-accordion], [data-full-squad-detail]')) return;
  if (peekAccordionSquad && !lockedAccordionSquad) closeSquadAccordion({ onlyPeek: true, squad: peekAccordionSquad });
});
