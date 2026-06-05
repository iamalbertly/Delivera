/**
 * SSOT: partition brief risks into non-overlapping UI surfaces.
 */
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
