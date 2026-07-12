/**
 * SSOT: Deterministic Priority Brief — live governance answer.
 */
import { ATTENTION_STATES, formatPromiseCount } from './Delivera-Governance-GovernanceState-01SSOT.js';
import { rankPortfolioSquads, collapsedSafeSquadsLine } from './Delivera-Governance-PortfolioJudgment-01SSOT.js';
import {
  buildCommitmentRealityRows,
  summarizeCommitmentRows,
  filterRowsForDetail,
} from './Delivera-Governance-CommitmentReality-01SSOT.js';
import { estimateRecovery, recoverySummaryLine } from './Delivera-Governance-RecoveryEstimate-01SSOT.js';
import { scopeDecisionCopy } from './Delivera-Governance-ScopeLanguage-01SSOT.js';
import { squadDisplayName } from './Delivera-Governance-PortfolioDecision-01SSOT.js';

function formatDate(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildBaselineProvenance({ brief = {}, baselineMissing = false, summary = {} } = {}) {
  const bc = brief.baselineComparison || {};
  const piName = bc.piName || brief.meta?.quarter || 'PI baseline';
  const uploaded = formatDate(bc.baselineDate || bc.approvedAt);
  if (baselineMissing) {
    return {
      available: false,
      line: 'Alignment cannot be verified because no quarter baseline is available',
      extracted: 0,
      linked: 0,
      unsupported: 0,
      sourceType: 'none',
    };
  }
  const s = bc.summary || {};
  const extracted = Number(s.totalCommitted) || summary.total || 0;
  const linked = (Number(s.delivered) || 0) + (Number(s.onTrack) || 0) || summary.linked || 0;
  const unsupported = Number(s.notTraceable) || Number(s.removed) || summary.unsupported || Math.max(0, extracted - linked);
  return {
    available: true,
    line: `Compared against: ${piName}${uploaded ? `, uploaded ${uploaded}` : ''}`,
    countsLine: `Extracted: ${extracted} · Linked: ${linked} · Unsupported: ${unsupported}`,
    extracted,
    linked,
    unsupported,
    sourceType: bc.sourceType || brief.meta?.baselineSource || 'pi-baseline',
    uploaded,
    piName,
  };
}

function buildDeliveraCompleted({ epicLineage = {}, baselineProvenance = {}, preparedActions = {}, sinceLastRun = {} } = {}) {
  const parts = [];
  const linked = baselineProvenance.linked || epicLineage.count || 0;
  const total = baselineProvenance.extracted || epicLineage.affectedCommitmentCount || 0;
  if (total > 0) {
    parts.push(`linked ${linked} of ${total} promise${total === 1 ? '' : 's'}`);
  } else if (epicLineage.hasLineage) {
    parts.push(`traced ${epicLineage.count} epic${epicLineage.count === 1 ? '' : 's'}`);
  }
  const lateAdded = Number(sinceLastRun?.changeCount) || 0;
  if (lateAdded > 0) parts.push(`detected ${lateAdded} post-planning change${lateAdded === 1 ? '' : 's'}`);
  const ready = Number(preparedActions.totalReady) || 0;
  if (ready > 0) parts.push(`prepared ${ready} evidence request${ready === 1 ? '' : 's'}`);
  if (!parts.length) parts.push('verified current Jira and baseline evidence');
  return `Delivera ${parts.join(', ')}.`;
}

function buildCauseLines({ commitmentRows = [], brief = {} } = {}) {
  const lines = [];
  const unsupported = commitmentRows.filter((r) => r.governanceState === 'unsupported' || r.governanceState === 'done-unproven');
  for (const row of unsupported.slice(0, 2)) {
    let line = row.title || row.baselinePromise;
    if (row.scopeAfterPlanning) {
      line += ' moved after sprint planning without recorded approval';
    } else if (!row.hasJiraMatch) {
      line += ' has no linked delivery evidence';
    } else if (row.governanceState === 'done-unproven') {
      line += ' is marked Done but acceptance proof is incomplete';
    } else {
      line += ' lacks delivery proof';
    }
    lines.push(line);
  }
  if (!lines.length && brief.topRisks?.[0]) {
    lines.push(brief.topRisks[0].summary || brief.topRisks[0].displayTitle || 'Governance gap detected');
  }
  return lines;
}

function buildHumanDecision({ decisionRequired = {}, commitmentRows = [], preparedActions = {}, cases = [] } = {}) {
  const scopeRow = commitmentRows.find((r) => r.scopeAfterPlanning);
  if (scopeRow) {
    const due = decisionRequired.dueAt || preparedActions.nextDeadline || '';
    return {
      text: `Accept the ${scopeRow.title} scope move, or require recovery evidence${due ? ` by ${due}` : ''}.`,
      owner: decisionRequired.owner || scopeRow.owner || 'Sponsor',
      dueAt: due,
    };
  }
  const primary = commitmentRows.find((r) => r.governanceState === 'unsupported' || r.governanceState === 'extraction-uncertain');
  if (primary) {
    return {
      text: scopeDecisionCopy({ commitment: primary, brief: {} }),
      owner: decisionRequired.owner || primary.owner || 'Product Owner',
      dueAt: decisionRequired.dueAt || preparedActions.nextDeadline || '',
    };
  }
  if (cases.length) {
    return {
      text: decisionRequired.recommendedAction || 'Record sponsor decision on open governance cases',
      owner: decisionRequired.owner || 'Sponsor',
      dueAt: decisionRequired.dueAt || preparedActions.nextDeadline || '',
    };
  }
  return {
    text: decisionRequired.recommendedAction || '',
    owner: decisionRequired.owner || '',
    dueAt: decisionRequired.dueAt || '',
  };
}

function buildHeadline({ judgment = {}, baselineProvenance = {}, periodKey = '', zeroRisk = false } = {}) {
  if (zeroRisk) {
    return 'No governance decision required. All squads remain within verified commitments.';
  }
  const leading = judgment.leadingSquad;
  if (!leading) return 'Portfolio governance status unavailable';

  const name = leading.squadName || leading.projectKey;
  const period = periodKey ? ` ${periodKey}` : '';
  const unsupported = leading.unsupportedCount || baselineProvenance.unsupported || 0;

  if (leading.attentionState === ATTENTION_STATES.CANNOT_VERIFY) {
    return `${name}${period} alignment cannot be verified`;
  }
  if (unsupported > 0) {
    return `${name} needs one decision. ${unsupported}${period} promise${unsupported === 1 ? '' : 's'} remain unsupported.`;
  }
  if (judgment.offPlanCount > 1) {
    return `${judgment.offPlanCount} squads are off-plan against PI commitments.`;
  }
  return `${name} needs one decision today.`;
}

function buildGrowthSignals({ epicLineage = {}, baselineProvenance = {}, preparedActions = {}, cases = [] } = {}) {
  const signals = [];
  if (baselineProvenance.linked > 0) {
    signals.push(`${baselineProvenance.linked} promise${baselineProvenance.linked === 1 ? '' : 's'} linked automatically`);
  }
  const ready = Number(preparedActions.totalReady) || 0;
  if (ready > 1) signals.push(`${ready - 1} duplicate evidence request${ready - 1 === 1 ? '' : 's'} prevented`);
  const closed = cases.filter((c) => c.state === 'closed' || c.state === 'verified').length;
  if (closed > 0) signals.push(`${closed} risk${closed === 1 ? '' : 's'} closed before governance review`);
  return signals;
}

export function buildPriorityBrief({
  brief = {},
  decision = {},
  cases = [],
  baselineMissing = false,
  partialSquads = 0,
} = {}) {
  const anchorKey = decision.anchorProject || '';
  const insight = (decision.insights || brief.squadInsights || []).find((i) => i.projectKey === anchorKey)
    || (brief.squadInsights || [])[0]
    || {};
  const commitmentRows = buildCommitmentRealityRows({
    brief,
    anchorKey,
    cases: cases.filter((c) => c.project === anchorKey),
    baselineMissing,
  });
  const summary = summarizeCommitmentRows(commitmentRows);
  const judgment = rankPortfolioSquads({
    insights: decision.insights || brief.squadInsights || [],
    cases,
    brief,
    baselineMissing,
    anchorKey,
  });
  const baselineProvenance = buildBaselineProvenance({ brief, baselineMissing, summary });
  const zeroRisk = judgment.atRisk.length === 0 && !baselineMissing;
  const sincePrefix = brief.meta?.sinceLastRun?.summary
    && judgment.leadingSquad?.attentionState !== ATTENTION_STATES.NO_ACTION
    ? `Changed since last visit: `
    : '';

  const recovery = estimateRecovery({
    unsupportedCount: summary.unsupported,
    offPlanHours: insight.offPlanHours,
    sprintPulse: insight.sprintPulse,
    timebox: decision.timebox || brief.meta?.timebox,
    blockedCount: (insight.cardRisks || []).filter((r) => r.escalation === 'blocked').length,
  });

  const humanDecision = buildHumanDecision({
    decisionRequired: decision.decisionRequired,
    commitmentRows,
    preparedActions: decision.preparedActions,
    cases: cases.filter((c) => c.project === anchorKey),
  });

  const preparedCount = Number(decision.preparedActions?.totalReady) || 0;
  const detailRows = filterRowsForDetail(commitmentRows);

  return {
    leadingSquad: judgment.leadingSquad?.projectKey || anchorKey,
    leadingSquadName: judgment.leadingSquad?.squadName || squadDisplayName(insight),
    headline: sincePrefix + buildHeadline({ judgment, baselineProvenance, periodKey: decision.periodKey, zeroRisk }),
    causeLines: zeroRisk ? [] : buildCauseLines({ commitmentRows, brief }),
    deliveraCompleted: buildDeliveraCompleted({
      epicLineage: decision.epicLineage,
      baselineProvenance,
      preparedActions: decision.preparedActions,
      sinceLastRun: brief.meta?.sinceLastRun,
    }),
    deliveraPrepared: preparedCount > 0
      ? `${preparedCount} evidence request${preparedCount === 1 ? '' : 's'} drafted and ready for review`
      : '',
    humanDecision: zeroRisk ? null : humanDecision,
    primaryAction: zeroRisk
      ? 'Inspect portfolio evidence'
      : 'Review and record governance decision',
    evidenceAction: detailRows.length
      ? `Inspect ${detailRows.length} unsupported promise${detailRows.length === 1 ? '' : 's'}`
      : 'Inspect promise-to-Jira trace',
    exposureLine: zeroRisk
      ? ''
      : formatPromiseCount({ supported: summary.linked, total: summary.total }),
    baselineProvenance,
    portfolioJudgment: judgment,
    safeSquadsLine: collapsedSafeSquadsLine(judgment.safe),
    commitmentRows,
    detailRows,
    recovery,
    recoveryLine: recoverySummaryLine(recovery),
    growthSignals: buildGrowthSignals({
      epicLineage: decision.epicLineage,
      baselineProvenance,
      preparedActions: decision.preparedActions,
      cases,
    }),
    zeroRisk,
    partialSquads,
    stale: String(brief?.freshness?.confidenceLimit || '').toLowerCase() === 'stale',
    writesDisabled: String(brief?.freshness?.confidenceLimit || '').toLowerCase() === 'stale',
    atRiskSquads: judgment.atRisk,
  };
}

export function buildSponsorBrief(priorityBrief = {}, decision = {}) {
  const lines = [];
  lines.push(`# Governance brief — ${decision.periodKey || 'Current quarter'}`);
  lines.push('');
  lines.push(`**Verdict:** ${priorityBrief.headline || ''}`);
  if (priorityBrief.causeLines?.length) {
    lines.push('');
    lines.push('**Cause:**');
    for (const c of priorityBrief.causeLines) lines.push(`- ${c}`);
  }
  lines.push('');
  lines.push(`**Delivera completed:** ${priorityBrief.deliveraCompleted || ''}`);
  if (priorityBrief.humanDecision?.text) {
    lines.push('');
    lines.push(`**Decision required:** ${priorityBrief.humanDecision.text}`);
    if (priorityBrief.humanDecision.owner) lines.push(`**Owner:** ${priorityBrief.humanDecision.owner}`);
    if (priorityBrief.humanDecision.dueAt) lines.push(`**Due:** ${priorityBrief.humanDecision.dueAt}`);
  }
  lines.push('');
  lines.push(`_Evidence as of ${decision.generatedAt || new Date().toISOString()}_`);
  return lines.join('\n');
}

export function buildInterventionSummary(cases = []) {
  const open = cases.filter((c) => c.state && c.state !== 'closed' && c.state !== 'verified');
  if (!open.length) return '';
  const state = open[0].state || 'detected';
  const map = {
    detected: 'Detected',
    'evidence-checked': 'Evidence checked',
    'clarification-required': 'Prepared',
    'clarification-sent': 'Sent',
    'decision-required': 'Awaiting sponsor decision',
    'action-running': 'Action running',
  };
  return `Governance loop: ${map[state] || state} → next meaningful step`;
}
