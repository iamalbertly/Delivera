/**
 * SSOT: Portfolio exposure — gap classification, commitments, prepared actions, peer narrative.
 */
import { resolveEscalationLevel } from './Delivera-Governance-Escalation-01Ladder-SSOT.js';

function deliveryPct(insight = {}) {
  const pulse = insight.sprintPulse || {};
  const committed = asNum(pulse.committed, 0);
  const done = asNum(pulse.done, 0);
  return committed > 0 ? Math.round((done / committed) * 100) : asNum(pulse.pct, 0);
}

function offPlanPct(insight = {}) {
  const hours = asNum(insight.offPlanHours, 0);
  const committed = asNum(insight.sprintPulse?.committed, 0);
  if (committed <= 0) return hours > 0 ? 100 : 0;
  return Math.min(100, Math.round((hours / Math.max(committed * 4, 1)) * 100));
}

function proofConfidencePct(insight = {}, brief = {}) {
  const freshness = String(brief?.freshness?.confidenceLimit || 'live').toLowerCase();
  let base = 72;
  if (insight.verdictTier === 'blocked') base = 28;
  else if (insight.verdictTier === 'watch') base = 48;
  else if (insight.verdictTier === 'onTrack') base = 74;
  const risks = asNum(insight.cardRisks?.length, 0);
  base -= risks * 6;
  if (!insight.boardResolved) base = Math.min(base, 35);
  if (freshness === 'stale') base = Math.min(base, 40);
  return Math.max(8, Math.min(95, base));
}

function squadDisplayName(insight = {}) {
  return insight.boardName || insight.projectKey || 'Squad';
}

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function median(values = []) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}

function riskProject(risk = {}, fallback = '') {
  const issueKey = String(risk.issueKey || risk.issueKeys?.[0] || '').trim().toUpperCase();
  if (/^[A-Z][A-Z0-9]+-\d+$/.test(issueKey)) return issueKey.split('-')[0];
  return String(risk.project || risk.projectKey || fallback || '').trim().toUpperCase();
}

function commitmentStatusFromRisk(risk = {}) {
  const type = String(risk.riskType || '').toLowerCase();
  if (type.includes('scope') || type.includes('baseline')) return 'Scope uncertain';
  if (type.includes('proof') || type.includes('evidence')) return 'Evidence weak';
  if (type.includes('stale') || type.includes('late')) return 'At risk';
  return 'At risk';
}

function commitmentReason(risk = {}, caseRow = null) {
  if (caseRow?.primaryAction?.action) return caseRow.primaryAction.action;
  if (risk.summary) return risk.summary;
  if (risk.recommendedAction) return risk.recommendedAction;
  const keys = caseRow?.issueKeys || risk.issueKeys || [];
  if (keys.length) return `${keys.length} open item${keys.length === 1 ? '' : 's'} need confirmation`;
  return 'Governance gap detected';
}

function decisionNeededForRisk(risk = {}) {
  const type = String(risk.riskType || '').toLowerCase();
  if (type.includes('scope')) return 'Confirm keep / split / move';
  if (type.includes('proof') || type.includes('evidence')) return 'Request evidence';
  if (risk.recommendedAction) return risk.recommendedAction;
  return 'Confirm scope and owner';
}

function risksForAnchor(brief = {}, anchorKey = '') {
  const AK = String(anchorKey || '').toUpperCase();
  const fromBrief = [
    ...(Array.isArray(brief.topRisks) ? brief.topRisks : []),
    ...(Array.isArray(brief?.leadershipNarrative?.decisionsNeeded) ? brief.leadershipNarrative.decisionsNeeded : []),
    ...(Array.isArray(brief?.meta?.actionPlan?.groupedActions) ? brief.meta.actionPlan.groupedActions : []),
  ];
  return fromBrief.filter((r) => riskProject(r, AK) === AK);
}

function formatDeadline(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `Today ${time}` : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function normalizeRole(owner = '') {
  const o = String(owner || '').toLowerCase();
  if (o.includes('product owner') || o === 'po') return 'Product Owner';
  if (o.includes('tech lead') || o.includes('technical lead')) return 'Tech Lead';
  if (o.includes('scrum') || o.includes('sm')) return 'Scrum Master';
  if (o.includes('pi lead') || o.includes('hod')) return 'PI Lead';
  return owner || 'Owner';
}

export function classifyPortfolioGap({
  anchor = {},
  peers = [],
  cases = [],
  brief = {},
  baselineMissing = false,
} = {}) {
  const delivery = deliveryPct(anchor);
  const proof = proofConfidencePct(anchor, brief);
  const peerDelivery = median(peers.map(deliveryPct));
  const peerProof = median(peers.map((p) => proofConfidencePct(p, brief)));
  const committed = asNum(anchor.sprintPulse?.committed, 0);
  const piCommitted = asNum(anchor.piCommitted, 0);
  const anchorCases = cases.filter((c) => c.project === anchor.projectKey);
  const deliveryBothLow = delivery <= 5 && peerDelivery <= 5;
  const noCommitted = committed <= 0 && piCommitted <= 0;

  if (!anchor.boardResolved) {
    return { primary: 'data-quality', secondary: null, confidence: 'low' };
  }
  if (baselineMissing || (piCommitted === 0 && anchorCases.length > 0)) {
    return { primary: 'commitment', secondary: proof < 40 ? 'evidence' : null, confidence: 'high' };
  }
  if (proof < 40 || (deliveryBothLow && proof < peerProof - 10)) {
    return { primary: 'evidence', secondary: noCommitted ? 'commitment' : null, confidence: 'high' };
  }
  if (!deliveryBothLow && delivery < peerDelivery - 15 && committed > 0) {
    return { primary: 'delivery', secondary: proof < 50 ? 'evidence' : null, confidence: 'medium' };
  }
  if (offPlanPct(anchor) >= 35 && committed > 0) {
    return { primary: 'capacity', secondary: 'delivery', confidence: 'medium' };
  }
  return { primary: 'none', secondary: null, confidence: 'medium' };
}

export function buildAffectedCommitments({
  anchor = {},
  cases = [],
  brief = {},
  periodKey = '',
} = {}) {
  const anchorKey = String(anchor.projectKey || '').toUpperCase();
  const period = periodKey || brief.meta?.quarter || '';
  const seen = new Set();
  const rows = [];

  for (const risk of risksForAnchor(brief, anchorKey)) {
    const key = String(risk.issueKey || risk.issueKeys?.[0] || risk.summary || '').slice(0, 120);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const title = risk.displayTitle || risk.summary || risk.title || risk.action || key;
    rows.push({
      id: key,
      title,
      periodKey: period,
      projectKey: anchorKey,
      status: commitmentStatusFromRisk(risk),
      reason: commitmentReason(risk),
      decisionNeeded: decisionNeededForRisk(risk),
      issueKeys: risk.issueKeys || (risk.issueKey ? [risk.issueKey] : []),
    });
  }

  for (const r of (anchor.cardRisks || [])) {
    const key = String(r.issueKey || r.displayTitle || '').slice(0, 120);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: key,
      title: r.displayTitle || r.issueKey || key,
      periodKey: period,
      projectKey: anchorKey,
      status: 'At risk',
      reason: r.escalation === 'blocked' ? 'Blocked delivery path' : 'Delivery risk flagged',
      decisionNeeded: 'Confirm scope and owner',
      issueKeys: r.issueKey ? [r.issueKey] : [],
    });
  }

  const anchorCases = cases.filter((c) => c.project === anchorKey);
  for (const c of anchorCases) {
    const key = String(c.id || c.title || '').slice(0, 120);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: c.id || key,
      title: c.title || compactCaseTitle(c),
      periodKey: c.periodKey || period,
      projectKey: anchorKey,
      status: c.state?.includes('decision') ? 'Decision required' : 'At risk',
      reason: commitmentReason({}, c),
      decisionNeeded: c.primaryAction?.action || 'Confirm owner and next step',
      issueKeys: c.issueKeys || [],
    });
  }

  return rows.slice(0, 5);
}

function compactCaseTitle(row = {}) {
  const keys = (row.issueKeys || []).slice(0, 2).join(', ');
  return keys ? `${row.project} — ${keys}` : row.title || `${row.project} needs a decision`;
}

export function buildPreparedActions({ cases = [], anchor = {}, brief = {} } = {}) {
  const anchorKey = String(anchor.projectKey || '').toUpperCase();
  const anchorCases = cases.filter((c) => c.project === anchorKey);
  const items = [];
  const groupMap = new Map();

  for (const c of anchorCases) {
    const action = c.primaryAction || {};
    const owner = action.owner || c.decisionOwner?.name || c.decisionOwner || 'Owner';
    const role = normalizeRole(owner);
    const item = {
      role,
      action: action.action || c.title || 'Confirm next step',
      owner,
      dueAt: action.dueAt || '',
      caseId: c.id,
      needsApproval: Boolean(c.needsApproval),
    };
    items.push(item);
    const prev = groupMap.get(role) || { role, count: 0, label: role };
    prev.count += 1;
    groupMap.set(role, prev);
  }

  const groups = Array.from(groupMap.values()).map((g) => ({
    ...g,
    label: `${g.count} ${g.role}${g.count === 1 ? '' : ' actions'}`,
  }));

  let nextDeadline = '';
  let earliest = Infinity;
  for (const item of items) {
    const t = new Date(item.dueAt).getTime();
    if (Number.isFinite(t) && t < earliest) {
      earliest = t;
      nextDeadline = formatDeadline(item.dueAt);
    }
  }

  let escalationReady = false;
  for (const c of anchorCases) {
    const action = c.primaryAction || {};
    const level = resolveEscalationLevel({ dueAt: action.dueAt });
    if (level.level >= 1 && (level.overdueHours > 0 || !action.dueAt)) escalationReady = true;
  }
  if (anchorCases.length > 0 && !nextDeadline) escalationReady = true;

  const poResponsesRequired = items.filter((i) => i.role === 'Product Owner' && i.needsApproval).length;

  return {
    groups,
    items: items.slice(0, 8),
    nextDeadline,
    escalationReady,
    poResponsesRequired,
    totalReady: items.filter((i) => i.needsApproval).length,
  };
}

export function buildPeerComparison({ anchor = {}, peers = [], brief = {} } = {}) {
  const delivery = deliveryPct(anchor);
  const peerDelivery = median(peers.map(deliveryPct));
  const anchorProof = proofConfidencePct(anchor, brief);
  const peerProof = median(peers.map((p) => proofConfidencePct(p, brief)));
  const committed = asNum(anchor.sprintPulse?.committed, 0);
  const peerCommitted = peers.some((p) => asNum(p.sprintPulse?.committed, 0) > 0);
  const deliveryBothZero = delivery <= 5 && peerDelivery <= 5 && (!committed || !peerCommitted);

  let conclusion = '';
  let sentence = '';
  const name = squadDisplayName(anchor);

  if (deliveryBothZero) {
    conclusion = 'The issue is not proven delivery underperformance yet. The current difference is evidence quality.';
    sentence = `${name} and peer squads both show ${delivery}% confirmed delivery. Proof confidence ${name}: ${anchorProof}% vs peers ${peerProof}%. ${conclusion}`;
  } else if (delivery < peerDelivery - 15 && committed > 0) {
    conclusion = 'Proven delivery gap — anchor is behind peers with committed work in flight.';
    sentence = `${name} delivery ${delivery}% vs peer median ${peerDelivery}%. Proof confidence ${anchorProof}% vs ${peerProof}%. ${conclusion}`;
  } else if (anchorProof < peerProof - 15) {
    conclusion = 'Evidence quality gap — delivery may be comparable but proof confidence differs.';
    sentence = `Proof confidence ${name}: ${anchorProof}% vs peers ${peerProof}%. ${conclusion}`;
  } else {
    conclusion = 'No material peer gap detected on current metrics.';
    sentence = `${name} is broadly aligned with peers on delivery (${delivery}% vs ${peerDelivery}%) and proof (${anchorProof}% vs ${peerProof}%).`;
  }

  return {
    deliveryBothZero,
    anchorDelivery: delivery,
    peerDelivery,
    anchorProof,
    peerProof,
    conclusion,
    sentence,
  };
}

export function gapMainIssueLabel(gap = {}) {
  switch (gap.primary) {
    case 'evidence': return 'Evidence gap, not yet proven delivery failure';
    case 'commitment': return 'Scope and commitment uncertainty';
    case 'delivery': return 'Proven delivery underperformance';
    case 'data-quality': return 'Data quality limits confidence';
    case 'capacity': return 'Capacity drag from off-plan work';
    default: return 'Monitoring — no urgent gap';
  }
}
