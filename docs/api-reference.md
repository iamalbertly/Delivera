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

## Evidence OS endpoints

- `GET /api/evidence-os/cockpit`
- `POST /api/evidence-os/agents/run`
- `GET /api/evidence-os/summary`
- `GET|POST /api/evidence-os/evidence`
- `POST /api/evidence-os/evidence-links`
- `GET|POST /api/evidence-os/contributions`
- `PATCH /api/evidence-os/contributions/:id/validation`
- `GET|POST /api/evidence-os/goals`
- `POST /api/evidence-os/goals/:id/amendments`
- `GET /api/evidence-os/goals/:id/score`
- `GET /api/evidence-os/commitments/detect`
- `POST /api/evidence-os/commitments/link`
- `GET|POST /api/evidence-os/validation-requests`
- `POST /api/evidence-os/validation-requests/draft`
- `POST /api/evidence-os/validation-requests/:id/responses`
- `GET|POST /api/evidence-os/reports`
- `POST /api/evidence-os/ai/draft`

Key rules enforced by the API: no contribution from Jira assignee alone, manual goal creation is blocked until source commitments are checked, Tier 4 AI interpretation cannot satisfy verified report or validation evidence, `no_response` is distinct from `not_confirmed`, report snapshots dedupe by purpose/audience/period, and explicit validation gaps are preserved.

## Governance Intervention endpoints

These endpoints keep Jira as the delivery source of truth. Delivera detects, drafts, queues, and verifies intervention cases, but stakeholder communication remains human-approved.

- `GET /api/governance/interventions.json`
- `POST /api/governance/interventions/seed-from-brief`
- `GET /api/governance/interventions/:id`
- `POST /api/governance/interventions/:id/approve-nudge`
- `POST /api/governance/interventions/:id/record-response`
- `POST /api/governance/interventions/:id/record-decision`
- `POST /api/governance/interventions/:id/escalate`
- `POST /api/governance/interventions/:id/verify`
- `POST /api/governance/interventions/:id/close`
- `GET /api/governance/roles.json`
- `POST /api/governance/roles`

Key rules enforced by the API: unresolved Product Owner blocks send, issue-changed-before-send blocks dispatch, missing target dates reduce escalation confidence, duplicate open cases merge by fingerprint, and `/api/governance/intervention-shortlist.json` remains compatible with the new case stream.

## Feedback and cache operations

- `POST /feedback`
- `POST /api/test/clear-cache` (available only in test mode or when enabled by env)
- `GET /api/cache-metrics`

## Auth and error behavior

- Endpoints use `requireAuth`
- JSON/`/api/*` unauthenticated responses return HTTP 401 with structured payloads
