/**
 * SSOT: actionable sprint briefing (time left, top risk + why + duration, next step).
 */
import { formatDate } from './Delivera-Shared-Format-DateNumber-Helpers.js';
import { formatSprintRemainingLabel } from './Delivera-CurrentSprint-Copy.js';
import { deriveSprintPhase } from './Delivera-CurrentSprint-Summary-01Facts-Verdict-SSOT.js';
import { deriveSprintVerdict } from './Delivera-CurrentSprint-Alert-Banner.js';
import { getUnifiedRiskCounts } from './Delivera-CurrentSprint-Data-WorkRisk-Rows.js';
import {
  formatRiskCountsRollup,
  staleInProgressLabel,
} from './Delivera-CurrentSprint-Risk-Vocabulary-01Terms-SSOT.js';

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatRiskAge(hours) {
  const h = Math.max(0, Math.round(asNum(hours, 0)));
  if (h >= 48) return `${h}h (${Math.round(h / 24)}d)`;
  if (h > 0) return `${h}h`;
  return '24h+';
}

export function pickTopStuckRisk(data) {
  const stuck = [...(Array.isArray(data?.stuckCandidates) ? data.stuckCandidates : [])]
    .sort((a, b) => asNum(b?.hoursInStatus, 0) - asNum(a?.hoursInStatus, 0));
  const top = stuck[0];
  if (!top) return null;
  const key = String(top.issueKey || top.key || '').trim();
  if (!key) return null;
  const hours = asNum(top.hoursInStatus, 0);
  const status = String(top.status || 'In progress').trim();
  const assignee = String(top.assignee || '').trim();
  const summary = String(top.summary || 'Work item').trim();
  const statusLower = status.toLowerCase();
  const isNotStarted = ['to do', 'open', 'backlog'].includes(statusLower);
  let reason = '';
  if (isNotStarted) {
    reason = assignee
      ? `waiting in ${status} with no movement (${formatRiskAge(hours)})`
      : `unowned in ${status} — no pick-up (${formatRiskAge(hours)})`;
  } else if (!assignee) {
    reason = `stuck in ${status} ${formatRiskAge(hours)} with no owner`;
  } else if (hours >= 72) {
    reason = `${assignee} has not moved it from ${status} for ${formatRiskAge(hours)}`;
  } else if (hours >= 24) {
    reason = `in ${status} ${formatRiskAge(hours)} without progress (${assignee})`;
  } else {
    reason = `aging in ${status} · ${assignee || 'owner unclear'}`;
  }
  let nextAction = '';
  if (!assignee) {
    nextAction = `Assign ${key} today and post the unblock ask in Jira.`;
  } else if (hours >= 48) {
    nextAction = `Ping @${assignee.split(/\s+/)[0] || assignee} on ${key} before stand-up — unblock or cut scope.`;
  } else {
    nextAction = `Review ${key} with ${assignee}: confirm blocker vs normal WIP.`;
  }
  return {
    key,
    summary,
    status,
    assignee,
    hours,
    reason,
    nextAction,
    isNotStarted,
    issueUrl: top.issueUrl || '',
  };
}

export function buildSprintAtAGlanceBriefing(data) {
  const sprint = data?.sprint || {};
  const board = data?.board || {};
  const summary = data?.summary || {};
  const days = data?.daysMeta || {};
  const meta = data?.meta || {};
  const verdictInfo = deriveSprintVerdict(data);
  const phaseInfo = deriveSprintPhase(data);
  const risks = getUnifiedRiskCounts(data);

  const remainingDays = days.daysRemainingWorking != null
    ? Number(days.daysRemainingWorking)
    : (days.daysRemainingCalendar != null ? Number(days.daysRemainingCalendar) : null);
  const endLabel = formatDate(sprint.endDate) || '';
  const timeLeftLine = remainingDays != null
    ? `${formatSprintRemainingLabel(remainingDays)}${endLabel ? ` · ends ${endLabel}` : ''}`
    : 'Sprint window unknown — check dates in Jira';

  const pctDone = asNum(summary.percentDone, 0);
  const doneStories = asNum(summary.doneStories, 0);
  const totalStories = asNum(summary.totalStories, 0);
  const scopeLine = `${board.name || 'Board'} · ${sprint.name || 'Sprint'} · ${phaseInfo.label}`;
  const progressLine = `${pctDone}% done · ${doneStories}/${totalStories} stories`;
  const healthLine = `${verdictInfo.verdict} · ${progressLine} · ${timeLeftLine}`;

  const topRisk = pickTopStuckRisk(data);
  let topRiskLine = '';
  let topRiskDetail = '';
  if (topRisk) {
    topRiskLine = `Top risk: ${topRisk.key} — ${topRisk.reason}`;
    topRiskDetail = topRisk.summary;
  } else if (risks.unownedOutcomes > 0) {
    topRiskLine = `Top risk: ${risks.unownedOutcomes} unowned outcome${risks.unownedOutcomes === 1 ? '' : 's'} — assign owners before scope slips`;
  } else if (phaseInfo.justStarting) {
    topRiskLine = 'Top risk: none flagged yet — confirm committed scope in Jira';
  } else {
    topRiskLine = 'Top risk: no stale work — watch scope creep and logging gaps';
  }

  const scopeCount = Array.isArray(data?.scopeChanges) ? data.scopeChanges.length : 0;
  const missingEst = asNum(summary.subtaskMissingEstimate, 0);
  const missingLog = asNum(summary.subtaskMissingLogged, 0);
  let risksRollup = formatRiskCountsRollup({
    stale: risks.blockersOwned,
    missingEst,
    missingLog,
    unowned: risks.unownedOutcomes,
  });
  if (scopeCount > 0) {
    risksRollup = [risksRollup, `+${scopeCount} scope`].filter(Boolean).join(' · ');
  }

  let nextAction = topRisk?.nextAction
    || (risks.blockersOwned > 0
      ? `Clear ${staleInProgressLabel(risks.blockersOwned) || 'stale work'} before adding new scope.`
      : (phaseInfo.justStarting
        ? 'Add stories and owners in Jira so health signals can form.'
        : 'Keep daily logging current so burndown and leadership rollups stay truthful.'));

  const quickClipboardLines = [
    scopeLine,
    `Time: ${timeLeftLine}`,
    `Health: ${healthLine}`,
    topRiskLine,
    `Do next: ${nextAction}`,
  ].filter(Boolean);

  const isHistorical = String(sprint.state || '').toLowerCase() !== 'active' || Boolean(meta.fromSnapshot);
  if (isHistorical) {
    nextAction = 'Snapshot only — switch to a live sprint to post Jira updates or change ownership.';
  }
  const headerExplain = [timeLeftLine, topRiskLine, `Do next: ${nextAction}`].join(' · ');

  return {
    scopeLine,
    timeLeftLine,
    progressLine,
    healthLine,
    topRisk,
    topRiskLine,
    topRiskDetail,
    risksRollup,
    nextAction,
    quickClipboardLines,
    headerExplain,
    verdict: verdictInfo.verdict,
    phaseInfo,
    verdictInfo,
    isHistorical,
  };
}

export function renderMissionBriefingHtml(briefing, escapeHtml) {
  if (!briefing || typeof escapeHtml !== 'function') return '';
  if (briefing.isHistorical) return '';
  const time = escapeHtml(briefing.timeLeftLine || '');
  const risk = escapeHtml(briefing.topRiskLine || '');
  const action = escapeHtml(briefing.nextAction || '');
  if (!time && !risk && !action) return '';
  return '<div class="sprint-mission-briefing" role="status" aria-live="polite" data-signal="mission-briefing">'
    + '<span class="mission-briefing-time" data-briefing="time">' + time + '</span>'
    + '<span class="mission-briefing-risk" data-briefing="risk">' + risk + '</span>'
    + '<span class="mission-briefing-action" data-briefing="action"><strong>Do:</strong> ' + action + '</span>'
    + '</div>';
}
