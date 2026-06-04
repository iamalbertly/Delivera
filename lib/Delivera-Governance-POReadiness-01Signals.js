/**
 * SSOT: PO Readiness Scorecard signals.
 *
 * Starts ONLY with signals that already exist in the current-sprint payload, so
 * it works on any Vodacom Jira instance without field configuration. Acceptance
 * criteria detection is deliberately deferred until a canonical field per project
 * is confirmed with a Jira admin (see context.md). Output is framed as "backlog
 * readiness risk", never team blame.
 *
 * Pure: takes board payloads, returns a scorecard. No Jira/IO.
 */
import { GOVERNANCE_THRESHOLDS, isLateScope } from './Delivera-Governance-Grammar-01Rules-SSOT.js';

const NOT_STARTED_STATUSES = ['to do', 'todo', 'open', 'backlog', 'new'];

function asNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function person(value) {
  const v = String(value || '').trim();
  return v && v !== '-' && v.toLowerCase() !== 'unassigned' ? v : '';
}

/**
 * Build the PO readiness scorecard for a portfolio.
 * @param {Array<{ board: object, payload: object }>} boardPayloads
 * @returns {object} { signals: {...counts}, items: [...], itemsByKey }
 */
export function buildPOReadinessScorecard(boardPayloads = []) {
  const signals = {
    noEstimate: 0,
    addedAfterSprintStart: 0,
    noAssignee: 0,
    noRecentMovement: 0,
    notClarified: 0,
    noPILink: 0,
  };
  const itemsByKey = new Map();

  const flag = (key, squad, summary, status, signal) => {
    const k = String(key || '').trim().toUpperCase();
    if (!k) return;
    if (!itemsByKey.has(k)) {
      itemsByKey.set(k, { issueKey: k, squad, summary: String(summary || '').slice(0, 160), status: String(status || ''), signals: [] });
    }
    const entry = itemsByKey.get(k);
    if (!entry.signals.includes(signal)) entry.signals.push(signal);
  };

  for (const entry of boardPayloads) {
    const payload = entry?.payload;
    if (!payload) continue;
    const squad = payload?.board?.name || entry?.board?.name || '';
    const sprintStart = payload?.sprint?.startDate || '';
    const stories = Array.isArray(payload.stories) ? payload.stories : [];

    for (const s of stories) {
      const key = s?.issueKey || s?.key || '';
      const status = String(s?.status || '');
      const statusLower = status.toLowerCase().trim();
      const sp = asNum(s?.storyPoints, 0);
      const hasEpic = !!(s?.epicKey || s?.epicLink || s?.parentKey);

      if (sp <= 0) { signals.noEstimate += 1; flag(key, squad, s?.summary, status, 'noEstimate'); }
      if (!person(s?.assignee)) { signals.noAssignee += 1; flag(key, squad, s?.summary, status, 'noAssignee'); }
      if (isLateScope(s?.created, sprintStart)) { signals.addedAfterSprintStart += 1; flag(key, squad, s?.summary, status, 'addedAfterSprintStart'); }
      if (!hasEpic) { signals.noPILink += 1; flag(key, squad, s?.summary, status, 'noPILink'); }

      const updatedMs = s?.updated ? new Date(s.updated).getTime() : NaN;
      const ageHours = Number.isFinite(updatedMs) ? (Date.now() - updatedMs) / 3600000 : 0;
      if (NOT_STARTED_STATUSES.includes(statusLower) && ageHours >= GOVERNANCE_THRESHOLDS.backlogNoMovementHours) {
        signals.noRecentMovement += 1;
        flag(key, squad, s?.summary, status, 'noRecentMovement');
      }
    }

    // "Not clarified": in progress but stale beyond the PO decision window.
    for (const r of (Array.isArray(payload.stuckCandidates) ? payload.stuckCandidates : [])) {
      if (asNum(r?.hoursInStatus, 0) >= GOVERNANCE_THRESHOLDS.poDecisionStaleHours && !person(r?.assignee)) {
        signals.notClarified += 1;
        flag(r?.issueKey || r?.key, squad, r?.summary, r?.status, 'notClarified');
      }
    }
  }

  const items = Array.from(itemsByKey.values()).sort((a, b) => b.signals.length - a.signals.length);
  const totalFlagged = items.length;
  const readinessLabel = totalFlagged === 0
    ? 'Backlog readiness looks healthy.'
    : `${totalFlagged} item${totalFlagged === 1 ? '' : 's'} carry backlog-readiness risk, not only delivery risk.`;

  return { signals, items, totalFlagged, readinessLabel };
}
