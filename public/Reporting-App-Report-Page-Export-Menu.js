import { reportDom } from './Reporting-App-Report-Page-Context.js';
import { getSafeMeta } from './Reporting-App-Report-Page-Render-Helpers.js';
import { reportState } from './Reporting-App-Report-Page-State.js';
import { exportCSV } from './Reporting-App-Report-Page-Export-CSV.js';
import { setActionErrorOnEl } from './Reporting-App-Shared-Status-Helpers.js';

function showExportError(message) {
  const { errorEl } = reportDom;
  if (!errorEl) return;
  setActionErrorOnEl(errorEl, {
    title: 'Export error',
    message: String(message || 'Failed to export Excel.'),
    primaryLabel: 'Retry export',
    primaryAction: 'trigger-export-excel',
    dismissible: true,
  });
}

function createSheet(name, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const first = safeRows[0] || {};
  const keys = Object.keys(first);
  const columns = keys.map((k) => ({ header: k, key: k }));
  return { name, columns, rows: safeRows };
}

async function requestExcelDownload(workbookData, meta) {
  const response = await fetch('/export-excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workbookData, meta }),
  });
  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    let parsedMessage = '';
    try {
      const parsed = rawText ? JSON.parse(rawText) : null;
      parsedMessage = parsed?.error || parsed?.message || '';
    } catch (_) {
      parsedMessage = '';
    }
    if (response.status >= 500) {
      throw new Error('Server error during Excel generation. Please try again.');
    }
    const safeMessage = parsedMessage || rawText || `Export failed with status ${response.status}`;
    throw new Error(safeMessage);
  }
  const blob = await response.blob();
  const cd = response.headers.get('content-disposition') || '';
  const match = /filename=\"?([^\";]+)\"?/i.exec(cd);
  const filename = match ? match[1] : 'jira-report.xlsx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleExcelExport(full = true) {
  const meta = getSafeMeta(reportState.previewData);
  if (!meta) {
    showExportError('No preview data to export.');
    return;
  }
  const { exportExcelBtn } = reportDom;
  const prevLabel = exportExcelBtn?.textContent ?? '';
  const prevDisabled = exportExcelBtn?.disabled ?? false;
  if (exportExcelBtn) {
    exportExcelBtn.textContent = 'Generating Excel…';
    exportExcelBtn.disabled = true;
  }
  try {
    const rows = full ? (reportState.previewRows || []) : (reportState.visibleRows || []);
    const boards = reportState.visibleBoardRows || reportState.previewData?.boards || [];
    const sprints = reportState.visibleSprintRows || reportState.previewData?.sprintsIncluded || [];
    const workbookData = {
      sheets: [
        createSheet('Stories', rows),
        createSheet('Boards', boards),
        createSheet('Sprints', sprints),
      ],
    };
    await requestExcelDownload(workbookData, meta);
  } finally {
    if (exportExcelBtn) {
      exportExcelBtn.textContent = prevLabel || 'Share / Export';
      const hasRows = Array.isArray(reportState.previewRows) && reportState.previewRows.length > 0;
      exportExcelBtn.disabled = !hasRows;
    }
  }
}

function getRowsForSection(sectionName) {
  const safeName = String(sectionName || '').trim();
  if (safeName === 'project-epic-level') {
    return reportState.visibleBoardRows || reportState.previewData?.boards || [];
  }
  if (safeName === 'sprints') {
    return reportState.visibleSprintRows || reportState.previewData?.sprintsIncluded || [];
  }
  if (safeName === 'unusable-sprints') {
    return reportState.previewData?.sprintsUnusable || [];
  }
  return reportState.visibleRows || reportState.previewRows || [];
}

function getActiveTabSectionName() {
  const activeBtn = document.querySelector('.tab-btn.active[data-tab]');
  const tab = activeBtn?.getAttribute('data-tab') || '';
  if (tab === 'project-epic-level') return 'project-epic-level';
  if (tab === 'sprints') return 'sprints';
  if (tab === 'unusable-sprints') return 'unusable-sprints';
  return 'done-stories';
}

/**
 * Triggers Excel export by programmatically clicking the sidebar Export to Excel button.
 * Used by the preview-header Export button and any keyboard shortcuts.
 */
export function triggerExcelExport() {
  const { exportExcelBtn } = reportDom;
  if (!exportExcelBtn || exportExcelBtn.disabled) return;
  handleExcelExport(true).catch((err) => showExportError(err?.message || err));
}

export function updateExportHint() {
  const { exportExcelBtn, exportDropdownTrigger, exportHint } = reportDom;
  if (!exportHint) return;
  const disabled = (exportExcelBtn ? exportExcelBtn.disabled : true) && (exportDropdownTrigger ? exportDropdownTrigger.disabled : true);
  exportHint.textContent = disabled ? 'Run a report to enable Share / Export.' : '';
}

export function updateExportFilteredState() {
  const { exportDropdownMenu } = reportDom;
  if (!exportDropdownMenu) return;
  const csvFiltered = exportDropdownMenu.querySelector('.export-dropdown-item[data-export="csv-filtered"]');
  const excelFiltered = exportDropdownMenu.querySelector('.export-dropdown-item[data-export="excel-filtered"]');
  const hasRows = Array.isArray(reportState.visibleRows) && reportState.visibleRows.length > 0;
  if (csvFiltered) csvFiltered.disabled = !hasRows;
  if (excelFiltered) excelFiltered.disabled = !hasRows;
  updateExportHint();
}

export function initExportMenu() {
  const { exportExcelBtn, exportDropdownTrigger, exportDropdownMenu } = reportDom;
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      if (exportExcelBtn.disabled) return;
      handleExcelExport(true).catch((err) => showExportError(err?.message || err));
    });
  }
  if (!exportDropdownTrigger || !exportDropdownMenu) return;

  function openExportMenu() {
    exportDropdownMenu.setAttribute('aria-hidden', 'false');
    exportDropdownTrigger.setAttribute('aria-expanded', 'true');
    const firstItem = exportDropdownMenu.querySelector('.export-dropdown-item:not([disabled])');
    if (firstItem) firstItem.focus();
  }

  function closeExportMenu() {
    exportDropdownMenu.setAttribute('aria-hidden', 'true');
    exportDropdownTrigger.setAttribute('aria-expanded', 'false');
  }

  exportDropdownTrigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = exportDropdownMenu.getAttribute('aria-hidden') === 'false';
    if (isOpen) {
      closeExportMenu();
    } else {
      openExportMenu();
    }
  });

  document.addEventListener('click', (event) => {
    if (!exportDropdownMenu.contains(event.target) && event.target !== exportDropdownTrigger) {
      closeExportMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeExportMenu();
    }
  });

  exportDropdownMenu.addEventListener('click', (event) => {
    const button = event.target.closest('.export-dropdown-item[data-export]');
    if (!button) return;
    const mode = button.getAttribute('data-export');
    if (mode === 'excel-full') {
      handleExcelExport(true).catch((err) => showExportError(err?.message || err));
      closeExportMenu();
      return;
    }
    if (mode === 'excel-filtered') {
      handleExcelExport(false).catch((err) => showExportError(err?.message || err));
      closeExportMenu();
      return;
    }
    if (mode === 'csv-filtered') {
      exportCSV(reportState.visibleRows || [], 'filtered', Object.keys((reportState.visibleRows || [])[0] || {}));
      closeExportMenu();
      return;
    }
    if (mode === 'csv-active-tab') {
      const section = getActiveTabSectionName();
      const rows = getRowsForSection(section);
      exportCSV(rows || [], section, Object.keys((rows || [])[0] || {}));
      closeExportMenu();
    }
  });

  updateExportFilteredState();
  updateExportHint();
}
