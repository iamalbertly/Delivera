import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { renderEmptyStateHtml } from './Reporting-App-Shared-Empty-State-Helpers.js';

export function renderEmptyState(targetElement, title, message, hint, ctaLabel) {
  if (!targetElement) return;
  targetElement.innerHTML = renderEmptyStateHtml(title, message, hint, ctaLabel);
}

export function getSafeMeta(preview) {
  if (!preview || !preview.meta) {
    return null;
  }

  const raw = preview.meta;

  return {
    windowStart: raw.windowStart || '',
    windowEnd: raw.windowEnd || '',
    selectedProjects: Array.isArray(raw.selectedProjects) ? raw.selectedProjects : [],
    sprintCount: typeof raw.sprintCount === 'number'
      ? raw.sprintCount
      : Array.isArray(preview.sprintsIncluded)
        ? preview.sprintsIncluded.length
        : 0,
    fromCache: raw.fromCache === true,
    cacheAgeMinutes: raw.cacheAgeMinutes,
    partial: raw.partial === true,
    partialReason: raw.partialReason || '',
    generatedAt: raw.generatedAt,
    requestedAt: raw.requestedAt,
    elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : null,
    cachedElapsedMs: typeof raw.cachedElapsedMs === 'number' ? raw.cachedElapsedMs : null,
    discoveredFields: raw.discoveredFields || {},
    fieldInventory: raw.fieldInventory || null,
    requireResolvedBySprintEnd: !!raw.requireResolvedBySprintEnd,
    epicTTMFallbackCount: raw.epicTTMFallbackCount || 0,
  };
}

export async function getDateRangeLabel(start, end) {
  try {
    const res = await fetch(`/api/format-date-range?start=${encodeURIComponent(start || '')}&end=${encodeURIComponent(end || '')}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.dateRange) return data.dateRange;
    }
  } catch (_) {}
  const s = (start || '').split('T')[0];
  const e = (end || '').split('T')[0];
  return s && e ? `${s}_to_${e}` : 'date-range';
}

export function buildCsvFilename(section, meta, qualifier = '', dateRange = null) {
  const projects = (meta?.selectedProjects || []).join('-') || 'Projects';
  const range = dateRange != null
    ? dateRange
    : ((meta?.windowStart || '').split('T')[0] && (meta?.windowEnd || '').split('T')[0]
      ? `${(meta.windowStart || '').split('T')[0]}_to_${(meta.windowEnd || '').split('T')[0]}`
      : 'date-range');
  const exportDate = new Date().toISOString().split('T')[0];
  const partialSuffix = meta?.partial ? '_PARTIAL' : '';
  const cleanedSection = section.replace(/[^a-z0-9-]/gi, '-');
  const cleanedQualifier = qualifier ? `_${qualifier.replace(/[^a-z0-9-]/gi, '-')}` : '';
  return `${projects}_${range}_${cleanedSection}${cleanedQualifier}${partialSuffix}_${exportDate}.csv`;
}
