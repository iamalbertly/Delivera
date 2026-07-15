# Delivera

Delivery intelligence for scrum teams and leaders, backed by Jira.

Delivera answers **what to say, who to chase, and what proof to show** — in about 10 seconds on the Brief.

## Primary surfaces

| Route | Surface | Purpose |
|-------|---------|---------|
| `/governance` | **Portfolio** | Portfolio/RTE decision cockpit, squad comparison, governance evidence, open Actions |
| `/current-sprint` | **Squads** | What must move today (blockers, owners, nudges) |
| `/actions` | **Actions** | Intervention cases — ready nudges, waiting, escalations, proof |
| `/report` | **Proof** | Evidence and drill-down (unchanged route; top chrome links here from legacy bookmarks) |
| `/settings` | **Settings** | My workspace prefs, read-only org catalog, integrations health, Jira activity |

**Portfolio command surface (`/governance`):** Priority Brief hero (`#governance-priority-surface-mount`) is the **single visible paint path** — composed by `Delivera-App-Governance-PrioritySurface-01Render-UI.js` (hero + agentic + exception + commitment detail + carousel slot). **First-paint writers (Wave 2):** static HTML shell + `Delivera-Shared-Instant-Shell-01UI.js` + live/cache `paintPortfolioMounts` inside `Page-06Portfolio-Render-Plugin.js` only — Loading-State and bento skeleton must **not** rewrite the priority mount. Hidden legacy mounts are **not repainted** on `governance-priority-brief-page`. **Status grammar SSOT:** `Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js` (`gradateCardStatus`, `attentionTone`, `normalizeBackendStatusClass`, `isAttentionStatus`) — ExceptionRail / PriorityBrief tones + systemic banners + lib `PortfolioComparison` (`critical` / `on-track` / `watch`). **Actions scope filter SSOT:** `Delivera-App-Actions-Case-01Scope-Filter-SSOT.js`. **Instant loading:** static first-paint shells + Instant Shell stale-while-revalidate + compact `.gov-scope-stale-overlay` chip — never a blank white main. Orphans: `DeleteThisFile_*` AdaptiveEvidence / AlignmentSummary (zero refs). Round11/12 journey specs retained (exclusive assertions). Pipeline: `Page-03Load-Controller.js` + `Page-06` + Priority Brief + `PIBaseline` wizard. **Canonical P0 gate:** `npm run test:journey:core` (alias for `test:journey:churn-trust-repair` — fail-fast `--max-failures=1`). Legacy: `test:journey:governance-priority-brief` · `test:journey:portfolio`.

**Actions (`/actions`):** Ready-tab **Approve / Decline in place** (intervention cases — distinct from Squads Jira comment nudges). Project continuity via `Delivera-App-Actions-Case-01Scope-Filter-SSOT.js` (rejects foreign “X board” titles / wrong keys). Approve **422 fail-closed**. Proof tab lists evidence packs. `/evidence` and `/impact` redirect here. `/portfolio` redirects to `/governance`.

**Squads (`/current-sprint`):** Decision cockpit above the work table in lean mode; PI alignment strip one-hop links to `/governance?openAlignment=1`. One Create work chip above the fold (Structure now buried in non-lean only).

Impact adds a role-aware intelligence layer without replacing Jira, SuccessFactors, Teams, email, Portfolio, Squads, or Proof. It uses `/api/evidence-os/*`, checked-in Postgres migrations under `db/migrations/`, Drizzle schema under `db/schema/`, and the existing governed AI orchestrator for Tier 4 draft assistance only. Evidence, validation, commitments, and reports are background records; the user-facing surface is decisions and intervention.

**Settings hub (`/settings`):** sticky section nav — **My workspace** (simple mode, default squads) → **Organization** (read-only squad names, e.g. SD shown as DMS Squad) → **Integrations** (Jira health + AI trust) → **Activity** (Jira comment audit). Admins edit squad names via `data/Delivera-Org-Project-Catalog.json` (copy from [`docs/Delivera-Org-Project-Catalog.example.json`](docs/Delivera-Org-Project-Catalog.example.json)); see [`docs/org-settings.md`](docs/org-settings.md). Display resolver: `Delivera-Shared-Project-Display-01Resolve-SSOT.js`. Gate: `npm run test:journey:settings-masterplan`.

**Proof (report) above-fold:** header **Refresh** / **Export** replace duplicate sidebar Preview when top chrome is present; filter summary lives in the mission strip (sidebar summary hidden when chips exist); scorecard and heavy widgets defer until opened; `delivera:scope-changed` remounts proof summary and filter chips when squad changes.

**Bookmarks:** `/brief` and `/portfolio` → `/governance`. `/leadership` and `/program-increment` → `/governance#portfolio-decision`. `/evidence` and `/impact` → `/actions`. `/value-delivery` → `/report`. `/teams` and `/risks-blockers` → `/current-sprint` (with `#stuck-card` where applicable).

Root `/` lands on Brief when auth is off; otherwise follows your configured auth landing.

**Global chrome**

Authenticated pages use a Jira-style top bar (`#app-top-chrome`, `Delivera-Shared-Top-Chrome-01Render-UI.js`):

- **Site-wide nav SSOT:** `Delivera-Shared-Page-Route-01Resolve-SSOT.js` — `SURFACE_SWITCHER`, `PRIMARY_NAV_KEYS`, `getSurfaceQuickLinks()` (settings quick-nav), `getChromeSurfacePage()`. Sidebar + mobile bottom nav + top switcher all derive labels/hrefs from this module via `Delivera-Shared-Global-Nav.js`.
- **Layout contract:** `body.has-top-chrome` pads content under fixed chrome and owns `--sticky-global-nav-top` (nav stack) plus `--sticky-offset` (nav + scope bar — drawers/rails **below** the scope bar). Scope bar sticky `top` must be `0` (body padding already clears chrome; `overflow-x:hidden` makes body the sticky CB — using `--sticky-global-nav-top` doubles ~56px). Never apply `--sticky-offset` as `top` on the scope bar. Live heights via `Delivera-Shared-Sticky-Offset-01Measure.js`. Sprint/leadership HUD may still use `--sticky-global-nav-top` when sticking relative to the viewport.
- **Instant Shell SSOT:** `Delivera-Shared-Instant-Shell-01UI.js` + `public/css/15-instant-shell.css` paint layout-mirroring skeletons on every surface so users never see a blank white page; stale-while-revalidate via sessionStorage; skim attrs `data-delivera-surface` / `data-delivera-data-state`.
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
- **Loading shell:** system-wide instant shells (Governance / Squads / Actions / Settings HTML + `Delivera-Shared-Instant-Shell-01UI.js`). Portfolio load preserves last answer with a compact refresh chip (`Delivera-Governance-Brief-Page-02Loading-State.js`); no empty white `#gov-loading`. Scope bar shows a **time-box chip** (`Day X/Y · Z% time elapsed`) + **since-last-check chip** + **labeled status pill** (`✕ Blocked` / `● Watch` / `✓ OK` / `○ Setup`) in the summary strip. No Refresh button — auto-refresh fires on `visibilitychange` (debounced >2s, deferred during open drawers).
- **Shared UI primitives:** Jira story/epic titles render through `Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js` for full hover/focus titles + preview-ready issue keys; long-running waits render through `Delivera-Shared-Loading-State-01Render-UI.js`. HTML escaping is SSOT in `Delivera-Shared-Dom-Escape-Helpers.js` (client) + `Delivera-Server-Url-And-Escape-Helpers.js` (server) — no re-exports from governance modules.
- **Cache-first paint:** `peekGovernanceBriefCache` renders the last scoped answer before network; **Refresh** calls `invalidateBriefCacheEntry` + `?refresh=1` on client and server
- **Scope SSOT:** project changes call `notifyScopeChanged()` (`Delivera-Shared-Scope-Notify-01Bridge.js`) so sidebar, top chrome, and scope bar stay aligned; cross-tab `storage` events also notify; scope change invalidates brief cache and forces reload; quarter key is `GOVERNANCE_QUARTER_KEY` in `Delivera-Shared-Storage-Keys.js`
- Client-side brief cache (`Delivera-Shared-Brief-Client-Cache-01Bridge.js`) keys on `periodWindow` as well as projects/quarter — period chip invalidates cache before reload; deduped quarters fetch (`Delivera-Shared-Quarters-List-01Fetch-Memo.js`) cut repeat network round-trips
- **Server cache (age-tier TTL):** `lib/Delivera-Cache-AgeTier-01TTL-SSOT.js` drives `governanceBrief` and `portfolioDecision` namespaces in `lib/cache.js` (fresher data → shorter TTL; stale serve on Jira outage via `getWithStaleFallback`). Set `CACHE_BACKEND=redis` + `REDIS_URL` for shared cache across Node instances.
- **Client portfolio-decision cache:** `Delivera-Shared-Portfolio-Decision-Client-Cache-01Bridge.js` — peek + background revalidate on scope refresh (3m cap, respects server `meta.cacheTtlMs`).
- **Governance parity contract (2026-07-15):** `/governance` separates scoreable delivery squads from operational guilds, keeps ASG out of scoreable counts, and splits attention into delivery risk, missing PI baseline, missing Jira story evidence, and cannot-judge-yet. Portfolio decision cache keys include app version, quarter, scoreable squad scope, and baseline readiness. Stored compare peers do not contaminate the anchor brief; only explicit add-compare actions include peer squads in the live brief fetch. The portfolio scope bar owns trust/status/readiness, and visible setup actions appear only when setup gaps exist.
- Brief load runs inbox + brief in parallel; scorecard defers until evidence `<details>` opens
- **Intervention stream:** `#gov-intervention-case-mount` appears only when the Brief has Jira-backed cases needing a human decision. It seeds/dedupes intervention cases from existing risks, reviews Teams/email-ready nudges, blocks unresolved recipients or changed issues, and keeps `/api/governance/intervention-shortlist.json` compatible.
- **Above-fold order (single squad):** squad hero card (`#gov-verdict-mount[data-hero-squad]`) first — portfolio banner, compare tray, sprint pulse, cause/action, open sprint/evidence — then compact copy/overflow actions → owner clusters → setup debt → proof preview; **right rail** holds agent queue + PI strip only (desktop sticky column 2). Duplicate lead-blocker strip and command visual blocks hide when hero is active (`governance-shell--hero-squad`). Multi-squad: heat tiles in hero mount; supporting evidence `<details>` stays collapsed when owner clusters exist; feedback in collapsed `<details>`
- **AI trust SSOT:** `Delivera-AI-Trust-Display-01SSOT.js` — Settings + top pill read server OpenRouter; high template-fallback rate suppresses advisor badge
- **Journey tests:** `npm run test:journey:settings-masterplan` · `npm run test:journey:hero-squad-first` · `npm run test:journey:customer-growth-round3` · `npm run test:journey:customer-simplicity-trust`
- **Report feedback dedupe:** when top chrome is present, `#feedback-panel` stays empty — global Improve Delivera modal is SSOT (`Delivera-Report-Page-Feedback-Panel-Inject.js` defers until after chrome mount)
- Responsive layout: scope capsule, answer blocks, PI counters, and tables use auto-fit grids + `data-table-scroll-wrap` (no horizontal bleed on mobile)
- **Above-fold declutter:** duplicate status in command answer hides when scope chip is SSOT; send badge hides when owner clusters exist; agent queue mount and secondary chrome stay collapsed until they have content; governance brand context in top chrome hides (scope capsule is SSOT)
- Page-level **Export brief** hides when top chrome is present — **Export brief** moves to command overflow (`#gov-export-overflow`)
- PI baseline wizard with optional slide upload; AI keys live in **Settings** (`/settings#integrations`) or `.env` — providers: OpenAI, Claude, **OpenRouter** (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL_VISION` or `OPENROUTER_MODEL_IMAGE`). Work-draft canvas links to Settings (no duplicate key UI). Slide vision uses `google/gemini-2.5-flash-lite` by default; epic titles follow the org format from `data/Delivera-Org-Epic-Format.json` (`{quarter} – {system} – {subsystem} – {capability}`). Duplicate detection threshold: 55% similarity → user decides merge vs create new. Epic titles are inline-editable before submission. Unified loading/error states via `Delivera-Shared-Surface-State-01SSOT.js`.
- Inbox drawer with icon tabs; guided nudge review (not silent approve)
- **Direct-value master plan (2026-06):** single console patch (`Delivera-Shared-Runtime-Notification-Bridge.js` is the only `console.error` wrapper — extension noise filtered by regex, no double-fire); owner cluster dismiss chips hover-reveal on desktop / always visible on touch; evidence drawer has no tabs (investment summary inlined above proof list); micro-survey 4h timer disabled (post-nudge thumb chip only via `renderPostNudgeSurvey`); 14 dead `DeleteThisFile_*` files removed; `escapeHtml` imports consolidated to the SSOT (no re-exports from `02Render-Decisions-UI`).
- **Token & resource efficiency (2026-07):** Client-side AI usage cache (60s TTL in `Delivera-AI-Trust-Display-01SSOT.js`) eliminates 8+ duplicate `/api/settings/ai-usage.json` fetches per page load. Server-side caches for `ai-usage.json` (30s), `ai-provider-status.json` (30s), `projects-catalog.json` (5m), `quarters-list` (5m) prevent redundant disk reads. Slide vision results cached by image hash (10m TTL) — re-uploads return instantly. `seedFromBrief` client-side dedup (30s TTL) prevents duplicate POSTs. Duplicate `refreshPortfolioSurface` call eliminated (was firing 2× `portfolio-decision.json` POSTs per load). Health watchdog global guard prevents multiple polling instances. Net result: 19 API calls per page load (down from 40+), zero duplicate AI token consumption.
- **Visual declutter (2026-07):** Developer test commands removed from help popover (was showing `npm run test:journey:*` to end users). "Logging alerts: 0 · Healthy" chip hidden when healthy (was developer telemetry noise in sidebar footer). Test consolidation: Direct-Value MasterPlan Rounds 4–8 deprecated (Round 9 is canonical); AutoHacker v3–v5 deprecated (v6 is canonical). Duplicate `test:journey:direct-value-r{4-8}` scripts replaced by single `test:journey:direct-value-masterplan`.
- **Trust & continuity fixes (2026-07-15):** (1) **Phantom squad bug fixed** — `squadDisplayName()` in `PortfolioDecision-01SSOT.js` + `PortfolioExposure-01SSOT.js` now prefers the org catalog label over the Jira `boardName`, preventing shared/foreign boards (e.g. a DevSecOps board touching SD issues) from renaming the squad as "COPS PROJECT". Board discovery in `Brief-03Assemble-Service.js` filters boards whose `location.projectKey` doesn't match the requested projects. (2) **Create-work drawer state leak fixed** — `ensureTopChrome()` closes any lingering drawer on every page render; CSS adds `left: auto` safety net so the Close button can never be pushed off-screen. (3) **Cadence chip staleness capped** — `staleLabelFromBrief()` in `Cadence-01Pack-Render-UI.js` caps the stale label at the sprint's actual duration (via `sprintPulse.daysElapsedCalendar`), preventing "48d stale" for a 13-day-old sprint. (4) **Cross-squad contamination fixed** — `getProjects()` in the portfolio scope bar now returns only the anchor in drill mode, so the brief API doesn't flood the drilled squad with other squads' stories. (5) **Section label conditional** — "Squad deep dive" vs "Squad comparison" based on view mode. (6) **Stale epic relevance decay** — `summarizeCommitmentRows()` adds `notPlannedActive` count excluding stale candidates (idle >45d), so dormant epics don't inflate a squad's gap-list ranking. (7) **Systemic banner split** — "5 squads at 0%" now splits into "N squads need PI slides (cannot score)" vs "N squads at 0% delivered (blocked)". (8) **Quarter dropdown fixed** — `defaultQuarterLabel()` in `ScopeBar-03Shared-Kernel-SSOT.js` computes the current Vodacom fiscal quarter from today's date; `deriveVodacomQuarterFromDate()` in `VodacomQuarters-01Bounds.js` resolves `period.vodacomQuarter` server-side (was always null). (9) **Duplicate Settings nav removed** — Settings icon button removed from Global actions (already in Surfaces nav). (10) **Clipped + Add comparison fixed** — `portfolio-scope-compare-row` `overflow: visible`.

Details: [`context.md`](context.md). Brief SSOT gate: `npm run test:journey:brief-ssot`. Layout gate: `npm run test:journey:layout-overlap`. **Governance fail-fast P0:** `npm run test:journey:governance-p0` (29 PI units + ~50 Playwright). Full governance bundle: `npm run test:journey:governance`.

**PI baseline / Alignment Studio:** Slide upload matches Jira epics via capability-segment + bullet similarity (45–55% threshold), Jira fallback when board cache is thin, and auto-promotion of 55%+ duplicate-risk rows to **matched**. Auto-reconcile runs after propose; matched rows pre-check on review. Vision cache key `v2|…` busts stale pre-fix matches. Baselines persist to `data/Delivera-PI-Baseline-Snapshots.jsonl` keyed by `projects+quarter`; brief assembly uses `getLatestPIBaselineForScope`. Saving baseline invalidates governance brief + portfolio-decision caches. **Fail-fast CI:** `npm run test:journey:core` (canonical — 31 units + 37 Playwright). Legacy standalone: `test:journey:governance-priority-brief` · `test:journey:portfolio` (both subsets of core).

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

**Health probe:** `GET /healthz` returns `{ ok: true, ready: true }` when the process is listening (used by Render and deploy smoke tests). Transient `unhandledRejection` events are logged but no longer kill the process immediately; a client watchdog (`Delivera-Shared-Health-Watchdog-01Client.js`) polls `/healthz` and shows a bottom reconnect banner when the API is unreachable.

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
| `npm run test:all` | Full fail-fast orchestration (reordered tiers) |
| `npm run test:journey:core` | **Daily P0 gate** — 31 units + 37 Playwright (governance + portfolio command, fail-fast) |
| `npm run test:journey:churn-trust-repair` | Same as `test:journey:core` |
| `npm run test:all:priority` | Tier 0–2 gate: CSS sync, churn-trust-repair, layout-overlap, brief-ssot, sprint dedupe-fold |
| `npm run test:focused` | Focused Playwright specs tagged `@focused` (fail-fast, port guard) |
| `npm run test:parity:focused` | **Recommended parity gate** — UTF-8, CSS, focused governance/portfolio units, portfolio journey, governance click-friction, current-sprint chrome smoke, fast click audit |
| `npm run test:parity:focused:vercel` | Same as parity gate plus local `npx vercel build` |
| `npm run test:smoke` | Short UX smoke |
| `npm run test:journey:direct-value-masterplan` | Direct-to-value master plan (Round 9 canonical — supersedes Rounds 4–8 which are deprecated) |
| `npm run test:journey:settings-masterplan` | Settings hub, display names, integrations deep links |
| `npm run test:journey:value-retention` | Value retention master plan (27 steps: desktop 1024px density, alignment, investment drawer, period lens, edge cases E2/E6/E8, proof drawer tab) |
| `npm run test:current-sprint:dedupe-fold` | Sprint header/viewport gate |
| `npm run test:journey:brief-ssot` | Brief loading shell, cache-first paint, scope sync, Refresh bypass |
| `npm run test:journey:layout-overlap` | Governance/report/sprint layout overlap + mobile clip gate (fail-fast) |
| `npm run test:journey:governance-p0` | Fail-fast governance gate: PI baseline units + Alignment Studio / scope / visual-clarity P0 Playwright |
| `npm run test:journey:governance` | Brief / governance Playwright bundle |
| `npm run test:journey:governance-intervention-loop` | Intervention case API journey and approval gates |
| `npm run test:journey:pi-intelligence` | PI confidence, scope intelligence, epic hygiene, feedback lab (on-demand legacy hydrate) |
| `npm run test:journey:portfolio` | Legacy subset of core (portfolio command only) |
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

Pre-deploy: `npm run test:parity:focused:vercel` for governance/scope/chrome changes. Use the broader journey bundles only when touching their owned surface or shared data contracts.

**Vercel note:** `vercel.json` bundles `public/**` into the serverless function for HTML routes (`/governance`, etc.). If deploy fails on `includeFiles`, clear conflicting **Functions** overrides in the Vercel project dashboard.

**Production identity:** `/version` must show the same branch and commit as the pushed `autohacker-20260615_093142` head. If the alias still reports an older commit after push, run a manual production deploy (`npx vercel deploy --prod`) and verify `https://vodaagileboard.vercel.app/version`.

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
