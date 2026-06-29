/**
 * Governance scope — project + period selectors (scroll pills desktop, native select mobile).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { readCatalogKeys } from './Delivera-Shared-Projects-Catalog-01SSOT.js';
import { resolveProjectDisplay } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';

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
    const display = resolveProjectDisplay(pk, { context: 'chip' });
    const accessNote = limited ? ' — Jira access not confirmed' : '';
    const title = limited
      ? `Jira access not confirmed for ${display.tooltip}`
      : display.tooltip;
    return `<button type="button" class="${cls}" data-project="${pk}" aria-pressed="${on}" aria-label="${escapeHtml(display.ariaLabel + accessNote)}" title="${escapeHtml(title)}">${escapeHtml(display.primary)}</button>`;
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
    const display = resolveProjectDisplay(pk, { context: 'chip' });
    return `<label class="gov-scope-mobile-check">
      <input type="checkbox" class="gov-scope-mobile-project-check" value="${escapeHtml(pk)}"${on ? ' checked' : ''} />
      <span>${escapeHtml(display.primary)}${escapeHtml(limited)}</span>
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

export function renderPeriodPresetChip(activeQuarter, periodWindow) {
  const on = periodWindow === 'pi';
  const q = activeQuarter || 'Current';
  const label = `PI · ${q}`;
  return `<button type="button" class="gov-period-chip gov-period-preset-chip${on ? ' is-on' : ''}" data-period-preset="pi-quarter" title="Set period to PI and ${escapeHtml(q)}">${escapeHtml(label)}</button>`;
}

function renderAdvancedScopeControl(advancedLabel, { openByDefault = false } = {}) {
  const openAttr = openByDefault ? ' open' : '';
  return `<details class="gov-scope-intel-block"${openAttr}>
    <summary class="gov-scope-advanced-label">${escapeHtml(advancedLabel)}</summary>
    <p class="gov-scope-drawer-note">Governance rules use Vodacom delivery grammar (stale-in-progress, late scope, data confidence). Strict changelog sprint membership is deferred.</p>
    <div class="gov-scope-intel-inline" data-scope-intel-inline></div>
  </details>`;
}

export function renderExpandedSelectors({
  projectKeys,
  selected,
  quarters,
  activeQuarter,
  advancedLabel,
  advancedWarnCount = 0,
  boardsWarn = '',
  accessByKey = {},
  periodWindowChips = '',
  investmentChip = '',
  periodWindow = '28d',
  openAdvancedScope = false,
}) {
  const quarterPills = renderQuarterStrip(quarters, activeQuarter);
  const chips = renderProjectChips(projectKeys, selected, accessByKey);
  const compareSelected = selected.length > 1 ? ' data-compare-mode="1"' : '';
  const presetChip = renderPeriodPresetChip(activeQuarter, periodWindow);
  const periodRow = `${presetChip}${periodWindowChips}${quarterPills ? `<span class="gov-scope-period-sep" aria-hidden="true">·</span>${quarterPills}` : ''}${investmentChip}`;
  const mobilePeriodBlock = `<div class="gov-scope-period gov-scope-period--merged gov-scope-mobile-period" role="group" aria-label="Period">
        <div class="gov-scope-period-merged-row">${periodRow}</div>
      </div>`;
  const advancedScope = renderAdvancedScopeControl(advancedLabel, { openByDefault: openAdvancedScope });
  return `
    ${boardsWarn ? `<p class="gov-scope-boards-warn" role="status">${escapeHtml(boardsWarn)}</p>` : ''}
    <div class="gov-scope-desktop-only gov-scope-flat-selectors" role="group" aria-label="Scope selectors">
      <div class="gov-scope-chips" role="group" aria-label="Projects"${compareSelected}>${chips}</div>
      <div class="gov-scope-period-merged-row" role="group" aria-label="Period">${periodRow}</div>
    </div>
    <div class="gov-scope-mobile-only">
      ${renderMobileProjectChecklist(projectKeys, selected, accessByKey)}
      ${mobilePeriodBlock}
    </div>
    ${advancedScope}`;
}
