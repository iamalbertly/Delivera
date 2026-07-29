/**
 * SSOT: PI Baseline vs Now comparison.
 *
 * Compares an approved PI baseline snapshot against the current delivery reality
 * (the fact contract) and classifies each commitment: delivered, delayed,
 * added-after-baseline, or not-traceable. A missing board row is never proof
 * that a commitment was removed; deletion needs explicit Jira changelog proof.
 * moat - it answers "what changed against commitment", which a generic Jira
 * sprint summary cannot.
 *
 * Pure: baseline object + current keys/status, returns classified diff. No IO.
 */

export const BASELINE_VERDICTS = Object.freeze({
  DELIVERED: 'delivered',
  DELAYED: 'delayed',
  REMOVED: 'removed',
  ADDED_AFTER_BASELINE: 'added-after-baseline',
  NOT_TRACEABLE: 'not-traceable',
  ON_TRACK: 'on-track',
});

function statusIsDone(status) {
  return String(status || '').toLowerCase().includes('done');
}

export const PROMISE_DIAGNOSIS_CODES = Object.freeze({
  ACCESS_BLOCKED: 'access-blocked',
  BOARD_UNRESOLVED: 'board-unresolved',
  BACKLOG_ONLY: 'backlog-only',
  FUTURE_SPRINT: 'future-sprint',
  MISSING_PI_METADATA: 'missing-pi-metadata',
  LIKELY_MOVED_OR_REKEYED: 'likely-moved-or-rekeyed',
  DONE_PROOF_PENDING: 'done-proof-pending',
  PROGRAM_THEME: 'program-theme',
  OFF_PLAN_OR_SUPPORT: 'off-plan-or-support',
  PERIOD_CONFLICT: 'period-conflict',
  EXACT_KEY_UNAVAILABLE: 'exact-key-unavailable',
  VERIFIED: 'verified',
});

function isAuthBlocked(input = {}) {
  const status = Number(input.httpStatus);
  const code = String(input.authCode || input.jiraErrorCode || '').toUpperCase();
  return Boolean(
    input.permissionDenied
    || status === 401
    || status === 403
    || code === 'JIRA_UNAUTHORIZED'
    || code === 'JIRA_ACCESS_DENIED'
  );
}

function includesAny(value, terms) {
  const text = String(value || '').toLowerCase();
  return terms.some((term) => text.includes(term));
}

function candidateKeys(input = {}) {
  return [...new Set([
    ...(input.candidateIssueKeys || []),
    ...(input.linkedIssueKeys || []),
    input.candidateIssueKey,
    input.issueKey,
  ].map((key) => String(key || '').trim().toUpperCase()).filter(Boolean))];
}

/**
 * Deterministic diagnosis for a baseline commitment. Rules only describe facts
 * present in Jira/baseline evidence and always return a human-reviewable trail.
 */
export function diagnosePromiseEvidence(input = {}) {
  const status = String(input.statusNow || input.status || '');
  const issueKey = String(input.issueKey || '').trim().toUpperCase();
  const candidates = candidateKeys(input);
  const ownerRoute = input.ownerRoute || {
    role: 'PI Team queue',
    displayName: '',
    unresolved: true,
  };
  const evidence = (label, value, source = 'Jira + approved PI contract') => ({
    label,
    value: String(value || ''),
    source,
  });
  const result = (code, label, confidence, trail, action, impact, requiresHumanDecision = true) => ({
    diagnosisCode: code,
    diagnosisLabel: label,
    diagnosisConfidence: confidence,
    diagnosisEvidence: trail.filter((item) => item.value),
    candidateIssueKeys: candidates,
    customerOrPiImpact: impact,
    recommendedAction: action,
    ownerRoute,
    requiresHumanDecision,
  });

  if (isAuthBlocked(input)) {
    return result(PROMISE_DIAGNOSIS_CODES.ACCESS_BLOCKED, 'Jira login or permissions blocked this check', 0.98, [
      evidence('Requested commitment', issueKey),
      evidence('Access result', Number(input.httpStatus) === 401
        ? 'Jira rejected the login'
        : Number(input.httpStatus) === 403
          ? 'Jira returned 403'
          : 'Permission denied'),
    ], `Ask an admin to restore Jira access for ${issueKey || 'this commitment'}, then tap Refresh.`, 'Work may already exist in Jira, but Delivera cannot verify it yet.');
  }
  if (input.boardResolved === false) {
    return result(PROMISE_DIAGNOSIS_CODES.BOARD_UNRESOLVED, 'We cannot open this squad’s Jira board yet', 0.94, [
      evidence('Requested commitment', issueKey),
      evidence('Board result', input.searchScope || 'Configured board is missing or not mapped'),
    ], `Open Settings and map a board for this squad, then tap Refresh.`, 'Without a board link, Delivera cannot compare this PI promise to live Jira work.');
  }
  if (input.periodConflict || (input.baselinePeriod && input.jiraPeriod && input.baselinePeriod !== input.jiraPeriod)) {
    return result(PROMISE_DIAGNOSIS_CODES.PERIOD_CONFLICT, 'Baseline and Jira periods conflict', 0.96, [
      evidence('Baseline period', input.baselinePeriod),
      evidence('Jira period', input.jiraPeriod),
    ], `Confirm the approved period for ${issueKey || 'this commitment'} before changing the PI contract.`, 'The work may be counted in the wrong PI period.');
  }
  if (statusIsDone(status) && !input.acceptedAt && !input.acceptanceIndicator && !input.releaseEvidence) {
    return result(PROMISE_DIAGNOSIS_CODES.DONE_PROOF_PENDING, 'Delivery done, proof pending', 0.97, [
      evidence('Jira status', status),
      evidence('Acceptance evidence', 'No acceptance or release proof is attached'),
    ], `Attach acceptance or release evidence for ${issueKey || 'the completed commitment'}.`, 'Delivery cannot be credited in an auditable report yet.');
  }
  if (input.inBacklog === true || includesAny(input.sprintState, ['backlog'])) {
    return result(PROMISE_DIAGNOSIS_CODES.BACKLOG_ONLY, 'Epic exists only in backlog', 0.95, [
      evidence('Jira key', issueKey),
      evidence('Delivery location', 'Backlog; no active delivery stories'),
    ], `Confirm commit, defer, or descope for ${issueKey || 'this backlog commitment'}.`, 'The PI promise has no active execution path.');
  }
  if (input.inFutureSprint === true || includesAny(input.sprintState, ['future', 'planned'])) {
    return result(PROMISE_DIAGNOSIS_CODES.FUTURE_SPRINT, 'Work moved to a future sprint', 0.94, [
      evidence('Jira key', issueKey),
      evidence('Sprint', input.sprintName || input.sprintState),
    ], `Record approved replan evidence for ${issueKey || 'this commitment'}.`, 'The promised outcome may land later than the current plan.');
  }
  if (input.missingPiMetadata === true) {
    return result(PROMISE_DIAGNOSIS_CODES.MISSING_PI_METADATA, 'Active work lacks PI metadata', 0.92, [
      evidence('Jira key', issueKey),
      evidence('Missing fields', 'No fiscal-quarter label or fix version'),
    ], `Confirm and add the FY/quarter metadata for ${issueKey || 'this active work'}.`, 'Active delivery is invisible to PI reporting.');
  }
  if (input.isProgramTheme === true || includesAny(input.issueType, ['theme', 'initiative'])) {
    return result(PROMISE_DIAGNOSIS_CODES.PROGRAM_THEME, 'Program theme needs delivery mapping', 0.90, [
      evidence('Baseline item', input.title || input.originalText),
      evidence('Issue type', input.issueType || 'Program theme'),
    ], 'Link the theme to its delivery epics or confirm it as a non-epic outcome.', 'One-to-one epic matching would misrepresent a program-level promise.');
  }
  if (input.offPlan === true || input.supportWork === true || includesAny(input.workCategory, ['support', 'operational', 'off-plan'])) {
    return result(PROMISE_DIAGNOSIS_CODES.OFF_PLAN_OR_SUPPORT, 'Squad is delivering other work', 0.88, [
      evidence('Observed work category', input.workCategory || (input.supportWork ? 'support' : 'off-plan')),
      evidence('Observed Jira work', candidates.join(', ')),
    ], 'Classify the work as support, an approved amendment, or accepted PI risk.', 'Capacity is being used outside the mapped PI promise.');
  }
  if (!input.currentFound && candidates.some((key) => key !== issueKey)) {
    return result(PROMISE_DIAGNOSIS_CODES.LIKELY_MOVED_OR_REKEYED, 'Likely moved, cloned, or re-keyed', 0.82, [
      evidence('Original key', issueKey),
      evidence('Candidate keys', candidates.filter((key) => key !== issueKey).join(', ')),
      evidence('Candidate basis', input.candidateReason || 'Linked issue or strong title match'),
    ], 'Confirm the replacement Jira key before updating the baseline link.', 'Delivery may continue under a different Jira identity.');
  }
  if (!input.currentFound) {
    return result(PROMISE_DIAGNOSIS_CODES.EXACT_KEY_UNAVAILABLE, 'Exact Jira key is not currently verifiable', 0.70, [
      evidence('Requested key', issueKey),
      evidence('Search scope', input.searchScope || 'Current authorized Jira evidence'),
    ], `Check access, archive, rename, and board scope for ${issueKey || 'this commitment'}.`, 'No delivery conclusion is safe until the source is resolved.');
  }
  return result(PROMISE_DIAGNOSIS_CODES.VERIFIED, 'Jira evidence verified', 0.99, [
    evidence('Jira key', issueKey),
    evidence('Jira status', status),
  ], `Keep ${issueKey || 'the commitment'} evidence current.`, 'No evidence gap is currently detected.', false);
}

/**
 * @param {object} args
 * @param {object} args.baseline saved baseline { committedItems[], baselineDate }
 * @param {Map|object} args.currentByKey issueKey -> { status, updated, inActiveSprint }
 * @param {string[]} [args.currentKeys] all issue keys currently in the portfolio (for added-after detection)
 * @returns {object} { piName, baselineDate, summary: {...counts}, items: [...] }
 */
export function comparePIBaselineToNow({ baseline = {}, currentByKey = new Map(), currentKeys = [] } = {}) {
  const lookup = (key) => {
    if (currentByKey instanceof Map) return currentByKey.get(key) || null;
    return currentByKey[key] || null;
  };
  const committed = Array.isArray(baseline?.committedItems) ? baseline.committedItems : [];
  const committedKeySet = new Set(committed.map((i) => String(i.issueKey || '').trim().toUpperCase()));
  const baselineDateMs = baseline?.baselineDate ? new Date(baseline.baselineDate).getTime() : NaN;

  const items = [];
  const summary = {
    delivered: 0, delayed: 0, removed: 0, addedAfterBaseline: 0, notTraceable: 0, onTrack: 0, totalCommitted: committed.length,
  };

  for (const item of committed) {
    const key = String(item.issueKey || '').trim().toUpperCase();
    const current = lookup(key);
    let verdict;
    if (!current) {
      verdict = BASELINE_VERDICTS.NOT_TRACEABLE;
      summary.notTraceable += 1;
    } else if (statusIsDone(current.status)) {
      verdict = BASELINE_VERDICTS.DELIVERED;
      summary.delivered += 1;
    } else if (item.targetDate && new Date(item.targetDate).getTime() < Date.now()) {
      verdict = BASELINE_VERDICTS.DELAYED;
      summary.delayed += 1;
    } else {
      verdict = BASELINE_VERDICTS.ON_TRACK;
      summary.onTrack += 1;
    }
    items.push({
      issueKey: key,
      title: item.title,
      squad: item.squad,
      owner: item.owner,
      targetDate: item.targetDate,
      statusNow: current?.status || 'not found',
      verdict,
      ...diagnosePromiseEvidence({ ...item, ...(current || {}), issueKey: key, currentFound: Boolean(current) }),
    });
  }

  // Added after baseline: keys present now but not in the committed set, created after baseline date.
  for (const rawKey of (Array.isArray(currentKeys) ? currentKeys : [])) {
    const key = String(rawKey || '').trim().toUpperCase();
    if (!key || committedKeySet.has(key)) continue;
    const current = lookup(key);
    const createdMs = current?.created ? new Date(current.created).getTime() : NaN;
    const isAfter = Number.isFinite(baselineDateMs) && Number.isFinite(createdMs) ? createdMs > baselineDateMs : true;
    if (isAfter) {
      summary.addedAfterBaseline += 1;
      items.push({ issueKey: key, title: current?.title || '', statusNow: current?.status || '', verdict: BASELINE_VERDICTS.ADDED_AFTER_BASELINE });
    } else {
      summary.notTraceable += 1;
      items.push({ issueKey: key, title: current?.title || '', statusNow: current?.status || '', verdict: BASELINE_VERDICTS.NOT_TRACEABLE });
    }
  }

  return {
    piName: baseline?.piName || null,
    baselineDate: baseline?.baselineDate || null,
    approvedBy: baseline?.approvedBy || null,
    summary,
    items,
  };
}
