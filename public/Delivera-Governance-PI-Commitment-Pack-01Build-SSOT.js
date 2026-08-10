/**
 * Deterministic PI Commitment Pack — no AI tokens.
 * Builds a copy-ready summary from ActiveLoop promises + sprint reality already in memory.
 */

function clean(value, max = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return clean(value, 40);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function childTruth(promise = {}) {
  const actual = promise.expectedVsActual?.actual || {};
  const children = Array.isArray(actual.children) ? actual.children : [];
  const issueKeys = Array.isArray(actual.issueKeys) ? actual.issueKeys : [];
  const total = Number.isFinite(Number(actual.childTotal)) ? Number(actual.childTotal) : (children.length || issueKeys.length);
  const done = Number.isFinite(Number(actual.doneChildCount))
    ? Number(actual.doneChildCount)
    : children.filter((child) => /done|closed|resolved/i.test(String(child?.status || ''))).length;
  const reopened = Number.isFinite(Number(actual.reopenedChildCount))
    ? Number(actual.reopenedChildCount)
    : children.filter((child) => child?.reopened === true).length;
  const excluded = Number.isFinite(Number(actual.excludedChildCount)) ? Number(actual.excludedChildCount) : 0;
  const inaccessible = Number.isFinite(Number(actual.inaccessibleChildCount)) ? Number(actual.inaccessibleChildCount) : 0;
  const open = Math.max(0, Number.isFinite(Number(actual.openChildCount))
    ? Number(actual.openChildCount)
    : total - done - excluded);
  return { total, done, open, reopened, inaccessible };
}

function openStoriesHint(promise = {}) {
  const truth = childTruth(promise);
  if (truth.total) return `${truth.done}/${truth.total} children complete · ${truth.open} open · ${truth.reopened} reopened${truth.inaccessible ? ` · ${truth.inaccessible} inaccessible` : ''}`;
  if (promise.issueKey) return 'Linked Jira work present';
  return 'No linked stories verified';
}

function milestoneStatus(promise = {}) {
  const truth = childTruth(promise);
  const actual = promise.expectedVsActual?.actual || {};
  const accepted = Boolean(actual.acceptanceEvidence || promise.acceptanceProof || promise.acceptedAt);
  if (truth.inaccessible || /cannot verify|metadata/i.test(String(promise.diagnosisLabel || promise.matchLabel || ''))) return 'Cannot verify';
  if (truth.total && truth.open === 0 && truth.reopened === 0 && accepted) return 'Delivered';
  if (/block/i.test(String(promise.statusNow || actual.status || ''))) return 'Blocked';
  if ((truth.done || /done/i.test(String(actual.status || promise.statusNow || ''))) && (!accepted || truth.open || truth.reopened)) return 'Milestone delivered';
  return 'In progress';
}

function carryOverLine(promise = {}, monthLabel = '') {
  const month = clean(monthLabel, 20) || new Date().toLocaleDateString(undefined, { month: 'long' });
  const label = clean(promise.diagnosisLabel || promise.matchLabel || '', 80).toLowerCase();
  const status = clean(promise.statusNow || promise.expectedVsActual?.actual?.status || '', 40).toLowerCase();
  const truth = childTruth(promise);
  if (label.includes('proof pending') || (label.includes('done') && label.includes('proof'))) {
    return `${month} milestone may be claimed only with acceptance evidence; open work or proof gaps remain.`;
  }
  if (truth.open > 0) {
    return `Remaining open children and external dependencies carry into the next period.`;
  }
  if (label.includes('active sprint') || status.includes('progress')) {
    return `Work continued in the active sprint; treat ${month} dates as a milestone, not full epic close.`;
  }
  if (label.includes('metadata') || label.includes('cannot verify')) {
    return 'Dates are not PI-trusted until FY/quarter metadata is confirmed.';
  }
  return 'Status reflects verified Jira evidence only — unfinished stories block “done”.';
}

/** Child story min/max dates + counts for epic chips and packs. */
export function childDateEnvelope(promise = {}) {
  const actual = promise.expectedVsActual?.actual || {};
  const children = Array.isArray(actual.children) ? actual.children : [];
  let minStart = null;
  let maxEnd = null;
  const consider = (raw) => {
    if (!raw) return;
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t)) return;
    if (minStart == null || t < minStart) minStart = t;
    if (maxEnd == null || t > maxEnd) maxEnd = t;
  };
  for (const child of children) {
    consider(child?.startDate || child?.created || child?.firstInProgress || child?.plannedStartDate);
    consider(child?.endDate || child?.resolved || child?.updated || child?.targetDate || child?.plannedEndDate);
  }
  consider(actual.observedStart || actual.startDate);
  consider(actual.observedEnd || actual.endDate);
  consider(promise.fiscalStart || promise.startDate);
  consider(promise.fiscalEnd || promise.endDate);
  return {
    start: minStart != null ? new Date(minStart).toISOString() : '',
    end: maxEnd != null ? new Date(maxEnd).toISOString() : '',
    ...childTruth(promise),
  };
}

function resolveBrowseUrl(promise = {}, browseHost = '') {
  const direct = clean(promise.issueUrl || promise.browseUrl || '', 240);
  if (direct) return direct;
  const key = clean(promise.issueKey || '', 40);
  const host = clean(browseHost || promise.jiraBrowseHost || '', 120).replace(/\/+$/, '');
  if (key && host) return `${host}/browse/${key}`;
  if (key) return `https://vodacomtz.atlassian.net/browse/${key}`;
  return '';
}

function statusSentence(promise = {}, monthLabel = '') {
  const status = milestoneStatus(promise);
  const truth = childTruth(promise);
  const month = clean(monthLabel, 20) || 'PI';
  if (status === 'Delivered') {
    return `${month} Milestone Delivered. All ${truth.total || ''} verified children are complete with acceptance evidence.`.replace(/\s+/g, ' ').trim();
  }
  if (status === 'Milestone delivered') {
    return `${month} Milestone Delivered. Core delivery progressed (${truth.done}/${truth.total || truth.done} children); remaining open work or acceptance proof carries forward.`;
  }
  if (status === 'Blocked') return `Blocked. ${openStoriesHint(promise)}.`;
  if (status === 'Cannot verify') return `Cannot verify yet — PI metadata or Jira proof is incomplete.`;
  return `In progress. ${openStoriesHint(promise)}.`;
}

/**
 * @param {object} opts
 * @param {object[]} opts.promises
 * @param {object} [opts.squad]
 * @param {string} [opts.monthLabel]
 * @param {string} [opts.browseHost]
 * @returns {{ title: string, text: string, items: object[] }}
 */
export function buildPiCommitmentPack({ promises = [], squad = {}, monthLabel = '', browseHost = '', epicForecasts = [] } = {}) {
  const month = clean(monthLabel, 40) || new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const forecastByIssue = new Map((epicForecasts || []).map((forecast) => [
    clean(forecast.issueKey || forecast.commitmentId, 40).toUpperCase(),
    forecast,
  ]));
  const items = (promises || []).slice(0, 12).map((promise) => {
    const envelope = childDateEnvelope(promise);
    const forecast = forecastByIssue.get(clean(promise.issueKey || promise.commitmentId, 40).toUpperCase()) || {};
    const expectedStart = promise.expectedVsActual?.expected?.startDate || promise.fiscalStart || promise.startDate || forecast.plannedStart || '';
    const expectedEnd = promise.expectedVsActual?.expected?.endDate || promise.fiscalEnd || promise.endDate || forecast.plannedEnd || forecast.forecastEnd || '';
    const start = expectedStart || envelope.start || '';
    const end = expectedEnd || envelope.end || '';
    const plannedDates = `Start ${formatDate(start) || 'not verified'} · End ${formatDate(end) || 'not verified'}`;
    const actual = promise.expectedVsActual?.actual || {};
    const observedStart = actual.observedStart || actual.startDate || forecast.actualStart || envelope.start;
    const observedEnd = actual.observedEnd || actual.endDate || forecast.forecastEnd || envelope.end;
    const observedDates = `Start ${formatDate(observedStart) || 'not verified'} · Forecast end ${formatDate(observedEnd) || 'not verified'}`;
    const dependencies = Array.isArray(actual.dependencies) ? actual.dependencies : (Array.isArray(promise.dependencies) ? promise.dependencies : []);
    const status = milestoneStatus(promise);
    return {
      issueKey: clean(promise.issueKey || 'Unlinked', 40),
      issueUrl: resolveBrowseUrl(promise, browseHost),
      title: clean(promise.originalText || promise.summary || 'PI commitment', 180),
      status,
      statusSentence: statusSentence(promise, month),
      plannedDates,
      observedDates,
      openWork: openStoriesHint(promise),
      dependencies: dependencies.length ? dependencies.map((value) => clean(value?.issueKey || value, 60)).join(', ') : 'None verified',
      acceptance: actual.acceptanceEvidence || promise.acceptanceProof ? 'Verified' : 'Not verified',
      carryOver: carryOverLine(promise, month),
    };
  });

  const squadName = clean(squad.displayName || squad.squad || 'Selected squad', 80);
  const parallelNote = items.length > 1
    ? `We worked on these ${items.length} workstreams in parallel throughout ${month}, delivering the core functionality while carrying over specific dependencies.`
    : `Here is the update on our ${month} PI commitments for ${squadName}.`;

  const lines = [
    `Here is the update on our ${month} PI commitments for the ${squadName}. ${parallelNote}`,
    '',
  ];
  items.forEach((item) => {
    const epicLine = item.issueUrl
      ? `${item.title} (Epic: ${item.issueUrl})`
      : `${item.title} (Epic: ${item.issueKey})`;
    lines.push(epicLine);
    lines.push(`Dates: ${item.plannedDates}`);
    lines.push(`Observed: ${item.observedDates}`);
    lines.push(`Status: ${item.statusSentence}`);
    if (item.carryOver) lines.push(item.carryOver);
    lines.push('');
  });
  if (!items.length) {
    lines.push('No verified PI commitments are available for this squad yet.');
  } else {
    const delivered = items.filter((item) => /delivered/i.test(item.status)).length;
    const summary = delivered === items.length
      ? `Summary: All ${month} PI targets were met. The Epics remain open in Jira to track remaining sub-tasks and external dependencies.`
      : `Summary: ${delivered} of ${items.length} ${month} commitments reached a milestone. Epics remain open in Jira for unfinished children and dependencies.`;
    lines.push(summary);
  }

  return {
    title: `PI Commitment Pack · ${squadName}`,
    text: lines.join('\n').trim(),
    items,
  };
}

export function commitmentPackControlsHtml({ disabled = false, emptyHint = '' } = {}) {
  const hint = emptyHint || (disabled ? 'No verified promises to pack.' : 'Paste-ready PI update from stored Jira + baseline — no AI tokens.');
  return `<div class="gov-commitment-pack" data-commitment-pack>
    <p class="gov-calm-note">${hint}</p>
    <pre class="gov-commitment-pack-preview" data-commitment-pack-preview hidden></pre>
    <button type="button" class="btn btn-secondary btn-compact" data-copy-commitment-pack${disabled ? ' disabled aria-disabled="true"' : ''}>Copy PI commitment pack</button>
    <span class="gov-commitment-pack-status" data-commitment-pack-status aria-live="polite">${disabled ? 'No verified promises to pack' : ''}</span>
  </div>`;
}

/** Prefer Domain cluster-first unknown copy — UI must not re-strip wallpaper. */
export function clusterFirstUnknownImpact(squad, rework) {
  const unknown = squad?.unknownWork || {};
  if (unknown.promoted && unknown.copy) return unknown.copy;
  if (squad?.doingInstead?.major?.title) return squad.doingInstead.major.title;
  if (rework) return squad?.possibleRework?.copy || 'Insufficient evidence to measure diversion';
  return 'Insufficient evidence to measure diversion';
}

export function honestUnknownPctLine(squad, unknown) {
  const unknownPct = Number(squad?.workSplit?.unknownPct);
  const clusters = unknown?.clusters || squad?.unknownWork?.clusters || [];
  if (!Number.isFinite(unknownPct)) return 'Unknown: not calculated';
  if (unknownPct >= 100 && !clusters.length) {
    return squad?.doingInstead?.major?.title || 'Insufficient evidence to measure diversion';
  }
  if (clusters[0] && unknownPct >= 80) {
    const top = clusters[0];
    const keyHint = Array.isArray(top.issueKeys) && top.issueKeys[0] ? top.issueKeys[0] : '';
    return keyHint ? `Classify ${keyHint}` : `Classify · ${String(top.title || 'cluster').trim()}`;
  }
  if (unknown?.promoted && unknown?.copy) return unknown.copy;
  return `Unknown: ${unknownPct}%`;
}

export function promiseAlignmentSummary(promise = {}) {
  const comparison = promise.expectedVsActual || {};
  const expected = comparison.expected || {};
  const actual = comparison.actual || {};
  const keys = (actual.issueKeys || []).join(', ') || promise.issueKey || 'No Jira work matched';
  const method = actual.matchedThrough === 'epic-child'
    ? 'story to approved PI epic'
    : actual.matchedThrough === 'exact-key' || actual.matchedThrough === 'baseline-comparison'
      ? 'approved Jira key'
      : 'no verified mapping';
  const duration = comparison.durationBusinessDays == null
    ? 'duration unknown'
    : `${comparison.durationBusinessDays} business day${comparison.durationBusinessDays === 1 ? '' : 's'} observed`;
  return `Expected: ${expected.issueKey || promise.issueKey || 'PI commitment'} in ${expected.fiscalPeriod || promise.quarter || 'the active PI'}. Happening: ${keys} · ${actual.status || promise.statusNow || 'unknown'}${actual.sprintName ? ` · ${actual.sprintName}` : ''} · ${method} · ${duration}.`;
}

function kpiBundle({ squads = [], promises = [], answer = {}, evidencedPctFallback = null } = {}) {
  const promiseTotal = promises.length
    || Number(answer.decisionCoverage?.total)
    || Number(String(answer.sourceLine || '').match(/(\d+)\s+promises?\s+checked/i)?.[1] || 0)
    || squads.reduce((sum, s) => sum + (Number(s.promiseCount) || 0), 0);
  const evidenced = promises.filter((p) => {
    const state = String(p.matchState || p.caseState || '').toLowerCase();
    return state.includes('matched') || state === 'aligned' || state === 'aligned-amended' || p.verdict === 'delivered';
  }).length;
  const evidencedFromPct = squads.length
    ? Math.round(squads.reduce((sum, s) => sum + (Number(s.piPct) || 0), 0) / squads.length)
    : 0;
  const evidencedCount = evidenced || Math.round(((evidencedPctFallback ?? evidencedFromPct) / 100) * promiseTotal);
  const attentionSquads = squads.filter((s) => Number(s.attentionCount || 0) > 0);
  const attentionCount = attentionSquads.reduce((sum, s) => sum + (Number(s.attentionCount) || 0), 0);
  const diverting = squads.filter((s) => s.doingInstead?.major || Number(s.workSplit?.unplannedPct) > 0);
  const unverified = squads.filter((s) => s.baselineCoverage?.state === 'missing'
    || /cannot.?verify|unverified|missing/i.test(String(s.contractState?.label || s.topState || '')));
  const topDivert = diverting
    .map((s) => ({ squad: s, pct: Number(s.doingInstead?.major?.percentage || s.workSplit?.unplannedPct || 0) }))
    .sort((a, b) => b.pct - a.pct)[0];
  const topRisk = [...squads].sort((a, b) => Number(b.attentionCount || 0) - Number(a.attentionCount || 0))[0];
  const avgPiPct = squads.length
    ? Math.round(squads.reduce((sum, s) => sum + (Number(s.piPct) || 0), 0) / squads.length)
    : null;
  const storiesDone = promises.reduce((sum, p) => {
    const truth = childTruth(p);
    return sum + (truth.done || Number(p.expectedVsActual?.actual?.doneChildCount) || 0);
  }, 0);
  const epicsClosed = promises.filter((p) => {
    const state = String(p.matchState || '').toLowerCase();
    return state.includes('matched') || state === 'aligned-amended' || p.verdict === 'delivered'
      || milestoneStatus(p) === 'Delivered';
  }).length;
  return {
    promiseTotal,
    evidencedCount: Math.min(promiseTotal || evidencedCount, evidencedCount),
    evidencedPct: avgPiPct,
    storiesDone,
    epicsClosed,
    attentionCount,
    attentionSquads: attentionSquads.length,
    divertingCount: diverting.length,
    unverifiedCount: unverified.length,
    topDivertTitle: topDivert?.squad?.doingInstead?.major?.title || '',
    topDivertSquad: topDivert?.squad?.displayName || topDivert?.squad?.squad || '',
    topRiskSquad: topRisk?.displayName || topRisk?.squad || '',
    topRiskKey: topRisk?.squad || '',
  };
}

/** Portfolio delivery KPIs for first-viewport H1 + bento (Active Loop fields only). */
export function buildDeliveryPortfolioKpis(answer = {}) {
  const squads = Array.isArray(answer.squads) ? answer.squads : [];
  const promises = Array.isArray(answer.promises) ? answer.promises : [];
  return kpiBundle({ squads, promises, answer });
}

/** Squad-scoped delivery KPIs — never bleed portfolio peers into a selected-squad tunnel. */
export function buildDeliverySquadKpis(answer = {}, squadKey = '') {
  const focus = String(squadKey || '').trim().toUpperCase();
  if (!focus) return buildDeliveryPortfolioKpis(answer);
  const squads = (Array.isArray(answer.squads) ? answer.squads : [])
    .filter((s) => String(s.squad || '').trim().toUpperCase() === focus);
  const promises = (Array.isArray(answer.promises) ? answer.promises : [])
    .filter((p) => String(p.squad || '').trim().toUpperCase() === focus);
  const squad = squads[0];
  const bundle = kpiBundle({
    squads,
    promises,
    answer: { ...answer, decisionCoverage: null, sourceLine: '' },
    evidencedPctFallback: Number(squad?.piPct),
  });
  if (squad && Number.isFinite(Number(squad.piPct))) bundle.evidencedPct = Number(squad.piPct);
  if (squad && !bundle.promiseTotal && Number(squad.promiseCount)) {
    bundle.promiseTotal = Number(squad.promiseCount);
    if (bundle.evidencedPct != null) {
      bundle.evidencedCount = Math.round((bundle.evidencedPct / 100) * bundle.promiseTotal);
    }
  }
  if (squad && !bundle.attentionCount) bundle.attentionCount = Number(squad.attentionCount) || 0;
  if (squad && !bundle.divertingCount && (squad.doingInstead?.major || Number(squad.workSplit?.unplannedPct) > 0)) {
    bundle.divertingCount = 1;
    bundle.topDivertTitle = squad.doingInstead?.major?.title || '';
    bundle.topDivertSquad = squad.displayName || squad.squad || '';
  }
  if (squad && !bundle.unverifiedCount && (squad.baselineCoverage?.state === 'missing'
    || /cannot.?verify|unverified|missing/i.test(String(squad.contractState?.label || squad.topState || '')))) {
    bundle.unverifiedCount = 1;
  }
  return bundle;
}

/** One delivery-first H1 sentence — never “N of M squads verified”. */
export function buildDeliveryH1(answer = {}, { isSquadView = false, focusSquad = null } = {}) {
  const truth = answer?.deliveryTruth || null;
  const completed = Number(truth?.commitmentCompletion?.completed);
  const total = Number(truth?.commitmentCompletion?.total);
  if (isSquadView && focusSquad) {
    const pct = Number(focusSquad.piPct);
    const divert = focusSquad.doingInstead?.major?.title
      || (Number(focusSquad.workSplit?.unplannedPct) > 0 ? `${focusSquad.workSplit.unplannedPct}% unplanned` : '');
    const name = focusSquad.displayName || focusSquad.squad || 'Squad';
    if ((answer?.scope?.projects || []).length === 1 && Number.isFinite(completed) && Number.isFinite(total) && total > 0) {
      return `${name}: ${completed} of ${total} PI commitments delivered${divert ? ` · ${divert}` : ''}`.slice(0, 150);
    }
    if (Number.isFinite(pct)) {
      return divert
        ? `${name}: ${pct}% source coverage · diverting into ${divert}`.slice(0, 150)
        : `${name}: ${pct}% source coverage; delivery outcome not yet confirmed`.slice(0, 150);
    }
    return `${name}: ${focusSquad.contractState?.label || focusSquad.topState || 'Evidence needs review'}`.slice(0, 150);
  }
  const k = buildDeliveryPortfolioKpis(answer);
  if (!answer.contract) return 'PI contract missing — recover baseline to score delivery';
  if (!(answer.squads || []).length) return 'No squad evidence yet — connect Jira to score delivery';
  const base = Number.isFinite(completed) && Number.isFinite(total) && total > 0
    ? `${completed} of ${total} commitments delivered`
    : (k.promiseTotal
      ? `${k.evidencedCount} of ${k.promiseTotal} commitments have source coverage`
      : (k.evidencedPct != null ? `${k.evidencedPct}% source coverage` : 'Delivery evidence incomplete'));
  const divertPart = k.divertingCount
    ? `${k.divertingCount} squad${k.divertingCount === 1 ? '' : 's'} diverting`
    : '';
  const riskPart = k.topRiskSquad && k.attentionCount
    ? `${k.topRiskSquad} drives miss risk`
    : (k.unverifiedCount ? `${k.unverifiedCount} unverified` : '');
  return [base, divertPart, riskPart].filter(Boolean).join(' · ').slice(0, 160);
}

/** Short next-verb for the single primary CTA (rail must not restate this). */
export function primaryVerbLabel(squad, { noBaseline = false, isSquadView = false, actionLabels = {} } = {}) {
  if (noBaseline) return 'Recover PI contract';
  if (isSquadView) {
    const actionId = squad?.nextAction?.id || squad?.nextAction?.action || '';
    return actionLabels[actionId] || 'Review commitment';
  }
  if (!squad) return 'Review aligned promises';
  const actionId = squad.nextAction?.id || squad.nextAction?.action || '';
  const fromLabels = actionLabels[actionId] || '';
  const raw = fromLabels
    || String(squad.nextAction?.label || '').split(/[:·]/)[0].trim()
    || (squad.baselineCoverage?.state === 'missing' ? 'Save baseline' : 'Open spotlight');
  // Prefer issue-key cues over mid-sentence essays; never hard-slice mid-word.
  const keyMatch = raw.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  let verb = raw;
  if (!fromLabels && keyMatch && /confirm|whether|moved/i.test(raw)) {
    verb = `Confirm ${keyMatch[1]}`;
  } else if (!fromLabels && raw.length > 36) {
    const cut = raw.slice(0, 36);
    const sp = cut.lastIndexOf(' ');
    verb = `${(sp > 14 ? cut.slice(0, sp) : cut).trimEnd()}…`;
  }
  const shortName = String(squad.displayName || squad.squad || '').split(' ')[0];
  return shortName ? `${verb} · ${shortName}` : verb;
}

/** Build issueKey → activity map from brief (baseline items + boardEpicIndex). Zero API. */
function activityMapFromBrief(brief = {}) {
  const map = new Map();
  const put = (key, patch) => {
    const k = String(key || '').trim().toUpperCase();
    if (!k) return;
    const prev = map.get(k) || {};
    map.set(k, { ...prev, ...patch, issueKey: k });
  };
  for (const item of brief?.baselineComparison?.items || []) {
    const act = item?.epicActivity || {};
    put(item.issueKey, {
      title: item.title || item.issueKey,
      plannedStartDate: item.plannedStartDate || act.firstActiveSprintStart || '',
      plannedEndDate: item.targetDate || item.plannedEndDate || '',
      storyCount: Number(act.storyCount) || 0,
      doneCount: Number(act.doneCount) || 0,
      firstActiveSprintStart: act.firstActiveSprintStart || '',
      lifecycle: act.lifecycle || '',
      deliveryPct: item.verdict === 'delivered' ? 100 : (Number(act.storyCount) > 0
        ? Math.round((Number(act.doneCount) || 0) / Number(act.storyCount) * 100)
        : null),
    });
  }
  for (const entry of brief?.meta?.boardEpicIndex || []) {
    const k = String(entry.issueKey || '').trim().toUpperCase();
    if (!k || map.has(k)) continue;
    put(k, {
      title: entry.title || k,
      plannedStartDate: entry.plannedStartDate || '',
      plannedEndDate: entry.targetDate || entry.plannedEndDate || '',
      storyCount: Number(entry.storyCount) || 0,
      doneCount: Number(entry.doneCount) || 0,
    });
  }
  return map;
}

function mergeChipWithActivity(chip, activity, promise = null) {
  const truth = promise ? childTruth(promise) : { total: 0, done: 0 };
  const envelope = promise ? childDateEnvelope(promise) : { start: '', end: '', total: 0, done: 0 };
  const actStories = Number(activity?.storyCount) || 0;
  const actDone = Number(activity?.doneCount) || 0;
  const childTotal = truth.total || envelope.total || actStories;
  const childDone = truth.total ? truth.done : (envelope.done || actDone);
  const start = chip.plannedStartDate
    || activity?.plannedStartDate
    || activity?.firstActiveSprintStart
    || promise?.expectedVsActual?.expected?.startDate
    || promise?.fiscalStart
    || envelope.start
    || '';
  const end = chip.plannedEndDate
    || activity?.plannedEndDate
    || promise?.expectedVsActual?.expected?.endDate
    || promise?.fiscalEnd
    || envelope.end
    || '';
  const deliveryPct = chip.deliveryPct != null
    ? chip.deliveryPct
    : (activity?.deliveryPct != null
      ? activity.deliveryPct
      : (childTotal ? Math.round((childDone / childTotal) * 100) : null));
  const childHint = childTotal
    ? `${childDone}/${childTotal} children`
    : (activity?.lifecycle === 'not-started' ? '0 children in sprint' : 'No child stories');
  // Children-only forecast is honest when Jira target missing but child envelope exists.
  const missingDates = !end && !envelope.end;
  const hasChildDates = Boolean(envelope.start || envelope.end);
  return {
    issueKey: chip.issueKey || activity?.issueKey || promise?.issueKey || '',
    title: chip.title || activity?.title || promise?.originalText || promise?.summary || 'PI commitment',
    plannedStartDate: start,
    plannedEndDate: end || envelope.end || '',
    elapsedPct: chip.elapsedPct ?? null,
    deliveryPct,
    confidenceLabel: chip.confidenceLabel
      || (missingDates && !hasChildDates
        ? (childTotal ? 'Based on child stories' : 'Dates missing')
        : (missingDates && hasChildDates
          ? 'Children dates'
          : (childTotal ? 'Medium' : 'Limited'))),
    missingDates: missingDates && !hasChildDates,
    childHint,
    childTotal,
    childDone,
    source: chip.source || (activity ? 'activity' : 'promise'),
  };
}

/** Timeline chips for epic rail — prefer brief chips; enrich with activity + promises. */
export function buildEpicRailChips({ brief = null, answer = null, squadKey = '' } = {}) {
  const focus = String(squadKey || '').trim().toUpperCase();
  const activity = activityMapFromBrief(brief || {});
  const fromBrief = Array.isArray(brief?.meta?.piConfidence?.timelineChips)
    ? brief.meta.piConfidence.timelineChips
    : [];
  const promiseByKey = new Map();
  const focusPromises = [];
  for (const p of answer?.promises || []) {
    const k = String(p.issueKey || '').trim().toUpperCase();
    if (k) promiseByKey.set(k, p);
    if (focus && String(p.squad || '').trim().toUpperCase() === focus) {
      focusPromises.push(p);
    }
  }

  const matchesFocus = (chip) => {
    if (!focus) return true;
    const issueKey = String(chip.issueKey || '').toUpperCase();
    const key = String(chip.squad || chip.projectKey || chip.issueKey || '').toUpperCase();
    const promise = promiseByKey.get(issueKey);
    const squad = String(promise?.squad || chip.squad || '').toUpperCase();
    return key === focus
      || key.startsWith(`${focus}-`)
      || issueKey.startsWith(`${focus}-`)
      || squad === focus;
  };

  // When scoped: prefer that squad's promises first so peer brief chips cannot dominate.
  let seeds = [];
  if (focus && focusPromises.length) {
    seeds = focusPromises.map((promise) => ({
      issueKey: promise.issueKey || '',
      title: promise.originalText || promise.summary || 'PI commitment',
      source: 'promise',
      squad: promise.squad,
      _promise: promise,
    }));
  }
  if (!seeds.length) {
    seeds = fromBrief.map((chip) => ({ ...chip, source: 'brief' }));
  }
  if (!seeds.length) {
    for (const [key, act] of activity) {
      seeds.push({
        issueKey: key,
        title: act.title,
        plannedStartDate: act.plannedStartDate,
        plannedEndDate: act.plannedEndDate,
        deliveryPct: act.deliveryPct,
        source: 'activity',
      });
    }
  }
  if (!seeds.length) {
    seeds = (answer?.promises || []).map((promise) => ({
      issueKey: promise.issueKey || '',
      title: promise.originalText || promise.summary || 'PI commitment',
      source: 'promise',
      _promise: promise,
    }));
  }

  if (focus) {
    const filtered = seeds.filter(matchesFocus);
    // Continuity seal: never fall back to peer squad chips when focus is set.
    seeds = filtered;
  }

  return seeds.slice(0, 6).map((chip) => {
    const key = String(chip.issueKey || '').trim().toUpperCase();
    return mergeChipWithActivity(
      chip,
      activity.get(key),
      chip._promise || promiseByKey.get(key) || null,
    );
  });
}
