const REPORT_CONTEXT_SESSION_KEY = 'jiraReportingUserContext';
const REPORT_CONTEXT_LOCAL_STORAGE_KEY = 'jiraReportingUserContext_v1';

function normalizeId(value) {
  if (value == null) return '';
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return String(parsed);
}

function normalizeProjects(value) {
  if (!value) return '';
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(',');
}

export function getReportContextStorageKey() {
  return REPORT_CONTEXT_LOCAL_STORAGE_KEY;
}

export function normalizeReportContext(input = {}) {
  const boardId = normalizeId(input.boardId);
  const sprintId = normalizeId(input.sprintId);
  const projects = normalizeProjects(input.projects);
  const reportPath = String(input.reportPath || '/report').startsWith('/report') ? String(input.reportPath || '/report') : '/report';

  return {
    boardId,
    sprintId,
    projects,
    reportPath,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function readReportContextFromSession(req) {
  const raw = req?.session?.[REPORT_CONTEXT_SESSION_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const normalized = normalizeReportContext(raw);
  if (!normalized.boardId && !normalized.sprintId && !normalized.projects) return null;
  return normalized;
}

export function writeReportContextToSession(req, context = {}) {
  if (!req?.session) return null;
  const normalized = normalizeReportContext(context);
  req.session[REPORT_CONTEXT_SESSION_KEY] = normalized;
  return normalized;
}

export function clearReportContextInSession(req) {
  if (!req?.session) return;
  delete req.session[REPORT_CONTEXT_SESSION_KEY];
}

export function buildReportUrlFromContext(context = {}, fallbackPath = '/report') {
  const normalized = normalizeReportContext(context);
  const params = new URLSearchParams();
  if (normalized.boardId) params.set('boardId', normalized.boardId);
  if (normalized.sprintId) params.set('sprintId', normalized.sprintId);
  if (normalized.projects) params.set('projects', normalized.projects);
  const query = params.toString();
  const path = normalized.reportPath || fallbackPath || '/report';
  return query ? `${path}?${query}` : path;
}
