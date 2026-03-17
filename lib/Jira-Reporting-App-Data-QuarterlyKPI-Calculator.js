import fs from 'fs';
import path from 'path';

import { cache } from './cache.js';
import { buildPreviewCacheKey } from './preview-helpers.js';
import { getOutlierEpics, getOutlierSprints } from '../public/Reporting-App-Shared-Outlier-Engine.js';

function loadCostModel(projectRoot) {
  try {
    const explicitPath = path.join(projectRoot || process.cwd(), 'data', 'costModel.json');
    const examplePath = path.join(projectRoot || process.cwd(), 'data', 'costModel.example.json');
    let raw = null;
    if (fs.existsSync(explicitPath)) {
      raw = fs.readFileSync(explicitPath, 'utf8');
    } else if (fs.existsSync(examplePath)) {
      raw = fs.readFileSync(examplePath, 'utf8');
    }
    if (!raw) return { available: false, source: 'unavailable', model: null };
    const parsed = JSON.parse(raw);
    return {
      available: true,
      source: fs.existsSync(explicitPath) ? 'configured' : 'example',
      model: parsed,
    };
  } catch (err) {
    console.error('Failed to load cost model config', err); // eslint-disable-line no-console
    return { available: false, source: 'error', model: null };
  }
}

function bandStatus(value, band) {
  if (value == null || !band) return 'no-data';
  const { min, max } = band;
  if (typeof min === 'number' && value < min) return 'below-target';
  if (typeof max === 'number' && value > max) return 'above-target';
  return 'on-target';
}

function safeRatio(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(1, part / total));
}

function buildDataQualitySummary({ rows, sprintsIncluded, epicRows, costModelSource }) {
  const totalDone = rows.length || 0;
  const withSP = rows.filter((r) => typeof r.storyPoints === 'number' && r.storyPoints > 0).length;
  const withDates = sprintsIncluded.filter((s) => s.startDate && s.endDate).length;
  const timesheetRows = rows.filter((r) =>
    typeof r.timeSpentHours === 'number'
    || typeof r.subtaskTimeSpentHours === 'number'
    || typeof r.loggedHours === 'number'
  );
  const epicTotal = epicRows.length || 0;
  const epicsWithDates = epicRows.filter((e) => e.startDate && e.resolutionDate).length;

  const spCoverage = safeRatio(withSP, totalDone);
  const dateCoverage = safeRatio(withDates, sprintsIncluded.length || 0);
  const timesheetCoverage = safeRatio(timesheetRows.length, totalDone);
  const epicHygiene = safeRatio(epicsWithDates, epicTotal);

  const floor = Math.min(spCoverage, dateCoverage, epicHygiene || 0);
  let trustBand = 'Weak';
  if (floor >= 0.95 && timesheetCoverage >= 0.5) trustBand = 'Strong';
  else if (floor >= 0.8) trustBand = 'Mixed';

  return {
    spCoverage,
    dateCoverage,
    timesheetCoverage,
    epicHygiene,
    trustBand,
    costModelSource,
    assumptions: {
      costPerSP: timesheetCoverage === 0 ? 'Model-only estimate until timesheets are logged.' : 'Uses configured cost model plus delivered story points.',
      utilization: timesheetCoverage === 0 ? 'Unavailable without timesheets.' : 'Uses available logged time as directional utilization evidence.',
    },
  };
}

function computeCostPerSP({ rows, costModel }) {
  if (!costModel || !Array.isArray(costModel.roles) || !costModel.roles.length) {
    return { value: null, status: 'no-data' };
  }
  const totalMonthlyCost = costModel.roles.reduce((sum, role) => {
    const monthly = typeof role.monthlyCostUSD === 'number' ? role.monthlyCostUSD : 0;
    return sum + monthly;
  }, 0);
  const totalSP = rows.reduce((sum, row) => (typeof row.storyPoints === 'number' ? sum + row.storyPoints : sum), 0);
  if (!totalSP) return { value: null, status: 'no-data' };
  const costPerSP = totalMonthlyCost / totalSP;
  return {
    value: costPerSP,
    status: bandStatus(costPerSP, costModel.costPerSPTargetBand),
  };
}

function computeOverheadPct(costModel) {
  if (!costModel || !costModel.overheadItemsMonthly) {
    return { value: null, status: 'no-data' };
  }
  const overhead = Object.values(costModel.overheadItemsMonthly).reduce((sum, value) => {
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
  const base = Array.isArray(costModel.roles)
    ? costModel.roles.reduce((sum, role) => sum + (typeof role.monthlyCostUSD === 'number' ? role.monthlyCostUSD : 0), 0)
    : 0;
  if (!base) return { value: null, status: 'no-data' };
  const pct = (overhead / base) * 100;
  return {
    value: pct,
    status: bandStatus(pct, costModel.overheadTargetBand),
  };
}

function computeUtilizationPct(rows, costModel) {
  const totalHours = rows.reduce((sum, row) => {
    const explicitHours = typeof row.timeSpentHours === 'number'
      ? row.timeSpentHours
      : (typeof row.subtaskTimeSpentHours === 'number' ? row.subtaskTimeSpentHours : null);
    return sum + (explicitHours || 0);
  }, 0);
  if (!totalHours) return { value: null, source: 'unavailable' };
  const capacityHours = Array.isArray(costModel?.roles)
    ? costModel.roles.reduce((sum, role) => sum + (typeof role.monthlyCapacityHours === 'number' ? role.monthlyCapacityHours : 0), 0)
    : 0;
  if (!capacityHours) return { value: null, source: 'unavailable' };
  return {
    value: (totalHours / capacityHours) * 100,
    source: 'timesheets',
  };
}

function getPreviewPayloadFromCache({ projectKeys, windowStart, windowEnd }) {
  const cacheKey = buildPreviewCacheKey({
    selectedProjects: projectKeys,
    windowStart,
    windowEnd,
    includeStoryPoints: true,
    requireResolvedBySprintEnd: false,
    includeBugsForRework: true,
    includePredictability: true,
    predictabilityMode: 'approx',
    includeEpicTTM: true,
    includeActiveOrMissingEndDateSprints: false,
  });
  return cache.get(cacheKey, { namespace: 'preview' });
}

function buildQuarterlyKPIFromPayload({ payload, projectKeys, windowStart, windowEnd, projectRoot }) {
  if (!payload || !payload.rows || !payload.metrics) {
    return {
      projectKPIs: {},
      outlierEpics: [],
      outlierSprints: [],
      dataQuality: null,
      meta: { windowStart, windowEnd, generatedAt: null },
    };
  }

  const { rows, metrics, sprintsIncluded = [], epics = [], meta = {} } = payload;
  const costModelResult = loadCostModel(projectRoot);
  const dataQuality = buildDataQualitySummary({
    rows,
    sprintsIncluded,
    epicRows: epics,
    costModelSource: costModelResult.source,
  });

  const projectKPIs = {};
  projectKeys.forEach((projectKey) => {
    const projectRows = rows.filter((row) => row.projectKey === projectKey);
    const projectMetrics = metrics.projects?.[projectKey] || {};
    const predictability = metrics.predictability?.[projectKey] || { avgPredictabilityPct: null };
    const epicMetrics = metrics.epicTTM?.[projectKey] || { avgWorkingDays: null };

    let costPerSP = { value: null, status: 'no-data' };
    let overhead = { value: null, status: 'no-data' };
    let utilization = { value: null, source: 'unavailable' };

    if (costModelResult.available) {
      costPerSP = computeCostPerSP({ rows: projectRows, costModel: costModelResult.model });
      overhead = computeOverheadPct(costModelResult.model);
      utilization = computeUtilizationPct(projectRows, costModelResult.model);
    }

    projectKPIs[projectKey] = {
      throughputSP: projectMetrics.totalSP || projectRows.reduce((sum, row) => (typeof row.storyPoints === 'number' ? sum + row.storyPoints : sum), 0),
      epicTTMWorkingDays: epicMetrics.avgWorkingDays || null,
      avgPredictabilityPct: predictability.avgPredictabilityPct || null,
      reworkPct: projectMetrics.reworkPct || null,
      defectDensity: projectMetrics.defectDensity || null,
      velocityWithOvh: projectMetrics.velocityWithOvh || null,
      costPerSP: costPerSP.value,
      costPerSPStatus: costPerSP.status,
      avgOverheadPct: overhead.value,
      avgOverheadStatus: overhead.status,
      utilizationPct: utilization.value,
      utilizationSource: utilization.source,
      wastePct: projectMetrics.wastePct || null,
      dataQuality,
    };
  });

  return {
    projectKPIs,
    outlierEpics: getOutlierEpics(Array.isArray(metrics.epicTTM) ? metrics.epicTTM : []).slice(0, 5),
    outlierSprints: getOutlierSprints(metrics.predictability?.perSprint || {}).slice(0, 5),
    dataQuality,
    meta: {
      windowStart,
      windowEnd,
      generatedAt: meta.generatedAt || null,
      costModelSource: costModelResult.source,
    },
  };
}

export async function buildQuarterlyKPIForProjects({ projectKeys, windowStart, windowEnd, projectRoot }) {
  const cacheEntry = await getPreviewPayloadFromCache({ projectKeys, windowStart, windowEnd });
  return buildQuarterlyKPIFromPayload({
    payload: cacheEntry?.value || cacheEntry,
    projectKeys,
    windowStart,
    windowEnd,
    projectRoot,
  });
}

export {
  loadCostModel,
  buildQuarterlyKPIFromPayload,
};
