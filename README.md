# Delivera

Delivery intelligence for scrum teams and leaders, backed by Jira.

Delivera answers **what to say, who to chase, and what proof to show** — in about 10 seconds on the Brief.

## Primary surfaces

| Route | Surface | Purpose |
|-------|---------|---------|
| `/governance` | **Governance** | PI contract variance, squad evidence, and the next safe governance transition |
| `/current-sprint` | **Sprint** | What must move today (blockers, owners, nudges) |
| `/report` | **Proof** | Evidence and drill-down for the current Brief |

**Proof (report) above-fold:** header **Refresh** / **Export** replace duplicate sidebar Preview when top chrome is present; filter summary lives in the mission strip (sidebar summary hidden when chips exist); scorecard and heavy widgets defer until opened; `delivera:scope-changed` remounts proof summary and filter chips when squad changes.

**Bookmarks:** `/brief` → `/governance`. `/leadership` and `/program-increment` → `/governance#decision-snapshot`. `/value-delivery` → `/report`. `/teams` and `/risks-blockers` → `/current-sprint` (with `#stuck-card` where applicable).

Root `/` lands on Brief when auth is off; otherwise follows your configured auth landing.

## Global chrome

Authenticated pages use a Jira-style top bar (`#app-top-chrome`, `Delivera-Shared-Top-Chrome-01Render-UI.js`):

- **Answer · Today · Proof** surface switcher (primary wayfinding; `Delivera-Shared-Top-Chrome-01Render-UI.js`)
- Sidebar toggle, workspace context, search, **Create**, notifications, help, settings, avatar
- Left sidebar: context card + data pulse only (nav links hidden on desktop)
- Duplicate page-level **Create** buttons are suppressed when top chrome is present
- **Mobile/tablet (≤768px):** search collapses to a 36px icon (`.is-collapsed`); brand slot hides; focus expands search to a second row (`body.top-search-active`) and grows chrome height to 98px. Help and avatar hide at ≤480px. `Escape` dismisses expanded search.
- **Brief notifications:** dock stays collapsed until the bell is tapped; on governance mobile it opens as a bottom sheet so it does not cover the scope **Refresh** row.
- **Brief mobile with owner clusters:** full command card hides; owner action clusters become the primary above-fold surface.

Notifications mount in `#app-notification-slot` under the top bar (`Delivera-Shared-Notifications-Dock-Manager.js`).

## Brief highlights

- Shared project catalog (`Delivera-Shared-Projects-Catalog-01SSOT.js`, `GET /api/projects-catalog.json`)
- **Loading shell:** `#gov-loading` reuses Sprint spinner markup (`Delivera-Governance-Brief-Page-02Loading-State.js`); cache hit paints instantly with a scope-bar “Refreshing…” chip (`preserveContent` pattern)
- **Cache-first paint:** `peekGovernanceBriefCache` renders the last scoped answer before network; **Refresh** calls `invalidateBriefCacheEntry` + `?refresh=1` on client and server
- **Scope SSOT:** project changes call `notifyScopeChanged()` (`Delivera-Shared-Scope-Notify-01Bridge.js`) so sidebar, top chrome, and scope bar stay aligned; cross-tab `storage` events also notify; scope change invalidates brief cache and forces reload; quarter key is `GOVERNANCE_QUARTER_KEY` in `Delivera-Shared-Storage-Keys.js`
- Client-side brief cache (`Delivera-Shared-Brief-Client-Cache-01Bridge.js`) keys on `periodWindow` as well as projects/quarter — period chip invalidates cache before reload; deduped quarters fetch (`Delivera-Shared-Quarters-List-01Fetch-Memo.js`) cut repeat network round-trips
- Brief load runs inbox + brief in parallel; scorecard defers until evidence `<details>` opens
- **Above-fold order (single squad):** squad hero card (`#gov-verdict-mount[data-hero-squad]`) first — portfolio banner, compare tray, sprint pulse, cause/action, open sprint/evidence — then compact copy/overflow actions → owner clusters → setup debt → proof preview; **right rail** holds agent queue + PI strip only (desktop sticky column 2). Duplicate lead-blocker strip and command visual blocks hide when hero is active (`governance-shell--hero-squad`). Multi-squad: heat tiles in hero mount; supporting evidence `<details>` stays collapsed when owner clusters exist; feedback in collapsed `<details>`
- **AI trust SSOT:** `Delivera-AI-Trust-Display-01SSOT.js` — Settings + top pill read server OpenRouter; high template-fallback rate suppresses advisor badge
- **Journey tests:** `npm run test:journey:hero-squad-first` · `npm run test:journey:customer-growth-round3` · `npm run test:journey:customer-simplicity-trust`
- **Report feedback dedupe:** when top chrome is present, `#feedback-panel` stays empty — global Improve Delivera modal is SSOT (`Delivera-Report-Page-Feedback-Panel-Inject.js` defers until after chrome mount)
- Responsive layout: scope capsule, answer blocks, PI counters, and tables use auto-fit grids + `data-table-scroll-wrap` (no horizontal bleed on mobile)
- **Above-fold declutter:** duplicate status in command answer hides when scope chip is SSOT; send badge hides when owner clusters exist; agent queue mount and secondary chrome stay collapsed until they have content; governance brand context in top chrome hides (scope capsule is SSOT)
- Page-level **Export brief** hides when top chrome is present — **Export brief** moves to command overflow (`#gov-export-overflow`)
- PI baseline wizard with optional slide upload; AI keys live in **Settings** (`/settings#gov-ai-helper`) or `.env` — providers: OpenAI, Claude, **OpenRouter** (`OPENROUTER_API_KEY`). Work-draft canvas links to Settings (no duplicate key UI).
- Inbox drawer with icon tabs; guided nudge review (not silent approve)

Details: [`context.md`](context.md). Brief SSOT gate: `npm run test:journey:brief-ssot`. Layout gate: `npm run test:journey:layout-overlap`. Full governance bundle: `npm run test:journey:governance`.

## Active PI Governance contract

Governance is a meeting-safe PI decision loop, not a Jira clone. It opens in **All Squads**, paints the last verified schema-v2 projection from local cache, refreshes quietly, and keeps the first viewport to one contract answer, source/freshness, completed-work line, decision CTA, and stable squad matrix.

- **Server-prepared truth:** `/api/governance/active-loop.json` serves Layer 1; squad and promise detail routes serve Layer 2. The browser renders, filters, and reveals the story but does not calculate Promise Match, Work Split, Proof Age, ranking, ownership, rework, or action eligibility.
- **Five bands:** Portfolio Answer → Squad Comparison → Synchronized Squad Spotlight → Resolution Drawer → Action Trail. Schema v2 suppresses the legacy comparison-card wall and duplicate action rails.
- **Deterministic evidence:** Promise Match, Work Split, Proof Age, Possible Rework, Unknown clustering, baseline coverage, owner routing, and stable risk order are rule-based. AI may simplify wording only.
- **Conservative rework:** “Possible rework” requires at least two strong evidence paths. Weak reopenings, title similarity, minor corrections, and epic splits stay out of risk totals.
- **Source-safe writes:** local receipt → queued → source pending → source confirmed or failed → projection reconciled. Jira-dependent decisions never turn green before Jira confirms them. All writes carry optimistic version, squad hash, actor, target, idempotency key, retry state, audit evidence, and correction path.
- **Meeting continuity:** spotlight, lens, drawer draft, focus/popover, and scroll anchor remain stable during refresh. Same-item changes require review; unrelated squad changes do not replace active work.
- **Targeted freshness:** meeting users can refresh one promise or one squad and concurrent callers join the same job. Portfolio refresh remains worker/admin-owned.
- **Durability:** Redis is mandatory for production ledgers, hashes, streams, leases, and idempotency. JSONL/memory are local-development fallbacks only; production writes fail closed.
- **Diagnostics:** normal users see only a subdued UAT version control. Authorized UAT diagnostics open by double-click/double-tap, keyboard activation, or `Alt+Shift+D`; `/healthz` remains the deploy probe.

Primary validation: `npm run test:journey:governance-active-loop`. Tests fail fast on browser exceptions, console/API/server errors, false source confirmation, stale writes, duplicate jobs, accessibility regressions, and meeting-state discontinuity.

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
| `npm run test:journey:governance-active-loop` | Fail-fast active PI contract loop: cache, evidence, actions, concurrency, logs, accessibility |
| `npm run validate:jira-env` | Probe Jira `/myself` with `.env` |
| `npm run dev:safe` | Port guard + CSS watch + API reload (recommended) |
| `npm run dev:hot` | Single-port dev with CSS + API reload |
| `npm run test:all` | Full fail-fast orchestration |
| `npm run test:focused` | Focused Playwright specs tagged `@focused` (fail-fast, port guard) |
| `npm run test:smoke` | Short UX smoke |
| `npm run test:journey:direct-value-masterplan` | Direct-to-value master plan cross-surface validation |
| `npm run test:journey:value-retention` | Value retention master plan (27 steps: desktop 1024px density, alignment, investment drawer, period lens, edge cases E2/E6/E8, proof drawer tab) |
| `npm run test:current-sprint:dedupe-fold` | Sprint header/viewport gate |
| `npm run test:journey:brief-ssot` | Brief loading shell, cache-first paint, scope sync, Refresh bypass |
| `npm run test:journey:layout-overlap` | Governance/report/sprint layout overlap + mobile clip gate (fail-fast) |
| `npm run test:journey:governance` | Brief / governance Playwright bundle |
| `npm run test:journey:ux-core` | Cross-surface UX gate |
| Official Vercel Git integration | Authenticated preview/production deployment SSOT |

Orchestration, journeys, and `SKIP_WEBSERVER`: [`TESTING.md`](TESTING.md)

**Journey buckets (SSOT):** Spec-to-journey mapping lives in `scripts/Delivera-Tests-Journey-Buckets-Map-SSOT.js`. Run a bucket with `node scripts/Delivera-Tests-Journey-Runner-SSOT.js <journeyId>` (e.g. `journey.value-retention`, `journey.ux-core`, `journey.governance`) or the matching `npm run test:journey:*` alias. The journey runner builds CSS before Playwright. `npm run test:focused` runs only specs tagged `@focused` in the test title. **Phase 3 desktop density:** governance brief and current sprint use a 2-column grid from 1024px (shared `--brief-desktop-cols` / `--brief-desktop-gap` in `01-reset-vars.css`). `npm run test:all` runs value-retention → direct-value-masterplan → focused → layout-overlap → current-sprint:dedupe-fold immediately after `check:css` (fail-fast). Direct Value spec owns evidence-tab restore; Value Retention spec owns squad portfolio, investment drawer, and period lens.

## CSS contract

Edit partials under `public/css/` only. Never edit `public/styles.css` directly.

```bash
npm run build:css
npm run check:css
```

Ownership: [`public/css/README.md`](public/css/README.md)

## Deployment

- **Render:** [`render.yaml`](render.yaml) — always-on Node, background workers
- **Vercel:** root `index.js` + `vercel.json` with the official Git integration; workers disabled

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
