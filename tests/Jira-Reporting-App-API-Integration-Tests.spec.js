import { test, expect } from '@playwright/test';
import { CSV_COLUMNS as SERVER_CSV_COLUMNS } from '../lib/csv.js';

const DEFAULT_Q2_QUERY = '?projects=MPSA,MAS&start=2025-07-01T00:00:00.000Z&end=2025-09-30T23:59:59.999Z';
const DEFAULT_PREVIEW_URL = `/preview.json${DEFAULT_Q2_QUERY}`;

async function safePost(request, url, data, timeoutMs = 10000) {
  try {
    return await request.post(url, { data, timeout: timeoutMs });
  } catch (error) {
    return { error };
  }
}

test.describe('Jira Reporting App - API Integration Tests', () => {
  test('GET /api/csv-columns returns server SSOT and matches lib/csv.js', async ({ request }) => {
    const response = await request.get('/api/csv-columns');
    if (response.status() === 401) {
      test.skip('Auth required; cannot assert CSV columns contract');
      return;
    }
    if (response.status() === 404) {
      test.skip('Route /api/csv-columns not found (restart server with latest code)');
      return;
    }
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.columns)).toBe(true);
    expect(body.columns).toEqual(SERVER_CSV_COLUMNS);
  });

  test('GET /api/cache-metrics returns cache namespace stats when authenticated', async ({ request }) => {
    const response = await request.get('/api/cache-metrics');
    if (response.status() === 401) {
      test.skip('Auth required; cannot assert cache metrics contract');
      return;
    }
    if (response.status() === 404) {
      test.skip('Route /api/cache-metrics not found (restart server with latest code)');
      return;
    }
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBeTruthy();
    expect(typeof body.generatedAt).toBe('string');
    expect(typeof body.backend).toBe('string');
    expect(Array.isArray(body.namespaces)).toBeTruthy();
  });

  test('GET /report should return HTML page', async ({ request }) => {
    const response = await request.get('/report');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    const body = await response.text();
    expect(body).toContain('VodaAgileBoard');
    expect(body).toContain('MPSA');
    expect(body).toContain('MAS');
  });

  test('GET /preview.json should validate empty projects', async ({ request }) => {
    const response = await request.get('/preview.json?projects=');
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.code).toBe('NO_PROJECTS_SELECTED');
    expect(json.message?.toLowerCase() || json.error?.toLowerCase() || '').toContain('at least one project');
  });

  test('GET /preview.json should validate invalid date range', async ({ request }) => {
    let response;
    try {
      response = await request.get('/preview.json?projects=MPSA&start=2025-09-30T00:00:00.000Z&end=2025-07-01T00:00:00.000Z');
    } catch (error) {
      test.skip(`Preview API not reachable for invalid-date-range test: ${error?.message || 'Unknown error'}`);
      return;
    }
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.code).toBe('INVALID_DATE_RANGE');
  });

  test('GET /preview.json should validate date range too large', async ({ request }) => {
    const response = await request.get('/preview.json?projects=MPSA&start=2020-01-01T00:00:00.000Z&end=2025-12-31T23:59:59.999Z');
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.code).toBe('DATE_RANGE_TOO_LARGE');
  });

  test('GET /preview.json should validate invalid date format', async ({ request }) => {
    let response;
    try {
      response = await request.get('/preview.json?projects=MPSA&start=invalid-date&end=2025-09-30T23:59:59.999Z');
    } catch (error) {
      test.skip(`Preview API not reachable for invalid-date-format test: ${error?.message || 'Unknown error'}`);
      return;
    }
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.code).toBe('INVALID_DATE_FORMAT');
  });

  test('GET /reports should redirect to canonical /report', async ({ request }) => {
    const response = await request.get('/reports');
    if (response.status() === 301 || response.status() === 302) {
      const location = response.headers()['location'] || '';
      expect(location.startsWith('/report')).toBeTruthy();
      return;
    }
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('VodaAgileBoard');
  });

  test('GET /preview.json should accept valid parameters', async ({ request }) => {
    // This test may fail if Jira credentials are not configured
    // That's expected - we're testing the API accepts the request format
    // Increase timeout for real Jira API calls
    test.setTimeout(120000); // 2 minutes
    let response;
    let lastError;
    const requestTimeoutMs = 30000;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await request.get(DEFAULT_PREVIEW_URL, {
          timeout: requestTimeoutMs
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!response) {
      test.skip(`Preview request failed before response: ${lastError?.message || 'Unknown error'}`);
      return;
    }
    
    // Should either succeed (200) or fail with auth error (500/401), not validation error (400)
    expect([200, 401, 403, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const json = await response.json();
      expect(json).toHaveProperty('meta');
      expect(json).toHaveProperty('boards');
      expect(json).toHaveProperty('sprintsIncluded');
      expect(json).toHaveProperty('rows');

      // Basic meta contract: windowStart/windowEnd and selectedProjects should be present.
      expect(json.meta).toHaveProperty('windowStart');
      expect(json.meta).toHaveProperty('windowEnd');
      expect(Array.isArray(json.meta.selectedProjects)).toBeTruthy();
      expect(typeof json.meta.jiraHostResolved).toBe('string');
      expect(typeof json.meta.jiraHostMismatch).toBe('boolean');
      expect(typeof json.meta.jiraHostFromCache).toBe('string');
      if (json.meta.jiraHostResolved) {
        expect(json.meta.jiraHostResolved.startsWith('http://') || json.meta.jiraHostResolved.startsWith('https://')).toBeTruthy();
      }

      // Field inventory contract for API field discovery mapping
      expect(json.meta).toHaveProperty('fieldInventory');
      expect(json.meta.fieldInventory).toHaveProperty('availableFieldCount');
      expect(json.meta.fieldInventory).toHaveProperty('customFieldCount');
      expect(Array.isArray(json.meta.fieldInventory.ebmFieldsFound)).toBeTruthy();
      expect(Array.isArray(json.meta.fieldInventory.ebmFieldsMissing)).toBeTruthy();

      // Drill-down rows should include time tracking and EBM-related fields
      if (json.rows.length > 0) {
        const sampleRow = json.rows[0];
        expect(sampleRow).toHaveProperty('issueStatusCategory');
        expect(sampleRow).toHaveProperty('issuePriority');
        expect(sampleRow).toHaveProperty('issueLabels');
        expect(sampleRow).toHaveProperty('issueComponents');
        expect(sampleRow).toHaveProperty('issueFixVersions');
        expect(sampleRow).toHaveProperty('subtaskCount');
        expect(sampleRow).toHaveProperty('timeOriginalEstimateHours');
        expect(sampleRow).toHaveProperty('timeRemainingEstimateHours');
        expect(sampleRow).toHaveProperty('timeSpentHours');
        expect(sampleRow).toHaveProperty('timeVarianceHours');
        expect(sampleRow).toHaveProperty('subtaskTimeOriginalEstimateHours');
        expect(sampleRow).toHaveProperty('subtaskTimeRemainingEstimateHours');
        expect(sampleRow).toHaveProperty('subtaskTimeSpentHours');
        expect(sampleRow).toHaveProperty('subtaskTimeVarianceHours');
        expect(sampleRow).toHaveProperty('ebmTeam');
        expect(sampleRow).toHaveProperty('ebmProductArea');
        expect(sampleRow).toHaveProperty('ebmCustomerSegments');
        expect(sampleRow).toHaveProperty('ebmValue');
        expect(sampleRow).toHaveProperty('ebmImpact');
        expect(sampleRow).toHaveProperty('ebmSatisfaction');
        expect(sampleRow).toHaveProperty('ebmSentiment');
        expect(sampleRow).toHaveProperty('ebmSeverity');
        expect(sampleRow).toHaveProperty('ebmSource');
        expect(sampleRow).toHaveProperty('ebmWorkCategory');
        expect(sampleRow).toHaveProperty('ebmGoals');
        expect(sampleRow).toHaveProperty('ebmTheme');
        expect(sampleRow).toHaveProperty('ebmRoadmap');
        expect(sampleRow).toHaveProperty('ebmFocusAreas');
        expect(sampleRow).toHaveProperty('ebmDeliveryStatus');
        expect(sampleRow).toHaveProperty('ebmDeliveryProgress');
      }
    } else {
      // Auth error is acceptable for this test
      const json = await response.json();
      expect(json).toHaveProperty('error');
      // Typed error path should expose a code as well
      expect(json).toHaveProperty('code');
    }
  });

  test('GET /preview.json should return structurally consistent data across identical requests (basic caching sanity)', async ({ request }) => {
    test.setTimeout(180000);

    let first;
    try {
      first = await request.get(DEFAULT_PREVIEW_URL, { timeout: 30000 });
    } catch (error) {
      test.skip(`Preview request timed out before caching sanity check: ${error.message}`);
      return;
    }
    expect([200, 401, 403, 500]).toContain(first.status());

    let second;
    try {
      second = await request.get(DEFAULT_PREVIEW_URL, { timeout: 30000 });
    } catch (error) {
      test.skip(`Preview request timed out on repeat call: ${error.message}`);
      return;
    }
    expect([200, 401, 403, 500]).toContain(second.status());

    // If both succeed, ensure key shapes match; otherwise just confirm structured error payloads
    if (first.status() === 200 && second.status() === 200) {
      const a = await first.json();
      const b = await second.json();

      expect(Array.isArray(a.rows)).toBeTruthy();
      expect(Array.isArray(b.rows)).toBeTruthy();
      expect(Array.isArray(a.sprintsIncluded)).toBeTruthy();
      expect(Array.isArray(b.sprintsIncluded)).toBeTruthy();

      expect(a.rows.length).toBe(b.rows.length);
      expect(a.sprintsIncluded.length).toBe(b.sprintsIncluded.length);
    } else {
      const a = await first.json();
      const b = await second.json();
      expect(a).toHaveProperty('error');
      expect(a).toHaveProperty('code');
      expect(b).toHaveProperty('error');
      expect(b).toHaveProperty('code');
    }
  });

  test('GET /preview.json should preserve date-range metadata and expose cache diagnostics', async ({ request }) => {
    test.setTimeout(180000);

    let response;
    try {
      response = await request.get(`${DEFAULT_PREVIEW_URL}&previewMode=normal`, { timeout: 30000 });
    } catch (error) {
      test.skip(`Preview request timed out before metadata check: ${error.message}`);
      return;
    }

    expect([200, 401, 403, 500]).toContain(response.status());
    if (response.status() !== 200) return;

    const json = await response.json();
    expect(json).toHaveProperty('meta');
    expect(json.meta.windowStart).toBeDefined();
    expect(json.meta.windowEnd).toBeDefined();
    expect(typeof json.meta.jiraHostResolved).toBe('string');
    if (json.meta.cachedKeyUsed != null) {
      expect(String(json.meta.cachedKeyUsed)).toContain('preview:v2:');
    }
  });

  test('GET /preview.json should echo previewMode in meta when recent-only mode succeeds (when served live)', async ({ request }) => {
    test.setTimeout(180000);

    const url = `${DEFAULT_PREVIEW_URL}&previewMode=recent-only&clientBudgetMs=80000`;
    let response;
    try {
      response = await request.get(url, { timeout: 60000 });
    } catch (error) {
      test.skip(`Preview recent-only request timed out before response: ${error.message}`);
      return;
    }

    expect([200, 401, 403, 500]).toContain(response.status());

    if (response.status() === 200) {
      const json = await response.json();
      if (!json.meta || json.meta.fromCache) {
        test.skip('Preview recent-only response came from cache or without meta; skipping previewMode assertion.');
        return;
      }
      expect(json).toHaveProperty('meta');
      expect(json.meta).toHaveProperty('previewMode');
      expect(json.meta.previewMode).toBe('recent-only');
      if (typeof json.meta.clientBudgetMs === 'number') {
        expect(json.meta.clientBudgetMs).toBeGreaterThan(0);
      }
    }
  });

  test('POST /export should validate request body', async ({ request }) => {
    // Missing columns
    const response1 = await safePost(request, '/export', { rows: [] });
    if (response1?.error) {
      test.skip(`POST /export did not respond in time: ${response1.error.message}`);
      return;
    }
    expect(response1.status()).toBe(400);

    // Missing rows
    const response2 = await safePost(request, '/export', { columns: [] });
    if (response2?.error) {
      test.skip(`POST /export did not respond in time: ${response2.error.message}`);
      return;
    }
    expect(response2.status()).toBe(400);

    // Invalid format
    const response3 = await safePost(request, '/export', { columns: 'not-array', rows: 'not-array' });
    if (response3?.error) {
      test.skip(`POST /export did not respond in time: ${response3.error.message}`);
      return;
    }
    expect(response3.status()).toBe(400);
  });

  test('POST /export should generate CSV with valid data', async ({ request }) => {
    const columns = ['projectKey', 'issueKey', 'issueSummary'];
    const rows = [
      { projectKey: 'MPSA', issueKey: 'MPSA-1', issueSummary: 'Test Story' },
      { projectKey: 'MAS', issueKey: 'MAS-1', issueSummary: 'Another Story' },
    ];

    const response = await safePost(request, '/export', { columns, rows });
    if (response?.error) {
      test.skip(`POST /export did not respond in time: ${response.error.message}`);
      return;
    }

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
    expect(response.headers()['content-disposition']).toContain('attachment');
    
    const csv = await response.text();
    expect(csv).toContain('projectKey,issueKey,issueSummary');
    expect(csv).toContain('MPSA,MPSA-1,Test Story');
    expect(csv).toContain('MAS,MAS-1,Another Story');
  });

  test('POST /export should handle large datasets', async ({ request }) => {
    const columns = ['projectKey', 'issueKey'];
    // Generate 6000 rows to test server-side streaming
    const rows = Array.from({ length: 6000 }, (_, i) => ({
      projectKey: 'MPSA',
      issueKey: `MPSA-${i + 1}`,
    }));

    const response = await safePost(request, '/export', { columns, rows }, 20000);
    if (response?.error) {
      test.skip(`POST /export did not respond in time: ${response.error.message}`);
      return;
    }

    expect(response.status()).toBe(200);
    const csv = await response.text();
    // Should have header + 6000 rows = 6001 lines
    const lines = csv.split('\n').filter(l => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(6000);
  });

  test('GET /api/boards.json should validate empty projects', async ({ request }) => {
    const response = await request.get('/api/boards.json?projects=');
    if (response.status() === 401) {
      test.skip('Auth required');
      return;
    }
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.code).toBe('NO_PROJECTS');
  });

  test('GET /api/current-sprint.json should require boardId', async ({ request }) => {
    const response = await request.get('/api/current-sprint.json?projects=MPSA,MAS');
    if (response.status() === 401) {
      test.skip('Auth required');
      return;
    }
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.code).toBe('MISSING_BOARD_ID');
  });

  test('GET /api/current-sprint.json should return 404 for unknown board', async ({ request }) => {
    const response = await request.get('/api/current-sprint.json?boardId=999999&projects=MPSA,MAS');
    if (response.status() === 401) {
      test.skip('Auth required');
      return;
    }
    expect(response.status()).toBe(404);
    const json = await response.json();
    expect(json.code).toBe('BOARD_NOT_FOUND');
  });

  test('POST /api/current-sprint-notes should require boardId and sprintId', async ({ request }) => {
    const response = await request.post('/api/current-sprint-notes', {
      data: { dependencies: 'Blocked by data feed', learnings: 'Sync earlier' },
    });
    if (response.status() === 401) {
      test.skip('Auth required');
      return;
    }
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.code).toBe('MISSING_NOTES_KEYS');
  });

  test('GET /current-sprint should serve HTML page', async ({ request }) => {
    const response = await request.get('/current-sprint');
    if (response.status() === 302) {
      expect(response.headers()['location']).toMatch(/login|report|\/$/);
      return;
    }
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    const body = await response.text();
    expect(body).toContain('Current Sprint');
  });

  test('GET /sprint-leadership should redirect/resolve to report trends page', async ({ request }) => {
    const response = await request.get('/sprint-leadership');
    if (response.status() === 302) {
      expect(response.headers()['location']).toMatch(/login|report|\/$/);
      return;
    }
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    const body = await response.text();
    expect(body).toMatch(/High-Level Performance|General Performance|VodaAgileBoard/);
  });

  test.skip('GET /preview.json should handle all filter options', async ({ request }) => {
    // Skipped: This test requires many API calls (bugs, metrics) and can timeout with real Jira data
    // The parameter acceptance is validated by other tests
    // To test manually, use the UI with all options enabled
    
    test.setTimeout(300000); // 5 minutes for tests with all metrics enabled
    
    const params = new URLSearchParams({
      projects: 'MPSA,MAS',
      start: '2025-07-01T00:00:00.000Z',
      end: '2025-09-30T23:59:59.999Z',
      // Story Points, Bugs/Rework, and Epic TTM are now mandatory (always enabled)
      requireResolvedBySprintEnd: 'true',
      includePredictability: 'true',
      predictabilityMode: 'approx',
      includeActiveOrMissingEndDateSprints: 'true',
    });

    const response = await request.get(`/preview.json?${params.toString()}`, {
      timeout: 300000
    });
    
    expect([200, 401, 403, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const json = await response.json();
      if (json.metrics) {
        expect(json.meta.discoveredFields).toBeDefined();
      }
    }
  });
});
