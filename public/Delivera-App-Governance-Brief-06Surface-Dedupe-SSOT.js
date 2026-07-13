/**
 * SSOT: partition brief risks into non-overlapping UI surfaces.
 */
import { buildCadencePackState } from './Delivera-App-Governance-Cadence-01Pack-Render-UI.js';

const ESC_ORDER = { escalate: 0, 'act-today': 1, watch: 2 };

function riskKey(r) {
  if (r.issueKey) return String(r.issueKey).toUpperCase();
  return `sq:${r.squad || ''}:${r.riskType || ''}`;
}

function isDelivery(r) {
  return r.audience === 'delivery' || (!r.audience && r.issueKey);
}

function isMeasurement(r) {
  return r.audience === 'measurement' || r.riskType === 'data-confidence-gap'
    || r.riskType === 'insufficient-delivery-evidence'
    || r.riskType === 'no-active-sprint';
}

function sortRisks(list) {
  return [...list].sort((a, b) => (ESC_ORDER[a.escalation] ?? 3) - (ESC_ORDER[b.escalation] ?? 3));
}

function normPk(value) {
  return String(value || '').trim().toUpperCase();
}

/** Client port of risksForSquad — filter risks to selected project keys. */
export function filterRisksForProjects(risks = [], projectKeys = []) {
  const keys = (Array.isArray(projectKeys) ? projectKeys : [])
    .map(normPk)
    .filter(Boolean);
  if (!keys.length || keys.length > 1) return risks;
  const PK = keys[0];
  const prefix = `${PK}-`;
  return risks.filter((r) => {
    const ik = normPk(r.issueKey);
    if (ik && ik.startsWith(prefix)) return true;
    const squad = normPk(r.squad);
    if (squad && (squad.includes(PK) || PK.includes(squad.split(/\s/)[0] || ''))) return true;
    return false;
  });
}

/**
 * @returns {{ doNowActions, drawerIssues, measurementRisks, proofRows }}
 */
export function partitionBriefSurfaces(brief, projectKeys = null) {
  const seen = new Set();
  const selected = projectKeys ?? (Array.isArray(brief?.projects) ? brief.projects : []);
  const poolTop = filterRisksForProjects(brief?.topRisks || [], selected);
  const poolPortfolio = filterRisksForProjects(brief?.portfolioRisks || [], selected);
  const all = sortRisks([...poolTop, ...poolPortfolio]);

  const measurementRisks = all.filter(isMeasurement).slice(0, 4);
  const deliveryPool = all.filter((r) => isDelivery(r) && !isMeasurement(r));

  const drawerIssues = [];
  const doNowActions = [];

  for (const r of deliveryPool) {
    const key = riskKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    drawerIssues.push(r);
    if (doNowActions.length < 3 && (r.issueKey || r.recommendedAction)) {
      doNowActions.push({
        issueKey: r.issueKey || '',
        issueUrl: r.issueUrl || '',
        assigneeName: r.assigneeName || r.owner || '',
        actionPlain: plainAction(r),
        displayTitle: r.displayTitle || r.summary || r.issueKey || 'Follow up',
        escalation: r.escalation || 'watch',
      });
    }
  }

  const proofRows = [];
  const poolRisks = filterRisksForProjects(brief?.risks || [], selected);
  for (const r of sortRisks([...poolTop, ...poolPortfolio, ...poolRisks])) {
    const key = riskKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    proofRows.push(r);
  }

  return { doNowActions, drawerIssues, measurementRisks, proofRows };
}

function plainAction(risk) {
  const raw = String(risk.recommendedAction || '').trim();
  if (!raw) return 'Confirm the next step today.';
  return raw
    .replace(/SP field mapping/gi, 'story point setup')
    .replace(/Confirm whether/gi, 'Check')
    .slice(0, 120);
}

function ownerKey(risk) {
  const name = String(risk.assigneeName || risk.owner || '').trim();
  if (name && !/^unassigned$/i.test(name)) return name;
  return String(risk.decisionNeededFrom || 'Unassigned lane').trim();
}

/**
 * Group delivery issues by assignee or decision lane for owner action clusters.
 * @returns {Array<{ ownerKey, assigneeName, decisionLane, issues: object[], commonReason: string }>}
 */
export function groupDoNowByOwner(drawerIssues = []) {
  const map = new Map();
  for (const r of drawerIssues) {
    if (!r.issueKey && !r.recommendedAction) continue;
    const key = ownerKey(r);
    if (!map.has(key)) {
      map.set(key, {
        ownerKey: key,
        assigneeName: r.assigneeName || r.owner || '',
        decisionLane: r.decisionNeededFrom || '',
        issues: [],
        commonReason: '',
      });
    }
    map.get(key).issues.push(r);
  }
  for (const g of map.values()) {
    const hours = g.issues.map((i) => Number(i.ageHours) || 0).filter((h) => h > 0);
    const maxH = hours.length ? Math.max(...hours) : 0;
    if (maxH >= 48) g.commonReason = `no progress for ${Math.round(maxH / 24)} days`;
    else if (maxH >= 24) g.commonReason = `no progress for ${Math.round(maxH)} hours`;
    else g.commonReason = g.issues[0]?.evidence?.slice(0, 80) || 'needs follow-up today';
  }
  return Array.from(map.values()).sort((a, b) => b.issues.length - a.issues.length);
}

/**
 * Portfolio command surface — canonical counts for viewport dedupe.
 * @returns {{ exposedCommitments: number, actionsReady: number, poResponsesRequired: number, proofLevel: string }}
 */
export function portfolioCanonicalCounts(decision = {}) {
  const above = decision.aboveFold || {};
  const trust = decision.trust || {};
  const mon = decision.monitoring || {};
  return {
    exposedCommitments: above.exposedCommitments ?? mon.exposedCommitmentCount ?? (decision.affectedCommitments || []).length,
    actionsReady: above.actionsReady ?? trust.nudgesReady ?? 0,
    poResponsesRequired: above.poResponsesRequired ?? 0,
    proofLevel: trust.proofLevel || 'Medium',
  };
}

/** SSOT: primary portfolio CTA lives only on the decision rail mount. */
export const PORTFOLIO_PRIMARY_CTA_MOUNT_ID = 'portfolio-decision-mount';

/** SSOT: decision headline lives only on the decision rail mount. */
export const PORTFOLIO_HEADLINE_MOUNT_ID = 'portfolio-decision-mount';

function normalizeCommitmentText(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function commitmentTokenSet(value = '') {
  return new Set(
    normalizeCommitmentText(value)
      .split(/\W+/)
      .filter((token) => token.length > 2),
  );
}

function commitmentJaccard(a = '', b = '') {
  const left = commitmentTokenSet(a);
  const right = commitmentTokenSet(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  left.forEach((token) => {
    if (right.has(token)) overlap += 1;
  });
  return overlap / (left.size + right.size - overlap);
}

/** Merge duplicate Reason/Decision lines when text is equal, substring, or near-duplicate. */
export function shouldMergeCommitmentLines(reason = '', move = '') {
  const normalizedReason = normalizeCommitmentText(reason);
  const normalizedMove = normalizeCommitmentText(move);
  if (!normalizedReason || !normalizedMove) return false;
  if (normalizedReason === normalizedMove) return true;
  if (normalizedReason.includes(normalizedMove) || normalizedMove.includes(normalizedReason)) return true;
  return commitmentJaccard(reason, move) >= 0.55;
}

/** Dedupe affected commitments by issueKey (first wins). */
export function dedupeCommitmentsByIssueKey(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((c) => {
    const key = String(c.issueKey || c.issueKeys?.[0] || c.id || '').trim().toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Hide prepared-actions stream when empty — count badge links to Actions. */
export function shouldHidePreparedActionsSection(decision = {}, brief = {}) {
  const items = decision?.preparedActions?.items || [];
  const groups = decision?.preparedActions?.groups || [];
  const totalReady = Number(decision?.preparedActions?.totalReady) || 0;
  return !items.length && !groups.some((g) => Number(g.count) > 0) && totalReady <= 0;
}

export function maxStaleHoursFromBrief(brief = {}) {
  const rows = brief?.evidencePack?.rows || [];
  let maxH = 0;
  for (const row of rows) {
    const why = String(row?.whyFlagged || '');
    const m = why.match(/(\d+)\s*h/i) || why.match(/stale\s+(\d+)/i);
    if (m) maxH = Math.max(maxH, Number(m[1]) || 0);
  }
  return maxH;
}

/** Trust chip label when sprint cadence is stale or blocked (1-second skim SSOT). */
export function deriveTrustChipLabel(brief = {}, decision = {}) {
  const cadence = buildCadencePackState(brief);
  const verdict = String(brief?.executiveView?.verdictTier || '').toLowerCase();
  if (verdict === 'blocked' || cadence.status === 'stalled' || cadence.movementHealth === 'blocked') {
    const stale = cadence.staleDays >= 1 ? `${Math.round(cadence.staleDays)}d stale` : '';
    return stale ? `DELIVERY BLOCKED · ${stale}` : 'DELIVERY BLOCKED';
  }
  if (cadence.status === 'ended' && cadence.daysSinceEnd != null && cadence.daysSinceEnd >= 14) {
    return `No sprint · ${cadence.daysSinceEnd}d gap`;
  }
  const proof = decision?.trust?.proofLevel || decision?.dataTrust?.confidenceLabel || '';
  if (proof && String(proof).toLowerCase() !== 'medium') return String(proof);
  return '';
}

/** Downgrade confidence when blocked + stale + low done ratio (trust SSOT). */
export function applyHonestTrustClamp(brief = {}, decision = {}) {
  const verdict = String(brief?.executiveView?.verdictTier || '').toLowerCase();
  const selected = (brief?.projects || []).map((p) => String(p).toUpperCase());
  const squad = (brief?.squadInsights || []).find((s) => selected.includes(String(s.projectKey || '').toUpperCase()))
    || brief?.squadInsights?.[0];
  const committed = Number(squad?.sprintPulse?.committed) || 0;
  const done = Number(squad?.sprintPulse?.done) || 0;
  const ratio = committed > 0 ? done / committed : 1;
  const staleH = maxStaleHoursFromBrief(brief);
  const cadence = buildCadencePackState(brief);
  const stalledSprint = cadence.status === 'stalled'
    || cadence.movementHealth === 'blocked'
    || (cadence.staleDays >= 7 && ratio < 0.15);
  const forceLow = verdict === 'blocked' || ratio < 0.15 || staleH > 72 || stalledSprint;
  if (!forceLow) return { brief, decision };
  const nextBrief = { ...brief };
  if (nextBrief.leadershipNarrative) {
    nextBrief.leadershipNarrative = { ...nextBrief.leadershipNarrative, confidence: 'low' };
  }
  const nextDecision = decision ? { ...decision } : {};
  if (nextDecision.trust) {
    nextDecision.trust = { ...nextDecision.trust, proofLevel: 'Low' };
  }
  if (nextDecision.dataTrust) {
    nextDecision.dataTrust = { ...nextDecision.dataTrust, confidenceLabel: 'Low' };
  }
  if (nextDecision.evidenceBreakdown) {
    nextDecision.evidenceBreakdown = { ...nextDecision.evidenceBreakdown, confidenceLabel: 'Low' };
  }
  if (nextDecision.priorityBrief?.recovery) {
    nextDecision.priorityBrief = {
      ...nextDecision.priorityBrief,
      recovery: { ...nextDecision.priorityBrief.recovery, confidence: 'low', outlook: 'unlikely' },
      recoveryLine: nextDecision.priorityBrief.recoveryLine
        ? String(nextDecision.priorityBrief.recoveryLine).replace(/Medium confidence/i, 'Low confidence')
        : nextDecision.priorityBrief.recoveryLine,
    };
  }
  return { brief: nextBrief, decision: nextDecision };
}

/** When compare cards share the same root issue, surface deltas instead of duplicate copy. */
export function enrichComparisonForDiffOnly(comparison = {}) {
  const cards = Array.isArray(comparison.cards) ? [...comparison.cards] : [];
  if (cards.length < 2) return comparison;
  const issues = cards.map((c) => String(c.mainIssue || '').trim()).filter(Boolean);
  const shared = issues.length >= 2 && issues.every((i) => i === issues[0]);
  if (!shared) return comparison;
  const sharedRoot = issues[0];
  return {
    ...comparison,
    sharedRootIssue: sharedRoot,
    cards: cards.map((c) => {
      const m = c.metrics || {};
      const delivered = Number(m.delivered) || 0;
      const gaps = Number(c.affectedCommitmentCount) || 0;
      return {
        ...c,
        mainIssue: `${c.projectKey}: ${delivered}% done · ${gaps} gaps`,
        sharedRootIssue: sharedRoot,
      };
    }),
  };
}

/** Setup gaps when PI focus strip owns baseline CTA. */
export function filterSetupGapsForPiFocus(brief = {}) {
  const gaps = brief?.meta?.setupGaps || [];
  if (brief?.meta?.piFocus?.synergy !== 'low') return gaps;
  return gaps.filter((g) => g.action !== 'set-baseline');
}

/** Single SSOT for which surfaces may show baseline entry CTAs. */
export function resolveBaselineEntryPoint(brief = {}) {
  const gaps = brief?.meta?.setupGaps || [];
  const hasBaselineGap = gaps.some((g) => g.action === 'set-baseline');
  const piFocusOwns = brief?.meta?.piFocus?.synergy === 'low';
  const hideDupes = hasBaselineGap && piFocusOwns;
  return {
    hasBaselineGap,
    piFocusOwns,
    hideDuplicateBaselineCtAs: hideDupes || piFocusOwns,
    showScopeCadenceBaselineCta: hasBaselineGap && !piFocusOwns,
    showPiFocusStrip: piFocusOwns && hasBaselineGap,
    primaryTestId: piFocusOwns ? 'gov-pi-focus-set-baseline' : 'gov-scope-baseline',
  };
}
