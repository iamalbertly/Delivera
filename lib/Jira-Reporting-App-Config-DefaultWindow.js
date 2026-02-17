/**
 * Single source of truth for default report date window.
 * Default behavior: latest completed Vodacom quarter in UTC.
 */
import { getQuartersUpToCurrent } from './Jira-Reporting-App-Data-VodacomQuarters-01Bounds.js';

function resolveLatestCompletedQuarterRange() {
  const quarters = getQuartersUpToCurrent(8);
  if (!Array.isArray(quarters) || quarters.length === 0) return null;
  const currentIdx = quarters.findIndex((q) => q?.isCurrent);
  if (currentIdx > 0) return quarters[currentIdx - 1];
  return quarters[quarters.length - 1];
}

const DEFAULT_RANGE = resolveLatestCompletedQuarterRange();
export const DEFAULT_WINDOW_START = DEFAULT_RANGE?.startISO || '2025-07-01T00:00:00.000Z';
export const DEFAULT_WINDOW_END = DEFAULT_RANGE?.endISO || '2025-09-30T23:59:59.999Z';
