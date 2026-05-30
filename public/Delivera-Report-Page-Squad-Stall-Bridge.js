/**
 * Fetches squad activation state from leadership-summary and merges into Report attention queue.
 * SSOT for cross-surface stall visibility on /report.
 */
import { reportState } from './Delivera-Report-Page-State.js';
import { renderAttentionQueue } from './Delivera-Shared-Attention-Queue.js';
import { getSelectedProjects } from './Delivera-Report-Page-Selections-Manager.js';

let stallFetchSeq = 0;

function daysSince(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

export function buildSquadStallAttentionItems(squads) {
  if (!Array.isArray(squads) || squads.length === 0) return [];
  return squads
    .filter((s) => s && s.hasActiveSprintFallback)
    .map((squad) => {
      const name = String(squad.boardName || squad.sprintName || 'Squad').trim();
      const overdue = squad.nextSprintStartOverdue === true;
      const days = daysSince(squad.sprintStartDate || squad.lastSprintEndDate);
      const daysPart = days != null ? ` · ${days}d since last activity` : '';
      const label = overdue
        ? `${name}: sprint start overdue${daysPart}`
        : `${name}: no active sprint${daysPart}`;
      return {
        dedupeKey: `squad-stall:${squad.boardId || name}`,
        label,
        detail: 'Open sprint cockpit',
        tone: 'danger',
        action: 'open-current-sprint',
      };
    });
}

export async function fetchSquadStallsForReport(projects) {
  const list = Array.isArray(projects) ? projects : getSelectedProjects();
  if (!list.length) return [];
  const seq = ++stallFetchSeq;
  const qs = new URLSearchParams({ projects: list.join(',') }).toString();
  try {
    const res = await fetch(`/api/leadership-summary.json?${qs}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    if (seq !== stallFetchSeq) return reportState.squadStallItems || [];
    const items = buildSquadStallAttentionItems(data?.squads);
    reportState.squadStallItems = items;
    return items;
  } catch (_) {
    return reportState.squadStallItems || [];
  }
}

export function patchReportAttentionQueue(baseItems, extraItems = []) {
  const previewMeta = document.getElementById('preview-meta');
  if (!previewMeta) return;
  const merged = [...(extraItems || []), ...(baseItems || [])];
  const html = renderAttentionQueue({ title: 'Attention queue', items: merged });
  const existing = previewMeta.querySelector('.attention-queue');
  if (existing) {
    existing.outerHTML = html;
  } else if (html) {
    const details = previewMeta.querySelector('#preview-meta-details');
    if (details) details.insertAdjacentHTML('beforebegin', html);
    else previewMeta.insertAdjacentHTML('beforeend', html);
  }
  if (merged.some((i) => i?.action === 'open-current-sprint')) {
    window.setTimeout(() => {
      previewMeta.querySelector('.attention-queue')?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }, 120);
  }
}

export async function refreshReportSquadStallAttention(baseAttentionItems) {
  const projects = getSelectedProjects();
  const stallItems = await fetchSquadStallsForReport(projects);
  patchReportAttentionQueue(baseAttentionItems, stallItems);
  return stallItems;
}
