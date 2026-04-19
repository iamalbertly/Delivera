/**
 * Vodacom quarter bounds and "latest completed" logic. Single source of truth.
 * Q1 = Apr 1 - Jun 30, Q2 = Jul 1 - Sep 30, Q3 = Oct 1 - Dec 31, Q4 = Jan 1 - Mar 31.
 * "Latest completed" = quarter whose end date is <= today (UTC); never returns a future quarter.
 */

const VODACOM_QUARTER_BOUNDS = Object.freeze({
  1: { startMonth: 3, startDay: 1, endMonth: 5, endDay: 30 },   // Apr 1 - Jun 30 (0-indexed: 3, 5)
  2: { startMonth: 6, startDay: 1, endMonth: 8, endDay: 30 },   // Jul 1 - Sep 30
  3: { startMonth: 9, startDay: 1, endMonth: 11, endDay: 31 },  // Oct 1 - Dec 31
  4: { startMonth: 0, startDay: 1, endMonth: 2, endDay: 31 },   // Jan 1 - Mar 31
});

/**
 * Returns ISO date range for a Vodacom quarter in a given year.
 * @param {number} quarterNum - 1, 2, 3, or 4
 * @param {number} year - Full year (e.g. 2025)
 * @returns {{ startISO: string, endISO: string } | null}
 */
export function getQuarterRange(quarterNum, year) {
  const q = Number(quarterNum);
  const y = Number(year);
  if (!Number.isInteger(q) || q < 1 || q > 4 || !Number.isInteger(y)) return null;
  const bounds = VODACOM_QUARTER_BOUNDS[q];
  if (!bounds) return null;
  const start = new Date(Date.UTC(y, bounds.startMonth, bounds.startDay, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, bounds.endMonth, bounds.endDay, 23, 59, 59, 999));
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

/**
 * Returns the latest completed occurrence of the given Vodacom quarter (end date <= today UTC).
 * Never returns a future quarter.
 * @param {number} quarterNum - 1, 2, 3, or 4
 * @returns {{ startISO: string, endISO: string } | null}
 */
export function getLatestCompletedQuarter(quarterNum) {
  const q = Number(quarterNum);
  if (!Number.isInteger(q) || q < 1 || q > 4) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999);
  let year = today.getUTCFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const range = getQuarterRange(q, year);
    if (!range) return null;
    const endTime = new Date(range.endISO).getTime();
    if (endTime <= todayUtc) return range;
    year -= 1;
  }
  return null;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPeriodDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getUTCDate();
  const month = SHORT_MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function getFiscalYearLabel(endDate) {
  if (!endDate || Number.isNaN(endDate.getTime())) return { fy: null, shortLabel: '' };
  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const fy = endMonth <= 2 ? endYear : endYear + 1;
  const short = String(fy).slice(-2);
  return { fy, shortLabel: `FY${short}` };
}

/**
 * Returns latest completed quarter range plus display metadata: year, label, period.
 * @param {number} quarterNum - 1, 2, 3, or 4
 * @returns {{ startISO: string, endISO: string, year: number, label: string, period: string } | null}
 */
export function getQuarterLabelAndPeriod(quarterNum) {
  const range = getLatestCompletedQuarter(quarterNum);
  if (!range) return null;
  const end = new Date(range.endISO);
  const year = end.getUTCFullYear();
  const fyInfo = getFiscalYearLabel(end);
  const label = fyInfo.shortLabel
    ? `${fyInfo.shortLabel} Q${quarterNum}`
    : `Q${quarterNum} ${year}`;
  const period = `${formatPeriodDate(range.startISO)} - ${formatPeriodDate(range.endISO)}`;
  return { ...range, year, label, period, fiscalYear: fyInfo.fy, fiscalLabel: fyInfo.shortLabel };
}


/**
 * Returns an array of the last N Vodacom quarters up to and including the current quarter (oldest to newest).
 * Each element: { startISO, endISO, label, period, isCurrent }.
 * "Current" quarter is the one containing today; isCurrent is true only for that quarter.
 * @param {number} count - Number of quarters to return (default 8).
 * @returns {Array<{ startISO: string, endISO: string, label: string, period: string, isCurrent: boolean }>}
 */
export function getQuartersUpToCurrent(count = 8) {
  const n = Math.max(1, Math.min(Number(count) || 8, 20));
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  let qNum, qYear;
  if (m <= 2) {
    qNum = 4;
    qYear = y;
  } else if (m <= 5) {
    qNum = 1;
    qYear = y;
  } else if (m <= 8) {
    qNum = 2;
    qYear = y;
  } else {
    qNum = 3;
    qYear = y;
  }
  const quarters = [];
  let cq = qNum;
  let cy = qYear;
  for (let i = 0; i < n; i++) {
    const range = getQuarterRange(cq, cy);
    if (!range) break;
    const end = new Date(range.endISO);
    const fyInfo = getFiscalYearLabel(end);
    const label = fyInfo.shortLabel ? `${fyInfo.shortLabel} Q${cq}` : `Q${cq} ${cy}`;
    const period = `${formatPeriodDate(range.startISO)} - ${formatPeriodDate(range.endISO)}`;
    quarters.push({ ...range, label, period, isCurrent: false });
    if (cq === 1) {
      cq = 4;
      cy -= 1;
    } else {
      cq -= 1;
    }
  }
  quarters.reverse();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999);
  if (quarters.length > 0) {
    const last = quarters[quarters.length - 1];
    const endTime = new Date(last.endISO).getTime();
    if (endTime >= todayUtc) last.isCurrent = true;
  }
  return quarters;
}

/**
 * Returns quarter label for a date range if it exactly matches a Vodacom quarter; otherwise null.
 * Used by formatDateRangeForFilename.
 * @param {string} startISO - Start date ISO string
 * @param {string} endISO - End date ISO string
 * @returns {string | null} e.g. "Q2-2025" or null
 */
export function getQuarterLabelForRange(startISO, endISO) {
  if (!startISO || !endISO) return null;
  try {
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const startMonth = start.getUTCMonth();
    const startDay = start.getUTCDate();
    const endMonth = end.getUTCMonth();
    const endDay = end.getUTCDate();
    const year = start.getUTCFullYear();
    if (start.getUTCFullYear() !== year || end.getUTCFullYear() !== year) return null;
    for (const [q, bounds] of Object.entries(VODACOM_QUARTER_BOUNDS)) {
      if (
        startMonth === bounds.startMonth && startDay === bounds.startDay &&
        endMonth === bounds.endMonth && endDay === bounds.endDay
      ) {
        return `Q${q}-${year}`;
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}
