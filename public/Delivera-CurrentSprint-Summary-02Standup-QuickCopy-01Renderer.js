import { deriveSprintPhase, buildHealthLineForPhase } from './Delivera-CurrentSprint-Summary-01Facts-Verdict-SSOT.js';
import { getUnifiedRiskCounts } from './Delivera-CurrentSprint-Data-WorkRisk-Rows.js';

function asText(v) {
  return String(v == null ? '' : v).trim();
}

/**
 * Max 4 lines for stand-up quick copy — no Jira essay.
 */
export function renderStandupQuickCopyLines(data) {
  const sprint = data?.sprint || {};
  const board = data?.board || {};
  const summary = data?.summary || {};
  const phaseInfo = deriveSprintPhase(data);
  const risks = getUnifiedRiskCounts(data);
  const lines = [];
  const sprintLabel = asText(sprint.name) || 'Sprint';
  const boardLabel = asText(board.name) || 'Board';
  lines.push(`${boardLabel} · ${sprintLabel} · ${phaseInfo.label}`);
  lines.push(`Health: ${buildHealthLineForPhase(phaseInfo, data)}`);
  const riskParts = [];
  if (risks.blockersOwned > 0) riskParts.push(`${risks.blockersOwned} blocker${risks.blockersOwned === 1 ? '' : 's'}`);
  if (risks.unownedOutcomes > 0) riskParts.push(`${risks.unownedOutcomes} unowned`);
  const scopeCount = Array.isArray(data?.scopeChanges) ? data.scopeChanges.length : 0;
  if (scopeCount > 0) riskParts.push(`+${scopeCount} scope`);
  if (riskParts.length) {
    lines.push(`Risks: ${riskParts.join(' · ')}`);
  }
  const pctDone = Number(summary.percentDone || 0);
  if (pctDone > 0 && lines.length < 4) {
    lines.push(`Progress: ${pctDone}% stories complete`);
  }
  return lines.slice(0, 4);
}

export function renderStandupQuickCopyText(data) {
  return renderStandupQuickCopyLines(data).join('\n');
}
