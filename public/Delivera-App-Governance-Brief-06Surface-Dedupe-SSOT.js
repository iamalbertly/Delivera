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

/**
 * @returns {{ doNowActions, drawerIssues, measurementRisks, proofRows }}
 */
export function partitionBriefSurfaces(brief) {
  const seen = new Set();
  const all = sortRisks([
    ...(brief?.topRisks || []),
    ...(brief?.portfolioRisks || []),
  ]);

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

  const proofRows = sortRisks([
    ...(brief?.topRisks || []),
    ...(brief?.portfolioRisks || []),
    ...(brief?.risks || []),
  ]);

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
