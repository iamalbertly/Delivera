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

- `npm run dev`
- `npm start`
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
- Data integrity journey: `npm run test:journey:data-integrity`
- Full E2E journey bucket: `npm run test:e2e:full`
- Stop orchestration: `npm run test:all:stop`

For run modes, fail-fast behavior, and impacted-only flags, see [`TESTING.md`](TESTING.md).

## Latest UX and Trust Hardening

- Decision-first behavior was tightened across `report`, `current-sprint`, and `leadership` without adding new flows.
- Report header refresh now uses one preview dispatch path with explicit status messaging for busy, success, and retry states.
- Current Sprint now exposes a top intervention shortlist in the sticky header to reduce standup hunt time.
- Leadership confidence messaging now prioritizes stale/partial state clarity so trust risk is explicit before action.
- Contrast/readability improvements were applied to report action status, context strips, sprint action chips, and leadership summary text.
- New Playwright fail-fast validations were added for refresh trust, shortlist action rhythm, cross-surface freshness SSOT, duplicate UI regression, and mobile leadership first-viewport clarity.
- Current Sprint can post guided nudges to Jira via `POST /api/issues/:issueKey/comment` (Send to Jira, top nudge, Take action). Restart the local server after pulling API changes — a stale process returns `Cannot POST /api/issues/.../comment`.
- Focused direct-value + Jira send gate: `npm run test:journey:direct-value-send`

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
