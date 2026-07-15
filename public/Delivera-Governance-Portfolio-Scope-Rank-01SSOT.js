/**
 * SSOT: Rank portfolio projects by data density for All Projects scope.
 * Order: (1) has PI baseline for focused quarter, (2) commitment count,
 * (3) board/issue volume proxy, (4) catalog order.
 */
export const PORTFOLIO_ALL = '__ALL__';
export const PORTFOLIO_ALL_LABEL = 'All Projects';
import { isDeliverySquad } from './Delivera-Shared-Projects-Catalog-01SSOT.js';

/**
 * @param {string[]} catalogKeys
 * @param {object} [densityByProject] map of projectKey → { hasBaseline, commitmentCount, issueVolume }
 */
export function rankProjectsByDataDensity(catalogKeys = [], densityByProject = {}) {
  const keys = (catalogKeys || [])
    .map((k) => String(k || '').trim().toUpperCase())
    .filter((k) => k && k !== PORTFOLIO_ALL && isDeliverySquad(k));
  const scored = keys.map((key, catalogIndex) => {
    const d = densityByProject[key] || densityByProject[String(key).toLowerCase()] || {};
    const hasBaseline = d.hasBaseline === true || d.hasBaseline === 1 ? 1 : 0;
    const commitments = Number(d.commitmentCount || d.commitments || 0) || 0;
    const volume = Number(d.issueVolume || d.boardIssues || d.openIssues || 0) || 0;
    return { key, hasBaseline, commitments, volume, catalogIndex };
  });
  scored.sort((a, b) => {
    if (b.hasBaseline !== a.hasBaseline) return b.hasBaseline - a.hasBaseline;
    if (b.commitments !== a.commitments) return b.commitments - a.commitments;
    if (b.volume !== a.volume) return b.volume - a.volume;
    return a.catalogIndex - b.catalogIndex;
  });
  return scored.map((s) => s.key);
}

/** Build density map from brief / baselines when available. */
export function densityFromBrief(brief = {}) {
  const out = {};
  const byProject = brief.baselineComparisonByProject || {};
  const readiness = brief.meta?.baselineReadinessByProject || brief.baselineReadinessByProject || {};
  const judgment = brief.portfolioJudgment?.squads || brief.priorityBrief?.portfolioJudgment?.squads || [];
  const allKeys = new Set([
    ...Object.keys(byProject),
    ...Object.keys(readiness),
    ...judgment.map((s) => String(s.projectKey || s.key || '').toUpperCase()).filter(Boolean),
  ]);
  for (const key of allKeys) {
    const K = String(key).toUpperCase();
    const cmp = byProject[K] || {};
    const ready = readiness[K] || {};
    const squad = judgment.find((s) => String(s.projectKey || s.key || '').toUpperCase() === K) || {};
    const items = Array.isArray(cmp.items) ? cmp.items.length : (Number(cmp.committedCount) || 0);
    out[K] = {
      hasBaseline: Boolean(ready.hasBaseline || cmp?.baseline?.committedItems?.length || items > 0),
      commitmentCount: items || Number(squad.commitmentCount) || 0,
      issueVolume: Number(squad.openCases || squad.unsupportedCount || squad.issueVolume || 0),
    };
  }
  return out;
}

export function isPortfolioAllAnchor(anchor = '') {
  return String(anchor || '').trim().toUpperCase() === PORTFOLIO_ALL;
}

/** True when no squad in scope has a PI baseline for the focused quarter. */
export function portfolioHasNoBaselines(brief = {}, projectKeys = []) {
  const readiness = brief.meta?.baselineReadinessByProject || {};
  const keys = (projectKeys || []).map((k) => String(k).toUpperCase()).filter((k) => k !== PORTFOLIO_ALL);
  if (!keys.length) {
    return !Object.values(readiness).some((r) => r?.hasBaseline);
  }
  return !keys.some((k) => readiness[k]?.hasBaseline);
}
