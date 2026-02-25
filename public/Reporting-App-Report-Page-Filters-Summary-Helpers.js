import { classifyPreviewComplexity } from './Reporting-App-Report-Page-Preview-Complexity-Config.js';
import { getSelectedProjects } from './Reporting-App-Report-Page-Selections-Manager.js';
import { getValidLastQuery } from './Reporting-App-Shared-Context-From-Storage.js';
import {
  PROJECTS_SSOT_KEY,
  REPORT_LAST_META_KEY,
  REPORT_FILTERS_STALE_KEY,
  REPORT_HAS_RUN_PREVIEW_KEY,
  REPORT_FILTERS_STALE_REASON_KEY,
} from './Reporting-App-Shared-Storage-Keys.js';
import { isRangeValid, updateRangeHint } from './Reporting-App-Report-Page-DateRange-Controller.js';
import { reportState } from './Reporting-App-Report-Page-State.js';

const CONTEXT_SEPARATOR = ' | ';

function getShortRangeLabel() {
  const activePill = document.querySelector('.quarter-pill.is-active');
  if (activePill && activePill.dataset.quarter) return activePill.dataset.quarter;
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  if (!startInput?.value || !endInput?.value) return '';
  const startLabel = startInput.value.slice(0, 10);
  const endLabel = endInput.value.slice(0, 10);
  return (startLabel && endLabel) ? `${startLabel} - ${endLabel}` : '';
}

function getRangeDaysFromInputs() {
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  const startVal = startInput?.value || '';
  const endVal = endInput?.value || '';
  if (!startVal || !endVal) return null;
  const startMs = new Date(startVal).getTime();
  const endMs = new Date(endVal).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
}

export function getCurrentSelectionComplexity() {
  const projects = getSelectedProjects();
  const rangeDays = getRangeDaysFromInputs();
  const { level } = classifyPreviewComplexity({
    rangeDays,
    projectCount: projects.length,
    includePredictability: document.getElementById('include-predictability')?.checked === true,
    includeActiveOrMissingEndDateSprints: document.getElementById('include-active-or-missing-end-date-sprints')?.checked === true,
    requireResolvedBySprintEnd: document.getElementById('require-resolved-by-sprint-end')?.checked === true,
  });
  return { level, isHeavy: level === 'heavy' || level === 'veryHeavy' };
}

export function shouldAutoPreviewOnInit() {
  const projects = getSelectedProjects();
  if (!Array.isArray(projects) || projects.length === 0) return false;
  if (!isRangeValid()) return false;
  return !getCurrentSelectionComplexity().isHeavy;
}

export function refreshPreviewButtonLabel() {
  const previewBtn = document.getElementById('preview-btn');
  const rangeHintEl = document.getElementById('range-hint');
  if (!previewBtn) return;
  const projects = getSelectedProjects();
  const projectCount = projects.length;
  const rangeLabel = getShortRangeLabel();
  const complexity = getCurrentSelectionComplexity();

  if (projectCount === 0) {
    previewBtn.textContent = 'Preview';
    previewBtn.title = 'Select at least one project to preview.';
    previewBtn.disabled = true;
    if (rangeHintEl) rangeHintEl.style.display = 'none';
    return;
  }
  if (reportState.previewInProgress) {
    previewBtn.disabled = true;
    previewBtn.title = 'Generating preview...';
    return;
  }
  if (!isRangeValid()) {
    previewBtn.disabled = false;
    previewBtn.title = 'End date must be after start date.';
    previewBtn.textContent = 'Preview';
    if (rangeHintEl) {
      rangeHintEl.style.display = 'block';
      rangeHintEl.textContent = 'Fix date range before preview.';
    }
    return;
  }

  previewBtn.disabled = false;
  const rangePart = rangeLabel ? ', ' + rangeLabel : '';
  if (complexity.isHeavy) {
    previewBtn.textContent = 'Preview now (' + projectCount + ' project' + (projectCount !== 1 ? 's' : '') + rangePart + ')';
    previewBtn.title = 'Large range detected. Manual preview prevents surprise auto-loads.';
    if (rangeHintEl) {
      rangeHintEl.style.display = 'block';
      rangeHintEl.textContent = 'Large selection detected. Preview runs manually for speed and reliability.';
    }
    return;
  }

  previewBtn.textContent = 'Preview (' + projectCount + ' project' + (projectCount !== 1 ? 's' : '') + rangePart + ')';
  previewBtn.title = 'Generate report for selected filters.';
  updateRangeHint();
}

export function updateAppliedFiltersSummary() {
  const summaryEl = document.getElementById('applied-filters-summary');
  const chipsEl = document.getElementById('applied-filters-chips');
  const projects = getSelectedProjects();
  const startVal = document.getElementById('start-date')?.value || '';
  const endVal = document.getElementById('end-date')?.value || '';
  const options = [];
  if (document.getElementById('require-resolved-by-sprint-end')?.checked) options.push('Require resolved by sprint end');
  if (document.getElementById('include-predictability')?.checked) options.push('Include Predictability');

  const projectLabel = projects.length ? projects.join(', ') : 'None';
  const rangeLabel = startVal && endVal ? startVal.slice(0, 10) + ' - ' + endVal.slice(0, 10) : '';
  const summaryText = (projectLabel !== 'None' && rangeLabel)
    ? 'Applied: ' + projectLabel + CONTEXT_SEPARATOR + rangeLabel + (options.length ? CONTEXT_SEPARATOR + options.join(', ') : '')
    : 'Select projects and dates, then preview.';

  if (summaryEl) summaryEl.textContent = summaryText;
  if (chipsEl) {
    const primaryProject = projects.length === 0 ? 'No project' : projects[0] + (projects.length > 1 ? ' +' + (projects.length - 1) : '');
    const chips = [];
    if (projects.length > 0) chips.push('Projects: ' + primaryProject);
    if (rangeLabel) chips.push('Range: ' + rangeLabel);
    if (options.length > 0) chips.push('+Advanced (' + options.length + ')');
    chipsEl.textContent = chips.length ? chips.join(' | ') : 'No filters selected';
  }

  if (summaryEl && typeof window !== 'undefined' && window.innerWidth <= 768 && projects.length > 1) {
    const mobileLabel = projects[0] + ' +' + (projects.length - 1) + ' more';
    const mobileSummary = (mobileLabel !== 'None' && rangeLabel)
      ? 'Applied: ' + mobileLabel + CONTEXT_SEPARATOR + rangeLabel
      : summaryText;
    summaryEl.textContent = mobileSummary;
  }

  const activeCount = projects.length + (startVal && endVal ? 1 : 0) + options.length;
  const countBadge = document.querySelector('.filters-active-count-badge');
  if (countBadge) countBadge.textContent = activeCount > 0 ? activeCount + ' active' : '';

  const statusStripEl = document.getElementById('preview-status-strip');
  if (statusStripEl) {
    const state = getStatusStripSemantics({
      projects,
      startVal,
      endVal,
      projectLabel,
      rangeLabel,
    });
    statusStripEl.textContent = state.label;
    statusStripEl.setAttribute('data-state', state.state);
  }

  refreshPreviewButtonLabel();

  const loadLatestWrap = document.getElementById('report-load-latest-wrap');
  const previewBtn = document.getElementById('preview-btn');
  if (loadLatestWrap && previewBtn && previewBtn.disabled) loadLatestWrap.style.display = 'none';
  const reportContextLine = document.getElementById('report-context-line');
  if (reportContextLine && projects.length === 0) {
    reportContextLine.textContent = 'Select at least one project to see results.';
  }
}

export function getStatusStripSemantics(input) {
  const projects = Array.isArray(input?.projects) ? input.projects : getSelectedProjects();
  const startVal = input?.startVal ?? (document.getElementById('start-date')?.value || '');
  const endVal = input?.endVal ?? (document.getElementById('end-date')?.value || '');
  const projectLabel = input?.projectLabel ?? (projects.length ? projects.join(', ') : 'None');
  const rangeLabel = input?.rangeLabel ?? (startVal && endVal ? startVal.slice(0, 10) + ' - ' + endVal.slice(0, 10) : '');

  let filtersStale = false;
  let hasRunPreview = false;
  let staleReason = '';
  try {
    if (typeof sessionStorage !== 'undefined') {
      filtersStale = sessionStorage.getItem(REPORT_FILTERS_STALE_KEY) === '1';
      hasRunPreview = sessionStorage.getItem(REPORT_HAS_RUN_PREVIEW_KEY) === '1';
      staleReason = sessionStorage.getItem(REPORT_FILTERS_STALE_REASON_KEY) || '';
    }
  } catch (_) {}

  const complexity = getCurrentSelectionComplexity();
  const hasProjects = projects.length > 0;
  const hasRange = !!(startVal && endVal);

  let state = 'idle';
  let label = '';

  if (!hasProjects || !hasRange) {
    state = 'needs-preview';
    label = 'PREVIEW REQUIRED – choose projects and dates.';
  } else if (complexity.isHeavy) {
    state = 'heavy';
    label = 'HEAVY RANGE – manual preview only.';
  } else if (!hasRunPreview || filtersStale) {
    state = 'needs-preview';
    if (staleReason === 'storage-event') {
      label = 'PREVIEW REQUIRED – filters changed in another tab.';
    } else {
      label = 'PREVIEW REQUIRED – filters changed.';
    }
  } else {
    state = 'fresh';
    label = 'UP TO DATE – preview matches current filters.';
  }

  if (projectLabel !== 'None' && rangeLabel) {
    label += ' · ' + projectLabel + CONTEXT_SEPARATOR + rangeLabel;
  }

  return { state, label, context: { projects, startVal, endVal, projectLabel, rangeLabel, filtersStale, hasRunPreview } };
}

export function hydrateFromLastQuery() {
  let ctx = getValidLastQuery();
  let fallbackProjects = [];
  try {
    const rawMeta = sessionStorage.getItem(REPORT_LAST_META_KEY);
    const parsedMeta = rawMeta ? JSON.parse(rawMeta) : null;
    if (parsedMeta && Array.isArray(parsedMeta.projects)) {
      fallbackProjects = parsedMeta.projects.map((p) => String(p || '').trim()).filter(Boolean);
    }
  } catch (_) {}
  if (!fallbackProjects.length) {
    try {
      const ssot = localStorage.getItem(PROJECTS_SSOT_KEY);
      if (ssot) fallbackProjects = ssot.split(',').map((p) => p.trim()).filter(Boolean);
    } catch (_) {}
  }
  if (fallbackProjects.length) fallbackProjects = Array.from(new Set(fallbackProjects));
  if (!ctx || !ctx.projects) {
    ctx = { projects: fallbackProjects.length ? fallbackProjects.join(',') : 'MPSA,MAS' };
  }

  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  if (ctx) {
    if (startInput && ctx.start) startInput.value = ctx.start.slice(0, 16);
    if (endInput && ctx.end) endInput.value = ctx.end.slice(0, 16);
    const projects = (ctx.projects || '').split(',').map((p) => p.trim()).filter(Boolean);
    document.querySelectorAll('.project-checkbox[data-project]').forEach((input) => {
      input.checked = projects.includes(input.dataset.project);
    });
  }
}
