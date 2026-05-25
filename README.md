# Delivera

Delivery intelligence for scrum teams and leaders, backed by Jira data.

Delivera focuses on three primary surfaces:

- ` /report` for portfolio and performance reporting
- ` /current-sprint` for squad mission-control transparency
- ` /leadership` for leadership HUD and trend visibility

## Quickstart

### Prerequisites

- Node.js `>=20`
- Jira access credentials (`JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`)

### Install

```bash
npm install
```

### Configure env

Copy `.env.example` to `.env` and set at least:

```bash
JIRA_HOST=https://your-domain.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_jira_api_token
```

### Run locally

```bash
npm run dev
```

or production-style startup:

```bash
npm start
```

`npm start` runs CSS build first via `prestart`.

## Access and Auth Modes

Delivera supports three runtime modes:

- **No auth (default local loop):** when legacy auth variables are not set, `/` redirects to report.
- **Legacy auth:** enable with `SESSION_SECRET`, `APP_LOGIN_USER`, `APP_LOGIN_PASSWORD`.
- **SuperTokens auth:** enable with `SUPERTOKENS_ENABLED=true`; hybrid migration is supported with `SUPERTOKENS_HYBRID_MODE=true`.

Detailed env matrix: [`docs/environment.md`](docs/environment.md)

## Common Commands

### Build and run

- **One dev port (recommended):** set `PORT=3001` once in `.env`, then run `npm run dev:hot` — nodemon restarts the API on file save and CSS partials rebuild automatically (no second terminal on 3003).
- `npm run dev` — build CSS once, then nodemon (same hot API restart; run `npm run build:css` after stylesheet edits if not using `dev:hot`).
- `npm start` — production-style start (prebuilds CSS).
- Playwright against your running server: `BASE_URL=http://localhost:3001 SKIP_WEBSERVER=true npm run test:current-sprint:dedupe-fold`
- `npm run build:css`
- `npm run check:css`
- `npm run validate:jira-env`

### Testing

- Full orchestration: `npm run test:all`
- Smoke: `npm run test:smoke`
- Current Sprint journey: `npm run test:journey:current-sprint`
- Leadership journey: `npm run test:journey:leadership`
- Outcome intake journey: `npm run test:journey:outcome-intake`
- UX core journey: `npm run test:journey:ux-core`
- Direct-value Jira send (Current Sprint): `npm run test:journey:direct-value-send`
- Human nudge review + Settings activity: `npm run test:journey:human-nudge-trust`
- Viewport declutter (stories before cockpit): `npm run test:journey:viewport-declutter`
- Data integrity journey: `npm run test:journey:data-integrity`
- Full E2E journey bucket: `npm run test:e2e:full`
- Stop orchestration: `npm run test:all:stop`

For run modes, fail-fast behavior, and impacted-only flags, see [`TESTING.md`](TESTING.md).

## Latest UX and Trust Hardening

### Create Work drawer (cooperative AI UX)
- Right-side drawer (`Delivera-Work-Draft-Canvas.js`) replaces centered modal: auto-draft (800ms debounce), editable canvas with E/S/T/N/I type chips, inline repair chips for warnings/duplicates.
- Paste event fires instant client-side preview via `requestAnimationFrame` — no waiting for debounce on first paste.
- Ignored non-work lines fold into a collapsed `▸ N lines ignored as non-work` row (class-toggled div; no browser `<details>`).
- Send bar shows contextual zero states: “Nothing to create yet”, “Select a project first”, “Jira keys detected — link only” instead of always showing a disabled “Create 0 issues” button.
- Drawer width uses CSS variable `--sidebar-width: 240px` in `calc(100vw - var(--sidebar-width))` — single source of truth prevents sidebar overlap at any DPI.
- Confidence threshold raised to 0.5: more uncertain items automatically get a “Low confidence — review intent before creating” repair chip.
- Activity log (last 5 project keys from `localStorage`) is sent to `/api/outcome-draft` for smarter project-aware classification.
- AI provider gateway (`lib/Delivera-AI-Provider-Gateway.js`) + settings panel in drawer: Claude/OpenAI/Gemini/Ollama switchable; API keys stored in `sessionStorage` only (cleared on tab close), sent via `x-ai-key` header, never logged server-side.

### Guided nudge — role + confidence output
- `buildGuidedNudgeText` now produces `[RoleLabel] ... \nDo now: <action>\nConfidence: Low|Medium|High\nDone criteria: ...` format; `summaryContext.evidenceBand` maps to confidence label; duplicate nudges within 20 min return `Duplicate nudge suppressed`.
- Fixes 7 previously failing Playwright nudge tests in `Delivera-Adaptive-Nudge-Role-EdgeCases-Realtime-Validation-Tests.spec.js`.

### Jira outage resilience (stale-on-error)
- Report preview: serves stale cached data on Jira 502 and shows `Showing cached data from Xh ago — Jira was unreachable` banner automatically.
- Current-sprint handler: same `getWithStaleFallback` pattern — teams see sprint data instead of an error screen during Jira incidents.
- Smart sprint limbo: when no active sprint exists but a future sprint is planned, `meta.explanatoryLine` names the sprint candidate and start date; `meta.nextSprintCandidate` and `meta.suggestStartSprint` flags are set for the frontend.

### Snapshot worker and cache
- `resolveSnapshotProjects()` dynamically discovers recently queried projects from the preview cache namespace instead of hardcoding `['MPSA', 'MAS']`.
- `--sidebar-width` CSS variable added to `:root` — drawer calc and sidebar width share one definition.

### Console hygiene
- 9 unguarded `console.error` calls across `Delivera-CurrentSprint-Export-Dashboard.js`, `Delivera-Leadership-HUD-Controller.js`, and `Delivera-Report-Page-Preview-Flow.js` converted to `console.warn` so telemetry-clean tests don't false-positive.

### Earlier hardening (still active)
- Decision-first behavior tightened across `report`, `current-sprint`, and `leadership`.
- Current Sprint: top intervention shortlist in sticky header; guided nudge posts to Jira via `POST /api/issues/:issueKey/comment`.
- Focused direct-value + Jira send gate: `npm run test:journey:direct-value-send`
- Sidebar IA (3 primaries): **Current Sprint**, **Delivery**, **Leadership**; **Today**, **Risks**, **Teams**, **PI Goals**, **Value Archive**, **Settings** under **More**.

### Local dev without port churn (CI/CD-friendly patterns)

1. **`npm run dev:hot`** — single `PORT` in `.env`; nodemon + CSS watch (near-zero downtime for API; hard refresh browser after JS module graph changes).
2. **`SKIP_WEBSERVER=true` + `BASE_URL`** — Playwright hits your already-running instance instead of spawning another port.
3. **Production:** Render blueprint / `npm start` with health checks; blue-green or rolling deploy on the host — see [`docs/deployment.md`](docs/deployment.md).

## Documentation Map

- Environment details: [`docs/environment.md`](docs/environment.md)
- Deployment details: [`docs/deployment.md`](docs/deployment.md)
- API contracts: [`docs/api-reference.md`](docs/api-reference.md)
- Troubleshooting: [`docs/troubleshooting.md`](docs/troubleshooting.md)
- Release notes: [`docs/release-notes.md`](docs/release-notes.md)
- README migration map: [`docs/readme-migration-map.md`](docs/readme-migration-map.md)

## Doc Ownership (SSOT)

- **Testing contracts and orchestration flags:** [`TESTING.md`](TESTING.md)
- **CSS source/build ownership:** [`public/css/README.md`](public/css/README.md)
- **Architecture and module context:** [`context.md`](context.md)
- **Operational onboarding index:** this `README.md`

## Architecture At A Glance

- Server entrypoint: [`server.js`](server.js)
- Express app factory: [`lib/Delivera-Express-Core-App-Factory-Handler.js`](lib/Delivera-Express-Core-App-Factory-Handler.js)
- Route surfaces:
  - Views: [`routes/views.js`](routes/views.js)
  - API: [`routes/api.js`](routes/api.js)
- Frontend modules and pages:
  - `public/*.html`
  - `public/Delivera-*.js`
  - `public/css/*.css` (compiled to `public/styles.css`)

## Deployment

Deploy to Node hosts such as Render or Vercel.

- Render blueprint: [`render.yaml`](render.yaml)
- Full deployment guidance: [`docs/deployment.md`](docs/deployment.md)

## Troubleshooting

Start with [`docs/troubleshooting.md`](docs/troubleshooting.md) for:

- Port conflicts (`EADDRINUSE`)
- Jira auth/connectivity failures
- CSS build/check drift
- Test orchestration failures

## License

MIT
