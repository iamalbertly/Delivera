/**
 * SSOT: Server-side project display name resolution.
 */
import { getProjectDisplayMode, catalogEntryFromList } from './Delivera-Org-Project-Catalog-01IO-SSOT.js';

/**
 * @param {string} key
 * @param {object} entry - catalog row or null
 * @param {{ context?: string, displayMode?: string }} [opts]
 */
export function resolveProjectDisplay(key, entry = null, opts = {}) {
  const k = String(key || '').trim().toUpperCase();
  const mode = opts.displayMode || getProjectDisplayMode();
  const context = String(opts.context || 'summary');
  const label = entry?.label || k;
  const short = entry?.shortLabel || label;
  const primary = context === 'chip' ? short : label;

  if (!entry) {
    return {
      key: k,
      primary: k,
      secondary: '',
      tooltip: k ? `Not in org catalog (Jira: ${k})` : '',
      ariaLabel: k,
      full: k,
    };
  }

  let primaryText = primary;
  let secondary = '';
  if (mode === 'key') {
    primaryText = k;
    secondary = label !== k ? label : '';
  } else if (mode === 'both') {
    primaryText = `${primary} (${k})`;
  }

  const tooltip = subtitleSuffix(entry)
    ? `${label} (Jira: ${k}) — ${entry.subtitle}`
    : `${label} (Jira: ${k})`;

  return {
    key: k,
    primary: primaryText,
    secondary,
    tooltip,
    ariaLabel: tooltip,
    full: mode === 'both' ? `${label} (${k})` : primaryText,
  };
}

function subtitleSuffix(entry) {
  return entry?.subtitle ? String(entry.subtitle).trim() : '';
}

/**
 * @param {string[]} keys
 * @param {object[]} catalogProjects
 * @param {{ displayMode?: string, context?: string }} [opts]
 */
export function summarizeProjectKeys(keys, catalogProjects, opts = {}) {
  const list = (keys || []).map((k) => String(k || '').trim().toUpperCase()).filter(Boolean);
  if (!list.length) return { label: 'None', full: 'None' };
  const resolved = list.map((k) => {
    const entry = catalogEntryFromList(catalogProjects, k);
    return resolveProjectDisplay(k, entry, { ...opts, context: opts.context || 'summary' }).primary;
  });
  if (resolved.length <= 2) return { label: resolved.join(', '), full: resolved.join(', ') };
  return {
    label: `${resolved[0]}, ${resolved[1]} +${resolved.length - 2}`,
    full: resolved.join(', '),
  };
}
