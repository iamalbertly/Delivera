# API Reference

API routes are defined in `routes/api.js`. This page captures the primary contracts used by UI and tests.

## Core endpoints

### `GET /api/csv-columns`

- Returns CSV column SSOT:
  - `{ columns: string[] }`

### `GET /api/boards.json?projects=MPSA,MAS`

- Returns discovered boards for selected projects
- Success:
  - `{ projects: string[], boards: Array<{ id, name, type, projectKey }>, jiraErrors?: [] }`
- Errors:
  - `400` with `code: NO_PROJECTS` when no projects selected
  - `502` with `code: JIRA_UNAUTHORIZED` when all selected projects fail auth/forbidden

### `GET /api/sprints` and `GET /api/sprints.json`

- Query:
  - `boardId` (optional)
  - `projects` (optional CSV, defaults apply)
- Returns:
  - `{ board: { id, name, projectKey }, sprints: [] }`

### `GET /api/current-sprint.json`

- Query:
  - `boardId` (required)
  - `sprintId` (optional)
  - `projects` (optional)
  - `live=true` or `refresh=true` bypasses snapshot cache
- Returns current sprint transparency payload used by `/current-sprint`

### `GET /api/leadership-summary.json`

- Query:
  - `projects` (optional CSV)
- Returns leadership HUD summary payload

### `GET /preview.json`

- Report preview endpoint used by `/report`
- Protected by auth middleware when auth is enabled

## Date and window helpers

- `GET /api/date-range?quarter=Q1|Q2|Q3|Q4`
- `GET /api/quarters-list?count=8`
- `GET /api/default-window`
- `GET /api/format-date-range?start=...&end=...`

## Export endpoints

- `POST /export` for CSV stream
- `POST /export-excel` for Excel workbook stream

## User context and notes

- `GET /api/user-context/report`
- `POST /api/user-context/report`
- `POST /api/current-sprint-notes`

## Outcome endpoints

- `POST /api/outcome-draft`
- `POST /api/outcome-from-narrative`

## Feedback and cache operations

- `POST /feedback`
- `POST /api/test/clear-cache` (available only in test mode or when enabled by env)
- `GET /api/cache-metrics`

## Auth and error behavior

- Endpoints use `requireAuth`
- JSON/`/api/*` unauthenticated responses return HTTP 401 with structured payloads
