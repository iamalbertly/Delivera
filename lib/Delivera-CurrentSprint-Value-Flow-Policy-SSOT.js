/**
 * Deterministic value, flow and communication policy for sprint interventions.
 * No function in this module may invent people, value, dependency or timing facts.
 */
const clean = (value, limit = 500) => String(value ?? '').trim().slice(0, limit);
const number = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const normalizeSquad = (value) => {
  const key = clean(value, 30).toUpperCase();
  return ({ DMS: 'SD', 'T-SQUAD': 'TRS', AMS: 'AMS2', BIOMETRIC: 'BIO' })[key] || key;
};

export function buildStrategicAnchor({ sprintName = '', squadKey = '', valueEvidence = {} } = {}) {
  const label = clean(sprintName, 120) || 'Sprint not named';
  const match = label.toUpperCase().match(/\bFY\d{2}([A-Z][A-Z0-9-]{1,8}?)(\d{2})\b/);
  const detectedSquad = match ? normalizeSquad(match[1]) : '';
  const activeSquad = normalizeSquad(squadKey);
  const conflict = Boolean(detectedSquad && activeSquad && detectedSquad !== activeSquad);
  const mission = clean(valueEvidence?.piObjectiveTitle || valueEvidence?.businessCase, 180);
  return {
    sprintLabel: label,
    missionTitle: conflict ? 'Mission quarantined — sprint scope conflicts' : (mission || 'Mission not mapped'),
    source: mission ? 'approved-pi-value' : 'unmapped',
    canonicalSquad: activeSquad,
    detectedSquad,
    conflict,
  };
}

export function buildBusinessTime({ currentAgeHours, p85CycleHours, baselineState, partialPermissions, stale } = {}) {
  if (partialPermissions || stale || baselineState !== 'ready') {
    return { state: 'unknown', label: 'Pace unknown — proof incomplete', businessDaysPastPace: null };
  }
  const age = number(currentAgeHours);
  const p85 = number(p85CycleHours);
  if (age == null || p85 == null) {
    return { state: 'unknown', label: 'Pace unknown — proof incomplete', businessDaysPastPace: null };
  }
  const days = Math.max(0, Math.round(((age - p85) / 24) * 5 / 7));
  return days > 0
    ? { state: 'past-pace', label: `Approximately ${days} business day${days === 1 ? '' : 's'} beyond this squad’s sustainable pace`, businessDaysPastPace: days }
    : { state: 'within-pace', label: 'Within this squad’s sustainable pace', businessDaysPastPace: 0 };
}

export function buildHumanImpact({ valueEvidence = {}, story = {} } = {}) {
  const explicit = clean(valueEvidence?.businessValue || valueEvidence?.businessCase, 220);
  if (explicit) return { statement: explicit, evidenceSource: 'approved-pi-value', estimate: null };
  const haystack = `${clean(story?.summary)} ${clean(story?.labels)}`.toLowerCase();
  const category = /customer|cx|notification|field/.test(haystack) ? 'customer'
    : /efficien|manual|automat|operation/.test(haystack) ? 'efficiency'
      : /regulat|compliance|kyc/.test(haystack) ? 'regulatory'
        : /growth|revenue|sales/.test(haystack) ? 'growth' : 'delivery';
  const statements = {
    customer: 'Frontline teams are waiting on the intended customer journey; Jira does not prove a wider impact yet.',
    efficiency: 'The intended efficiency gain remains in delivery; no quantified saving is approved yet.',
    regulatory: 'The compliance outcome remains in delivery and requires acceptance evidence before it can be credited.',
    growth: 'The growth outcome remains in delivery; Jira does not yet prove the material result.',
    delivery: 'No approved material-value statement is available for this work.',
  };
  return { statement: statements[category], category, evidenceSource: 'deterministic-story-tags', estimate: null };
}

export function buildDependencyEvidence(story = {}, commitment = {}) {
  const rows = [];
  (story?.issueLinks || []).forEach((link) => {
    const type = link?.type || {};
    const inwardKey = clean(link?.inwardIssue?.key).toUpperCase();
    const outwardKey = clean(link?.outwardIssue?.key).toUpperCase();
    const relationship = clean(type?.name || type, 80);
    if (!/block|depend/i.test([relationship, type?.inward, type?.outward].map(clean).join(' '))) return;
    if (inwardKey) rows.push({ issueKey: inwardKey, direction: 'is-blocked-by', relationship: clean(type?.inward || relationship), source: 'jira-link', accessible: true });
    if (outwardKey) rows.push({ issueKey: outwardKey, direction: 'blocks', relationship: clean(type?.outward || relationship), source: 'jira-link', accessible: true });
  });
  const keys = Array.isArray(commitment?.dependencyIssueKeys) ? commitment.dependencyIssueKeys : [];
  keys.forEach((key, index) => rows.push({
    issueKey: clean(key).toUpperCase(),
    direction: 'blocks',
    relationship: 'Approved PI dependency',
    squadKey: normalizeSquad(commitment?.dependencySquadKeys?.[index] || ''),
    source: 'approved-baseline',
    accessible: true,
  }));
  return rows.filter((row, index, all) => row.issueKey
    && all.findIndex((candidate) => candidate.issueKey === row.issueKey && candidate.direction === row.direction) === index);
}

export function buildImpactScenario({ flowBaseline = {}, daysRemaining, currentWip, partialPermissions, stale, contextConflict } = {}) {
  const throughput = (flowBaseline?.throughput || []).map((row) => number(row?.completed)).filter((value) => value != null);
  if (partialPermissions || stale || contextConflict || flowBaseline?.state !== 'ready' || throughput.length < 3) {
    return { state: 'refused', label: 'Impact estimate unavailable — evidence is insufficient', refusalReason: 'insufficient-or-conflicted-evidence' };
  }
  const sorted = [...throughput].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const remaining = Math.max(0, number(daysRemaining, 0));
  const completionDelta = Math.max(0, Math.min(number(currentWip, 0), Math.round(median * remaining / 10)));
  const slipDelta = completionDelta > 0 ? Math.max(1, Math.round(number(flowBaseline?.medianCycleHours, 0) / 24)) : 0;
  return {
    state: 'available',
    completionDelta,
    scheduleDeltaBusinessDays: slipDelta,
    confidence: throughput.length >= 5 ? 'medium' : 'low',
    method: 'median-throughput-and-cycle-time-v1',
    label: `If this item unblocks today: approximately ${completionDelta} additional completion${completionDelta === 1 ? '' : 's'} in-window and ${slipDelta} fewer projected delay day${slipDelta === 1 ? '' : 's'}.`,
  };
}

export function buildCommunicationGuard({ stale, contextConflict, sendAllowed = true, selectedTone = 'supportive' } = {}) {
  const forced = stale || contextConflict || !sendAllowed;
  return {
    selectedTone,
    effectiveTone: forced ? 'information-only' : selectedTone,
    allowedTones: forced ? ['information-only'] : ['supportive', 'information-only', 'urgent'],
    sendAllowed: !forced,
    staleReason: forced ? 'Evidence is stale — facilitate offline and refresh before posting to Jira.' : '',
  };
}
