/**
 * Excel export utilities using Excel.js
 */

import ExcelJS from 'exceljs';
import { mapColumnsToBusinessNames } from './columnMapping.js';
import { calculateWorkDays, calculateVelocityConsistency, calculateMaturityLevel, getMaturityScore } from './kpiCalculations.js';
import { getQuarterLabelForRange } from './Delivera-Data-VodacomQuarters-01Bounds.js';

/**
 * Formats a date string for Excel compatibility
 * Returns YYYY-MM-DD format that Excel recognizes as a date
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {string|Date} Excel-compatible date (YYYY-MM-DD string or Date object for Excel.js)
 */
export function formatDateForExcel(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    // Return Date object for Excel.js (it handles date formatting)
    return date;
  } catch (error) {
    return '';
  }
}

/**
 * Calculates work days between two dates (excludes weekends)
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number} Number of work days
 */
export { calculateWorkDays } from './kpiCalculations.js';

/**
 * Formats date range for filename (e.g., "Q2-2025" or "2025-07-01_to_2025-09-30")
 * @param {string} startDate - Start date ISO string
 * @param {string} endDate - End date ISO string
 * @returns {string} Formatted date range string
 */
export function formatDateRangeForFilename(startDate, endDate) {
  try {
    const quarterLabel = getQuarterLabelForRange(startDate, endDate);
    if (quarterLabel) return quarterLabel;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return `${startStr}_to_${endStr}`;
  } catch (error) {
    return `${startDate}_to_${endDate}`;
  }
}

/**
 * Generates Excel filename with descriptive format
 * Pattern: {Projects}_{DateRange}_{ReportType}_{ExportDate}.xlsx
 * @param {Object} meta - Preview metadata
 * @param {string} type - Report type (default: 'Sprint-Report')
 * @returns {string} Excel filename
 */
export function generateExcelFilename(meta, type = 'Sprint-Report') {
  const projects = (meta.selectedProjects || []).join('-');
  const dateRange = formatDateRangeForFilename(meta.windowStart, meta.windowEnd);
  const exportDate = new Date().toISOString().split('T')[0];
  
  // Sanitize filename (remove invalid characters)
  const sanitizedProjects = projects.replace(/[<>:"/\\|?*]/g, '-');
  const sanitizedType = type.replace(/[<>:"/\\|?*]/g, '-');
  
  return `${sanitizedProjects}_${dateRange}_${sanitizedType}_${exportDate}.xlsx`;
}

/**
 * Creates Summary sheet with key metrics, KPIs, and maturity indicators
 * @param {Object} metrics - Calculated metrics
 * @param {Object} meta - Preview metadata
 * @param {Array} allRows - All story rows for calculations
 * @returns {Array} Array of row objects for Summary sheet
 */
export function createSummarySheetData(metrics, meta, allRows) {
  const summaryRows = [];
  
  // Section 1: Overview
  summaryRows.push({ Section: 'Overview', Metric: 'Total Stories', Value: allRows.length || 0 });
  summaryRows.push({ Section: 'Overview', Metric: 'Total Sprints', Value: meta.sprintCount || 0 });
  summaryRows.push({ Section: 'Overview', Metric: 'Date Range', Value: `${meta.windowStart} to ${meta.windowEnd}` });
  summaryRows.push({ Section: 'Overview', Metric: 'Projects', Value: (meta.selectedProjects || []).join(', ') });
  summaryRows.push({ Section: '', Metric: '', Value: '' }); // Empty row
  
  // Section 2: Key Metrics
  if (metrics.throughput) {
    const totalSP = Object.values(metrics.throughput.perProject || {}).reduce((sum, p) => sum + (p.totalSP || 0), 0);
    summaryRows.push({ Section: 'Key Metrics', Metric: 'Total Story Points', Value: totalSP });
    summaryRows.push({ Section: 'Key Metrics', Metric: 'Average SP per Sprint', Value: totalSP / (meta.sprintCount || 1) });
  }
  
  if (metrics.rework) {
    summaryRows.push({ Section: 'Key Metrics', Metric: 'Rework Ratio', Value: `${metrics.rework.reworkRatio.toFixed(2)}%` });
  }
  
  if (metrics.predictability) {
    const avgPredictability = Object.values(metrics.predictability.perSprint || {}).reduce((sum, s) => sum + (s.predictabilitySP || 0), 0) / Object.keys(metrics.predictability.perSprint || {}).length || 0;
    summaryRows.push({ Section: 'Key Metrics', Metric: 'Average Predictability', Value: `${avgPredictability.toFixed(2)}%` });
  }
  
  summaryRows.push({ Section: '', Metric: '', Value: '' }); // Empty row
  
  // Section 3: Agile Maturity Assessment (SSOT: kpiCalculations)
  const predictability = metrics.predictability ? Object.values(metrics.predictability.perSprint || {}).reduce((sum, s) => sum + (s.predictabilitySP || 0), 0) / (Object.keys(metrics.predictability.perSprint || {}).length || 1) : 0;
  const velocities = metrics.throughput?.perSprint ? Object.values(metrics.throughput.perSprint).map(s => s.totalSP || 0) : [];
  const consistency = calculateVelocityConsistency(velocities);
  const reworkRatio = metrics.rework?.reworkRatio || 0;
  const maturityLevel = calculateMaturityLevel(predictability, consistency, reworkRatio);
  const maturityScore = getMaturityScore(predictability, consistency, reworkRatio);
  summaryRows.push({ Section: 'Agile Maturity', Metric: 'Maturity Level', Value: `${maturityLevel}/5` });
  summaryRows.push({ Section: 'Agile Maturity', Metric: 'Maturity Score', Value: maturityScore.toFixed(1) });
  summaryRows.push({ Section: '', Metric: '', Value: '' }); // Empty row
  
  // Section 4: Data Quality
  const missingEpicCount = allRows.filter(r => !r.epicKey).length;
  const missingSPCount = allRows.filter(r => !r.storyPoints || r.storyPoints === 0).length;
  const qualityScore = 100 - ((missingEpicCount / allRows.length) * 50) - ((missingSPCount / allRows.length) * 50);
  
  summaryRows.push({ Section: 'Data Quality', Metric: 'Missing Epic Count', Value: missingEpicCount });
  summaryRows.push({ Section: 'Data Quality', Metric: 'Missing Story Points Count', Value: missingSPCount });
  summaryRows.push({ Section: 'Data Quality', Metric: 'Data Quality Score', Value: `${Math.max(0, qualityScore).toFixed(1)}%` });
  summaryRows.push({ Section: '', Metric: '', Value: '' }); // Empty row
  
  // Section 5: Manual Enrichment Guide
  summaryRows.push({ Section: 'Manual Enrichment', Metric: 'Epic ID (Manual)', Value: 'Fill in missing Epic IDs' });
  summaryRows.push({ Section: 'Manual Enrichment', Metric: 'Epic Name (Manual)', Value: 'Fill in missing Epic Names' });
  summaryRows.push({ Section: 'Manual Enrichment', Metric: 'Is Rework (Manual)', Value: 'Enter Y or N' });
  summaryRows.push({ Section: 'Manual Enrichment', Metric: 'Is Bug (Manual)', Value: 'Enter Y or N' });
  summaryRows.push({ Section: 'Manual Enrichment', Metric: 'Team Notes', Value: 'Add context or notes' });
  
  return summaryRows;
}

/**
 * Generates Excel workbook with multiple sheets
 * @param {Object} workbookData - Workbook data structure
 * @param {Array} workbookData.sheets - Array of sheet definitions {name, columns, rows}
 * @returns {Promise<Buffer>} Excel workbook buffer
 */
export async function generateExcelWorkbook(workbookData) {
  const workbook = new ExcelJS.Workbook();

  const resolveColumnHeader = (col) => {
    if (typeof col === 'string') return mapColumnsToBusinessNames([col])[0];
    if (col && typeof col === 'object') {
      if (typeof col.key === 'string') return mapColumnsToBusinessNames([col.key])[0];
      if (typeof col.header === 'string') return mapColumnsToBusinessNames([col.header])[0];
    }
    return '';
  };

  const resolveColumnKey = (col) => {
    if (typeof col === 'string') return col;
    if (col && typeof col === 'object' && typeof col.key === 'string') return col.key;
    return '';
  };
  
  for (const sheetData of workbookData.sheets) {
    const worksheet = workbook.addWorksheet(sheetData.name.substring(0, 31)); // Excel sheet name limit: 31 chars
    const columns = Array.isArray(sheetData.columns) ? sheetData.columns : [];
    const columnHeaders = columns.map((col) => resolveColumnHeader(col));
    
    // Add header row
    const headerRow = worksheet.addRow(columnHeaders);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data rows
    for (const rowData of sheetData.rows) {
      const row = worksheet.addRow(columns.map(col => {
        const colKey = resolveColumnKey(col);
        const colHeader = resolveColumnHeader(col);
        const value = rowData[colKey] ?? rowData[colHeader];
        
        // Handle dates - set as Date object for Excel
        if (value && (colHeader.includes('Date') || colHeader.includes('date'))) {
          const dateValue = formatDateForExcel(value);
          return dateValue;
        }
        
        return value !== null && value !== undefined ? value : '';
      }));
      
      // Format date cells
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const colName = resolveColumnHeader(columns[colNumber - 1]);
        if (colName && (colName.includes('Date') || colName.includes('date'))) {
          const value = cell.value;
          if (value instanceof Date) {
            cell.numFmt = 'yyyy-mm-dd';
          }
        }
      });
    }
    
    // Auto-size columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
  }
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
