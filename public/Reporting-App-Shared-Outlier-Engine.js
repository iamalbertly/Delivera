import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

export function getOutlierEpics(epicRows, thresholdWorkingDays = 90) {
  const rows = Array.isArray(epicRows) ? epicRows : [];
  if (rows.length < 2) return [];

  return rows
    .filter((epic) => typeof epic.workingDays === 'number' && epic.workingDays > thresholdWorkingDays)
    .sort((a, b) => b.workingDays - a.workingDays)
    .map((epic) => {
      const id = epic.epicKey || epic.key || epic.id;
      const label = epic.epicName || epic.summary || id;
      const value = epic.workingDays;
      const jiraHref = epic.url || epic.issueUrl || '';
      const rcaHint = 'TTM spike likely indicates planning under-commit, cross-sprint epic sprawl, or epic hygiene issues.';
      return {
        id,
        label,
        value,
        metric: 'Epic TTM (working days)',
        jiraHref,
        rcaHint,
      };
    });
}

export function getOutlierSprints(predictabilityPerSprint, lowThreshold = 80, highThreshold = 130) {
  const perSprint = predictabilityPerSprint && typeof predictabilityPerSprint === 'object'
    ? Object.entries(predictabilityPerSprint)
    : [];
  if (perSprint.length < 3) return [];

  const outliers = [];
  perSprint.forEach(([sprintId, metrics]) => {
    const value = typeof metrics.predictabilitySP === 'number' ? metrics.predictabilitySP : null;
    if (value == null) return;
    if (value < lowThreshold || value > highThreshold) {
      const jiraHref = metrics.url || '';
      let rcaHint = '';
      if (value > highThreshold) {
        rcaHint = 'Very high predictability may indicate under-commitment; consider stretching sprint commitments.';
      } else {
        rcaHint = 'Low predictability suggests unplanned spillover or scope changes; review sprint hygiene and mid-sprint adds.';
      }
      outliers.push({
        id: sprintId,
        label: metrics.name || sprintId,
        value,
        metric: 'Predictability (SP %)',
        jiraHref,
        rcaHint,
      });
    }
  });

  return outliers.sort((a, b) => Math.abs(b.value - 100) - Math.abs(a.value - 100));
}

