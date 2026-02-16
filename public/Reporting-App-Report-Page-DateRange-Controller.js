import { formatDateForDisplay, formatDateTimeLocalForInput, formatDateShort } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { toUtcIsoFromLocalInput } from './Reporting-App-Report-Utils-Data-Helpers.js';
import { initQuarterStrip } from './Reporting-App-Shared-Quarter-Range-Helpers.js';
import { SHARED_DATE_RANGE_KEY, REPORT_HAS_RUN_PREVIEW_KEY } from './Reporting-App-Shared-Storage-Keys.js';

let lastQuarterLabel = null;

export function isRangeValid() {
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  const startVal = startInput?.value || '';
  const endVal = endInput?.value || '';
  if (!startVal || !endVal) return true;
  const start = new Date(startVal).getTime();
  const end = new Date(endVal).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return true;
  return end >= start;
}

export function updateDateDisplay() {
  const startDate = document.getElementById('start-date')?.value || '';
  const endDate = document.getElementById('end-date')?.value || '';

  if (startDate && endDate) {
    const startISO = toUtcIsoFromLocalInput(startDate);
    const endISO = toUtcIsoFromLocalInput(endDate, true);
    if (!startISO || !endISO) {
      document.getElementById('date-display').innerHTML = `
        <small>
          UTC: Invalid date input<br>
          Local: Invalid date input
        </small>
      `;
      return;
    }
    const startLocal = formatDateForDisplay(startDate);
    const endLocal = formatDateForDisplay(endDate);
    const startUtc = new Date(startISO).toUTCString();
    const endUtc = new Date(endISO).toUTCString();

    document.getElementById('date-display').innerHTML = `
      <small>
        UTC: ${startUtc} to ${endUtc}<br>
        Local: ${startLocal} to ${endLocal}
      </small>
    `;
  }
}

function persistSharedDateRange() {
  const startDate = document.getElementById('start-date')?.value || '';
  const endDate = document.getElementById('end-date')?.value || '';
  if (!startDate || !endDate) return;
  const startISO = toUtcIsoFromLocalInput(startDate);
  const endISO = toUtcIsoFromLocalInput(endDate, true);
  if (!startISO || !endISO) return;
  try {
    localStorage.setItem(SHARED_DATE_RANGE_KEY, JSON.stringify({ start: startISO, end: endISO }));
  } catch (_) {}
}

function hydrateSharedDateRange(startInput, endInput) {
  try {
    const raw = localStorage.getItem(SHARED_DATE_RANGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.start || !parsed?.end) return false;
    const start = new Date(parsed.start);
    const end = new Date(parsed.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    if (startInput) startInput.value = formatDateTimeLocalForInput(start);
    if (endInput) endInput.value = formatDateTimeLocalForInput(end);
    return true;
  } catch (_) {
    return false;
  }
}

function updateRangeSummary(quarterLabel) {
  const summaryEl = document.getElementById('date-range-summary');
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  if (!summaryEl) return;
  const startVal = startInput?.value || '';
  const endVal = endInput?.value || '';
  const valid = isRangeValid();
  if (!valid && startVal && endVal) {
    summaryEl.textContent = 'End date must be after start date.';
    return;
  }
  if (quarterLabel != null) {
    lastQuarterLabel = quarterLabel;
  } else {
    lastQuarterLabel = null;
  }
  if (!startVal || !endVal) {
    summaryEl.textContent = 'Select a quarter or enter dates.';
    return;
  }
  const startDate = new Date(startVal);
  const endDate = new Date(endVal);
  const startStr = Number.isNaN(startDate.getTime()) ? '' : formatDateShort(startDate);
  const endStr = Number.isNaN(endDate.getTime()) ? '' : formatDateShort(endDate);
  const suffix = lastQuarterLabel ? ` (${lastQuarterLabel})` : ' (Custom range)';
  summaryEl.textContent = startStr && endStr ? `${startStr} – ${endStr}${suffix}` : 'Select a quarter or enter dates.';
}

export function updateRangeHint() {
  const hintEl = document.getElementById('range-hint');
  if (!hintEl) return;
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  const startVal = startInput?.value || '';
  const endVal = endInput?.value || '';
  let rangeDays = 0;
  if (startVal && endVal) {
    const start = new Date(startVal);
    const end = new Date(endVal);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      rangeDays = Math.round((end - start) / (24 * 60 * 60 * 1000));
    }
  }
  try {
    const hasRun = sessionStorage.getItem(REPORT_HAS_RUN_PREVIEW_KEY) === '1';
    hintEl.style.display = (rangeDays > 90 || !hasRun) ? 'block' : 'none';
  } catch (_) {
    hintEl.style.display = rangeDays > 90 ? 'block' : 'none';
  }
}

function tryFirstRunAutoSetRange(startInput, endInput) {
  try {
    if (sessionStorage.getItem(REPORT_HAS_RUN_PREVIEW_KEY) === '1') return;
  } catch (_) { return; }
  const startVal = startInput?.value || '';
  const endVal = endInput?.value || '';
  let rangeDays = 0;
  if (startVal && endVal) {
    const start = new Date(startVal);
    const end = new Date(endVal);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      rangeDays = Math.round((end - start) / (24 * 60 * 60 * 1000));
    }
  }
  if (rangeDays <= 180) return;
  fetch('/api/quarters-list?count=8', { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : { quarters: [] }))
    .catch(() => ({ quarters: [] }))
    .then((data) => {
      const quarters = data.quarters || [];
      if (quarters.length === 0) return;
      const now = Date.now();
      const completed = quarters.filter((q) => q && q.end && new Date(q.end).getTime() <= now);
      const lastQuarter = completed.length > 0 ? completed[completed.length - 1] : quarters[quarters.length - 1];
      const qStart = lastQuarter?.start;
      const qEnd = lastQuarter?.end;
      if (!qStart || !qEnd || !startInput || !endInput) return;
      startInput.value = formatDateTimeLocalForInput(qStart);
      endInput.value = formatDateTimeLocalForInput(qEnd);
      persistSharedDateRange();
      updateDateDisplay();
      const hintEl = document.getElementById('range-hint');
      if (hintEl) {
        hintEl.textContent = "We've set the range to last quarter for a faster first run. You can change it.";
        hintEl.style.display = 'block';
      } else {
        updateRangeHint();
      }
    });
}

export function initDateRangeControls(onApply, onValidationChange) {
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  const hydratedFromShared = hydrateSharedDateRange(startInput, endInput);

  const syncSummaryAndValidation = () => {
    updateRangeSummary(null);
    if (typeof onValidationChange === 'function') onValidationChange(isRangeValid());
  };
  if (startInput) {
    startInput.addEventListener('change', () => { updateDateDisplay(); updateRangeHint(); persistSharedDateRange(); syncSummaryAndValidation(); });
    startInput.addEventListener('input', syncSummaryAndValidation);
  }
  if (endInput) {
    endInput.addEventListener('change', () => { updateDateDisplay(); updateRangeHint(); persistSharedDateRange(); syncSummaryAndValidation(); });
    endInput.addEventListener('input', syncSummaryAndValidation);
  }
  updateDateDisplay();
  updateRangeHint();
  tryFirstRunAutoSetRange(startInput, endInput);

  updateRangeSummary(null);

  initQuarterStrip('.quarter-strip-inner', startInput, endInput, {
    formatInputValue: formatDateTimeLocalForInput,
    updateDateDisplay: () => {
      updateDateDisplay();
      persistSharedDateRange();
      updateRangeHint();
    },
    onShowCustom: () => {
      updateRangeSummary(null);
      if (typeof onValidationChange === 'function') onValidationChange(isRangeValid());
    },
    onHideCustom: () => {},
    onClearSelection: () => { updateRangeHint(); },
    onQuartersLoaded: () => {
      updateRangeHint();
      updateRangeSummary(lastQuarterLabel);
      if (hydratedFromShared) return;
      const hasStart = !!(startInput?.value || '');
      const hasEnd = !!(endInput?.value || '');
      if (hasStart && hasEnd) return;
      const firstQuarterPill = document.querySelector('.quarter-strip-inner .quarter-pill:not(.quarter-pill-custom)');
      if (firstQuarterPill) {
        firstQuarterPill.click();
      }
    },
    onApply: (data) => {
      updateRangeSummary(data?.data?.label ?? null);
      persistSharedDateRange();
      updateRangeHint();
      if (typeof onApply === 'function') onApply();
      if (typeof onValidationChange === 'function') onValidationChange(isRangeValid());
    },
  });
}
