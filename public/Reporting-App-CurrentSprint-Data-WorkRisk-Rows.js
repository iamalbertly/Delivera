/**
 * Build merged work-risk rows from current sprint data (scope changes, stuck, subtasks, stories).
 * Used by Reporting-App-CurrentSprint-Render-Subtasks.js.
 */
const WORK_RISK_ROWS_CACHE_KEY = '__workRiskRowsCache';

function resolveCachedRows(data) {
  if (!data || typeof data !== 'object') return null;
  const cached = data[WORK_RISK_ROWS_CACHE_KEY];
  if (!cached || !Array.isArray(cached.rows)) return null;
  if (cached.version !== (data.meta?.generatedAt || data.meta?.snapshotAt || 'live')) return null;
  return cached.rows;
}

function cacheRows(data, rows) {
  if (!data || typeof data !== 'object' || !Array.isArray(rows)) return;
  data[WORK_RISK_ROWS_CACHE_KEY] = {
    version: data.meta?.generatedAt || data.meta?.snapshotAt || 'live',
    rows,
  };
}

export function buildMergedWorkRiskRows(data) {
  const cachedRows = resolveCachedRows(data);
  if (cachedRows) return cachedRows;
  const rows = [];
  const storiesByKey = new Map((data.stories || []).map((s) => [s.issueKey || s.key, s]));
  const pushRow = (row) => rows.push(row);

  for (const row of (data.scopeChanges || [])) {
    const key = row.issueKey || row.key || '';
    const story = storiesByKey.get(key);
    pushRow({
      source: 'Scope',
      riskType: 'Added Mid-Sprint',
      issueKey: key,
      issueUrl: row.issueUrl || story?.issueUrl || '',
      summary: row.summary || story?.summary || key || '-',
      issueType: row.issuetype || story?.issueType || '-',
      storyPoints: row.storyPoints ?? story?.storyPoints ?? null,
      status: row.status || story?.status || '-',
      assignee: row.assignee || story?.assignee || '-',
      reporter: row.reporter || story?.reporter || '-',
      hoursInStatus: null,
      estimateHours: null,
      loggedHours: null,
      updated: row.date || story?.updated || null,
    });
  }

  for (const row of (data.stuckCandidates || [])) {
    pushRow({
      source: 'Flow',
      riskType: 'Stuck >24h',
      issueKey: row.issueKey || row.key || '',
      issueUrl: row.issueUrl || '',
      summary: row.summary || '-',
      issueType: row.issueType || '-',
      storyPoints: row.storyPoints ?? null,
      status: row.status || '-',
      assignee: row.assignee || '-',
      reporter: row.reporter || '-',
      hoursInStatus: row.hoursInStatus ?? null,
      estimateHours: null,
      loggedHours: null,
      updated: row.updated || null,
    });
  }

  for (const row of ((data.subtaskTracking || {}).rows || [])) {
    const missingEstimate = !(Number(row.estimateHours) > 0);
    const missingLog = !(Number(row.loggedHours) > 0);
    if (!missingEstimate && !missingLog && !(Number(row.hoursInStatus) >= 24)) continue;
    pushRow({
      source: 'Subtask',
      riskType: missingEstimate
        ? 'Missing Estimate'
        : (missingLog ? 'No Log Yet' : 'Stuck >24h'),
      issueKey: row.issueKey || row.key || '',
      issueUrl: row.issueUrl || '',
      summary: row.summary || '-',
      issueType: row.issueType || 'Sub-task',
      storyPoints: row.storyPoints ?? null,
      parentKey: row.parentKey || '',
      parentSummary: row.parentSummary || '',
      parentUrl: row.parentUrl || '',
      status: row.status || '-',
      assignee: row.assignee || '-',
      reporter: row.reporter || '-',
      hoursInStatus: row.hoursInStatus ?? null,
      estimateHours: row.estimateHours ?? null,
      loggedHours: row.loggedHours ?? null,
      updated: row.updated || row.created || null,
    });
  }

  for (const row of (data.stories || [])) {
    const missingAssignee = !row.assignee || row.assignee === '-';
    const missingReporter = !row.reporter || row.reporter === '-';
    if (!missingAssignee && !missingReporter) continue;
    pushRow({
      source: 'Sprint',
      riskType: missingAssignee ? 'Unassigned Issue' : 'Missing Reporter',
      issueKey: row.issueKey || row.key || '',
      issueUrl: row.issueUrl || '',
      summary: row.summary || '-',
      issueType: row.issueType || '-',
      storyPoints: row.storyPoints ?? null,
      status: row.status || '-',
      assignee: row.assignee || '-',
      reporter: row.reporter || '-',
      hoursInStatus: null,
      estimateHours: null,
      loggedHours: null,
      updated: row.updated || row.created || null,
    });
  }

  const deduped = new Map();
  for (const row of rows) {
    const key = (row.issueKey || '').trim().toUpperCase();
    if (!key || key === '-') { deduped.set(Symbol(), row); continue; }
    const existing = deduped.get(key);
    if (!existing) { deduped.set(key, row); continue; }
    if (!existing.source.includes(row.source)) existing.source += ', ' + row.source;
    if (!existing.riskType.includes(row.riskType)) existing.riskType += ', ' + row.riskType;
    if (existing.summary === '-' && row.summary !== '-') existing.summary = row.summary;
    if (existing.status === '-' && row.status !== '-') existing.status = row.status;
    if (existing.issueType === '-' && row.issueType && row.issueType !== '-') existing.issueType = row.issueType;
    if (existing.storyPoints == null && row.storyPoints != null) existing.storyPoints = row.storyPoints;
    if (existing.assignee === '-' && row.assignee !== '-') existing.assignee = row.assignee;
    if (existing.reporter === '-' && row.reporter !== '-') existing.reporter = row.reporter;
    if (existing.hoursInStatus == null && row.hoursInStatus != null) existing.hoursInStatus = row.hoursInStatus;
    if (existing.estimateHours == null && row.estimateHours != null) existing.estimateHours = row.estimateHours;
    if (existing.loggedHours == null && row.loggedHours != null) existing.loggedHours = row.loggedHours;
    if (!existing.parentKey && row.parentKey) existing.parentKey = row.parentKey;
    if (!existing.parentSummary && row.parentSummary) existing.parentSummary = row.parentSummary;
    if ((!existing.parentUrl || existing.parentUrl === '#') && row.parentUrl) existing.parentUrl = row.parentUrl;
    if ((!existing.issueUrl || existing.issueUrl === '#') && row.issueUrl) existing.issueUrl = row.issueUrl;
    const existingTs = existing.updated ? new Date(existing.updated).getTime() : 0;
    const rowTs = row.updated ? new Date(row.updated).getTime() : 0;
    if (rowTs > existingTs) existing.updated = row.updated;
  }
  const dedupedRows = Array.from(deduped.values());
  dedupedRows.sort((a, b) => {
    const at = a.updated ? new Date(a.updated).getTime() : 0;
    const bt = b.updated ? new Date(b.updated).getTime() : 0;
    return bt - at;
  });
  cacheRows(data, dedupedRows);
  return dedupedRows;
}

export function getUnifiedBlockerCount(data) {
  const rows = buildMergedWorkRiskRows(data);
  const blockerKeys = new Set();
  for (const row of rows) {
    const riskType = String(row?.riskType || '').toLowerCase();
    if (!riskType.includes('stuck >24h')) continue;
    const key = String(row?.issueKey || '').trim().toUpperCase();
    if (!key || key === '-') continue;
    blockerKeys.add(key);
  }
  return blockerKeys.size;
}
