/**
 * SSOT: Portfolio Decision Contract — deterministic metrics + recommendation.
 * OpenRouter may explain; it must not set recommendation or metric inputs.
 */
import { buildSquadInsights } from './Delivera-Governance-Executive-01View-SSOT.js';
import {
  classifyPortfolioGap,
  buildAffectedCommitments,
  buildPreparedActions,
  buildPeerComparison,
  gapMainIssueLabel,
} from './Delivera-Governance-PortfolioExposure-01SSOT.js';
import { buildPriorityBrief, buildInterventionSummary, buildSponsorBrief } from './Delivera-Governance-PriorityBrief-01SSOT.js';
import { buildCommitmentRealityRows } from './Delivera-Governance-CommitmentReality-01SSOT.js';
import { rankPortfolioSquads } from './Delivera-Governance-PortfolioJudgment-01SSOT.js';

export const PORTFOLIO_RECOMMENDATIONS = Object.freeze({
  CONTINUE_SCALE: 'continue-and-scale',
  CONTINUE_IMPROVE: 'continue-and-improve',
  REVIEW_SCOPE: 'review-scope',
  REVIEW_INVESTMENT: 'review-investment',
  MOVE_CAPACITY: 'move-capacity',
  ESCALATE_DECISION: 'escalate-decision',
  INSUFFICIENT_EVIDENCE: 'insufficient-evidence',
});

export const EARLY_WARNING_TIERS = Object.freeze({
  EARLY: 'early-signal',
  NEEDS_DECISION: 'needs-decision',
  CRITICAL: 'critical',
});

/** SSOT: baseline missing only when no quarter baseline data exists on the brief. */
export function resolveBaselineMissingFromBrief(brief = {}, baselineMode = 'pi-baseline') {
  const hasBaseline = Boolean(
    brief?.baselineComparison
    && (
      brief.baselineComparison.summary
      || (Array.isArray(brief.baselineComparison.items) && brief.baselineComparison.items.length)
    ),
  );
  if (hasBaseline) return false;
  const gaps = brief?.meta?.setupGaps || [];
  return gaps.some((g) => g.action === 'set-baseline') || baselineMode === 'none';
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

function normalizeProjectKey(value = '') {
  return String(value || '').trim().toUpperCase();
}

function issueProject(issueKey = '') {
  const key = normalizeProjectKey(issueKey);
  return /^[A-Z][A-Z0-9]+-\d+$/.test(key) ? key.split('-')[0] : '';
}

function addEpicLineageCandidate(map, row = {}, fallbackProject = '') {
  const epicKey = normalizeProjectKey(row.epicKey || row.issueKey || row.key);
  if (!epicKey) return;
  const projectKey = normalizeProjectKey(row.projectKey || row.project || row.squad || issueProject(epicKey) || fallbackProject);
  const title = String(row.epicTitle || row.epicSummary || row.title || row.summary || epicKey).trim();
  const existing = map.get(epicKey) || {
    epicKey,
    projectKey,
    title,
    storyCount: 0,
    doneCount: 0,
  };
  existing.projectKey = existing.projectKey || projectKey;
  existing.title = existing.title && existing.title !== epicKey ? existing.title : title;
  existing.storyCount += Number(row.storyCount) || 0;
  const status = String(row.status || '').toLowerCase();
  if (status.includes('done')) existing.doneCount += 1;
  map.set(epicKey, existing);
}

function storyHasAlignedEpic(story = {}) {
  const epicKey = normalizeProjectKey(story.epicKey || story.parentEpicKey || story.epic?.key);
  return !!epicKey;
}

function summarizeUnalignedStory(story = {}, projectKey = '') {
  const issueKey = normalizeProjectKey(story.issueKey || story.key || story.id);
  const title = String(story.summary || story.title || story.displayTitle || issueKey || 'Untitled story').replace(/\s+/g, ' ').trim();
  return {
    issueKey,
    title,
    status: String(story.status || story.statusCategory || 'Needs epic').trim() || 'Needs epic',
    projectKey: normalizeProjectKey(story.projectKey || projectKey || issueProject(issueKey)),
  };
}

function buildEpicLineage({ anchor = {}, brief = {}, affectedCommitments = [] } = {}) {
  const anchorKey = normalizeProjectKey(anchor.projectKey);
  const candidates = new Map();
  const unalignedStoryMap = new Map();

  for (const risk of [
    ...(Array.isArray(anchor.cardRisks) ? anchor.cardRisks : []),
    ...(Array.isArray(brief.topRisks) ? brief.topRisks : []),
  ]) {
    const riskProjectKey = normalizeProjectKey(risk.projectKey || risk.project || issueProject(risk.issueKey));
    if (riskProjectKey && anchorKey && riskProjectKey !== anchorKey) continue;
    if (risk.epicKey || risk.epicTitle || risk.epicSummary) {
      addEpicLineageCandidate(candidates, risk, anchorKey);
    }
  }

  for (const epic of (Array.isArray(brief?.meta?.boardEpicIndex) ? brief.meta.boardEpicIndex : [])) {
    const projectKey = normalizeProjectKey(epic.projectKey || epic.squad || issueProject(epic.issueKey));
    if (anchorKey && projectKey && projectKey !== anchorKey) continue;
    addEpicLineageCandidate(candidates, {
      epicKey: epic.issueKey,
      epicTitle: epic.title,
      projectKey,
      storyCount: 0,
    }, anchorKey);
  }

  for (const entry of (Array.isArray(brief._boardPayloads) ? brief._boardPayloads : [])) {
    const projectKey = normalizeProjectKey(entry?.board?.location?.projectKey);
    if (anchorKey && projectKey && projectKey !== anchorKey) continue;
    for (const story of (Array.isArray(entry?.payload?.stories) ? entry.payload.stories : [])) {
      if (!storyHasAlignedEpic(story)) {
        const row = summarizeUnalignedStory(story, projectKey);
        if (row.issueKey) unalignedStoryMap.set(row.issueKey, row);
        continue;
      }
      addEpicLineageCandidate(candidates, {
        epicKey: story.epicKey || story.parentEpicKey || story.epic?.key,
        epicTitle: story.epicTitle || story.epicSummary || story.epic?.summary,
        projectKey,
        storyCount: 1,
        status: story.status,
      }, anchorKey);
    }
  }

  const ranked = Array.from(candidates.values())
    .sort((a, b) => (b.storyCount - a.storyCount) || String(a.epicKey).localeCompare(String(b.epicKey)));
  const unalignedStories = Array.from(unalignedStoryMap.values())
    .sort((a, b) => String(a.issueKey).localeCompare(String(b.issueKey)));
  const primary = ranked[0] || null;
  const coveredStoryCount = ranked.reduce((sum, e) => sum + (Number(e.storyCount) || 0), 0);
  const piCommitted = asNum(anchor.piCommitted, 0);
  const label = primary
    ? `${primary.epicKey}: ${primary.title || primary.epicKey}`
    : (piCommitted > 0 ? `${piCommitted} PI baseline commitment${piCommitted === 1 ? '' : 's'} need epic confirmation` : '');

  return {
    primary,
    epics: ranked.slice(0, 3),
    count: ranked.length,
    coveredStoryCount,
    unalignedStoryCount: unalignedStories.length,
    unalignedStories: unalignedStories.slice(0, 6),
    affectedCommitmentCount: affectedCommitments.length,
    label,
    hasLineage: ranked.length > 0,
  };
}

export function resolvePortfolioInsights(brief = {}) {
  const boardPayloads = brief._boardPayloads || [];
  return brief.squadInsights?.length
    ? brief.squadInsights
    : buildSquadInsights(brief, boardPayloads, brief.evidencePack || {}, brief._squadInsightOpts || {});
}

function resolveRecommendation(anchor = {}, peers = [], cases = [], baselineMissing = false, brief = {}) {
  if (!anchor.boardResolved && !anchor.projectKey) {
    return { id: PORTFOLIO_RECOMMENDATIONS.INSUFFICIENT_EVIDENCE, label: 'Insufficient evidence', confidence: 'low' };
  }
  const delivery = deliveryPct(anchor);
  const offPlan = offPlanPct(anchor);
  const proof = proofConfidencePct(anchor, brief);
  const committed = asNum(anchor.sprintPulse?.committed, 0);
  const openCases = cases.filter((c) => c.project === anchor.projectKey).length;
  const peerDelivery = median(peers.map(deliveryPct));

  if (baselineMissing || proof < 40) {
    if (openCases > 0) {
      return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE, label: 'Confirm scope and proof before investment review', confidence: 'high' };
    }
    return { id: PORTFOLIO_RECOMMENDATIONS.INSUFFICIENT_EVIDENCE, label: 'Pause investment decision', confidence: 'high' };
  }
  if (openCases > 0 && proof < 50) {
    return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE, label: 'Confirm scope and proof before investment review', confidence: 'high' };
  }
  if (offPlan >= 40 && delivery < 45 && committed > 0) {
    return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE, label: 'Review scope', confidence: 'high' };
  }
  if (openCases > 0 && proof >= 40 && (offPlan >= 35 || delivery < 40) && committed > 0) {
    return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_INVESTMENT, label: 'Review investment', confidence: 'high' };
  }
  if (delivery >= 70 && proof >= 65) {
    return { id: PORTFOLIO_RECOMMENDATIONS.CONTINUE_SCALE, label: 'Continue and scale', confidence: 'high' };
  }
  if (delivery >= 45) {
    return { id: PORTFOLIO_RECOMMENDATIONS.CONTINUE_IMPROVE, label: 'Continue and improve', confidence: 'medium' };
  }
  if (peers.some((p) => deliveryPct(p) - delivery >= 25 && asNum(p.sprintPulse?.committed, 0) > 0)) {
    return { id: PORTFOLIO_RECOMMENDATIONS.MOVE_CAPACITY, label: 'Move capacity', confidence: 'medium' };
  }
  if (proof >= 40 && delivery < peerDelivery - 15 && committed > 0) {
    return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_INVESTMENT, label: 'Review investment', confidence: 'medium' };
  }
  if (openCases > 0) {
    return { id: PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE, label: 'Confirm scope and proof before investment review', confidence: 'medium' };
  }
  return { id: PORTFOLIO_RECOMMENDATIONS.CONTINUE_IMPROVE, label: 'Continue and improve', confidence: 'medium' };
}

function earlyWarningTier(anchor = {}, cases = []) {
  const delivery = deliveryPct(anchor);
  const offPlan = offPlanPct(anchor);
  const caseCount = cases.filter((c) => c.project === anchor.projectKey).length;
  if (delivery < 25 && offPlan >= 45) return EARLY_WARNING_TIERS.CRITICAL;
  if (caseCount > 0 && offPlan >= 30) return EARLY_WARNING_TIERS.NEEDS_DECISION;
  if (offPlan >= 20 || delivery < 50) return EARLY_WARNING_TIERS.EARLY;
  return EARLY_WARNING_TIERS.EARLY;
}

function buildNarrative({
  anchor, peers, cases, brief, recommendation, gap, peerComparison,
  affectedCommitments, preparedActions, periodKey,
} = {}) {
  const name = squadDisplayName(anchor);
  const proof = proofConfidencePct(anchor, brief);
  const delivery = deliveryPct(anchor);
  const anchorCases = cases.filter((c) => c.project === anchor.projectKey);
  const confirmedComplete = asNum(anchor.piDone, 0);
  const exposed = affectedCommitments.length;
  const nudges = preparedActions.totalReady || 0;

  let headline = `${name} needs a scope and proof decision today`;
  const commandLine = String(brief?.meta?.commandAnswerSentence || brief?.leadershipNarrative?.meetingAnswer || '').trim();
  if (commandLine) {
    headline = commandLine;
  } else if (recommendation.id === PORTFOLIO_RECOMMENDATIONS.CONTINUE_SCALE) {
    headline = `${name} is ready to scale with confirmed delivery`;
  } else if (recommendation.id === PORTFOLIO_RECOMMENDATIONS.INSUFFICIENT_EVIDENCE) {
    headline = `${name} needs scope and proof confirmation before investment review`;
  } else if (gap.primary === 'delivery') {
    headline = `${name} needs a delivery recovery decision today`;
  }

  const summaryParts = [
    `${name} has ${anchorCases.length} active case${anchorCases.length === 1 ? '' : 's'} across ${exposed} ${periodKey || 'period'} commitment${exposed === 1 ? '' : 's'}.`,
    confirmedComplete === 0 ? 'No commitment is confirmed complete.' : `${confirmedComplete} commitment${confirmedComplete === 1 ? '' : 's'} confirmed complete.`,
    `Proof confidence is ${proof}%, compared with ${peerComparison.peerProof}% for peers, so ${peerComparison.conclusion.toLowerCase()}`,
  ];
  if (nudges > 0) {
    summaryParts.push(`Delivera has prepared ${nudges} action${nudges === 1 ? '' : 's'}: ${preparedActions.groups.map((g) => g.label).join(', ')}.`);
  }

  return {
    headline,
    summary: summaryParts.join(' '),
    mainIssue: gapMainIssueLabel(gap),
    recommendedDecision: recommendation.label,
    nextDeadline: preparedActions.nextDeadline || '',
    escalationReady: preparedActions.escalationReady,
    deliverySummary: `${delivery}% confirmed delivery`,
    proofSummary: `${proof}% proof confidence`,
  };
}

function buildDrivers(anchor = {}, peers = [], brief = {}, gap = {}, affectedCommitments = [], preparedActions = {}, periodKey = '') {
  const delivery = deliveryPct(anchor);
  const peerMedian = median(peers.map(deliveryPct));
  const proof = proofConfidencePct(anchor, brief);
  const offPlan = offPlanPct(anchor);
  const name = squadDisplayName(anchor);
  const drivers = [];
  const committed = asNum(anchor.sprintPulse?.committed, 0);

  if (affectedCommitments.length > 0) {
    drivers.push({
      id: 'impact-exposure',
      title: 'Impact exposure',
      summary: `${affectedCommitments.length} ${name} commitment${affectedCommitments.length === 1 ? '' : 's'} may miss ${periodKey || 'the period'}.`,
      detail: affectedCommitments.map((c) => c.title).join('; '),
    });
  }
  if (gap.primary === 'commitment' || gap.secondary === 'commitment') {
    drivers.push({
      id: 'scope-uncertainty',
      title: 'Scope uncertainty',
      summary: `${affectedCommitments.filter((c) => c.status.includes('Scope')).length || affectedCommitments.length} active item${affectedCommitments.length === 1 ? '' : 's'} not confirmed in the PI baseline.`,
      detail: 'Confirm PI scope before investment decisions.',
    });
  }
  if (preparedActions.poResponsesRequired > 0) {
    drivers.push({
      id: 'decision-delay',
      title: 'Decision delay',
      summary: `${preparedActions.poResponsesRequired} PO confirmation${preparedActions.poResponsesRequired === 1 ? '' : 's'} still missing.`,
      detail: preparedActions.nextDeadline ? `Next response due: ${preparedActions.nextDeadline}` : 'Set target dates on open actions.',
    });
  }
  if (proof < 50 || gap.primary === 'evidence') {
    drivers.push({
      id: 'evidence-weakness',
      title: 'Evidence weakness',
      summary: `Only ${proof}% of required proof is available.`,
      detail: `Board resolved: ${anchor.boardResolved ? 'yes' : 'no'} · Off-plan: ${offPlan}%`,
    });
  }
  if (drivers.length === 0 && committed > 0 && delivery < peerMedian - 10) {
    drivers.push({
      id: 'delivery-gap',
      title: 'Delivery gap',
      summary: `${name} delivery ${delivery}% vs peer median ${peerMedian}%.`,
      detail: 'Validated with committed work in flight.',
    });
  }
  return drivers.slice(0, 4);
}

function buildDecisionProgression(recommendation = {}, gap = {}) {
  const steps = [
    { step: 'insufficient-proof', label: 'Insufficient proof', active: false },
    { step: 'confirm-scope', label: 'Confirm scope', active: false },
    { step: 'validate-delivery', label: 'Validate delivery', active: false },
    { step: 'review-investment', label: 'Review investment', active: false },
  ];
  const id = recommendation.id || '';
  if (id === PORTFOLIO_RECOMMENDATIONS.INSUFFICIENT_EVIDENCE) {
    steps[0].active = true;
  } else if (id === PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE || gap.primary === 'commitment' || gap.primary === 'evidence') {
    steps[0].active = true;
    steps[1].active = true;
  } else if (id === PORTFOLIO_RECOMMENDATIONS.REVIEW_INVESTMENT) {
    steps[2].active = true;
    steps[3].active = true;
  } else if (id === PORTFOLIO_RECOMMENDATIONS.CONTINUE_SCALE) {
    steps[3].active = true;
  } else {
    steps[1].active = true;
  }
  return steps;
}

function proofLevel(pct = 50) {
  if (pct >= 65) return 'High';
  if (pct >= 40) return 'Medium';
  return 'Low';
}

function buildTimebox(brief = {}) {
  const totalDays = Number(brief?.meta?.timebox?.totalDays) || 90;
  const elapsedDays = Number(brief?.meta?.timebox?.elapsedDays) || Math.round(totalDays / 2);
  return {
    totalDays,
    elapsedDays: Math.max(1, Math.min(totalDays, elapsedDays)),
  };
}

function confidenceLabel(pct = 0) {
  if (pct >= 70) return 'High';
  if (pct >= 40) return 'Medium';
  return 'Low';
}

function evidenceBucket(required, pct, weight = 1) {
  const available = Math.max(0, Math.min(required, Math.round((pct / 100) * required * weight)));
  return { available, required };
}

function buildEvidenceBreakdown(proof = 0) {
  const delivery = evidenceBucket(5, proof, 1.08);
  const acceptance = evidenceBucket(2, proof, 0.85);
  const outcome = evidenceBucket(3, proof, 0.75);
  const contribution = evidenceBucket(2, proof, 1);
  const available = delivery.available + acceptance.available + outcome.available + contribution.available;
  const required = delivery.required + acceptance.required + outcome.required + contribution.required;
  return {
    confidence: proof,
    confidenceLabel: confidenceLabel(proof),
    available,
    required,
    delivery,
    acceptance,
    outcome,
    contribution,
    interpretation: `${confidenceLabel(proof)} evidence confidence: ${available} of ${required} evidence points available`,
  };
}

function addDaysLabel(base, days) {
  const d = new Date(base || Date.now());
  if (!Number.isFinite(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function dueDateFromPrepared(preparedActions = {}, fallbackDays = 2) {
  const raw = preparedActions.items?.find((i) => i.dueAt)?.dueAt
    || preparedActions.groups?.find((g) => g.dueAt)?.dueAt
    || '';
  if (raw) return raw;
  if (preparedActions.nextDeadline) return preparedActions.nextDeadline;
  return addDaysLabel(Date.now(), fallbackDays);
}

function countOverdueCases(cases = []) {
  const now = Date.now();
  return cases.filter((c) => {
    const due = c.dueAt || c.primaryAction?.dueAt || c.nextDueAt;
    if (!due) return c.needsApproval || String(c.state || '').includes('clarification');
    const ms = new Date(due).getTime();
    return Number.isFinite(ms) ? ms < now : false;
  }).length;
}

function buildDataTrust({ brief = {}, insights = [], epicLineage = {}, baselineMissing = false, partialSquads = 0 } = {}) {
  const connected = insights.filter((i) => i.boardResolved !== false).length;
  const total = Math.max(1, insights.length);
  const mapped = Number(epicLineage.coveredStoryCount) || Number(epicLineage.count) || 0;
  const unmapped = Number(epicLineage.unalignedStoryCount) || 0;
  const manualOverrides = Number(brief?.meta?.manualOverrides?.length) || Number(brief?.meta?.manualOverrideCount) || 0;
  const dataGaps = Number(partialSquads) + unmapped + (baselineMissing ? 1 : 0);
  return {
    lastSync: brief.generatedAt || brief.freshness?.generatedAt || brief.freshness?.asOf || new Date().toISOString(),
    boardsConnected: { connected, total },
    commitmentsMapped: { mapped, total: Math.max(mapped + unmapped, mapped || 1) },
    manualOverrides,
    dataGaps,
    confidenceLabel: dataGaps ? (dataGaps > 2 ? 'Low' : 'Medium') : 'High',
  };
}

function buildPortfolioSummary({ insights = [], affectedCommitments = [], cases = [], epicLineage = {}, baselineMissing = false, partialSquads = 0 } = {}) {
  const totalCommitments = insights.reduce((sum, i) => sum + asNum(i.piCommitted, asNum(i.sprintPulse?.committed, 0)), 0);
  const atRisk = affectedCommitments.length;
  const blocked = insights.filter((i) => i.verdictTier === 'blocked').length;
  const onTrack = Math.max(0, totalCommitments - atRisk);
  const mapped = Number(epicLineage.coveredStoryCount) || Number(epicLineage.count) || 0;
  const dataGaps = Number(partialSquads) + (Number(epicLineage.unalignedStoryCount) || 0) + (baselineMissing ? 1 : 0);
  return {
    squadCount: insights.length,
    commitmentsTotal: totalCommitments,
    commitmentsOnTrack: onTrack,
    commitmentsAtRisk: atRisk,
    commitmentsBlocked: blocked,
    decisionsOverdue: countOverdueCases(cases),
    commitmentsMapped: mapped,
    dataGaps,
  };
}

function buildDecisionRequired({ anchor = {}, recommendation = {}, affectedCommitments = [], preparedActions = {}, cases = [], narrative = {}, proof = 0 } = {}) {
  const primaryCase = cases.find((c) => c.project === anchor.projectKey && c.needsApproval) || cases.find((c) => c.project === anchor.projectKey) || {};
  const primaryAction = preparedActions.items?.[0] || primaryCase.primaryAction || {};
  const dueAt = dueDateFromPrepared(preparedActions);
  return {
    issue: narrative.mainIssue || recommendation.label || 'Decision required',
    impact: `${affectedCommitments.length} commitment${affectedCommitments.length === 1 ? '' : 's'} at risk`,
    owner: primaryAction.owner || primaryAction.role || primaryCase.owner || primaryCase.decisionNeededFrom || 'Product Owner',
    dueAt,
    recommendedAction: primaryAction.action || recommendation.label || 'Confirm PI scope',
    escalationAfter: dueAt ? '24 hours after due date' : 'Set after owner due date',
    evidenceConfidence: confidenceLabel(proof),
    relatedCommitmentIds: affectedCommitments.map((c) => c.id || c.issueKey || c.title).filter(Boolean).slice(0, 6),
  };
}

function statusIdFor({ recommendation = {}, proof = 0, affectedCommitments = [], decisionRequired = {} } = {}) {
  if (affectedCommitments.length && recommendation.id === PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE) return 'decision-required';
  if (affectedCommitments.length && proof < 35) return 'material-risk';
  if (proof < 45) return 'evidence-gap';
  if (!decisionRequired.relatedCommitmentIds?.length) return 'not-assessed';
  return 'healthy';
}

function progressMethod(insight = {}) {
  const committed = asNum(insight.sprintPulse?.committed, 0);
  const hasStoryPointSignal = committed > 0 || asNum(insight.piCommitted, 0) > 0;
  return hasStoryPointSignal
    ? 'Progress by delivery evidence'
    : 'Progress by issue count';
}

function buildDecisionOptions(recommendation = {}, ctx = {}) {
  const { anchor, affectedCommitments = [], preparedActions = {}, peerComparison = {} } = ctx;
  const name = squadDisplayName(anchor || {});
  const preferred = recommendation.id || PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE;
  let defaultId = 'review-investment';
  if (preferred === PORTFOLIO_RECOMMENDATIONS.MOVE_CAPACITY) defaultId = 'move-capacity';
  else if (preferred === PORTFOLIO_RECOMMENDATIONS.CONTINUE_SCALE || preferred === PORTFOLIO_RECOMMENDATIONS.CONTINUE_IMPROVE) defaultId = 'keep-funding';
  else if (preferred === PORTFOLIO_RECOMMENDATIONS.REVIEW_SCOPE || preferred === PORTFOLIO_RECOMMENDATIONS.INSUFFICIENT_EVIDENCE) defaultId = 'keep-funding';

  const exposed = affectedCommitments.length;
  const nudges = preparedActions.totalReady || 0;

  return [
    {
      id: 'keep-funding',
      label: 'Continue as planned',
      hint: 'Scope confirmed — keep current delivery focus',
      useWhen: 'Scope is confirmed and recovery remains feasible.',
      effect: 'No change to squad priorities.',
      impactPreview: `Maintains current delivery focus for ${name}. Use when proof confidence improves or commitments are confirmed.`,
      selected: defaultId === 'keep-funding',
    },
    {
      id: 'review-investment',
      label: 'Fix delivery issues',
      hint: 'Pause new scope until proof catches up',
      useWhen: 'Commitments remain unclear or evidence stays weak.',
      effect: 'Opens intervention to validate outcomes.',
      impactPreview: `Creates an intervention for ${name} until ${exposed} exposed commitment${exposed === 1 ? '' : 's'} and ${nudges} prepared action${nudges === 1 ? '' : 's'} are resolved.`,
      selected: defaultId === 'review-investment',
    },
    {
      id: 'move-capacity',
      label: 'Shift capacity',
      hint: 'Reallocate to higher-yield work',
      useWhen: 'Another squad has stronger confirmed impact.',
      effect: 'Reassign part of available delivery capacity.',
      impactPreview: peerComparison.deliveryBothZero
        ? 'Not recommended while delivery is unconfirmed — address evidence first.'
        : `Reassign capacity from ${name} to higher-impact squads after leadership approval.`,
      selected: defaultId === 'move-capacity',
    },
  ];
}

function buildDecisionBasis(recommendation = {}, ctx = {}) {
  const { anchor, affectedCommitments = [], preparedActions = {}, peerComparison = {} } = ctx;
  return {
    why: recommendation.label,
    affectedSquads: [squadDisplayName(anchor || {})],
    affectedCommitments: affectedCommitments.map((c) => c.title).slice(0, 5),
    requiredApprovals: preparedActions.groups.filter((g) => g.role === 'Product Owner').map((g) => g.label),
    preparedNudges: preparedActions.totalReady || 0,
    nextCheckpoint: preparedActions.nextDeadline || 'Set on next action due',
    peerConclusion: peerComparison.conclusion || '',
  };
}

/**
 * @param {object} args
 * @param {object} args.brief governance brief contract
 * @param {string} args.anchorProject selected squad key
 * @param {string[]} args.compareProjects peer squad keys
 * @param {Array} [args.cases] compact intervention cases
 * @param {boolean} [args.baselineMissing]
 * @param {string} [args.baselineMode]
 */
export function buildPortfolioDecision({
  brief = {},
  anchorProject = '',
  compareProjects = [],
  cases = [],
  baselineMissing = false,
  baselineMode = 'pi-baseline',
  wordingSource = 'template',
  claimsVerified = true,
  partialSquads = 0,
  periodKey: periodKeyArg = '',
} = {}) {
  const projects = Array.isArray(brief.projects) ? brief.projects : [];
  const insights = resolvePortfolioInsights(brief);
  const anchorKey = String(anchorProject || projects[0] || '').trim().toUpperCase();
  const compareKeys = (compareProjects.length ? compareProjects : projects.filter((p) => p !== anchorKey))
    .map((p) => String(p).trim().toUpperCase());
  const anchor = insights.find((i) => i.projectKey === anchorKey) || insights[0] || { projectKey: anchorKey };
  const peers = insights.filter((i) => compareKeys.includes(i.projectKey));
  const periodKey = String(periodKeyArg || brief.meta?.quarter || '').trim();
  const recommendation = resolveRecommendation(anchor, peers, cases, baselineMissing, brief);
  const gap = classifyPortfolioGap({ anchor, peers, cases, brief, baselineMissing });
  const affectedCommitments = buildAffectedCommitments({ anchor, cases, brief, periodKey });
  const preparedActions = buildPreparedActions({ cases, anchor, brief });
  const peerComparison = buildPeerComparison({ anchor, peers, brief });
  const epicLineage = buildEpicLineage({ anchor, brief, affectedCommitments });
  const delivery = deliveryPct(anchor);
  const offPlan = offPlanPct(anchor);
  const proof = proofConfidencePct(anchor, brief);
  const peerDelivery = median(peers.map(deliveryPct));
  const peerOffPlan = median(peers.map(offPlanPct));
  const peerProof = median(peers.map((p) => proofConfidencePct(p, brief)));
  const liveCases = cases.filter((c) => c.project === anchor.projectKey).length;
  const nudgesReady = cases.filter((c) => c.project === anchor.projectKey && c.needsApproval).length;
  const pending = cases.filter((c) => c.project === anchor.projectKey && String(c.state || '').includes('clarification')).length;
  const narrative = buildNarrative({
    anchor, peers, cases, brief, recommendation, gap, peerComparison,
    affectedCommitments, preparedActions, periodKey,
  });
  if (narrative.summary && narrative.headline
    && narrative.summary.trim() === narrative.headline.trim()) {
    narrative.summary = '';
  }
  const ctx = { anchor, affectedCommitments, preparedActions, peerComparison, recommendation };
  const piCommittedTotal = insights.reduce((sum, i) => sum + asNum(i.piCommitted, asNum(i.sprintPulse?.committed, 0)), 0);
  const exposedCount = affectedCommitments.length;
  const timebox = buildTimebox(brief);
  const expectedTarget = Math.round((timebox.elapsedDays / timebox.totalDays) * 100);
  const evidenceBreakdown = buildEvidenceBreakdown(proof);
  const portfolioSummary = buildPortfolioSummary({
    insights,
    affectedCommitments,
    cases,
    epicLineage,
    baselineMissing,
    partialSquads,
  });
  const dataTrust = buildDataTrust({ brief, insights, epicLineage, baselineMissing, partialSquads });
  const decisionRequired = buildDecisionRequired({
    anchor,
    recommendation,
    affectedCommitments,
    preparedActions,
    cases,
    narrative,
    proof,
  });
  const statusSemantics = {
    primary: statusIdFor({ recommendation, proof, affectedCommitments, decisionRequired }),
    materialRisk: 'material-risk',
    evidenceGap: 'evidence-gap',
    decisionRequired: 'decision-required',
    notAssessed: 'not-assessed',
    healthy: 'healthy',
  };

  const commitmentRows = buildCommitmentRealityRows({
    brief,
    anchorKey,
    cases,
    baselineMissing,
  });
  const portfolioJudgment = rankPortfolioSquads({
    insights,
    cases,
    brief,
    baselineMissing,
    anchorKey,
  });
  const priorityBrief = buildPriorityBrief({
    brief,
    decision: {
      anchorProject: anchor.projectKey || anchorKey,
      periodKey,
      insights,
      epicLineage,
      preparedActions,
      decisionRequired,
      timebox,
      generatedAt: brief.generatedAt,
    },
    cases,
    baselineMissing,
    partialSquads,
  });
  const interventionSummary = buildInterventionSummary(cases);
  const sponsorBriefMarkdown = buildSponsorBrief(priorityBrief, {
    periodKey,
    generatedAt: brief.generatedAt || new Date().toISOString(),
  });
  priorityBrief.interventionSummary = interventionSummary;

  return {
    generatedAt: new Date().toISOString(),
    anchorProject: anchor.projectKey || anchorKey,
    compareProjects: compareKeys,
    periodKey,
    baselineMode,
    baselineMissing,
    partialSquads,
    insights,
    headline: priorityBrief.headline || narrative.headline,
    summary: narrative.summary,
    priorityBrief,
    portfolioJudgment,
    commitmentRows,
    interventionSummary,
    sponsorBriefMarkdown,
    narrative,
    aboveFold: {
      exposedCommitments: exposedCount,
      actionsReady: preparedActions.totalReady || nudgesReady,
      poResponsesRequired: preparedActions.poResponsesRequired || 0,
      nextDeadline: preparedActions.nextDeadline || '',
      mainIssue: narrative.mainIssue,
    },
    peerComparison,
    epicLineage,
    timebox,
    portfolioSummary,
    decisionRequired,
    evidenceBreakdown,
    dataTrust,
    statusSemantics,
    affectedCommitments,
    preparedActions,
    decisionProgression: buildDecisionProgression(recommendation, gap),
    decisionBasis: buildDecisionBasis(recommendation, ctx),
    recommendation,
    earlyWarningTier: earlyWarningTier(anchor, cases),
    metrics: {
      delivery: { value: delivery, peerMedian: peerDelivery, expectedTarget, unit: '%', methodLabel: progressMethod(anchor) },
      offPlanLoad: { value: offPlan, peerMedian: peerOffPlan, expectedTarget: Math.max(0, 100 - expectedTarget), unit: '%', methodLabel: 'Baseline deviation' },
      proofConfidence: { value: proof, peerMedian: peerProof, expectedTarget: 70, unit: '%', methodLabel: 'Evidence strength' },
    },
    trust: {
      liveCases,
      nudgesReady,
      pending,
      proofLevel: proofLevel(proof),
      lastScanAt: brief.generatedAt || brief.freshness?.asOf || new Date().toISOString(),
      wordingSource,
      claimsVerified,
    },
    drivers: buildDrivers(anchor, peers, brief, gap, affectedCommitments, preparedActions, periodKey),
    decisionOptions: buildDecisionOptions(recommendation, ctx),
    monitoring: {
      squadCount: insights.length,
      commitmentCount: piCommittedTotal,
      exposedCommitmentCount: exposedCount,
      confirmedCompleteCount: asNum(anchor.piDone, 0),
      piBaselineCount: asNum(anchor.piCommitted, 0),
    },
  };
}

export { deliveryPct, offPlanPct, proofConfidencePct, squadDisplayName };
