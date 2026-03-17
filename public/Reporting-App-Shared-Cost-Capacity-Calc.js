import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

export function buildTrustBadge(dataQuality) {
  if (!dataQuality) return null;
  const band = dataQuality.trustBand || 'Weak';
  let tone = 'weak';
  if (band === 'Strong') tone = 'strong';
  else if (band === 'Mixed') tone = 'mixed';

  const label = band;
  const tooltipParts = [];
  if (typeof dataQuality.spCoverage === 'number') {
    tooltipParts.push(`SP coverage ${(dataQuality.spCoverage * 100).toFixed(0)}%`);
  }
  if (typeof dataQuality.dateCoverage === 'number') {
    tooltipParts.push(`Sprint date coverage ${(dataQuality.dateCoverage * 100).toFixed(0)}%`);
  }
  if (typeof dataQuality.timesheetCoverage === 'number') {
    tooltipParts.push(`Timesheet coverage ${(dataQuality.timesheetCoverage * 100).toFixed(0)}%`);
  }
  if (typeof dataQuality.epicHygiene === 'number') {
    tooltipParts.push(`Epic hygiene ${(dataQuality.epicHygiene * 100).toFixed(0)}%`);
  }

  return {
    label,
    tone,
    tooltip: tooltipParts.join(' · '),
  };
}

export function formatCostPerSPDisplay(kpi) {
  if (!kpi || kpi.costPerSP == null) return null;
  const prefix = kpi.dataQuality && kpi.dataQuality.timesheetCoverage === 0 ? '(~) ' : '';
  return `${prefix}$${Number(kpi.costPerSP).toFixed(0)}`;
}

export function formatOverheadDisplay(kpi) {
  if (!kpi || kpi.avgOverheadPct == null) return null;
  return `${Number(kpi.avgOverheadPct).toFixed(1)}%`;
}

export function buildUtilizationDisplay(kpi) {
  if (!kpi) return { text: 'No data', status: 'no-data' };
  if (kpi.utilizationPct == null) {
    if (kpi.dataQuality && kpi.dataQuality.timesheetCoverage === 0) {
      return {
        text: 'N/A — timesheets needed',
        status: 'no-data',
      };
    }
    return { text: 'No data', status: 'no-data' };
  }
  return {
    text: `${Number(kpi.utilizationPct).toFixed(0)}%`,
    status: 'on-target',
  };
}

