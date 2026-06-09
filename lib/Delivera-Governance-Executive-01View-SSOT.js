/**
 * SSOT: Executive-facing view on the governance brief (receiver truth).
 * Pure functions — no Jira/IO. Built from contract + board payloads + evidence pack.
 */
import { buildDeliveryTruth } from './Delivera-Governance-Brief-01FactContract-SSOT.js';
import {
  classifyRiskAudience,
  deriveDeliveryConfidence,
  GOVERNANCE_THRESHOLDS,
} from './Delivera-Governance-Grammar-01Rules-SSOT.js';
import { resolveSquadRoles } from './Delivera-Governance-SquadRoles-01Resolve-SSOT.js';

function asNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Strip ticket codes and cap length for business-facing titles. */
export function businessTitleFromSummary(summary = '', maxLen = 72) {
  let t = String(summary || '').trim();
  t = t.replace(/^[A-Z]{2,10}-\d+\s*[-:–]?\s*/i, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > maxLen) t = `${t.slice(0, maxLen - 1)}…`;
  return t || 'Work item needs attention';
}

export function buildImpactLine(risk = {}) {
  const hours = asNum(risk.ageHours, 0);
  if (hours >= 48) return `No progress for ${Math.round(hours / 24)} days`;
  if (hours >= 24) return `No progress for ${Math.round(hours)} hours`;
  const ev = String(risk.evidence || '').trim();
  if (/status unchanged/i.test(ev)) {
    const m = ev.match(/(\d+)h/i);
    if (m) return `No progress for ${m[1]} hours`;
  }
  if (ev.length > 0 && ev.length <= 60) return ev;
  return risk.riskLabel || 'Needs a decision';
}

export function buildSprintPulseFromPayload(payload) {
  if (!payload) {
    return { done: 0, committed: 0, pct: 0, daysElapsed: null, daysRemaining: null, phaseHint: 'unknown' };
  }
  const summary = payload.summary || {};
  const days = payload.daysMeta || {};
  const committed = asNum(summary.totalStories, 0);
  const done = asNum(summary.doneStories, 0);
  const pct = committed > 0 ? Math.round((done / committed) * 100) : 0;
  const daysElapsed = days.daysElapsedWorking ?? days.daysElapsedCalendar ?? null;
  const daysRemaining = days.daysRemainingWorking ?? days.daysRemainingCalendar ?? null;
  const stuck = Array.isArray(payload.stuckCandidates) ? payload.stuckCandidates.length : 0;
  let phaseHint = 'in_progress';
  if (committed <= 0) phaseHint = 'empty';
  else if (daysElapsed != null && daysElapsed < 2 && pct === 0 && stuck === 0) phaseHint = 'too_early';
  else if (pct >= 80) phaseHint = 'closing';
  else if (stuck > 0 && pct === 0 && daysElapsed != null && daysElapsed >= 2) phaseHint = 'blocked_signals';
  return { done, committed, pct, daysElapsed, daysRemaining, phaseHint };
}

export function buildSprintPulse(boardPayloads = []) {
  const entry = boardPayloads.find((e) => String(e?.payload?.sprint?.state || '').toLowerCase() === 'active')
    || boardPayloads[0];
  return buildSprintPulseFromPayload(entry?.payload);
}

function countDeliveryRisks(contract) {
  const all = [
    ...(contract?.topRisks || []),
    ...(contract?.portfolioRisks || []),
  ];
  return all.filter((r) => classifyRiskAudience(r.riskType) === 'delivery').length;
}

function countMeasurementRisks(contract) {
  const all = [
    ...(contract?.topRisks || []),
    ...(contract?.portfolioRisks || []),
  ];
  return all.filter((r) => classifyRiskAudience(r.riskType) === 'measurement').length;
}

function projectKeyForEntry(entry) {
  const pks = entry?.payload?.board?.projectKeys;
  if (Array.isArray(pks) && pks[0]) return String(pks[0]).trim().toUpperCase();
  const loc = entry?.board?.location?.projectKey;
  if (loc) return String(loc).trim().toUpperCase();
  const stories = Array.isArray(entry?.payload?.stories) ? entry.payload.stories : [];
  for (const s of stories) {
    const k = String(s?.issueKey || s?.key || '').trim().toUpperCase();
    const m = k.match(/^([A-Z][A-Z0-9]*)-/);
    if (m) return m[1];
  }
  return '';
}

export function groupBoardPayloadsByProject(projects = [], boardPayloads = []) {
  const map = new Map((projects || []).map((p) => [String(p).trim().toUpperCase(), []]));
  for (const entry of boardPayloads) {
    const pk = projectKeyForEntry(entry);
    if (map.has(pk)) {
      map.get(pk).push(entry);
      continue;
    }
    for (const p of projects) {
      const P = String(p).trim().toUpperCase();
      const squad = String(entry?.payload?.board?.name || entry?.board?.name || '').toUpperCase();
      if (squad.includes(P)) {
        map.get(P).push(entry);
        break;
      }
    }
  }
  return map;
}

function allContractRisks(contract) {
  const seen = new Set();
  const out = [];
  for (const r of [
    ...(contract?.topRisks || []),
    ...(contract?.portfolioRisks || []),
    ...(contract?.risks || []),
  ]) {
    const key = r.issueKey || `${r.squad}:${r.riskType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function risksForSquad(projectKey, contract) {
  const PK = String(projectKey || '').trim().toUpperCase();
  const prefix = `${PK}-`;
  return allContractRisks(contract).filter((r) => {
    const ik = String(r.issueKey || '').trim().toUpperCase();
    if (ik && ik.startsWith(prefix)) return true;
    const squad = String(r.squad || '').toUpperCase();
    if (squad && (squad.includes(PK) || PK.includes(squad.split(/\s/)[0] || ''))) return true;
    return false;
  });
}

function formatSprintStartLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Started: ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function statusIsInProgress(status) {
  const cat = String(status?.statusCategory?.key || status?.category || '').toLowerCase();
  return cat === 'indeterminate' || cat === 'in progress' || (!cat && status);
}

function buildCapacityLine(payload) {
  const stories = Array.isArray(payload?.stories) ? payload.stories : [];
  let unassigned = 0;
  for (const s of stories) {
    if (statusIsInProgress(s?.status) && !String(s?.assignee || '').trim()) unassigned += 1;
  }
  if (unassigned >= 2) return `Critical shortage: ${unassigned} unassigned in progress`;
  if (unassigned === 1) return 'Capacity gap: 1 unassigned in progress';
  const roster = payload?.summary?.teamRoster;
  if (Array.isArray(roster) && roster.length <= 2 && stories.length >= 4) {
    return `Lean team: ${roster.length} people on roster`;
  }
  return '';
}

function buildLeadTimeSignal(payload) {
  const stuck = Array.isArray(payload?.stuckCandidates) ? payload.stuckCandidates : [];
  if (!stuck.length) return { line: '', trend: 'stable' };
  const maxH = stuck.reduce((m, r) => Math.max(m, asNum(r?.hoursInStatus, 0)), 0);
  const days = Math.max(1, Math.round(maxH / 24));
  const worsening = maxH >= GOVERNANCE_THRESHOLDS.staleInProgressHours;
  return {
    line: `Avg. lead time signal: ${days} day${days === 1 ? '' : 's'}`,
    trend: worsening ? 'worsening' : 'stable',
  };
}

function buildStatusLine(sprintPulse, dt) {
  const { phaseHint, pct, daysElapsed, daysRemaining, done, committed } = sprintPulse;
  if (phaseHint === 'too_early') return 'Sprint just started — too early to judge delivery';
  if (phaseHint === 'closing' || pct >= 80) return 'On track to deliver';
  if (phaseHint === 'blocked_signals') {
    const d = daysElapsed != null ? `${daysElapsed} day${daysElapsed === 1 ? '' : 's'}` : 'Several days';
    return `${d} spent, zero progress`;
  }
  if (daysRemaining != null && daysRemaining <= 2 && pct < 50) return 'Sprint ending — delivery at risk';
  if (Number(done) === 0 && Number(committed) > 0 && daysElapsed != null && daysElapsed >= 3) {
    return `${daysElapsed} days spent, zero progress`;
  }
  if (pct >= 50) return `${done} of ${committed} delivered — progressing`;
  return `${done} of ${committed} delivered`;
}

function buildBottleneckLine(topRisk) {
  if (!topRisk) return 'None';
  const from = String(topRisk.decisionNeededFrom || '').trim();
  const impact = String(topRisk.impactLine || '').trim();
  const label = businessTitleFromSummary(topRisk.displayTitle || topRisk.summary || topRisk.riskLabel || '', 48);
  if (from && impact) return `Blocked by ${from}: ${impact}`;
  if (from) return `Blocked by ${from}`;
  if (impact) return impact;
  if (label && label !== 'Work item needs attention') return label;
  return 'Needs leadership attention';
}

const VERDICT_SORT_ORDER = { blocked: 0, watch: 1, ontrack: 2, 'on-track': 2, ok: 2 };

function periodCutoffMs(periodWindow = '28d') {
  const w = String(periodWindow || '28d').toLowerCase();
  if (w === 'pi') return null;
  const days = w === '14d' ? 14 : 28;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function computeDriftMetrics(payload, { periodWindow = '28d', piBaselineCommittedKeys = [], adHocEpicKeys = [] } = {}) {
  const cutoff = periodCutoffMs(periodWindow);
  const baselineSet = new Set((piBaselineCommittedKeys || []).map((k) => String(k).toUpperCase()));
  const adHocSet = new Set((adHocEpicKeys || []).map((e) => String(e?.issueKey || e).toUpperCase()));
  let offPlanHours = 0;
  let offPlanEpicCount = 0;
  let driftSince = '';
  const stories = Array.isArray(payload?.stories) ? payload.stories : [];
  const seenEpics = new Set();
  const piMode = String(periodWindow || '').toLowerCase() === 'pi';
  for (const s of stories) {
    const updatedMs = s?.updated ? new Date(s.updated).getTime() : (s?.created ? new Date(s.created).getTime() : NaN);
    if (cutoff != null && Number.isFinite(updatedMs) && updatedMs < cutoff) continue;
    const epicKey = String(s?.epicKey || '').trim().toUpperCase();
    if (piMode && epicKey && baselineSet.size && baselineSet.has(epicKey)) continue;
    const logged = asNum(s?.loggedHours, 0) + asNum(s?.subtaskLoggedHours, 0);
    const isPi = epicKey && baselineSet.has(epicKey);
    const isAdHoc = !epicKey || adHocSet.has(epicKey);
    if (!isPi && isAdHoc) {
      offPlanHours += logged;
      if (epicKey && !seenEpics.has(epicKey)) {
        seenEpics.add(epicKey);
        offPlanEpicCount += 1;
      } else if (!epicKey) {
        offPlanEpicCount += 1;
      }
    }
    if (!driftSince && isAdHoc && s?.created) driftSince = String(s.created).slice(0, 10);
  }
  return {
    offPlanHours: Math.round(offPlanHours * 10) / 10,
    offPlanEpicCount,
    driftSince,
  };
}

export function sortSquadInsights(squadInsights = []) {
  return [...squadInsights].sort((a, b) => {
    const ta = VERDICT_SORT_ORDER[String(a?.verdictTier || '').toLowerCase()] ?? 3;
    const tb = VERDICT_SORT_ORDER[String(b?.verdictTier || '').toLowerCase()] ?? 3;
    if (ta !== tb) return ta - tb;
    const gapA = asNum(a?.piGap, 0) + asNum(a?.offPlanHours, 0);
    const gapB = asNum(b?.piGap, 0) + asNum(b?.offPlanHours, 0);
    return gapB - gapA;
  });
}

function squadVerdictFromSignals({ sprintPulse, confidence, freshness, deliveryCount, measurementCount, dt }) {
  let verdictTier = 'onTrack';
  if (sprintPulse.phaseHint === 'too_early' && deliveryCount === 0) verdictTier = 'watch';
  else if (measurementCount > 0 && deliveryCount === 0) verdictTier = 'watch';
  else if (confidence === 'low' || sprintPulse.phaseHint === 'blocked_signals') verdictTier = 'blocked';
  else if (confidence === 'medium') verdictTier = 'watch';
  if (freshness === 'stale' && verdictTier === 'onTrack') verdictTier = 'watch';

  let verdictLabel = 'ON TRACK';
  if (sprintPulse.phaseHint === 'too_early' && Number(dt.done) === 0) verdictLabel = 'TOO EARLY';
  else if (verdictTier === 'blocked') verdictLabel = 'DELIVERY BLOCKED';
  else if (verdictTier === 'watch') verdictLabel = 'NEEDS WATCH';
  return { verdictTier, verdictLabel };
}

/**
 * @returns {object} squad insight card payload
 */
export function buildSquadInsight(projectKey, entries = [], contract, evidencePack = {}, opts = {}) {
  const {
    profileOverrides = [],
    jiraProjectFields = null,
    periodWindow = '28d',
    piBaselineCommittedKeys = [],
    adHocEpics = [],
  } = opts;
  const PK = String(projectKey || '').trim().toUpperCase();
  const boardResolved = entries.length > 0 && entries.some((e) => e?.payload);
  const activeEntry = entries.find((e) => String(e?.payload?.sprint?.state || '').toLowerCase() === 'active')
    || entries[0];
  const payload = activeEntry?.payload;
  const boardName = payload?.board?.name || activeEntry?.board?.name || '';

  const squadRoles = resolveSquadRoles({ projectKey: PK, profileOverrides, jiraProjectFields });
  if (!boardResolved || !payload) {
    return {
      projectKey: PK,
      boardResolved: false,
      boardName: '',
      verdictTier: 'watch',
      verdictLabel: 'NEEDS WATCH',
      sprintPulse: buildSprintPulseFromPayload(null),
      statusLine: 'Sprint data unavailable — refresh or check board mapping',
      bottleneckLine: 'None',
      sprintStartLabel: '',
      capacityLine: '',
      leadTimeLine: '',
      leadTimeTrend: 'stable',
      productivityLine: 'Data unavailable',
      assigneeHighlight: '',
      squadRoles,
      offPlanHours: 0,
      offPlanEpicCount: 0,
      driftSince: '',
      piCommitted: 0,
      piDone: 0,
      piGap: 0,
    };
  }

  const sprintPulse = buildSprintPulseFromPayload(payload);
  const dt = buildDeliveryTruth(entries).counts;
  const completionPct = dt.committed > 0 ? Math.round((dt.done / dt.committed) * 100) : 0;
  const confidence = deriveDeliveryConfidence({
    completionPct,
    blocked: dt.blocked,
    staleInProgress: dt.staleInProgress,
    lateAdded: dt.lateAdded,
  });
  const freshness = String(contract?.freshness?.confidenceLimit || 'live').toLowerCase();
  const squadRisks = risksForSquad(PK, contract).map((r) => enrichRiskExecutiveFields(r, evidencePack));
  const deliveryRisks = squadRisks.filter((r) => classifyRiskAudience(r.riskType) === 'delivery');
  const measurementCount = squadRisks.filter((r) => classifyRiskAudience(r.riskType) === 'measurement').length;
  const { verdictTier, verdictLabel } = squadVerdictFromSignals({
    sprintPulse,
    confidence,
    freshness,
    deliveryCount: deliveryRisks.length,
    measurementCount,
    dt,
  });

  const topDelivery = deliveryRisks.find((r) => r.issueKey || r.summary) || squadRisks[0];
  const lead = buildLeadTimeSignal(payload);
  const stale = asNum(dt.staleInProgress, 0);
  const activeSprint = asNum(payload?.meta?.activeSprintCount, 0) > 0
    || String(payload?.sprint?.state || '').toLowerCase() === 'active';
  const noSprintRisk = squadRisks.some((r) => r.riskType === 'no-active-sprint');
  const sprintSetup = (!activeSprint || noSprintRisk) ? 'limited' : 'ok';
  const deliveryHealth = verdictTier === 'blocked' ? 'blocked' : verdictTier === 'watch' ? 'watch' : 'ok';
  const hygieneHealth = measurementCount > 0 ? 'gap' : 'ok';
  let productivityLine = stale > 0 ? 'Stale work detected — squad may be stuck' : 'Productivity looks healthy';
  if (sprintSetup === 'limited') {
    productivityLine = 'Delivery confidence limited — no active sprint found';
  }

  const squadAdHoc = (adHocEpics || []).filter((e) => String(e?.squad || e?.projectKey || '').toUpperCase().includes(PK)
    || String(e?.issueKey || '').toUpperCase().startsWith(`${PK}-`));
  const drift = computeDriftMetrics(payload, {
    periodWindow,
    piBaselineCommittedKeys,
    adHocEpicKeys: squadAdHoc,
  });
  const baselineSet = new Set((piBaselineCommittedKeys || []).map((k) => String(k).toUpperCase()));
  let piCommitted = 0;
  let piDone = 0;
  for (const s of (Array.isArray(payload?.stories) ? payload.stories : [])) {
    const ek = String(s?.epicKey || '').toUpperCase();
    if (!ek || !baselineSet.has(ek)) continue;
    piCommitted += 1;
    if (String(s?.status || '').toLowerCase().includes('done')) piDone += 1;
  }

  return {
    projectKey: PK,
    boardResolved: true,
    boardName,
    verdictTier,
    verdictLabel,
    sprintPulse,
    statusLine: buildStatusLine(sprintPulse, dt),
    bottleneckLine: buildBottleneckLine(topDelivery),
    sprintStartLabel: formatSprintStartLabel(payload?.sprint?.startDate),
    capacityLine: buildCapacityLine(payload),
    leadTimeLine: lead.line,
    leadTimeTrend: lead.trend,
    productivityLine,
    healthSignals: {
      sprintSetup,
      delivery: deliveryHealth,
      hygiene: hygieneHealth,
      value: sprintPulse.pct >= 50 ? 'ok' : sprintPulse.committed > 0 ? 'watch' : 'limited',
    },
    hidePulseBar: sprintSetup === 'limited',
    assigneeHighlight: topDelivery?.assigneeName || evidenceAssignee(evidencePack, topDelivery?.issueKey) || '',
    squadRoles,
    offPlanHours: drift.offPlanHours,
    offPlanEpicCount: drift.offPlanEpicCount,
    driftSince: drift.driftSince,
    piCommitted,
    piDone,
    piGap: piCommitted > 0 ? piCommitted - piDone : 0,
    cardRisks: deliveryRisks.map((r) => ({
      issueKey: r.issueKey || '',
      displayTitle: r.displayTitle || r.summary || r.riskLabel || '',
      escalation: r.escalation || 'watch',
    })),
  };
}

export function buildPortfolioRollup(squadInsights = []) {
  const totalSquads = squadInsights.length;
  let blockerCount = 0;
  let bottleneckCount = 0;
  let behindPiCount = 0;
  let heavyAdHocCount = 0;
  for (const s of squadInsights) {
    if (s.verdictTier === 'blocked' || s.verdictLabel === 'DELIVERY BLOCKED') blockerCount += 1;
    if (s.verdictTier === 'blocked' || s.verdictTier === 'watch' || asNum(s.piGap, 0) > 0) behindPiCount += 1;
    if (asNum(s.offPlanHours, 0) >= 8) heavyAdHocCount += 1;
    const hasBottleneck = s.bottleneckLine && s.bottleneckLine !== 'None';
    if (hasBottleneck && (s.verdictTier === 'watch' || s.verdictTier === 'blocked')) bottleneckCount += 1;
  }
  const parts = [];
  if (behindPiCount) parts.push(`${behindPiCount} behind PI`);
  if (heavyAdHocCount) parts.push(`${heavyAdHocCount} heavy ad-hoc`);
  if (blockerCount) parts.push(`${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`);
  if (bottleneckCount) parts.push(`${bottleneckCount} bottleneck${bottleneckCount === 1 ? '' : 's'}`);
  const summaryLine = parts.length
    ? `Out of ${totalSquads} squads · ${parts.join(' · ')}`
    : `Out of ${totalSquads} squads: no critical blockers`;
  return { totalSquads, blockerCount, bottleneckCount, behindPiCount, heavyAdHocCount, summaryLine };
}

export function buildSquadInsights(contract, boardPayloads, evidencePack = {}, opts = {}) {
  const projects = Array.isArray(contract?.projects) ? contract.projects : [];
  const grouped = groupBoardPayloadsByProject(projects, boardPayloads);
  const insights = projects.map((p) => buildSquadInsight(
    p,
    grouped.get(String(p).trim().toUpperCase()) || [],
    contract,
    evidencePack,
    opts,
  ));
  return sortSquadInsights(insights);
}

export function attachPortfolioInsightsToBrief(contract, boardPayloads, evidencePack = {}, opts = {}) {
  const squadInsights = buildSquadInsights(contract, boardPayloads, evidencePack, opts);
  contract.squadInsights = squadInsights;
  contract.portfolioRollup = buildPortfolioRollup(squadInsights);
  return contract;
}

/**
 * @returns {{ verdictTier, verdictLabel, businessHeadline, sprintPulse, actionBadge }}
 */
export function buildExecutiveView(contract, boardPayloads = [], evidencePack = {}) {
  const confidence = String(contract?.leadershipNarrative?.confidence || 'low').toLowerCase();
  const freshness = String(contract?.freshness?.confidenceLimit || 'live').toLowerCase();
  const sprintPulse = buildSprintPulse(boardPayloads);
  const deliveryCount = countDeliveryRisks(contract);
  const measurementCount = countMeasurementRisks(contract);
  const portfolio = contract?.portfolio || 'Portfolio';
  const dt = contract?.deliveryTruth || {};

  let verdictTier = 'onTrack';
  if (sprintPulse.phaseHint === 'too_early' && deliveryCount === 0) {
    verdictTier = 'watch';
  } else if (measurementCount > 0 && deliveryCount === 0) {
    verdictTier = 'watch';
  } else if (confidence === 'low' || sprintPulse.phaseHint === 'blocked_signals') {
    verdictTier = 'blocked';
  } else if (confidence === 'medium') {
    verdictTier = 'watch';
  }
  if (freshness === 'stale' && verdictTier === 'onTrack') verdictTier = 'watch';

  let verdictLabel = 'ON TRACK';
  if (sprintPulse.phaseHint === 'too_early' && Number(dt.done) === 0) verdictLabel = 'TOO EARLY';
  else if (verdictTier === 'blocked') verdictLabel = 'DELIVERY BLOCKED';
  else if (verdictTier === 'watch') verdictLabel = 'NEEDS WATCH';

  const topDelivery = [...(contract?.topRisks || [])]
    .filter((r) => classifyRiskAudience(r.riskType) === 'delivery' && (r.issueKey || r.summary))[0];
  const headlineRisk = topDelivery || (contract?.topRisks || [])[0];
  const businessHeadline = headlineRisk?.issueKey
    ? businessTitleFromSummary(headlineRisk.summary || headlineRisk.riskLabel || headlineRisk.issueKey)
    : `${portfolio}: ${Number(dt.done) || 0} of ${Number(dt.committed) || 0} items delivered`;

  const nudgeable = (contract?.topRisks || []).filter((r) => r.issueKey).length;
  const actions = asNum((contract?.leadershipNarrative?.decisionsNeeded || []).length, deliveryCount);

  return {
    verdictTier,
    verdictLabel,
    businessHeadline,
    verdictLine: `${verdictLabel}. ${businessHeadline}`,
    sprintPulse,
    actionBadge: actions > 0 || nudgeable > 0
      ? `${actions || deliveryCount} action${(actions || deliveryCount) === 1 ? '' : 's'} · ${nudgeable} nudge${nudgeable === 1 ? '' : 's'}`
      : '',
  };
}

function evidenceAssignee(evidencePack, issueKey) {
  if (!issueKey) return '';
  const row = (evidencePack?.rows || []).find(
    (r) => String(r.issueKey).toUpperCase() === String(issueKey).toUpperCase(),
  );
  return row?.assignee || '';
}

export function enrichRiskExecutiveFields(risk, evidencePack = {}) {
  const audience = classifyRiskAudience(risk.riskType);
  const assigneeName = evidenceAssignee(evidencePack, risk.issueKey)
    || String(risk.owner || '').trim()
    || '';
  return {
    ...risk,
    audience,
    displayTitle: businessTitleFromSummary(risk.summary || risk.riskLabel || risk.squad || ''),
    impactLine: buildImpactLine(risk),
    assigneeName,
  };
}

export function attachExecutiveViewToBrief(contract, boardPayloads, evidencePack, opts = {}) {
  const executiveView = buildExecutiveView(contract, boardPayloads, evidencePack);
  contract.executiveView = executiveView;
  const enrich = (list) => (Array.isArray(list) ? list : []).map((r) => enrichRiskExecutiveFields(r, evidencePack));
  contract.topRisks = enrich(contract.topRisks);
  contract.portfolioRisks = enrich(contract.portfolioRisks);
  contract.risks = enrich(contract.risks);
  attachPortfolioInsightsToBrief(contract, boardPayloads, evidencePack, opts);
  const n = contract.leadershipNarrative || {};
  n.meetingAnswer = executiveView.verdictLine;
  n.meetingScript = [n.oneParagraph, n.whatToSay].filter(Boolean).join('\n\n');
  contract.leadershipNarrative = n;
  return contract;
}
