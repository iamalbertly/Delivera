import { formatDateTimeLocalForInput } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';

export function getFiscalShortLabel(endDate) {
  if (!endDate || Number.isNaN(endDate.getTime())) return '';
  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const fy = endMonth <= 2 ? endYear : endYear + 1;
  return `FY${String(fy).slice(-2)}`;
}

export function getVodacomQuarterFallback(quarterNum) {
  const q = Number(quarterNum);
  if (!Number.isInteger(q) || q < 1 || q > 4) return null;
  const bounds = { 1: [3, 1, 5, 30], 2: [6, 1, 8, 30], 3: [9, 1, 11, 31], 4: [0, 1, 2, 31] };
  const [sm, sd, em, ed] = bounds[q];
  const now = new Date();
  let year = now.getUTCFullYear();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999);
  for (let i = 0; i < 10; i++) {
    const start = new Date(Date.UTC(year, sm, sd, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, em, ed, 23, 59, 59, 999));
    if (end.getTime() <= todayUtc) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const fmt = (d) => `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      const fyLabel = getFiscalShortLabel(end);
      return { start: start.toISOString(), end: end.toISOString(), label: `${fyLabel} Q${q}`, period: `${fmt(start)} - ${fmt(end)}` };
    }
    year -= 1;
  }
  return null;
}

export function applyQuarterButtonContent(btn, data) {
  const label = data?.label || btn.textContent || '';
  const period = data?.period || '';
  btn.textContent = '';
  const labelEl = document.createElement('span');
  labelEl.className = 'quick-range-label';
  labelEl.textContent = label;
  btn.appendChild(labelEl);
  if (period) {
    const periodEl = document.createElement('span');
    periodEl.className = 'quick-range-period';
    periodEl.textContent = period;
    btn.appendChild(periodEl);
    btn.title = period;
    btn.setAttribute('aria-label', `${label} (${period})`);
  } else {
    btn.removeAttribute('title');
    btn.setAttribute('aria-label', label);
  }
}

export function initQuarterQuickRange(options = {}) {
  const {
    buttonSelector,
    containerSelector,
    startInput,
    endInput,
    formatInputValue = formatDateTimeLocalForInput,
    updateDateDisplay,
    onApply,
    setButtonsEnabled,
  } = options;

  const buttons = Array.from(document.querySelectorAll(buttonSelector));
  const container = containerSelector ? document.querySelector(containerSelector) : null;

  if (buttons.length === 0) return;
  buttons.forEach(btn => btn.setAttribute('aria-pressed', 'false'));

  const applyRange = async (btn) => {
    const q = btn.getAttribute('data-quarter');
    if (!q) return;
    try {
      if (setButtonsEnabled) setButtonsEnabled(false);
      buttons.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      let data = null;
      const res = await fetch(`/api/date-range?quarter=Q${encodeURIComponent(q)}`);
      if (res.ok) {
        data = await res.json();
      }
      if (!data || !data.start || !data.end) {
        data = getVodacomQuarterFallback(q);
      }
      if (!data || !data.start || !data.end) return;
      const startDate = new Date(data.start);
      const endDate = new Date(data.end);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        if (startInput && endInput) {
          startInput.value = formatInputValue(startDate);
          endInput.value = formatInputValue(endDate);
        }
        if (updateDateDisplay) updateDateDisplay();
        if (onApply) onApply({ startDate, endDate, data });
      }
    } catch (_) {
    } finally {
      if (setButtonsEnabled) setButtonsEnabled(true);
    }
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => applyRange(btn));
  });

  const fetches = [1, 2, 3, 4].map(async (q) => {
    try {
      const res = await fetch(`/api/date-range?quarter=Q${q}`);
      const data = res.ok ? await res.json() : null;
      return { q, data: (data && data.label) ? data : getVodacomQuarterFallback(q) };
    } catch (_) {
      return { q, data: getVodacomQuarterFallback(q) };
    }
  });

  Promise.all(fetches).then((results) => {
    const sortable = results
      .map(({ q, data }) => {
        const btn = buttons.find(b => b.getAttribute('data-quarter') === String(q));
        if (!btn || !data) return null;
        applyQuarterButtonContent(btn, data);
        const endTime = data.end ? new Date(data.end).getTime() : 0;
        return { btn, endTime };
      })
      .filter(Boolean)
      .sort((a, b) => a.endTime - b.endTime);
    if (container && sortable.length === buttons.length) {
      sortable.forEach(({ btn }) => container.appendChild(btn));
    }
  });
}

/**
 * Populates a scrollable strip with Vodacom quarter pills from /api/quarters-list (5+ quarters) plus a Custom pill.
 * Quarter = primary: selecting one hides custom date inputs. Custom = reveals start/end inputs.
 * @param {string} containerSelector - Selector for the inner strip container (gets pills appended).
 * @param {HTMLInputElement} startInput - Start date/datetime input.
 * @param {HTMLInputElement} endInput - End date/datetime input.
 * @param {Object} options - { formatInputValue, updateDateDisplay, onApply, onClearSelection, onQuartersLoaded, onShowCustom?, onHideCustom? }
 */
export function initQuarterStrip(containerSelector, startInput, endInput, options = {}) {
  const {
    formatInputValue = formatDateTimeLocalForInput,
    updateDateDisplay,
    onApply,
    onClearSelection,
    onQuartersLoaded,
    onShowCustom,
    onHideCustom,
  } = options;
  const container = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
  if (!container || !startInput || !endInput) return;

  container.innerHTML = '<span class="quarter-strip-loading" aria-live="polite">Loading quarters...</span>';
  container.style.minHeight = '2.5em';

  const clearSelection = () => {
    container.querySelectorAll('.quarter-pill').forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    if (typeof onShowCustom === 'function') onShowCustom();
    if (typeof options.onClearSelection === 'function') options.onClearSelection();
  };

  const applyQuarter = (q) => {
    const startDate = new Date(q.start);
    const endDate = new Date(q.end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
    const startVal = formatInputValue(startDate);
    const endVal = formatInputValue(endDate, true);
    startInput.value = startVal;
    endInput.value = endVal;
    if (typeof onHideCustom === 'function') onHideCustom();
    if (updateDateDisplay) updateDateDisplay();
    if (onApply) onApply({ startDate, endDate, data: q });
  };

  const selectCustom = () => {
    container.querySelectorAll('.quarter-pill').forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    if (typeof onShowCustom === 'function') onShowCustom();
  };

  startInput.addEventListener('change', clearSelection);
  startInput.addEventListener('input', clearSelection);
  endInput.addEventListener('change', clearSelection);
  endInput.addEventListener('input', clearSelection);

  fetch('/api/quarters-list?count=8', { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : { quarters: [] }))
    .catch(() => ({ quarters: [] }))
    .then((data) => {
      const quarters = data.quarters || [];
      const now = Date.now();
      const filteredQuarters = quarters.filter((q) => {
        if (!q || !q.start) return true;
        const startTime = new Date(q.start).getTime();
        if (Number.isNaN(startTime)) return true;
        return startTime <= now;
      });
      container.innerHTML = '';
      container.style.overflowX = 'auto';
      container.style.display = 'flex';
      container.style.gap = '6px';
      container.style.flexWrap = 'nowrap';
      container.setAttribute('role', 'group');
      container.setAttribute('aria-label', 'Vodacom quarters');
      if (filteredQuarters.length === 0) {
        const fallback = document.createElement('span');
        fallback.className = 'quarter-strip-fallback';
        fallback.setAttribute('aria-live', 'polite');
        fallback.textContent = 'Enter dates manually.';
        container.appendChild(fallback);
        if (onQuartersLoaded && typeof onQuartersLoaded === 'function') onQuartersLoaded();
        return;
      }
      // Ensure quarters are shown most-recent-first (end date desc)
      filteredQuarters.sort((a, b) => {
        const at = a && a.end ? new Date(a.end).getTime() : 0;
        const bt = b && b.end ? new Date(b.end).getTime() : 0;
        return bt - at;
      });
      filteredQuarters.forEach((q) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary btn-compact quarter-pill' + (q.isCurrent ? ' is-current' : '');
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('data-start', q.start || '');
        btn.setAttribute('data-end', q.end || '');
        // Use the shared renderer so the pill shows label and the period underneath for clarity
        applyQuarterButtonContent(btn, { label: q.label || '', period: q.period || '' });
        btn.title = q.period || q.label || '';
        btn.setAttribute('aria-label', (q.period ? `${q.label} (${q.period})` : q.label) || 'Quarter');
        btn.addEventListener('click', () => {
          clearSelection();
          btn.classList.add('is-active');
          btn.setAttribute('aria-pressed', 'true');
          applyQuarter(q);
        });
        container.appendChild(btn);
      });
      const customBtn = document.createElement('button');
      customBtn.type = 'button';
      customBtn.className = 'btn btn-secondary btn-compact quarter-pill quarter-pill-custom';
      customBtn.setAttribute('aria-pressed', 'false');
      customBtn.setAttribute('data-quarter', 'custom');
      customBtn.textContent = 'Custom';
      customBtn.setAttribute('aria-label', 'Custom date range');
      customBtn.addEventListener('click', () => {
        selectCustom();
        const wrap = document.getElementById('date-range-custom-wrap');
        if (wrap) { wrap.hidden = false; startInput.focus(); }
      });
      container.appendChild(customBtn);
      if (onQuartersLoaded && typeof onQuartersLoaded === 'function') onQuartersLoaded();
    });
}
