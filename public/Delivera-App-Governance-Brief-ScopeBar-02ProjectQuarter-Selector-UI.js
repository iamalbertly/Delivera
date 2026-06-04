/**
 * Governance scope — project + period selectors (scroll pills desktop, native select mobile).
 */
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

const FALLBACK_PROJECTS = ['MPSA', 'MAS', 'RPA', 'SD'];

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

export function renderProjectChips(projectKeys, selected) {
  return projectKeys.map((pk) => {
    const on = selected.includes(pk);
    return `<button type="button" class="gov-scope-chip${on ? ' is-on' : ''}" data-project="${pk}" aria-pressed="${on}">${escapeHtml(pk)}</button>`;
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

export function renderMobileProjectSelect(projectKeys, selected) {
  const opts = projectKeys.map((pk) => {
    const on = selected.includes(pk);
    return `<option value="${escapeHtml(pk)}"${on ? ' selected' : ''}>${escapeHtml(pk)}</option>`;
  }).join('');
  return `<label class="gov-scope-mobile-field">Project
    <select class="gov-scope-select gov-scope-mobile-project" aria-label="Project">${opts}</select>
  </label>`;
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
}) {
  const quarterPills = renderQuarterStrip(quarters, activeQuarter);
  const chips = renderProjectChips(projectKeys, selected);
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
        ${renderMobileProjectSelect(projectKeys, selected)}
        ${renderMobileQuarterSelect(quarters, activeQuarter)}
      </div>
      <button type="button" id="gov-scope-baseline" class="btn btn-secondary btn-compact">Set PI baseline</button>
      <button type="button" id="gov-scope-advanced" class="btn btn-link btn-compact">${escapeHtml(advancedLabel)}</button>
    </div>`;
}

export { FALLBACK_PROJECTS };
