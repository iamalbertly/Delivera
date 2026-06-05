/**
 * Governance scope — project + period selectors (scroll pills desktop, native select mobile).
 */
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { readCatalogKeys } from './Delivera-Shared-Projects-Catalog-01SSOT.js';

export function unionProjectKeys(...lists) {
  const set = new Set();
  for (const list of lists) {
    for (const pk of list || []) {
      const v = String(pk || '').trim().toUpperCase();
      if (v) set.add(v);
    }
  }
  return Array.from(set).sort();
}

export function catalogProjectKeys() {
  return readCatalogKeys();
}

export function renderProjectChips(projectKeys, selected, accessByKey = {}) {
  return projectKeys.map((pk) => {
    const on = selected.includes(pk);
    const limited = accessByKey[pk] === false;
    const cls = `gov-scope-chip${on ? ' is-on' : ''}${limited ? ' gov-scope-chip--limited' : ''}`;
    const title = limited ? 'Jira access not confirmed for this project' : pk;
    return `<button type="button" class="${cls}" data-project="${pk}" aria-pressed="${on}" title="${escapeHtml(title)}">${escapeHtml(pk)}</button>`;
  }).join('');
}

export function renderQuarterStrip(quarters, activeQuarter) {
  if (!quarters.length) {
    return '<span class="gov-scope-quarter-pill is-on">Current</span>';
  }
  return quarters.map((q) => {
    const label = q.label || q.period || '';
    const on = label === activeQuarter || (!activeQuarter && q.isCurrent);
    return `<button type="button" class="gov-scope-quarter-pill${on ? ' is-on' : ''}" data-quarter="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
  }).join('');
}

export function renderMobileProjectChecklist(projectKeys, selected, accessByKey = {}) {
  const checks = projectKeys.map((pk) => {
    const on = selected.includes(pk);
    const limited = accessByKey[pk] === false ? ' (limited)' : '';
    return `<label class="gov-scope-mobile-check">
      <input type="checkbox" class="gov-scope-mobile-project-check" value="${escapeHtml(pk)}"${on ? ' checked' : ''} />
      <span>${escapeHtml(pk)}${escapeHtml(limited)}</span>
    </label>`;
  }).join('');
  return `<div class="gov-scope-mobile-projects" role="group" aria-label="Projects">${checks}</div>`;
}

export function renderMobileQuarterSelect(quarters, activeQuarter) {
  const opts = quarters.map((q) => {
    const label = q.label || q.period || '';
    const on = label === activeQuarter || (!activeQuarter && q.isCurrent);
    return `<option value="${escapeHtml(label)}"${on ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
  return `<label class="gov-scope-mobile-field">Period
    <select class="gov-scope-select gov-scope-mobile-quarter" aria-label="Period">${opts}</select>
  </label>`;
}

export function renderExpandedSelectors({
  projectKeys,
  selected,
  quarters,
  activeQuarter,
  advancedLabel,
  boardsWarn = '',
  accessByKey = {},
}) {
  const quarterPills = renderQuarterStrip(quarters, activeQuarter);
  const chips = renderProjectChips(projectKeys, selected, accessByKey);
  return `
    <div class="gov-scope-bar-inner gov-scope-bar-inner--expanded">
      ${boardsWarn ? `<p class="gov-scope-boards-warn" role="status">${escapeHtml(boardsWarn)}</p>` : ''}
      <div class="gov-scope-desktop-only">
        <span class="gov-scope-label">Projects</span>
        <div class="gov-scope-chips gov-scope-chips--scroll" role="group" aria-label="Projects">${chips}</div>
        <div class="gov-scope-period" role="group" aria-label="Period">
          <span class="gov-scope-label">Period</span>
          <div class="gov-scope-quarter-strip">${quarterPills}</div>
        </div>
      </div>
      <div class="gov-scope-mobile-only">
        ${renderMobileProjectChecklist(projectKeys, selected, accessByKey)}
        ${renderMobileQuarterSelect(quarters, activeQuarter)}
      </div>
      <button type="button" id="gov-scope-baseline" class="btn btn-secondary btn-compact">${escapeHtml(COPY.piBaselineCta)}</button>
      <button type="button" id="gov-scope-advanced" class="btn btn-link btn-compact">${escapeHtml(advancedLabel)}</button>
    </div>`;
}
