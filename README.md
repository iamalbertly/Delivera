# Delivera

Delivery intelligence for scrum teams and leaders, backed by Jira.

Delivera answers **what to say, who to chase, and what proof to show** — in about 10 seconds on the Brief.

## Primary surfaces

| Route | Surface | Purpose |
|-------|---------|---------|
| `/governance` | **Portfolio** | AI portfolio signal, squad comparison, confirm decision, open Actions |
| `/current-sprint` | **Squads** | What must move today (blockers, owners, nudges) |
| `/actions` | **Actions** | Intervention cases — ready nudges, waiting, escalations, proof |
| `/report` | **Proof** | Evidence and drill-down (unchanged route; top chrome links here from legacy bookmarks) |
| `/settings` | **Settings** | My workspace prefs, read-only org catalog, integrations health, Jira activity |

**Portfolio command surface (`/governance`):** scope capsule shows **Selected / Compare / timeframe / PI baseline** (collapsed by default — tap **Change scope**). Above-fold order on mobile: signal → decision rail → compare carousel. **Review actions →** deep-links to `/actions` with project context. Legacy brief mounts stay hidden; data loaders still seed intervention cases. Gate: `npm run test:journey:portfolio`.

**Actions (`/actions`):** tab badges show ready-case counts; `?caseId=` highlights the matching card. `/evidence` and `/impact` redirect here. `/portfolio` redirects to `/governance`.

Impact adds a role-aware intelligence layer without replacing Jira, SuccessFactors, Teams, email, Portfolio, Squads, or Proof. It uses `/api/evidence-os/*`, checked-in Postgres migrations under `db/migrations/`, Drizzle schema under `db/schema/`, and the existing governed AI orchestrator for Tier 4 draft assistance only. Evidence, validation, commitments, and reports are background records; the user-facing surface is decisions and intervention.

**Settings hub (`/settings`):** sticky section nav — **My workspace** (simple mode, default squads) → **Organization** (read-only squad names, e.g. SD shown as DMS Squad) → **Integrations** (Jira health + AI trust) → **Activity** (Jira comment audit). Admins edit squad names via `data/Delivera-Org-Project-Catalog.json` (copy from [`docs/Delivera-Org-Project-Catalog.example.json`](docs/Delivera-Org-Project-Catalog.example.json)); see [`docs/org-settings.md`](docs/org-settings.md). Display resolver: `Delivera-Shared-Project-Display-01Resolve-SSOT.js`. Gate: `npm run test:journey:settings-masterplan`.

**Proof (report) above-fold:** header **Refresh** / **Export** replace duplicate sidebar Preview when top chrome is present; filter summary lives in the mission strip (sidebar summary hidden when chips exist); scorecard and heavy widgets defer until opened; `delivera:scope-changed` remounts proof summary and filter chips when squad changes.

**Bookmarks:** `/brief` and `/portfolio` → `/governance`. `/leadership` and `/program-increment` → `/governance#portfolio-decision`. `/evidence` and `/impact` → `/actions`. `/value-delivery` → `/report`. `/teams` and `/risks-blockers` → `/current-sprint` (with `#stuck-card` where applicable).

Root `/` lands on Brief when auth is off; otherwise follows your configured auth landing.

## Global chrome

Authenticated pages use a Jira-style top bar (`#app-top-chrome`, `Delivera-Shared-Top-Chrome-01Render-UI.js`):

- **Answer · Today · Proof** surface switcher maps to **Portfolio · Squads · Actions · Settings** (`Delivera-Shared-Top-Chrome-01Render-UI.js`)
- Sidebar toggle, workspace context, search, **Create**, notifications, help, settings, avatar
- Left sidebar: context card + data pulse only (nav links hidden on desktop)
- Duplicate page-level **Create** buttons are suppressed when top chrome is present
- **Mobile/tablet (≤768px):** search collapses to a 36px icon (`.is-collapsed`); brand slot hides; focus expands search to a second row (`body.top-search-active`) and grows chrome height to 98px. Help and avatar hide at ≤480px. `Escape` dismisses expanded search.
- **Brief notifications:** dock stays collapsed until the bell is tapped; on governance mobile it opens as a bottom sheet so it does not cover the scope **Refresh** row.
- **Brief mobile with owner clusters:** full command card hides; owner action clusters become the primary above-fold surface.

Notifications mount in `#app-notification-slot` under the top bar (`Delivera-Shared-Notifications-Dock-Manager.js`).

## Brief highlights

- Shared project catalog (`GET /api/projects-catalog.json` + optional `data/Delivera-Org-Project-Catalog.json`; display names via `Delivera-Shared-Project-Display-01Resolve-SSOT.js`)
- **Loading shell:** `#gov-loading` reuses Sprint spinner markup (`Delivera-Governance-Brief-Page-02Loading-State.js`); cache hit paints instantly with a scope-bar “Refreshing…” chip (`preserveContent` pattern)
- **Cache-first paint:** `peekGovernanceBriefCache` renders the last scoped answer before network; **Refresh** calls `invalidateBriefCacheEntry` + `?refresh=1` on client and server
- **Scope SSOT:** project changes call `notifyScopeChanged()` (`Delivera-Shared-Scope-Notify-01Bridge.js`) so sidebar, top chrome, and scope bar stay aligned; cross-tab `storage` events also notify; scope change invalidates brief cache and forces reload; quarter key is `GOVERNANCE_QUARTER_KEY` in `Delivera-Shared-Storage-Keys.js`
- Client-side brief cache (`Delivera-Shared-Brief-Client-Cache-01Bridge.js`) keys on `periodWindow` as well as projects/quarter — period chip invalidates cache before reload; deduped quarters fetch (`Delivera-Shared-Quarters-List-01Fetch-Memo.js`) cut repeat network round-trips
- Brief load runs inbox + brief in parallel; scorecard defers until evidence `<details>` opens
- **Intervention stream:** `#gov-intervention-case-mount` appears only when the Brief has Jira-backed cases needing a human decision. It seeds/dedupes intervention cases from existing risks, reviews Teams/email-ready nudges, blocks unresolved recipients or changed issues, and keeps `/api/governance/intervention-shortlist.json` compatible.
- **Above-fold order (single squad):** squad hero card (`#gov-verdict-mount[data-hero-squad]`) first — portfolio banner, compare tray, sprint pulse, cause/action, open sprint/evidence — then compact copy/overflow actions → owner clusters → setup debt → proof preview; **right rail** holds agent queue + PI strip only (desktop sticky column 2). Duplicate lead-blocker strip and command visual blocks hide when hero is active (`governance-shell--hero-squad`). Multi-squad: heat tiles in hero mount; supporting evidence `<details>` stays collapsed when owner clusters exist; feedback in collapsed `<details>`
- **AI trust SSOT:** `Delivera-AI-Trust-Display-01SSOT.js` — Settings + top pill read server OpenRouter; high template-fallback rate suppresses advisor badge
- **Journey tests:** `npm run test:journey:settings-masterplan` · `npm run test:journey:hero-squad-first` · `npm run test:journey:customer-growth-round3` · `npm run test:journey:customer-simplicity-trust`
- **Report feedback dedupe:** when top chrome is present, `#feedback-panel` stays empty — global Improve Delivera modal is SSOT (`Delivera-Report-Page-Feedback-Panel-Inject.js` defers until after chrome mount)
- Responsive layout: scope capsule, answer blocks, PI counters, and tables use auto-fit grids + `data-table-scroll-wrap` (no horizontal bleed on mobile)
- **Above-fold declutter:** duplicate status in command answer hides when scope chip is SSOT; send badge hides when owner clusters exist; agent queue mount and secondary chrome stay collapsed until they have content; governance brand context in top chrome hides (scope capsule is SSOT)
- Page-level **Export brief** hides when top chrome is present — **Export brief** moves to command overflow (`#gov-export-overflow`)
- PI baseline wizard with optional slide upload; AI keys live in **Settings** (`/settings#integrations`) or `.env` — providers: OpenAI, Claude, **OpenRouter** (`OPENROUTER_API_KEY`). Work-draft canvas links to Settings (no duplicate key UI).
- Inbox drawer with icon tabs; guided nudge review (not silent approve)

Details: [`context.md`](context.md). Brief SSOT gate: `npm run test:journey:brief-ssot`. Layout gate: `npm run test:journey:layout-overlap`. Full governance bundle: `npm run test:journey:governance`.

## Quickstart

**Prerequisites:** Node.js `>=20`, Jira credentials.

```bash
npm install
cp .env.example .env   # set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN
npm run dev:safe       # recommended: port guard + CSS watch + API reload (one server per machine)
npm run dev            # or npm run dev:hot for CSS watch + nodemon
```

Production-style: `npm start` (runs `build:css` first).

**Dev port conflicts:** `dev:safe` auto-picks the first free port in `3001–3010` when the preferred port is busy (writes `.delivera-dev-port`). Use `npm run dev:safe:force` to terminate the listener on your preferred port, or set `PORT=3010 npm run dev:safe` to pin a port.

Playwright against an already-running server:

```bash
npm start
# another terminal:
BASE_URL=http://localhost:3001 SKIP_WEBSERVER=true npm run test:smoke
```

**Health probe:** `GET /healthz` returns `{ ok: true, ready: true }` when the process is listening (used by Render and deploy smoke tests).

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
| `npm run dev:safe` | Port guard + CSS watch + API reload (recommended) |
| `npm run dev:hot` | Single-port dev with CSS + API reload |
| `npm run test:all` | Full fail-fast orchestration |
| `npm run test:focused` | Focused Playwright specs tagged `@focused` (fail-fast, port guard) |
| `npm run test:smoke` | Short UX smoke |
| `npm run test:journey:settings-masterplan` | Settings hub, display names, integrations deep links |
| `npm run test:journey:direct-value-masterplan` | Direct-to-value master plan cross-surface validation |
| `npm run test:journey:value-retention` | Value retention master plan (27 steps: desktop 1024px density, alignment, investment drawer, period lens, edge cases E2/E6/E8, proof drawer tab) |
| `npm run test:current-sprint:dedupe-fold` | Sprint header/viewport gate |
| `npm run test:journey:brief-ssot` | Brief loading shell, cache-first paint, scope sync, Refresh bypass |
| `npm run test:journey:layout-overlap` | Governance/report/sprint layout overlap + mobile clip gate (fail-fast) |
| `npm run test:journey:governance` | Brief / governance Playwright bundle |
| `npm run test:journey:governance-intervention-loop` | Intervention case API journey and approval gates |
| `npm run test:journey:portfolio` | Portfolio signal, carousel, decision confirm, Actions bridge |
| `npm run test:journey:ux-core` | Cross-surface UX gate |
| `npm run vercel:deploy` | Manual Vercel deploy after `vercel login` |

Orchestration, journeys, and `SKIP_WEBSERVER`: [`TESTING.md`](TESTING.md)

**Journey buckets (SSOT):** Spec-to-journey mapping lives in `scripts/Delivera-Tests-Journey-Buckets-Map-SSOT.js`. Run a bucket with `node scripts/Delivera-Tests-Journey-Runner-SSOT.js <journeyId>` (e.g. `journey.value-retention`, `journey.ux-core`, `journey.governance`) or the matching `npm run test:journey:*` alias. The journey runner builds CSS before Playwright. `npm run test:focused` runs only specs tagged `@focused` in the test title. **Phase 3 desktop density:** governance brief and current sprint use a 2-column grid from 1024px (shared `--brief-desktop-cols` / `--brief-desktop-gap` in `01-reset-vars.css`). `npm run test:all` runs CSS sync → newest governance intervention unit/API journey → last-failed focused areas → settings/value/direct-value/layout/current-sprint/governance bundles, stopping on the first failed step. Direct Value spec owns evidence-tab restore; Value Retention spec owns squad portfolio, investment drawer, and period lens.

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

- Entry: [`server.js`](server.js) — `listenWithRetry`, graceful SIGTERM/SIGINT drain, deferred background workers
- Lifecycle: [`lib/Delivera-Server-Lifecycle-01Graceful.js`](lib/Delivera-Server-Lifecycle-01Graceful.js)
- Worker leader lock (multi-instance): [`lib/Delivera-Worker-Leader-01Lock.js`](lib/Delivera-Worker-Leader-01Lock.js) when `WORKER_LEADER_LOCK=1` or `INSTANCE_COUNT>1`
- App factory: [`lib/Delivera-Express-Core-App-Factory-Handler.js`](lib/Delivera-Express-Core-App-Factory-Handler.js)
- Routes: [`routes/views.js`](routes/views.js), [`routes/api.js`](routes/api.js) (`GET /healthz`)
- UI: `public/*.html`, `public/Delivera-*.js`, compiled `public/styles.css`
- Fetch retry on 502/503: [`public/Delivera-Shared-Runtime-Notification-Bridge.js`](public/Delivera-Shared-Runtime-Notification-Bridge.js)

## License

MIT
