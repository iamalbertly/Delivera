/**
 * SSOT: partition brief risks into non-overlapping UI surfaces.
 */
import { readContinuityTokens } from './Delivera-Shared-Continuity-Link-01Build.js';

const ESC_ORDER = { escalate: 0, 'act-today': 1, watch: 2 };

const RISK_TYPE_LABELS = {
  'stale-in-progress': 'Stale in progress',
  'late-scope': 'Added after sprint start',
  'missing-owner': 'No owner',
  'po-decision-needed': 'Product Owner decision needed',
  dependency: 'Cross-team dependency',
  'no-active-sprint': 'No active sprint',
  'missing-estimate': 'Missing estimate',
  'no-log': 'No time logged',
  carryover: 'Carryover from prior sprint',
  'data-confidence-gap': 'Data confidence gap',
  'insufficient-delivery-evidence': 'Insufficient delivery evidence',
};

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

function filterRisksForSingleProject(risks, PK) {
  const prefix = `${PK}-`;
  return risks.filter((r) => {
    const ik = normPk(r.issueKey);
    if (ik && ik.startsWith(prefix)) return true;
    const squad = normPk(r.squad);
    if (squad && (squad.includes(PK) || PK.includes(squad.split(/\s/)[0] || ''))) return true;
    return false;
  });
}

/** Resolve spotlight/squad tunnel key — wins over multi-project CSV. */
export function resolveRiskFocusKey(projectKeys = null) {
  const continuity = typeof window !== 'undefined' ? readContinuityTokens() : { squad: '', view: '' };
  const fromUrl = normPk(continuity.squad);
  if (fromUrl && (continuity.view === 'squad' || continuity.view === '')) return fromUrl;
  if (fromUrl) return fromUrl;
  const keys = (Array.isArray(projectKeys) ? projectKeys : [])
    .map(normPk)
    .filter(Boolean);
  if (keys.length === 1) return keys[0];
  return '';
}

/** Client port of risksForSquad — filter risks to selected project keys or focus override. */
export function filterRisksForProjects(risks = [], projectKeys = [], focusKey = '') {
  const focus = normPk(focusKey);
  if (focus) return filterRisksForSingleProject(risks, focus);
  const keys = (Array.isArray(projectKeys) ? projectKeys : [])
    .map(normPk)
    .filter(Boolean);
  if (!keys.length || keys.length > 1) return risks;
  return filterRisksForSingleProject(risks, keys[0]);
}

export function riskTypeLabelClient(riskType) {
  return RISK_TYPE_LABELS[String(riskType || '').toLowerCase()] || 'Delivery risk';
}

/** One deterministic relevance line per risk card. */
export function formatRiskRelevanceLine(risk = {}) {
  const typeLabel = riskTypeLabelClient(risk.riskType || risk.rule || '');
  const squad = normPk(risk.squad || risk.projectKey || '');
  const age = Number(risk.ageHours);
  const agePart = Number.isFinite(age) && age > 0 ? `${Math.round(age)}h` : '';
  if (!risk.issueKey && squad) {
    const rule = String(risk.riskType || risk.rule || '').trim();
    return [typeLabel, agePart, squad, rule && rule !== typeLabel.toLowerCase() ? rule.replace(/-/g, ' ') : ''].filter(Boolean).join(' · ');
  }
  return [typeLabel, agePart, squad].filter(Boolean).join(' · ');
}

/** Authoritative unique risk count for bento / proof list sync. */
export function countUniqueProofRows(surfaces = {}) {
  return Array.isArray(surfaces.proofRows) ? surfaces.proofRows.length : 0;
}

/**
 * @returns {{ doNowActions, drawerIssues, measurementRisks, proofRows, proofCount }}
 */
export function partitionBriefSurfaces(brief, projectKeys = null) {
  const selected = projectKeys ?? (Array.isArray(brief?.projects) ? brief.projects : []);
  const focusKey = resolveRiskFocusKey(selected);
  const filterKeys = focusKey ? [focusKey] : selected;
  const poolTop = filterRisksForProjects(brief?.topRisks || [], filterKeys, focusKey);
  const poolPortfolio = filterRisksForProjects(brief?.portfolioRisks || [], filterKeys, focusKey);
  const poolRisks = filterRisksForProjects(brief?.risks || [], filterKeys, focusKey);
  const all = sortRisks([...poolTop, ...poolPortfolio]);

  const measurementRisks = all.filter(isMeasurement).slice(0, 4);
  const deliveryPool = all.filter((r) => isDelivery(r) && !isMeasurement(r));

  const doNowSeen = new Set();
  const drawerIssues = [];
  const doNowActions = [];

  for (const r of deliveryPool) {
    const key = riskKey(r);
    if (doNowSeen.has(key)) continue;
    doNowSeen.add(key);
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

  const proofSeen = new Set();
  const proofRows = [];
  for (const r of sortRisks([...poolTop, ...poolPortfolio, ...poolRisks])) {
    const key = riskKey(r);
    if (proofSeen.has(key)) continue;
    proofSeen.add(key);
    proofRows.push(r);
  }

  return {
    doNowActions,
    drawerIssues,
    measurementRisks,
    proofRows,
    proofCount: proofRows.length,
  };
}

/**
 * When Active Loop owns the page, suppress Do-first actions that restate the primary verb.
 */
export function suppressDoNowWhenActiveLoop(surfaces = {}) {
  if (typeof document !== 'undefined' && document.body?.classList?.contains('governance-active-loop-ready')) {
    return { ...surfaces, doNowActions: [] };
  }
  return surfaces;
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
