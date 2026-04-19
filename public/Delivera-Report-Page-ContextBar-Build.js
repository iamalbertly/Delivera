/**
 * SSOT chip list for report header + preview meta: one grammar for projects, range,
 * freshness, stale-context, rules, and (when preview exists) outcomes.
 */
import { chip } from './Reporting-App-Shared-ContextBar-Renderer.js';
import { getContextPieces, buildContextSegmentList } from './Reporting-App-Shared-Context-From-Storage.js';

export const REPORT_CONTEXT_BAR_TITLE = 'Current performance window';

function getRulesChip() {
  const options = [];
  if (typeof document !== 'undefined') {
    if (document.getElementById('require-resolved-by-sprint-end')?.checked) options.push('Require resolved by sprint end');
    if (document.getElementById('include-predictability')?.checked) options.push('Include Predictability');
  }
  const stripRules = options.length ? `${options.length} rule${options.length !== 1 ? 's' : ''}` : 'default rules';
  return chip('Rules', stripRules, { action: 'focus-config', tone: options.length ? 'highlight' : 'muted' });
}

/**
 * @param {{ outcomesCount?: number }} opts - When set, adds the Outcomes chip (after preview).
 */
export function buildUnifiedReportContextChips({ outcomesCount } = {}) {
  const pieces = getContextPieces();
  const segments = buildContextSegmentList(pieces);
  const chips = segments.map((segment) => {
    let action = '';
    if (segment.label === 'Projects') action = 'open-projects';
    else if (segment.label === 'Range') action = 'open-range';
    else if (segment.label === 'Context') action = 'refresh-context';
    return chip(segment.label, segment.value, { action });
  });
  chips.push(getRulesChip());
  if (typeof outcomesCount === 'number') {
    chips.push(chip('Outcomes', String(outcomesCount), { action: 'open-done-stories' }));
  }
  return chips;
}
