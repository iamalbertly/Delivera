import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

export function buildDataTableHtml(columns, rows, options = {}) {
  const { id, rowClassKey = '__rowClass', footerRow = null, footerTooltips = null, wrapperClass = '', tableClass = '' } = options;
  const safeWrapperClass = String(wrapperClass || '').trim();
  const safeTableClass = String(tableClass || '').trim();
  const wrapClassName = ['data-table-scroll-wrap', safeWrapperClass].filter(Boolean).join(' ');
  const tableClassName = ['data-table', 'data-table--mobile-scroll', safeTableClass].filter(Boolean).join(' ');
  let html = '';
  html += `<div class="${wrapClassName}">`;
  html += (id ? `<table class="${tableClassName}" id="${id}">` : `<table class="${tableClassName}">`);
  html += '<thead><tr>';
  for (const col of columns) {
    const title = col.title || col;
    html += `<th title="${escapeHtml(title)}" data-tooltip="${escapeHtml(title)}">${escapeHtml(col.label || col)}</th>`;
  }
  html += '</tr></thead>';
  html += '<tbody>';
  for (const r of rows) {
    const rowClass = r && r[rowClassKey] ? ` class="${escapeHtml(String(r[rowClassKey]))}"` : '';
    html += `<tr${rowClass}>`;
    for (const col of columns) {
      const key = (col.key || col).toString();
      let value = '';
      if (typeof col.renderer === 'function') {
        try { value = col.renderer(r); } catch (e) { value = ''; }
      } else {
        value = (r[key] == null) ? '' : String(r[key]);
      }
      const label = escapeHtml(col.label || col.key || col);
      html += '<td data-label="' + label + '">' + escapeHtml(value) + '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody>';
  if (footerRow) {
    html += '<tfoot><tr class="boards-summary-row">';
    for (const col of columns) {
      const key = (col.key || col).toString();
      const tip = footerTooltips && footerTooltips[key] ? footerTooltips[key] : '';
      const value = footerRow[key] == null ? '' : String(footerRow[key]);
      const label = escapeHtml(col.label || col.key || col);
      html += `<td data-label="${label}" title="${escapeHtml(tip)}" data-tooltip="${escapeHtml(tip)}">${escapeHtml(value)}</td>`;
    }
    html += '</tr></tfoot>';
  }
  html += '</table>';
  html += '</div>';
  return html;
}
