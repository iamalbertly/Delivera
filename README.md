# Delivera

Delivery intelligence for scrum teams and leaders, backed by Jira.

Delivera answers **what to say, who to chase, and what proof to show** — in about 10 seconds on the Brief.

## Primary surfaces

| Route | Surface | Purpose |
|-------|---------|---------|
| `/governance` | **Brief** | Delivery answer, owner actions, PI confidence, agent queue |
| `/current-sprint` | **Sprint** | What must move today (blockers, owners, nudges) |
| `/report` | **Proof** | Evidence and drill-down for the current Brief |

**Bookmarks:** `/brief` → `/governance`. `/leadership` and `/program-increment` → `/governance#decision-snapshot`. `/value-delivery` → `/report`. `/teams` and `/risks-blockers` → `/current-sprint` (with `#stuck-card` where applicable).

Root `/` lands on Brief when auth is off; otherwise follows your configured auth landing.

## Global chrome

Authenticated pages use a Jira-style top bar (`#app-top-chrome`, `Delivera-Shared-Top-Chrome-01Render-UI.js`):

- **Brief · Sprint · Proof** surface switcher (primary wayfinding)
- Sidebar toggle, workspace context, search, **Create**, notifications, help, settings, avatar
- Left sidebar: context card + data pulse only (nav links hidden on desktop)
- Duplicate page-level **Create** buttons are suppressed when top chrome is present

Notifications mount in `#app-notification-slot` under the top bar (`Delivera-Shared-Notifications-Dock-Manager.js`).

## Brief highlights

- Shared project catalog (`Delivera-Shared-Projects-Catalog-01SSOT.js`, `GET /api/projects-catalog.json`)
- Cache-first governance APIs; **Refresh** bypasses cache where supported
- Above-fold order: answer → owner clusters → setup debt → verdict → PI strip; agent queue and feedback in collapsed `<details>`
- Responsive layout: scope capsule, answer blocks, PI counters, and tables use auto-fit grids + `data-table-scroll-wrap` (no horizontal bleed on mobile)
- Page-level **Export brief** hides when top chrome is present (export stays in command overflow menu)
- PI baseline wizard with optional slide upload (OpenAI/Claude keys in Settings or `.env`)
- Inbox drawer with icon tabs; guided nudge review (not silent approve)

Details: [`context.md`](context.md). Layout gate: `npm run test:journey:layout-overlap`. Full governance bundle: `npm run test:journey:governance`.

## Quickstart

**Prerequisites:** Node.js `>=20`, Jira credentials.

```bash
npm install
cp .env.example .env   # set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN
npm run dev            # or npm run dev:hot for CSS watch + nodemon
```

Production-style: `npm start` (runs `build:css` first).

Playwright against an already-running server:

```bash
npm start
# another terminal:
BASE_URL=http://localhost:3000 SKIP_WEBSERVER=true npm run test:smoke
```

## Auth modes

- **No auth (local default):** open Brief without login vars
- **Legacy:** `SESSION_SECRET`, `APP_LOGIN_USER`, `APP_LOGIN_PASSWORD`
- **SuperTokens:** `SUPERTOKENS_ENABLED=true` (optional `SUPERTOKENS_HYBRID_MODE=true`)

Full matrix: [`docs/environment.md`](docs/environment.md)

## Common commands

| Command | Use |
|---------|-----|
| `npm run build:css` | Compile `public/css/*` → `public/styles.css` |
| `npm run check:css` | Fail if `styles.css` is out of sync |
| `npm run validate:jira-env` | Probe Jira `/myself` with `.env` |
| `npm run dev:hot` | Single-port dev with CSS + API reload |
| `npm run test:all` | Full fail-fast orchestration |
| `npm run test:smoke` | Short UX smoke |
| `npm run test:current-sprint:dedupe-fold` | Sprint header/viewport gate |
| `npm run test:journey:layout-overlap` | Governance/report/sprint layout overlap + mobile clip gate (fail-fast) |
| `npm run test:journey:governance` | Brief / governance Playwright bundle |
| `npm run test:journey:ux-core` | Cross-surface UX gate |
| `npm run vercel:deploy` | Manual Vercel deploy after `vercel login` |

Orchestration, journeys, and `SKIP_WEBSERVER`: [`TESTING.md`](TESTING.md)

## CSS contract

Edit partials under `public/css/` only. Never edit `public/styles.css` directly.

```bash
npm run build:css
npm run check:css
```

Ownership: [`public/css/README.md`](public/css/README.md)

## Deployment

- **Render:** [`render.yaml`](render.yaml) — always-on Node, background workers
- **Vercel:** root `index.js` + `vercel.json` — zero-config Express; workers disabled

Pre-deploy: `npm run build:css`, `npm run check:css`, then your chosen test gate.

**Vercel note:** `vercel.json` bundles `public/**` into the serverless function for HTML routes (`/governance`, etc.). If deploy fails on `includeFiles`, clear conflicting **Functions** overrides in the Vercel project dashboard.

Full guide: [`docs/deployment.md`](docs/deployment.md)

## Documentation

| Topic | Doc |
|-------|-----|
| Environment | [`docs/environment.md`](docs/environment.md) |
| Deployment | [`docs/deployment.md`](docs/deployment.md) |
| API | [`docs/api-reference.md`](docs/api-reference.md) |
| Troubleshooting | [`docs/troubleshooting.md`](docs/troubleshooting.md) |
| Release history | [`docs/release-notes.md`](docs/release-notes.md) |
| Testing | [`TESTING.md`](TESTING.md) |
| Architecture | [`context.md`](context.md) |

## Architecture (short)

- Entry: [`server.js`](server.js)
- App factory: [`lib/Delivera-Express-Core-App-Factory-Handler.js`](lib/Delivera-Express-Core-App-Factory-Handler.js)
- Routes: [`routes/views.js`](routes/views.js), [`routes/api.js`](routes/api.js)
- UI: `public/*.html`, `public/Delivera-*.js`, compiled `public/styles.css`

## License

MIT
