import { reportState } from './Reporting-App-Report-Page-State.js';
import { reportDom } from './Reporting-App-Report-Page-Context.js';
import { buildCsvFilename, getDateRangeLabel, getSafeMeta } from './Reporting-App-Report-Page-Render-Helpers.js';
import { generateCSVClient } from './Reporting-App-Report-Utils-Data-Helpers.js';
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

export function validateCSVColumns(columns, rows) {
  if (!Array.isArray(columns) || columns.length === 0) return false;
  if (!Array.isArray(rows)) return false;
  return true;
}

export function downloadCSV(csv, filename, options = {}) {
  const { anchorEl = null, exportId = null } = options;
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 500);

    const successMsg = document.createElement('div');
    successMsg.className = 'export-success-msg';
    const strong = document.createElement('strong'); strong.textContent = 'Exported:';
    successMsg.appendChild(strong);
    successMsg.appendChild(document.createTextNode(' ' + filename));
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 4000);
  } catch (err) {
    // If an anchor/button was provided, show a compact inline fallback next to it requiring fewer visual changes
    if (anchorEl && anchorEl.parentElement) {
      // Remove existing fallback if present for this exportId
      const existing = anchorEl.parentElement.querySelector('.export-copy-csv');
      if (existing) existing.remove();

      const wrapper = document.createElement('div');
      wrapper.className = 'export-copy-inline';
      wrapper.style.display = 'inline-block';
      wrapper.style.marginLeft = '8px';
      wrapper.innerHTML = `<button type="button" class="btn btn-compact export-copy-csv" data-export-copy="${escapeHtml(exportId || '')}">Copy CSV</button>`;
      anchorEl.parentElement.appendChild(wrapper);
      const copyBtn = wrapper.querySelector('.export-copy-csv');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(csv);
            } else {
              const ta = document.createElement('textarea');
              ta.value = csv;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              ta.remove();
            }
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { if (copyBtn) copyBtn.textContent = 'Copy CSV'; }, 3000);
          } catch (copyErr) {
            copyBtn.textContent = 'Copy failed';
          }
        });
      }
      return;
    }

    const errorEl = reportDom.errorEl;
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.innerHTML = `
        <div role="alert">
          <strong>Export error:</strong> Unable to download CSV file.
          <br><small>Your browser may be blocking downloads or an unexpected error occurred.</small>
          <div style="margin-top:8px">
            <button type="button" id="export-copy-csv" class="btn btn-compact">Copy CSV to clipboard</button>
            <button type="button" class="error-close" aria-label="Dismiss">x</button>
          </div>
        </div>
      `;

      const copyBtn = document.getElementById('export-copy-csv');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(csv);
            } else {
              const ta = document.createElement('textarea');
              ta.value = csv;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              ta.remove();
            }
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { if (copyBtn) copyBtn.textContent = 'Copy CSV to clipboard'; }, 3000);
          } catch (copyErr) {
            copyBtn.textContent = 'Copy failed';
          }
        });
      }
    }
  }
} 

export async function exportCSV(rows, type, columns) {
  const meta = getSafeMeta(reportState.previewData);
  if (!meta) return;
  if (!validateCSVColumns(columns, rows)) return;

  const dateRange = await getDateRangeLabel(meta.windowStart, meta.windowEnd);
  const filename = buildCsvFilename('voda-agile-board', meta, type, dateRange);

  try {
    const csv = generateCSVClient(columns, rows);
    downloadCSV(csv, filename);
  } catch (_) {
    const errorEl = reportDom.errorEl;
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.innerHTML = `
        <strong>Export error:</strong> Unable to download CSV file.
        <br><small>Check the browser console or try again.</small>
        <button type="button" class="error-close" aria-label="Dismiss">x</button>
      `;
    }
  }
}
