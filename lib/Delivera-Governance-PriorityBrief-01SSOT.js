/**
 * SSOT: Deterministic Priority Brief — live governance answer.
 */
import { ATTENTION_STATES, formatMetricsStrip } from './Delivera-Governance-GovernanceState-01SSOT.js';
import { rankPortfolioSquads, collapsedSafeSquadsLine } from './Delivera-Governance-PortfolioJudgment-01SSOT.js';
import {
  buildCommitmentRealityRows,
  summarizeCommitmentRows,
  filterRowsForDetail,
} from './Delivera-Governance-CommitmentReality-01SSOT.js';
import { estimateRecovery, recoverySummaryLine } from './Delivera-Governance-RecoveryEstimate-01SSOT.js';
import { scopeDecisionCopy } from './Delivera-Governance-ScopeLanguage-01SSOT.js';
import {
  squadDisplayName,
  resolveBaselineReadinessByProject,
  isBaselineMissingForProject,
} from './Delivera-Governance-PortfolioDecision-01SSOT.js';
import {
  buildAttentionEvidenceRows,
  buildEvidenceCopyPack,
} from './Delivera-Governance-CommitmentRelevance-01SSOT.js';
import { PORTFOLIO_ALL } from './Delivera-Governance-Portfolio-Scope-Rank-01SSOT.js';

function formatDate(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function normalizedQuarter(value = '') {
  return String(value || '').toUpperCase().match(/FY\s*\d{2}\s*Q\s*[1-4]/)?.[0]?.replace(/\s+/g, '') || '';
}

function baselineMatchesSelectedQuarter(readiness = {}, selectedQuarter = '') {
  const selected = normalizedQuarter(selectedQuarter);
  const baseline = normalizedQuarter(readiness.piName || readiness.quarter || readiness.periodKey || '');
  if (!selected || !baseline) return true;
  return selected === baseline;
}

function resolveJiraBrowseUrl(brief = {}, issueKey = '') {
  const key = String(issueKey || '').trim().toUpperCase();
  if (!key) return '';
  const fromRisk = [...(brief.topRisks || []), ...(brief.risks || [])]
    .find((r) => String(r.issueKey || '').toUpperCase() === key);
  if (fromRisk?.issueUrl) return String(fromRisk.issueUrl);
  const host = String(
    brief.meta?.jiraHost
    || brief.meta?.jira?.host
    || brief.freshness?.jiraHost
    || '',
  ).replace(/\/$/, '');
  if (!host) return '';
  return `${host}/browse/${key}`;
}

function buildBaselineProvenance({
  brief = {},
  baselineMissing = false,
  summary = {},
  periodKey = '',
  anchorKey = '',
  squadName = '',
} = {}) {
  const AK = String(anchorKey || '').toUpperCase();
  const readiness = brief.meta?.baselineReadinessByProject?.[AK] || {};
  const bc = brief.baselineComparisonByProject?.[AK] || brief.baselineComparison || {};
  const quarter = periodKey || brief.meta?.quarter || 'this quarter';
  const name = squadName || AK || 'this squad';
  if (baselineMissing || !readiness.hasBaseline) {
    return {
      available: false,
      line: `No ${quarter} PI slide for ${name} — upload the plan slide to verify commitments`,
      quarter,
      extracted: 0,
      linked: 0,
      unsupported: 0,
      sourceType: 'none',
      squadScoped: true,
    };
  }
  const piName = readiness.piName || bc.piName || brief.meta?.quarter || periodKey || 'PI baseline';
  const uploaded = formatDate(readiness.baselineDate || bc.baselineDate || bc.approvedAt);
  const s = bc.summary || {};
  const extracted = Number(summary.total) || Number(s.totalCommitted) || Number(readiness.committedCount) || 0;
  const linked = Number(summary.linked) || (Number(s.delivered) || 0) + (Number(s.onTrack) || 0) || 0;
  const unsupported = Number(summary.unsupported) || Math.max(0, extracted - linked);
  const metricsLine = formatMetricsStrip({ linked, total: extracted, needAttention: unsupported });
  return {
    available: true,
    line: `Compared against: ${piName}${uploaded ? `, uploaded ${uploaded}` : ''} (${name})`,
    countsLine: metricsLine,
    metricsLine,
    extracted,
    linked,
    unsupported,
    sourceType: bc.sourceType || brief.meta?.baselineSource || 'pi-baseline',
    uploaded,
    piName,
    squadScoped: true,
  };
}

function buildDeliveraCompleted({
  epicLineage = {},
  baselineProvenance = {},
  preparedActions = {},
  sinceLastRun = {},
  brief = {},
  baselineMissing = false,
} = {}) {
  const parts = [];
  const readiness = brief.meta?.baselineReadinessByProject || {};
  const withPlan = Object.entries(readiness).filter(([, r]) => r?.hasBaseline);
  const withoutPlan = Object.entries(readiness).filter(([, r]) => !r?.hasBaseline);
  if (withPlan.length) {
    const epicCount = withPlan.reduce((n, [, r]) => n + (Number(r.committedCount) || 0), 0);
    const names = withPlan.map(([k]) => k).join('/');
    parts.push(`compared ${epicCount} ${names} baseline epic${epicCount === 1 ? '' : 's'}`);
  }
  if (withoutPlan.length) {
    parts.push(`${withoutPlan.map(([k]) => k).join('/')} have no slide — plan compare skipped`);
  }
  const linked = baselineProvenance.linked || 0;
  const total = baselineProvenance.extracted || 0;
  if (!baselineMissing && total > 0) {
    parts.push(`linked ${linked} of ${total} promise${total === 1 ? '' : 's'}`);
  } else if (epicLineage.hasLineage && !baselineMissing) {
    parts.push(`traced ${epicLineage.count} epic${epicLineage.count === 1 ? '' : 's'}`);
  }
  const lateAdded = Number(sinceLastRun?.changeCount) || 0;
  if (lateAdded > 0) parts.push(`detected ${lateAdded} post-planning change${lateAdded === 1 ? '' : 's'}`);
  const ready = baselineMissing ? 0 : (Number(preparedActions.totalReady) || 0);
  if (ready > 0) parts.push(`prepared ${ready} evidence request${ready === 1 ? '' : 's'}`);
  if (!parts.length) parts.push(baselineMissing ? 'waiting for PI baseline slide' : 'verified current Jira and baseline evidence');
  return `Delivera ${parts.join('; ')}.`;
}

/** Structured cause objects for linked rendering — full proof list (cap 12 for skim). */
function buildCauseLines({ commitmentRows = [], brief = {}, max = 12 } = {}) {
  const lines = [];
  const unsupported = commitmentRows.filter((r) =>
    r.governanceState === 'unsupported'
    || r.governanceState === 'done-unproven'
    || r.lifecycleStage === 'not-planned'
    || r.verdict === 'not-planned',
  );
  for (const row of unsupported.slice(0, Math.max(1, max))) {
    const title = row.title || row.baselinePromise || 'Commitment';
    let clause = ' lacks delivery proof';
    if (row.scopeAfterPlanning) {
      clause = ' moved after sprint planning without recorded approval';
    } else if (row.lifecycleStage === 'not-planned' || row.verdict === 'not-planned') {
      clause = ' is on the PI plan and in Jira, but has no stories on the selected boards yet';
    } else if (row.lifecycleStage === 'not-in-jira' || (!row.hasJiraMatch && !row.issueKey)) {
      clause = ' is on the PI plan but not linked in Jira yet';
    } else if (!row.hasJiraMatch && row.verdict === 'removed') {
      clause = ' was removed from the quarter plan or is no longer on selected boards';
    } else if (!row.hasJiraMatch) {
      clause = ' is on the PI plan but not linked in Jira yet';
    } else if (row.governanceState === 'done-unproven') {
      clause = ' is marked Done but acceptance proof is incomplete';
    }
    const issueKey = String(row.issueKey || '').trim().toUpperCase();
    lines.push({
      text: `${title}${clause}`,
      title,
      clause,
      issueKey,
      issueUrl: resolveJiraBrowseUrl(brief, issueKey) || row.issueUrl || '',
    });
  }
  if (!lines.length && brief.topRisks?.[0]) {
    const risk = brief.topRisks[0];
    const issueKey = String(risk.issueKey || '').trim().toUpperCase();
    lines.push({
      text: risk.summary || risk.displayTitle || 'Governance gap detected',
      title: risk.displayTitle || risk.summary || '',
      clause: '',
      issueKey,
      issueUrl: risk.issueUrl || resolveJiraBrowseUrl(brief, issueKey),
    });
  }
  return lines;
}

function buildHumanDecision({ decisionRequired = {}, commitmentRows = [], preparedActions = {}, cases = [] } = {}) {
  const scopeRow = commitmentRows.find((r) => r.scopeAfterPlanning);
  if (scopeRow) {
    const due = decisionRequired.dueAt || preparedActions.nextDeadline || '';
    const dueLabel = due ? formatDate(due) || due : '';
    return {
      text: `Accept the ${scopeRow.title} scope move, or require recovery evidence${dueLabel ? ` by ${dueLabel}` : ''}.`,
      owner: decisionRequired.owner || scopeRow.owner || 'Sponsor',
      dueAt: due,
      issueKey: scopeRow.issueKey || '',
      issueUrl: scopeRow.issueUrl || '',
    };
  }
  const primary = commitmentRows.find((r) => r.governanceState === 'unsupported' || r.governanceState === 'extraction-uncertain');
  if (primary) {
    return {
      text: scopeDecisionCopy({ commitment: primary, brief: {} }),
      owner: decisionRequired.owner || primary.owner || 'Product Owner',
      dueAt: decisionRequired.dueAt || preparedActions.nextDeadline || '',
      issueKey: primary.issueKey || '',
      issueUrl: primary.issueUrl || '',
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

function buildHeadline({ judgment = {}, baselineProvenance = {}, periodKey = '', zeroRisk = false, baselineMissing = false, boardUnresolved = false, anchorKey = '', summary = {}, portfolioGeneral = false, baselineCoverage = {}, attentionBreakdown = {} } = {}) {
  if (zeroRisk) {
    return 'No governance decision required. All squads remain within verified commitments.';
  }
  if (portfolioGeneral || String(anchorKey).toUpperCase() === PORTFOLIO_ALL) {
    const atRisk = Number(attentionBreakdown.deliveryRisk) || judgment.offPlanCount || 0;
    const quarter = periodKey || baselineProvenance.quarter || 'this quarter';
    // Honest count: squads with baselines vs without. The 'No PI commitments'
    // warning should highlight squads missing slides, not claim all are missing.
    // (Audit 2026-07-15: 'No PI commitments on file' showed even when squads had data.)
    const totalSquads = judgment.squads?.length || 0;
    const squadsWithBaseline = judgment.squads?.filter((s) => !s.baselineMissing)?.length || 0;
    const squadsWithoutBaseline = Number(baselineCoverage.missing) || (totalSquads - squadsWithBaseline);
    if (baselineProvenance?.available === false && atRisk === 0 && squadsWithoutBaseline === totalSquads) {
      return `No PI slides confirmed for ${quarter} — upload plan slides in Alignment Studio`;
    }
    if (squadsWithoutBaseline > 0 && atRisk === 0) {
      return `${squadsWithoutBaseline} of ${baselineCoverage.totalSquads || totalSquads} delivery squads need ${quarter} PI commitments uploaded before Delivera can score delivery risk.`;
    }
    if (atRisk > 0) {
      const lead = judgment.leadingSquad?.squadName || judgment.leadingSquad?.projectKey || 'A squad';
      const gap = Number(judgment.leadingSquad?.notPlannedCount)
        || Number(judgment.leadingSquad?.unsupportedCount)
        || 0;
      if (gap > 0) {
        const total = Number(judgment.leadingSquad?.totalCount) || Math.max(gap, Number(baselineProvenance.total) || 0);
        return `Portfolio: ${atRisk} delivery squad${atRisk === 1 ? '' : 's'} need action — ${lead} leads because ${gap} of ${total || gap} ${quarter} commitments are missing Jira story evidence.`;
      }
      return `Portfolio: ${atRisk} delivery squad${atRisk === 1 ? '' : 's'} need action — ${lead} needs review first.`;
    }
    if (squadsWithoutBaseline > 0 && squadsWithBaseline > 0) {
      return `Portfolio overview for ${quarter} — ${squadsWithBaseline} of ${totalSquads} squads have PI commitments on file.`;
    }
    return `Portfolio overview for ${quarter} — all squads in scope.`;
  }
  const leading = judgment.leadingSquad;
  const anchorSquad = judgment.squads?.find(
    (s) => String(s.projectKey).toUpperCase() === String(anchorKey).toUpperCase(),
  ) || leading;
  if (!leading && !anchorSquad) return 'Portfolio governance status unavailable';

  const focus = (anchorKey && anchorSquad) ? anchorSquad : leading;
  const name = focus?.squadName || focus?.projectKey;
  const quarter = periodKey || baselineProvenance.quarter || 'this quarter';
  const period = periodKey ? ` ${periodKey}` : '';
  const unsupported = focus?.unsupportedCount || baselineProvenance.unsupported || 0;

  if (baselineMissing || focus?.baselineMissing || focus?.attentionState === ATTENTION_STATES.CANNOT_VERIFY) {
    if (focus?.boardResolved === false || boardUnresolved) {
      return `${name} board is not mapped — align board work in Alignment Studio`;
    }
    return `Upload ${quarter} PI baseline slide to verify ${name} commitments`;
  }
  if (boardUnresolved) {
    return `${name} board is not mapped — align board work in Alignment Studio`;
  }
  if (unsupported > 0) {
    const notPlanned = focus?.notPlannedCount
      || Number(summary?.notPlanned)
      || Number(baselineProvenance?.notPlanned)
      || 0;
    if (notPlanned > 0 && notPlanned >= unsupported) {
      return `${name} has ${notPlanned} PI commitment${notPlanned === 1 ? '' : 's'} missing Jira story evidence.`;
    }
    return `${name}: ${unsupported}${period} commitment${unsupported === 1 ? '' : 's'} need action — see evidence below.`;
  }
  if (judgment.offPlanCount > 1) {
    return `${judgment.offPlanCount} squads are behind sprint commitment against their PI plans.`;
  }
  if (focus?.attentionState === ATTENTION_STATES.OFF_PLAN) {
    return `${name} is behind sprint commitment — review delivery blockers.`;
  }
  if (focus?.attentionState === ATTENTION_STATES.PROOF_REQUIRED) {
    return `${name} needs acceptance proof before claims can be trusted.`;
  }
  return `${name}: review open commitments and evidence below.`;
}

function buildGrowthSignals({ epicLineage = {}, baselineProvenance = {}, preparedActions = {}, cases = [], baselineMissing = false } = {}) {
  const signals = [];
  if (!baselineMissing && baselineProvenance.linked > 0) {
    signals.push(`${baselineProvenance.linked} promise${baselineProvenance.linked === 1 ? '' : 's'} linked automatically`);
  }
  const ready = baselineMissing ? 0 : (Number(preparedActions.totalReady) || 0);
  if (ready > 1) signals.push(`${ready - 1} duplicate evidence request${ready - 1 === 1 ? '' : 's'} prevented`);
  const closed = cases.filter((c) => c.state === 'closed' || c.state === 'verified').length;
  if (closed > 0) signals.push(`${closed} risk${closed === 1 ? '' : 's'} closed before governance review`);
  return signals;
}

function portfolioHasNoBaselineLine(brief = {}, periodKey = '') {
  const ready = brief.meta?.baselineReadinessByProject || {};
  const allProjects = Object.keys(ready);
  const withBaseline = allProjects.filter((k) => ready[k]?.hasBaseline && baselineMatchesSelectedQuarter(ready[k], periodKey));
  const withoutBaseline = allProjects.filter((k) => !ready[k]?.hasBaseline || !baselineMatchesSelectedQuarter(ready[k], periodKey));
  const q = periodKey || brief.meta?.quarter || 'this quarter';
  if (!withBaseline.length) return `No PI slides confirmed for ${q} — open Alignment Studio to upload`;
  if (withoutBaseline.length) {
    return `${withoutBaseline.length} of ${allProjects.length} squads need PI slides for ${q}`;
  }
  return `All ${allProjects.length} squads have PI commitments for ${q}`;
}

function judgmentLeadingProject(decision = {}, brief = {}) {
  return decision.leadingSquad
    || decision.insights?.[0]?.projectKey
    || brief.squadInsights?.[0]?.projectKey
    || (brief.projects || [])[0]
    || '';
}

export function buildPriorityBrief({
  brief = {},
  decision = {},
  cases = [],
  baselineMissing = false,
  baselineMode = 'pi-baseline',
  partialSquads = 0,
  baselineCoverage = {},
  attentionBreakdown = {},
} = {}) {
  const periodKey = decision.periodKey || brief.meta?.quarter || '';
  const rawAnchor = String(decision.anchorProject || '').toUpperCase();
  const portfolioGeneral = rawAnchor === '__ALL__' || Boolean(decision.portfolioGeneral);
  const anchorKey = portfolioGeneral
    ? String(judgmentLeadingProject(decision, brief) || '').toUpperCase()
    : rawAnchor;
  const insight = (decision.insights || brief.squadInsights || []).find((i) => String(i.projectKey).toUpperCase() === anchorKey)
    || (brief.squadInsights || [])[0]
    || {};
  const readinessForAnchor = brief?.meta?.baselineReadinessByProject?.[anchorKey] || {};
  const quarterMismatch = !portfolioGeneral
    && readinessForAnchor.hasBaseline
    && !baselineMatchesSelectedQuarter(readinessForAnchor, periodKey);
  const effectiveMissing = portfolioGeneral
    ? false
    : (typeof baselineMissing === 'boolean' && brief?.meta?.baselineReadinessByProject?.[anchorKey]
      ? Boolean(!brief.meta.baselineReadinessByProject[anchorKey].hasBaseline || quarterMismatch)
      : (baselineMissing || isBaselineMissingForProject(brief, anchorKey, baselineMode)));
  const commitmentRows = buildCommitmentRealityRows({
    brief,
    anchorKey: portfolioGeneral ? '' : anchorKey,
    cases: portfolioGeneral ? cases : cases.filter((c) => c.project === anchorKey),
    baselineMissing: effectiveMissing,
  }).map((row) => ({
    ...row,
    issueUrl: row.issueUrl || resolveJiraBrowseUrl(brief, row.issueKey),
  }));
  const summary = summarizeCommitmentRows(commitmentRows);
  const anchorInsight = (decision.insights || brief.squadInsights || []).find(
    (i) => String(i.projectKey).toUpperCase() === anchorKey,
  );
  const boardUnresolved = !portfolioGeneral && !effectiveMissing && anchorInsight?.boardResolved === false;
  const judgment = rankPortfolioSquads({
    insights: decision.insights || brief.squadInsights || [],
    cases,
    brief,
    baselineMissing: effectiveMissing,
    baselineMode,
    anchorKey: portfolioGeneral ? '' : anchorKey,
  });
  const squadName = portfolioGeneral ? 'All Projects' : squadDisplayName(insight);
  const baselineProvenance = portfolioGeneral
    ? {
      available: Object.values(brief.meta?.baselineReadinessByProject || {}).some((r) => r?.hasBaseline),
      line: portfolioHasNoBaselineLine(brief, periodKey),
      quarter: periodKey,
      extracted: 0,
      linked: 0,
      unsupported: 0,
      sourceType: 'portfolio',
      squadScoped: false,
    }
    : buildBaselineProvenance({
      brief,
      baselineMissing: effectiveMissing,
      summary,
      periodKey,
      anchorKey,
      squadName,
    });

  const executiveBlocked = String(brief?.executiveView?.verdictTier || '').toLowerCase() === 'blocked'
    || (decision.insights || brief.squadInsights || []).some(
      (i) => String(i.verdictTier || '').toLowerCase() === 'blocked',
    );
  const hasCannotVerify = (judgment.squads || []).some(
    (s) => s.attentionState === ATTENTION_STATES.CANNOT_VERIFY || s.baselineMissing,
  );
  // Calm "no decision" only when nothing needs attention — including CANNOT_VERIFY / executive blocked.
  const zeroRisk = judgment.atRisk.length === 0
    && !effectiveMissing
    && !boardUnresolved
    && !executiveBlocked
    && !hasCannotVerify;
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
    cases: portfolioGeneral ? cases : cases.filter((c) => c.project === anchorKey),
  });

  const preparedCount = effectiveMissing ? 0 : (Number(decision.preparedActions?.totalReady) || 0);
  const detailRows = filterRowsForDetail(commitmentRows);
  const evidenceFocusKey = portfolioGeneral
    ? String(judgment.leadingSquad?.projectKey || anchorKey || '').toUpperCase()
    : anchorKey;
  const attentionEvidence = zeroRisk
    ? { rows: [], active: [], quarantine: [], total: 0, activeCount: 0, quarantineCount: 0 }
    : buildAttentionEvidenceRows({
      commitmentRows: portfolioGeneral
        ? buildCommitmentRealityRows({
          brief,
          anchorKey: evidenceFocusKey,
          cases: cases.filter((c) => c.project === evidenceFocusKey),
          baselineMissing: isBaselineMissingForProject(brief, evidenceFocusKey, baselineMode),
        }).map((row) => ({
          ...row,
          issueUrl: row.issueUrl || resolveJiraBrowseUrl(brief, row.issueKey),
        }))
        : commitmentRows,
      brief,
      resolveIssueUrl: (key) => resolveJiraBrowseUrl(brief, key),
      focusProjectKey: evidenceFocusKey,
    });
  const evidenceCopyPack = buildEvidenceCopyPack(attentionEvidence);
  const causeLines = zeroRisk
    ? []
    : (attentionEvidence.rows.length
      ? attentionEvidence.rows.slice(0, 12).map((e) => ({
        text: `${e.title} — ${e.relevanceLabel}`,
        title: e.title,
        clause: e.lifecycleStage === 'not-planned' || e.verdict === 'not-planned'
          ? ' is on the PI plan and in Jira, but has no stories on the selected boards yet'
          : ` — ${e.relevanceLabel}`,
        issueKey: e.issueKey,
        issueUrl: e.issueUrl,
        relevanceTier: e.relevanceTier,
      }))
      : buildCauseLines({ commitmentRows, brief }));

  const conflictBanner = (() => {
    if (quarterMismatch) {
      return {
        severity: 'critical',
        text: `${readinessForAnchor.piName || 'The uploaded PI plan'} is outside ${periodKey || 'the selected quarter'}. It is quarantined and cannot influence this judgment.`,
      };
    }
    if (executiveBlocked) {
      return {
        severity: 'critical',
        text: 'Data conflict — delivery pulse is Blocked. Treat Blocked / missing baseline as authoritative over calm commitment copy.',
      };
    }
    if (hasCannotVerify && !zeroRisk) {
      return {
        severity: 'warning',
        text: 'One or more squads still need a PI slide — Alignment Studio upload before treating board-gap scores as complete.',
      };
    }
    return null;
  })();

  return {
    leadingSquad: judgment.leadingSquad?.projectKey || anchorKey,
    leadingSquadName: judgment.leadingSquad?.squadName || squadName,
    headline: sincePrefix + buildHeadline({
      judgment,
      baselineProvenance,
      periodKey,
      zeroRisk,
      baselineMissing: effectiveMissing,
      boardUnresolved,
      anchorKey: portfolioGeneral ? PORTFOLIO_ALL : anchorKey,
      summary,
      portfolioGeneral,
      baselineCoverage,
      attentionBreakdown,
    }),
    portfolioGeneral,
    causeLines,
    /** Plain-text fallback for markdown / older consumers */
    causeLineTexts: causeLines.map((c) => (typeof c === 'string' ? c : c.text)),
    attentionEvidence,
    evidenceCopyPack,
    conflictBanner,
    deliveraCompleted: buildDeliveraCompleted({
      epicLineage: decision.epicLineage,
      baselineProvenance,
      preparedActions: decision.preparedActions,
      sinceLastRun: brief.meta?.sinceLastRun,
      brief,
      baselineMissing: effectiveMissing,
    }),
    deliveraPrepared: preparedCount > 0
      ? `${preparedCount} evidence request${preparedCount === 1 ? '' : 's'} drafted and ready for review`
      : (effectiveMissing ? 'Upload a PI baseline slide before drafting evidence requests' : ''),
    humanDecision: zeroRisk ? null : humanDecision,
    primaryAction: zeroRisk
      ? 'Inspect portfolio evidence'
      : effectiveMissing
        ? 'Upload PI baseline slide'
        : boardUnresolved
          ? 'Align board in Alignment Studio'
          : (attentionEvidence.total > 0 ? 'Review board-gap evidence' : 'Review and record governance decision'),
    primaryActionTarget: effectiveMissing
      ? 'alignment-studio-slide'
      : boardUnresolved
        ? 'alignment-studio-board'
        : (attentionEvidence.total > 0 ? 'expand-evidence' : 'record-decision'),
    evidenceAction: effectiveMissing
      ? 'Upload PI baseline slide'
      : detailRows.length
        ? `Inspect ${detailRows.length} promise${detailRows.length === 1 ? '' : 's'} that need action`
        : 'Inspect promise-to-Jira trace',
    exposureLine: zeroRisk || effectiveMissing
      ? ''
      : formatMetricsStrip({ linked: summary.linked, total: summary.total, needAttention: summary.unsupported }),
    metricsLine: formatMetricsStrip({ linked: summary.linked, total: summary.total, needAttention: summary.unsupported }),
    needAttentionCount: summary.unsupported,
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
      baselineMissing: effectiveMissing,
    }),
    zeroRisk,
    partialSquads,
    baselineMissing: effectiveMissing,
    baselineReadinessByProject: resolveBaselineReadinessByProject(
      brief,
      (decision.insights || brief.squadInsights || []).map((i) => i.projectKey),
      baselineMode,
    ),
    stale: String(brief?.freshness?.confidenceLimit || '').toLowerCase() === 'stale',
    writesDisabled: String(brief?.freshness?.confidenceLimit || '').toLowerCase() === 'stale',
    atRiskSquads: judgment.atRisk,
    evidenceFocusKey,
  };
}

export function buildSponsorBrief(priorityBrief = {}, decision = {}) {
  const lines = [];
  lines.push(`# Governance brief — ${decision.periodKey || 'Current quarter'}`);
  lines.push('');
  lines.push(`**Verdict:** ${priorityBrief.headline || ''}`);
  const causes = priorityBrief.causeLineTexts
    || (priorityBrief.causeLines || []).map((c) => (typeof c === 'string' ? c : c.text));
  if (causes.length) {
    lines.push('');
    lines.push('**Cause:**');
    for (const c of causes) lines.push(`- ${c}`);
  }
  lines.push('');
  lines.push(`**Delivera completed:** ${priorityBrief.deliveraCompleted || ''}`);
  if (priorityBrief.humanDecision?.text) {
    lines.push('');
    lines.push(`**Decision required:** ${priorityBrief.humanDecision.text}`);
    if (priorityBrief.humanDecision.owner) lines.push(`**Owner:** ${priorityBrief.humanDecision.owner}`);
    if (priorityBrief.humanDecision.dueAt) lines.push(`**Due:** ${formatDate(priorityBrief.humanDecision.dueAt) || priorityBrief.humanDecision.dueAt}`);
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
