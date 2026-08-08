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

function carryOverLine(promise = {}) {
  const label = clean(promise.diagnosisLabel || promise.matchLabel || '', 80).toLowerCase();
  const status = clean(promise.statusNow || promise.expectedVsActual?.actual?.status || '', 40).toLowerCase();
  if (label.includes('proof pending') || label.includes('done') && label.includes('proof')) {
    return 'July milestone may be claimed only with acceptance evidence; open work or proof gaps remain.';
  }
  if (label.includes('active sprint') || status.includes('progress')) {
    return 'Work continued in the active sprint; treat July dates as a milestone, not full epic close.';
  }
  if (label.includes('metadata') || label.includes('cannot verify')) {
    return 'Dates are not PI-trusted until FY/quarter metadata is confirmed.';
  }
  return 'Status reflects verified Jira evidence only — unfinished stories block “done”.';
}

/**
 * @param {object} opts
 * @param {object[]} opts.promises
 * @param {object} [opts.squad]
 * @param {string} [opts.monthLabel]
 * @returns {{ title: string, text: string, items: object[] }}
 */
export function buildPiCommitmentPack({ promises = [], squad = {}, monthLabel = '' } = {}) {
  const items = (promises || []).slice(0, 12).map((promise) => {
    const start = promise.expectedVsActual?.expected?.startDate
      || promise.fiscalStart
      || promise.startDate
      || '';
    const end = promise.expectedVsActual?.expected?.endDate
      || promise.fiscalEnd
      || promise.endDate
      || '';
    const plannedDates = [formatDate(start), formatDate(end)].filter(Boolean).join(' – ')
      || clean(promise.quarter || promise.expectedVsActual?.expected?.fiscalPeriod || 'PI period unconfirmed', 60);
    const actual = promise.expectedVsActual?.actual || {};
    const observedDates = [formatDate(actual.observedStart || actual.startDate), formatDate(actual.observedEnd || actual.endDate)]
      .filter(Boolean).join(' – ') || 'Not verified';
    const dependencies = Array.isArray(actual.dependencies) ? actual.dependencies : (Array.isArray(promise.dependencies) ? promise.dependencies : []);
    return {
      issueKey: clean(promise.issueKey || 'Unlinked', 40),
      title: clean(promise.originalText || promise.summary || 'PI commitment', 180),
      status: milestoneStatus(promise),
      plannedDates,
      observedDates,
      openWork: openStoriesHint(promise),
      dependencies: dependencies.length ? dependencies.map((value) => clean(value?.issueKey || value, 60)).join(', ') : 'None verified',
      acceptance: actual.acceptanceEvidence || promise.acceptanceProof ? 'Verified' : 'Not verified',
      carryOver: carryOverLine(promise),
    };
  });

  const squadName = clean(squad.displayName || squad.squad || 'Selected squad', 80);
  const month = clean(monthLabel, 40) || new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const parallelNote = items.length > 1
    ? `These ${items.length} workstreams were tracked in parallel; unfinished stories mean an epic cannot be called fully done.`
    : 'Single commitment in scope for this pack.';

  const lines = [
    `PI commitment update — ${squadName} (${month})`,
    parallelNote,
    '',
  ];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`);
    lines.push(`   Epic: ${item.issueKey} · ${item.status}`);
    lines.push(`   Planned: ${item.plannedDates} · Observed: ${item.observedDates}`);
    lines.push(`   Work: ${item.openWork}`);
    lines.push(`   Acceptance: ${item.acceptance} · Dependencies: ${item.dependencies}`);
    lines.push(`   Realism: ${item.carryOver}`);
    lines.push('');
  });
  if (!items.length) {
    lines.push('No verified PI commitments are available for this squad yet.');
  }

  return {
    title: `PI Commitment Pack · ${squadName}`,
    text: lines.join('\n').trim(),
    items,
  };
}

export function commitmentPackControlsHtml({ disabled = false, emptyHint = '' } = {}) {
  const hint = emptyHint || (disabled ? 'No verified promises to pack.' : 'Deterministic pack from stored Jira + PI baseline — no AI tokens.');
  return `<div class="gov-commitment-pack" data-commitment-pack>
    <p class="gov-calm-note">${hint}</p>
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
