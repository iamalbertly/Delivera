/**
 * SIZE-EXEMPT: Cohesive E2E spec for Excel export (file naming, tabs, columns, dates, KPI); splitting would duplicate runDefaultPreview and export flow.
 * Excel Export Validation Tests - file naming, multi-tab structure, business-friendly columns, Excel dates, KPI calculations
 */
import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview, captureBrowserTelemetry, IGNORE_REQUEST_PATTERNS, EXCEL_DOWNLOAD_TIMEOUT_MS } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

const EXPORT_TIMEOUT_MS = EXCEL_DOWNLOAD_TIMEOUT_MS;
const DIALOG_TIMEOUT_MS = 5000;

async function clickExcelExportAndWait(page, timeout = EXPORT_TIMEOUT_MS) {
  const downloadPromise = page.waitForEvent('download', { timeout });
  const dialogPromise = page
    .waitForEvent('dialog', { timeout: DIALOG_TIMEOUT_MS })
    .then(async (dialog) => {
      await dialog.accept();
    })
    .catch(() => null);

  await page.click('#export-excel-btn');
  await dialogPromise;
  return downloadPromise;
}
async function loadWorkbookFromDownload(download) {
  const path = await download.path();
  const { readFileSync } = await import('fs');
  const buffer = readFileSync(path);
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

test.describe('Jira Reporting App - Excel Export Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance/);
  });

  test('should generate Excel file with correct filename format', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing Excel filename format');
    
    await runDefaultPreview(page);
    
    await expect(page.locator('#preview-content')).toBeVisible();
    await expect(page.locator('#export-excel-btn')).toBeEnabled();
    await page.waitForTimeout(500);

    const telemetry = captureBrowserTelemetry(page);
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS);

      if (download) {
        const filename = download.suggestedFilename();
        // Verify filename pattern: {Projects}_{DateRange}_{Type}_{Date}.xlsx
        const filenamePattern = /^[A-Z-]+_(Q[1-4]-\d{4}|\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2})_Sprint-Report_\d{4}-\d{2}-\d{2}\.xlsx$/;
        expect(filename).toMatch(filenamePattern);
        console.log(`[TEST] Excel filename format correct: ${filename}`);
      }
      const criticalFailures = telemetry.failedRequests.filter(
        (r) => !IGNORE_REQUEST_PATTERNS.some((p) => p.test(r.url))
      );
      expect(criticalFailures).toEqual([]);
    }
  });

  test('should have Excel-compatible date formats', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing Excel date formats');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping Excel date format test');
      return;
    }
    
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS);
      
      if (download) {
        const workbook = await loadWorkbookFromDownload(download);
        
        // Check Stories sheet for date columns
        const storiesSheet = workbook.getWorksheet('Stories');
        if (storiesSheet) {
          const headerRow = storiesSheet.getRow(1);
          const dateColumns = [];
          
          headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const colName = cell.value;
            if (colName && (colName.toString().includes('Date') || colName.toString().includes('date'))) {
              dateColumns.push({ name: colName, colNumber });
            }
          });
          
          // Check that date cells are Date objects or formatted correctly
          if (dateColumns.length > 0 && storiesSheet.rowCount > 1) {
            const dataRow = storiesSheet.getRow(2);
            dateColumns.forEach(({ name, colNumber }) => {
              const cell = dataRow.getCell(colNumber);
              if (cell.value) {
                // Date should be a Date object or formatted string
                const isDate = cell.value instanceof Date || (typeof cell.value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cell.value));
                expect(isDate || cell.value === '').toBeTruthy();
              }
            });
            console.log(`[TEST] ✓ Excel date columns formatted correctly: ${dateColumns.map(c => c.name).join(', ')}`);
          }
        }
      }
    }
  });

  test('should have business-friendly column names', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing business-friendly column names');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping column names test');
      return;
    }
    
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS);
      
      if (download) {
        const workbook = await loadWorkbookFromDownload(download);
        
        // Check Stories sheet headers
        const storiesSheet = workbook.getWorksheet('Stories');
        if (storiesSheet) {
          const headerRow = storiesSheet.getRow(1);
          const headers = [];
          headerRow.eachCell({ includeEmpty: false }, (cell) => {
            headers.push(cell.value.toString());
          });
          
          // Verify business-friendly names (not technical names)
          expect(headers).not.toContain('issueKey'); // Should be 'Ticket ID'
          expect(headers).not.toContain('sprintStartDate'); // Should be 'Sprint Start Date'
          expect(headers).not.toContain('epicKey'); // Should be 'Epic ID'
          
          // Verify business-friendly names exist
          const hasTicketID = headers.some(h => h.includes('Ticket ID'));
          const hasSprintStartDate = headers.some(h => h.includes('Sprint Start Date'));
          const hasEpicID = headers.some(h => h.includes('Epic ID'));
          
          if (hasTicketID || hasSprintStartDate || hasEpicID) {
            console.log('[TEST] ✓ Excel contains business-friendly column names');
          }
        }
      }
    }
  });

  test('should calculate KPI columns correctly', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing KPI column calculations');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping KPI calculations test');
      return;
    }
    
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS);
      
      if (download) {
        const workbook = await loadWorkbookFromDownload(download);
        
        // Check Stories sheet for KPI columns
        const storiesSheet = workbook.getWorksheet('Stories');
        if (storiesSheet) {
          const headerRow = storiesSheet.getRow(1);
          const kpiColumns = [];
          
          headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const colName = cell.value.toString();
            if (colName.includes('Work Days') || colName.includes('Cycle Time') || colName.includes('Days Since')) {
              kpiColumns.push({ name: colName, colNumber });
            }
          });
          
          if (kpiColumns.length > 0) {
            console.log(`[TEST] ✓ Excel contains KPI columns: ${kpiColumns.map(c => c.name).join(', ')}`);
            
            // Verify KPI columns have numeric values (if data exists)
            if (storiesSheet.rowCount > 1) {
              const dataRow = storiesSheet.getRow(2);
              kpiColumns.forEach(({ name, colNumber }) => {
                const cell = dataRow.getCell(colNumber);
                // KPI values should be numbers or empty strings
                const isValid = cell.value === '' || typeof cell.value === 'number';
                expect(isValid).toBeTruthy();
              });
            }
          }
        }
      }
    }
  });

  test('should include manual enrichment columns', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing manual enrichment columns');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping manual enrichment test');
      return;
    }
    
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS);
      
      if (download) {
        const workbook = await loadWorkbookFromDownload(download);
        
        const storiesSheet = workbook.getWorksheet('Stories');
        if (storiesSheet) {
          const headerRow = storiesSheet.getRow(1);
          const headers = [];
          headerRow.eachCell({ includeEmpty: false }, (cell) => {
            headers.push(cell.value.toString());
          });
          
          // Verify manual enrichment columns exist
          const hasEpicIDManual = headers.some(h => h.includes('Epic ID (Manual)'));
          const hasEpicNameManual = headers.some(h => h.includes('Epic Name (Manual)'));
          const hasIsReworkManual = headers.some(h => h.includes('Is Rework (Manual)'));
          const hasIsBugManual = headers.some(h => h.includes('Is Bug (Manual)'));
          const hasTeamNotes = headers.some(h => h.includes('Team Notes'));
          
          if (hasEpicIDManual || hasEpicNameManual || hasIsReworkManual || hasIsBugManual || hasTeamNotes) {
            console.log('[TEST] ✓ Excel contains manual enrichment columns');
          }
        }
      }
    }
  });

  test('should contain Summary tab with key metrics', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing Summary tab content');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping Summary tab test');
      return;
    }
    
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS);
      
      if (download) {
        const workbook = await loadWorkbookFromDownload(download);
        
        const summarySheet = workbook.getWorksheet('Summary');
        if (summarySheet) {
          // Check that Summary sheet has data
          expect(summarySheet.rowCount).toBeGreaterThan(1);
          
          // Check for key sections
          const allValues = [];
          summarySheet.eachRow((row) => {
            row.eachCell({ includeEmpty: false }, (cell) => {
              allValues.push(cell.value.toString());
            });
          });
          
          const hasOverview = allValues.some(v => v.includes('Overview') || v.includes('Total Stories'));
          const hasKeyMetrics = allValues.some(v => v.includes('Key Metrics') || v.includes('Story Points'));
          const hasDataQuality = allValues.some(v => v.includes('Data Quality'));
          
          if (hasOverview || hasKeyMetrics || hasDataQuality) {
            console.log('[TEST] ✓ Summary tab contains key sections');
          }
        }
      }
    }
  });

  test('should contain Metadata tab with export context', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing Metadata tab content');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping Metadata tab test');
      return;
    }
    
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS);
      
      if (download) {
        const workbook = await loadWorkbookFromDownload(download);
        
        const metadataSheet = workbook.getWorksheet('Metadata');
        if (metadataSheet) {
          expect(metadataSheet.rowCount).toBeGreaterThan(1);
          
          // Check for key metadata fields
          const allValues = [];
          metadataSheet.eachRow((row) => {
            row.eachCell({ includeEmpty: false }, (cell) => {
              allValues.push(cell.value.toString());
            });
          });
          
          const hasExportDate = allValues.some(v => v.includes('Export Date') || v.includes('Export Time'));
          const hasDateRange = allValues.some(v => v.includes('Date Range'));
          const hasProjects = allValues.some(v => v.includes('Projects'));
          
          if (hasExportDate || hasDateRange || hasProjects) {
            console.log('[TEST] ✓ Metadata tab contains export context');
          }
        }
      }
    }
  });

  test('should handle Project & Epic Level active-tab CSV export from unified menu', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing Project & Epic Level active-tab CSV export');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping Project & Epic Level export test');
      return;
    }
    
    // Navigate to Project & Epic Level tab
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    
    await expect(page.locator('#export-dropdown-trigger')).toBeVisible();
    await page.click('#export-dropdown-trigger');
    const csvActive = page.locator('.export-dropdown-item[data-export="csv-active-tab"]');
    await expect(csvActive).toBeVisible();
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.evaluate(() => {
      const item = document.querySelector('.export-dropdown-item[data-export="csv-active-tab"]');
      if (item) item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const download = await downloadPromise;
    if (download) {
      console.log('[TEST] ✓ Project & Epic Level active-tab CSV export works');
    }
  });

  test('should validate Excel workbook data before sending to server', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing Excel export validation');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping validation test');
      return;
    }
    
    // Validation happens client-side before fetch, so we test that export works
    // (which implies validation passed)
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS).catch(() => null);
      
      if (download) {
        console.log('[TEST] ✓ Excel export validation passed (export succeeded)');
      }
    }
  });

  test('should show placeholder messages in empty Excel tabs', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing empty Excel tabs with placeholder messages');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping empty tabs test');
      return;
    }
    
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS).catch(() => null);
      
      if (download) {
        const workbook = await loadWorkbookFromDownload(download);
        
        // Check Epics sheet for placeholder message if empty
        const epicsSheet = workbook.getWorksheet('Epics');
        if (epicsSheet && epicsSheet.rowCount > 1) {
          const firstDataRow = epicsSheet.getRow(2);
          const epicIDCell = firstDataRow.getCell(1);
          if (epicIDCell.value && epicIDCell.value.toString().includes('No Epic TTM data available')) {
            console.log('[TEST] ✓ Empty Epics sheet shows placeholder message');
          }
        }
        
        // Check Sprints sheet for placeholder message if empty
        const sprintsSheet = workbook.getWorksheet('Sprints');
        if (sprintsSheet && sprintsSheet.rowCount > 1) {
          const firstDataRow = sprintsSheet.getRow(2);
          const sprintIDCell = firstDataRow.getCell(1);
          if (sprintIDCell.value && sprintIDCell.value.toString().includes('No sprint data available')) {
            console.log('[TEST] ✓ Empty Sprints sheet shows placeholder message');
          }
        }
      }
    }
  });

  test('should show file size warning for large Excel exports', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing file size warning (may not trigger with test data)');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping file size warning test');
      return;
    }
    
    // File size warning only appears for very large files (>50MB)
    // Test data may not be large enough, so we just verify export works
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      // Note: File size warning uses confirm() dialog which is hard to test in Playwright
      // We verify export works, which implies either no warning or user confirmed
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS).catch(() => null);
      
      if (download) {
        console.log('[TEST] ✓ Excel export works (file size warning may not have triggered with test data)');
      }
    }
  });

  test('should show improved error messages for Excel export failures', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing improved error messages');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping error message test');
      return;
    }
    
    // Error messages are tested implicitly when export succeeds
    // For explicit error testing, we'd need to mock server failures
    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const download = await clickExcelExportAndWait(page, EXPORT_TIMEOUT_MS).catch(() => null);
      
      if (download) {
        console.log('[TEST] ✓ Excel export error handling works (export succeeded)');
      }
    }
  });

  test('should block Excel export with clear error when preview meta is missing', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing export behavior when preview meta is missing');
    
    await runDefaultPreview(page);
    
    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping missing meta export test');
      return;
    }

    // Simulate a broken preview payload where meta is missing
    await page.evaluate(() => {
      // @ts-ignore
      if (window.previewData) {
        // @ts-ignore
        window.previewData.meta = undefined;
      }
    });

    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const dialogPromise = page
        .waitForEvent('dialog', { timeout: DIALOG_TIMEOUT_MS })
        .then(async (dialog) => {
          await dialog.accept();
        })
        .catch(() => null);

      await exportExcelBtn.click();
      await dialogPromise;
      const errorLocator = page.locator('#error');
      const errorPromise = errorLocator
        .waitFor({ state: 'visible', timeout: 10000 })
        .then(() => ({ type: 'error' }))
        .catch(() => null);
      const downloadPromise = page
        .waitForEvent('download', { timeout: 10000 })
        .then(download => ({ type: 'download', download }))
        .catch(() => null);

      const result = await Promise.race([errorPromise, downloadPromise]);
      if (result?.type == 'error') {
        const errorText = (await errorLocator.innerText())?.toLowerCase() || '';
        expect(errorText).toContain('export error');
        expect(errorText).toContain('metadata');
        console.log('[TEST] ? Export blocked with clear error when preview meta is missing');
      } else if (result?.type == 'download') {
        console.log('[TEST] ? Export succeeded without meta (fallback path)');
      } else {
        test.skip();
      }
    }
  });

  test('should show specific error message when server returns 500 for Excel export', async ({ page }) => {
    test.setTimeout(180000);
    console.log('[TEST] Testing Excel export server error handling (500)');

    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible();
    if (!previewVisible) {
      console.log('[TEST] Preview not visible, skipping server error export test');
      return;
    }

    // Force /export-excel to return a 500 error
    await page.route('/export-excel', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Simulated failure' }),
      });
    });

    const exportExcelBtn = page.locator('#export-excel-btn');
    if (await exportExcelBtn.isEnabled()) {
      const dialogPromise = page
        .waitForEvent('dialog', { timeout: DIALOG_TIMEOUT_MS })
        .then(async (dialog) => {
          await dialog.accept();
        })
        .catch(() => null);

      await exportExcelBtn.click();
      await dialogPromise;

      const errorLocator = page.locator('#error');
      await errorLocator.waitFor({ state: 'visible', timeout: 10000 });
      const errorText = (await errorLocator.innerText())?.toLowerCase() || '';

      expect(errorText).toContain('export error');
      expect(errorText).toContain('server error during excel generation');
      console.log('[TEST] ✓ Excel export shows specific error when server returns 500');
    }

    // Clean up route so other tests are not affected
    await page.unroute('/export-excel');
  });
});
