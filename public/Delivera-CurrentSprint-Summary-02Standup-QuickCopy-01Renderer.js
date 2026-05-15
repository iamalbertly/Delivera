import { buildSprintAtAGlanceBriefing } from './Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';

/**
 * Max 5 lines for stand-up quick copy — time left, top risk + why, next action.
 */
export function renderStandupQuickCopyLines(data) {
  const briefing = buildSprintAtAGlanceBriefing(data);
  return (briefing.quickClipboardLines || []).slice(0, 5);
}

export function renderStandupQuickCopyText(data) {
  return renderStandupQuickCopyLines(data).join('\n');
}
