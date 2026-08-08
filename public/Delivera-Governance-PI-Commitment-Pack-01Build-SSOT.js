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

function openStoriesHint(promise = {}) {
  const keys = promise.expectedVsActual?.actual?.issueKeys || [];
  if (keys.length) return `${keys.length} linked issue${keys.length === 1 ? '' : 's'}`;
  if (promise.issueKey) return 'Linked Jira work present';
  return 'No linked stories verified';
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
    const dateLine = [formatDate(start), formatDate(end)].filter(Boolean).join(' – ')
      || clean(promise.quarter || promise.expectedVsActual?.expected?.fiscalPeriod || 'PI period unconfirmed', 60);
    return {
      issueKey: clean(promise.issueKey || 'Unlinked', 40),
      title: clean(promise.originalText || promise.summary || 'PI commitment', 180),
      status: clean(promise.diagnosisLabel || promise.matchLabel || promise.statusNow || 'Unknown', 80),
      dates: dateLine,
      openWork: openStoriesHint(promise),
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
    lines.push(`   Dates: ${item.dates}`);
    lines.push(`   Work: ${item.openWork}`);
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
