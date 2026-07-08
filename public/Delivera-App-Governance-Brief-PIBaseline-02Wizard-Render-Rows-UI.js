/**
 * PI baseline wizard — candidate row helpers + shared resolve utilities.
 */
import {
  COPY,
  businessTitleFromSummary,
  guidanceCodeToHint,
  humanEpicActivityLabel,
} from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { fetchJson } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

let cachedJiraBrowseHost = null;

export function fewItemsBanner(data) {
  const n = (data.candidates || []).length;
  const total = Number(data.totalBoardEpics) || 0;
  if (n >= 3 && !(total > n)) return '';
  const msg = COPY.piBaselineFewItems.replace('{n}', String(n));
  return `<p class="gov-baseline-few-items" role="status">${escapeHtml(msg)}</p>`;
}

export function epicKeyLine(issueKey, jiraHost) {
  if (!issueKey) return '';
  const k = escapeHtml(issueKey);
  if (jiraHost) {
    return `<span class="gov-baseline-row-key"><a href="${escapeHtml(jiraHost)}/browse/${k}" target="_blank" rel="noopener">${k}</a></span>`;
  }
  return `<span class="gov-baseline-row-key">${k}</span>`;
}

export function activitySubline(c) {
  const label = humanEpicActivityLabel(c?.epicActivity || {});
  return label ? `<span class="gov-baseline-activity">${escapeHtml(label)}</span>` : '';
}

export function childStoriesHint(c) {
  const n = Array.isArray(c?.childStories) ? c.childStories.length : 0;
  if (!n) return '';
  return `<span class="gov-baseline-child-hint">${escapeHtml(COPY.baselineSlideChildStories.replace('{n}', String(n)))}</span>`;
}

export function rowActionButtons(c, indexAttr) {
  const title = c.suggestedEpicTitle || c.title || '';
  const isDup = c.method === 'slide-duplicate-risk' || Boolean(c.duplicateRisk);
  const isMissing = c.method === 'slide-unmatched' || (c.method === 'slide-duplicate-risk' && !c.issueKey);
  const canConfirm = Boolean(c.issueKey) && c.method !== 'slide-duplicate-risk';
  if (canConfirm) return '';

  const buttons = [];
  if (isDup && c.issueKey) {
    buttons.push(
      `<button type="button" class="btn btn-secondary btn-compact" data-baseline-use-existing="${escapeHtml(indexAttr)}" data-issue-key="${escapeHtml(c.issueKey)}" data-epic-title="${escapeHtml(title)}" data-testid="gov-baseline-use-existing">${escapeHtml(COPY.baselineSlideUseExisting)} ${escapeHtml(c.issueKey)}</button>`,
    );
    buttons.push(
      `<button type="button" class="btn btn-link btn-compact" data-baseline-create-one="${escapeHtml(indexAttr)}" data-epic-title="${escapeHtml(title)}" data-testid="gov-baseline-create-one">${escapeHtml(COPY.baselineSlideCreateNew)}</button>`,
    );
  } else if (isMissing || (isDup && !c.issueKey)) {
    buttons.push(
      `<button type="button" class="btn btn-secondary btn-compact" data-baseline-create-one="${escapeHtml(indexAttr)}" data-epic-title="${escapeHtml(title)}" data-testid="gov-baseline-create-one">${escapeHtml(COPY.baselineSlideCreateNew)}</button>`,
    );
  }
  if (!buttons.length) return '';
  return `<span class="gov-baseline-row-actions">${buttons.join('')}</span>`;
}

export function candidateRow(c, i, jiraHost) {
  const isLinked = c.method === 'slide-linked' || c.method === 'slide-reconciled';
  const isDup = c.method === 'slide-duplicate-risk';
  const canConfirm = Boolean(c.issueKey) && !isDup;
  const title = businessTitleFromSummary(c.suggestedEpicTitle || c.title || c.summary || '', 200);
  let statusBadge = '';
  if (isDup) {
    statusBadge = `<span class="gov-baseline-status gov-baseline-status--warn">${escapeHtml(COPY.baselineSlideDuplicateRisk)}</span>`;
  } else if (isLinked && canConfirm) {
    statusBadge = `<span class="gov-baseline-status gov-baseline-status--ok">${escapeHtml(COPY.baselineSlideLinkedPrior)}</span>`;
  } else if (canConfirm) {
    statusBadge = `<span class="gov-baseline-status gov-baseline-status--ok">${escapeHtml(COPY.baselineSlideMatched)}</span>`;
  } else if (c.method === 'slide-unmatched' || isDup) {
    statusBadge = `<span class="gov-baseline-status gov-baseline-status--missing">${escapeHtml(COPY.baselineSlideMissing)}</span>`;
  }
  const dupNote = c.duplicateRisk?.reason
    ? `<span class="gov-baseline-dup-hint">${escapeHtml(c.duplicateRisk.reason)}</span>`
    : '';
  const notes = c.notes
    ? `<span class="gov-baseline-notes">${escapeHtml(c.notes)}</span>`
    : '';
  return `
    <label class="gov-baseline-row${canConfirm ? '' : ' gov-baseline-row--muted'}" data-testid="gov-baseline-row" data-epic-title="${escapeHtml(c.suggestedEpicTitle || c.title || '')}">
      <input type="checkbox" ${canConfirm && c.selected !== false ? 'checked' : ''} ${canConfirm ? '' : 'disabled'} data-candidate="${i}" />
      <span class="gov-baseline-row-body">
        <span class="gov-baseline-row-title">${escapeHtml(title)}</span>
        ${statusBadge}
        ${epicKeyLine(c.issueKey, jiraHost)}
        ${dupNote}
        ${notes}
        ${childStoriesHint(c)}
        ${activitySubline(c)}
        ${rowActionButtons(c, i)}
      </span>
    </label>`;
}

export function drawerTitle(projectsCsv, quarterLabel) {
  const projects = projectsCsv.split(',').map((p) => p.trim()).filter(Boolean);
  const pk = projects.length === 1 ? projects[0] : projects.join('+');
  const parts = [COPY.piBaselineDrawerTitle];
  if (pk) parts.push(pk);
  if (quarterLabel) parts.push(quarterLabel);
  return parts.join(' · ');
}

export async function resolveJiraBrowseHost(projects) {
  if (cachedJiraBrowseHost) return cachedJiraBrowseHost;
  const csv = (projects || []).join(',') || 'MPSA';
  try {
    const data = await fetchJson(`/api/boards.json?projects=${encodeURIComponent(csv)}`, {}, 'baseline-boards');
    cachedJiraBrowseHost = data?.jiraBrowseHost || null;
  } catch (_) {
    cachedJiraBrowseHost = null;
  }
  return cachedJiraBrowseHost;
}

export async function resolveJiraBoardUrl(projects) {
  const host = await resolveJiraBrowseHost(projects);
  const key = projects[0];
  if (host && key) return `${host}/browse/${key}`;
  return null;
}

export function resolveHint(data, partial = false) {
  if (data.guidanceCode) return guidanceCodeToHint(data.guidanceCode);
  if (data.guidance) return data.guidance;
  return partial ? COPY.baselineEmptyHintPartial : COPY.baselineEmptyHint;
}

export function countMissing(data) {
  return (data.unmatched || []).filter((c) => c.method === 'slide-unmatched' || (c.method === 'slide-duplicate-risk' && !c.issueKey)).length
    || (data.resolved || []).filter((r) => r.status === 'missing').length;
}

export function findCandidateByIndex(data, idx) {
  const raw = String(idx || '');
  if (raw.startsWith('u-')) {
    const i = Number(raw.slice(2));
    return (data.unmatched || [])[i] || null;
  }
  const n = Number(raw);
  if (Number.isInteger(n)) return (data.candidates || [])[n] || null;
  return (data.candidates || []).find((c) => String(c.issueKey) === raw) || null;
}
