# Delivera

Delivery intelligence for scrum teams and leaders, backed by Jira.

Delivera answers **what to say, who to chase, and what proof to show** — in about 10 seconds on the Brief.

## Primary surfaces

| Route | Surface | Purpose |
|-------|---------|---------|
| `/dashboard` | **Today** | Executive entry point with continuity links into the active governance and sprint lanes |
| `/governance` | **Governance** | PI contract variance, squad evidence, and the next safe governance transition |
| `/current-sprint` | **Sprint** | What must move today: answer, blocker, owner, and next move before deeper inventory |
| `/actions` | **Actions** | Shared intervention queue for governance cases that need follow-up now |
| `/settings` | **Settings** | Organization registry, participation exceptions, owner-route gaps, AI/provider health, and audit status |
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
- **Cross-surface continuity:** spotlight, squad, sprint, and return-route tokens stay meaningful across Governance, Current Sprint, Actions, Report, and Dashboard links via `Delivera-Shared-Continuity-Link-01Build.js`. `/current-sprint?squad=<KEY>` is the sprint-side entry point; Actions → Governance carries `returnTo=/actions`, and Governance shows **Back to Actions** when that token is present.
- **Local fail-fast gate:** `npm run test:friction:focused` runs the small release bundle (Current Sprint shell → Governance release → Settings registry). Broad current-sprint journeys remain secondary/protected-branch coverage, not the front-line local gate.

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
- PI baseline wizard with optional slide upload; rebaseline always preserves the selected squad/project key through the CTA, wizard, API, and matching agent. AI keys live in **Settings** (`/settings#gov-ai-helper`) or `.env` — providers: OpenAI, Claude, **OpenRouter** (`OPENROUTER_API_KEY`). Work-draft canvas links to Settings (no duplicate key UI).
- **Slide-reader failure contract:** provider quota/auth failures return typed `429`/`503` responses (`AI_PROVIDER_LIMIT_REACHED`, `AI_PROVIDER_AUTH_FAILED`) without leaking provider URLs or key material. The wizard restores the upload controls, keeps the squad/quarter context, focuses a persistent recovery message, and links provider failures to Settings. A successful provider response with no readable commitments returns `AI_SLIDE_CONTENT_NOT_FOUND` instead of silently claiming a successful empty baseline.
- Inbox drawer with icon tabs; guided nudge review (not silent approve)

Details: [`context.md`](context.md). Brief SSOT gate: `npm run test:journey:brief-ssot`. Layout gate: `npm run test:journey:layout-overlap`. Full governance bundle: `npm run test:journey:governance`.

## Active PI Governance contract

### Native-first PI artifact intelligence

- Governance accepts image, PDF, and PPTX evidence through `POST /api/governance/pi-imports/prepare`, a one-use signed multipart upload, and a durable status receipt. Browser SHA-256 preflight returns an organization-scoped exact cache hit or joins the existing producer before bytes are uploaded.
- PPTX OOXML and PDF text/layout are extracted locally first. Images use CPU OCR. Only unresolved evidence may progress sequentially through Qianfan OCR Fast, Qwen visual structure, then Gemma reconciliation; the exact model, method, quota use, source span, confidence, and cache savings remain visible.
- Every external artifact call requires ZDR, schema validation, provenance, a Redis quota reservation, and a closed shared circuit. No external key is required for native or local processing, no dynamic free-router output can approve a baseline, and every baseline save remains a human-approved append-only revision.
- Vercel owns authenticated prepare/status APIs. `PI_IMPORT_WORKER_URL`, when set, receives the signed upload directly on Render; without a worker, bounded image/native-text work remains available and long multi-page visual processing fails explicitly instead of continuing after the response.
- Source files are temporary; Redis stores compressed normalized evidence, durable job state, hashes, quotas, circuits, and baseline history—not full decks. Cross-tenant hashes are namespaced by organization.
- Focused release validation is `npm run test:pi-release`: twelve fail-fast scenarios covering the supplied 48-page FY27 Q2 pack, T-Squad/TRS evidence, duplicate reuse, single-flight, model order, privacy, quota controls, state recovery, and direct-value UI contracts.

### Direct-to-value release contract

- Governance, Current Sprint, Actions, and Settings keep separate route ownership while sharing sprint truth, case lifecycle, display names, versions, and owner routes.
- Schema-v2 Layer 1 carries presentation contract version `3`; incompatible browser cache is rejected without replacing the last compatible story.
- Current Sprint writes a versioned per-squad sprint truth record and Governance reads that same cached record. Both expose the same truth version/hash and concrete `active`, `active-dates-expired`, `ended-no-successor`, `planned-not-started`, `closed`, `partial`, or `unverified` fact.
- Evidence-dependent actions are server-authorized. Jira failure or evidence older than 60 minutes disables send, approval, escalation, and re-check while preserving safe owner correction and drafts.
- `/actions` is the visible shared intervention queue and reuses the Governance resolution drawer; hidden legacy action mounts are never a data source.
- Settings owns the versioned organization registry. Participation is `pi-governed`, `pending-consent`, or `operational-exception`; production writes require Redis and fail closed.
- Release CI runs exactly five fail-fast Governance scenarios. Render deploy validation keeps exactly three production smoke scenarios.

Governance is a meeting-safe PI decision loop, not a Jira clone. It opens in **All Squads**, paints the last verified schema-v2 projection from local cache, refreshes quietly, and keeps the first viewport to one contract answer, source/freshness, completed-work line, decision CTA, and stable squad matrix.

- **Server-prepared truth:** `/api/governance/active-loop.json` serves Layer 1; squad and promise detail routes serve Layer 2. The browser renders, filters, and reveals the story but does not calculate Promise Match, Work Split, Proof Age, ranking, ownership, rework, or action eligibility.
- **Five bands:** Portfolio Answer → Squad Comparison → Synchronized Squad Spotlight → Resolution Drawer → Action Trail. Schema v2 suppresses the legacy comparison-card wall and duplicate action rails.
- **Deterministic evidence:** Promise Match, Work Split, Proof Age, Possible Rework, Unknown clustering, baseline coverage, owner routing, and stable risk order are rule-based. AI may simplify wording only.
- **Layered truth:** each squad row separates PI contract coverage, sprint cadence, Doing Instead, proof freshness, next action, and a plain trust factor. Missing evidence lowers trust; it never becomes a delivery accusation.
- **Board identity:** governed board aliases are resolved once and reused by Governance, Current Sprint, Report, catalog selectors, Spotlight, drawers, and previews. Raw Jira keys remain evidence identifiers, not the primary meeting label.
- **Operating-model firewall:** deterministic evidence can keep operational groups out of PI risk totals while leaving them reviewable. A PI-governed squad with heavy support demand remains in the contract totals and shows that load separately.
- **Conservative rework:** “Possible rework” requires at least two strong evidence paths. Weak reopenings, title similarity, minor corrections, and epic splits stay out of risk totals.
- **Source-safe writes:** local receipt → queued → source pending → source confirmed or failed → projection reconciled. Jira-dependent decisions never turn green before Jira confirms them. All writes carry optimistic version, squad hash, actor, target, idempotency key, retry state, audit evidence, and correction path.
- **Meeting continuity:** spotlight, lens, drawer draft, focus/popover, and scroll anchor remain stable during refresh. Same-item changes require review; unrelated squad changes do not replace active work.
- **Targeted freshness:** meeting users can refresh one promise or one squad and concurrent callers join the same job. Portfolio refresh remains worker/admin-owned.
- **Durability:** Redis is mandatory for production ledgers, hashes, streams, leases, and idempotency. JSONL/memory are local-development fallbacks only; production writes fail closed.
- **Diagnostics:** normal users see only a subdued UAT version control. Authorized UAT diagnostics open by double-click/double-tap, keyboard activation, or `Alt+Shift+D`; `/healthz` remains the deploy probe.

Primary release validation: `npm run test:governance:release`. It runs exactly five risk-ranked, fail-fast scenarios: source-write truth, Layer 1 value, synchronized Spotlight, refresh continuity, and the previously failed sprint-fold viewport contract. The broader journey remains available as `npm run test:journey:governance-active-loop`; pull requests use the five-scenario gate and protected-branch integration retains the full regression.

## Governance implementation record

This is the SSOT for the meeting-safe Governance implementation. Completed items remain here as durable product invariants: fast portfolio answer first, deterministic proof second, and the next safe transition available without leaving Governance. Future changes must reduce clicks, reduce duplicate surfaces, or make evidence more defensible.

**Priority codebase improvements**

1. **Sprint truth SSOT:** Current Sprint snapshot processing writes the canonical squad record; Governance consumes it rather than rebuilding from weaker portfolio inputs. Rationale: DMS cannot be "no sprint verified" in Governance while Current Sprint shows an active sprint.
2. **Warm Layer 1 only on first paint:** serve `active-loop.json` from the last verified story and defer legacy `governance-brief.json`, boards, feedback, inbox, and scorecard calls until v2 fallback or below-fold detail needs them. Rationale: the PI Team needs the answer in under two seconds, not an invisible legacy bill.
3. **Browser single-flight for active-loop reads:** coalesce duplicate first-load calls by scope/quarter/force in the frontend as well as the backend. Rationale: protects 90 concurrent viewers from multiplying identical reads.
4. **Decision coverage guard:** derive visible totals from schema total, checked promises, or Layer 1 promises so the hero never says `0 of 0` when the source line says promises were checked. Rationale: visible arithmetic must never contradict itself.
5. **Matrix copy simplification:** replace ambiguous headers (`Sprint cadence`, `Proof / next`, `Trust factor`) with `Sprint reality`, `Proof age / action`, and `Trust basis`. Rationale: brand-new users should understand each column without training.
6. **Stable lens emphasis:** lenses may dim or highlight columns and update one summary, but never reorder rows. Rationale: meeting participants keep spatial memory while discussing squads.
7. **Action trail grouping:** group identical empty or waiting states into one row with a promise count, while preserving a single next action. Rationale: removes repeated absence and makes real state changes stand out.
8. **Owner participation settings:** expose governed/excluded toggles for each catalog squad in Settings, backed by durable profile overrides and role checks. Rationale: squads such as Vodacom Business, M-SQUAD, Digital, Mini Apps, T-Squad, AMS, and Biometric KYC can remain exceptions until consent/onboarding.
9. **Source-safe write lifecycle everywhere:** link, classify, amend, operational-status, nudge, escalation, and callback writes stay receipt/queued/pending until Jira or Teams confirms. Rationale: no fake green states.
10. **Unknown cluster decisions:** promote grouped Unknown work only above threshold and offer cluster-level classification. Rationale: a 30-second cleanup decision beats a raw issue dump.
11. **Conservative Possible Rework:** require two strong evidence paths, confidence, and explanation before promoting. Rationale: the product must never accuse a squad from weak reopen/title similarity.
12. **Drawer state hash handshake:** compare story version, squad hash, and drawer hash before allowing saves. Rationale: open edits survive background refresh without silent overwrite.
13. **Global accessible help primitive:** consolidate native titles, hover cards, and one-off popovers into one persistent tooltip/popover pattern. Rationale: Jira keys, trust basis, and proof age help should be readable, copyable, keyboard reachable, and dismissible.
14. **Actions route boundary:** `/actions` should render the intervention case queue or redirect to a visible anchored Governance section; never land on a hidden empty mount. Rationale: dead navigation teaches users the app is unreliable.
15. **Current Sprint search truth:** search must filter visible work or be removed from the fold. Rationale: a control that accepts text and changes nothing burns user trust.
16. **Settings below-fold restructure:** keep AI provider health available, but move organization registry, squad participation, owner routes, and durability status into the first useful Settings band. Rationale: Governance corrections currently need Settings, but Settings hides those levers.
17. **Mobile first-viewport compression:** reduce hero/matrix vertical height, keep 44px targets, and show the first two squad states without horizontal lens sliding. Rationale: mobile PI review needs immediate value, not scroll debt.
18. **Diagnostics concealment:** keep build SHA, cache backend, flags, queue depth, and failed write reasons behind the UAT version trigger and authorized Settings entry. Rationale: diagnostics help UAT without polluting executive meetings.
19. **Friendly work-name SSOT:** render M-Pesa Recharge Trends style names before Jira keys across Governance, Current Sprint, and drawer evidence. Rationale: humans discuss work names; Jira keys are proof links.
20. **Route-boundary data contracts:** Governance owns portfolio variance, Current Sprint owns today's movement, Actions owns cases, Report owns proof, Settings owns registry/audit. Rationale: fewer surfaces, fewer repeated concepts, less churn.
21. **Dashboard continuity links:** the `/dashboard` hero uses the same identity-link shape as Governance so the first click can jump straight into either the selected squad brief lane or that squad's sprint lane.

**Bonus prerequisite improvements**

- Add a small server projection health object to Layer 1: `projectionAge`, `sourceBackend`, `detailAvailable`, `lastFailedWrite`, and `queueDepth`, hidden from normal UI but used by tests and diagnostics.
- Add a stable alias registry helper so display names are not re-derived in UI components.
- Move duplicate "stale proof" wording into one copy SSOT used by matrix, preview, drawer, and Current Sprint.
- Cache squad detail payloads by squad hash so Spotlight can reopen instantly in the same meeting.
- Add one participation override reducer that both Settings and the operating-model drawer call, with optional registry persistence only for authorized users.
- Add route-boundary tests that fail if Governance renders raw Jira tables above the fold or Actions routes to hidden empty content.
- Add an API budget counter to test fixtures so no first viewport path can accidentally call Jira or AI directly.
- Keep release validation to five fail-fast browser scenarios plus table-driven domain tests; broad regression remains protected-branch work, not local churn.

**Realistic edge cases**

- Operational group with one PI-looking epic: keep excluded, show "review classification," and never add the full group to PI totals until authorized.
- PI-governed squad with heavy support demand: keep in PI totals, show operational load separately, and offer amendment/risk decisions instead of hiding drift.
- Recently closed sprint with no next sprint: show "last sprint closed X days ago; no replacement detected," not "cadence okay" or generic missing sprint.
- Minor reopened issue: keep as follow-up or operational support unless Possible Rework reaches the multi-factor threshold.
- Epic split after acceptance: treat as continuation until acceptance reversal, linked defects, or same-criteria evidence proves possible rework.
- Stale callback after amendment: reject with a version conflict and preserve the user's draft.
- Jira write-back failure: keep the case attention-needed, show failure/correction path, and never mark the source confirmed.
- Layer 2 outage: keep Layer 1 useful, disable drawer write actions that require fresh detail, and show honest detail-unavailable copy.
- Corrupt or expired cache: show baseline recovery/no verified answer, not old conclusions.
- Concurrent targeted refresh: join the same promise/squad job and expose shared receipt; never start a portfolio scan from the meeting UI.

**Focused validation gate**

The local friction release gate is intentionally small: `npm run test:friction:focused`. It fail-fast runs Current Sprint shell continuity, the five Governance release scenarios, and Settings registry save/exclusivity contracts. Prefer that over broad current-sprint journeys for local verification. New continuity or above-fold contracts belong in the three friction specs rather than expanding total local suite size.

## Quickstart

**Prerequisites:** Node.js `>=20`, Jira credentials.

```bash
npm install
cp .env.example .env   # set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN
npm run dev:safe       # SSOT local watcher: port guard + CSS watch + API reload + /healthz self-heal
# npm run dev          # thinner path (CSS + nodemon only) — prefer dev:safe when the API flaps
```

Production-style: `npm start` (runs `build:css` first).

### Local server restart (one SSOT)

| Command | Use |
|---------|-----|
| `npm run dev:safe` | **Recommended.** Port guard + CSS watch + nodemon + health self-heal |
| `npm run dev:safe:force` | Kill preferred-port listener, then start `dev:safe` |
| `npm run dev:hot` | CSS + API reload without port guard |
| `npm run dev` | One-shot CSS build + nodemon only (prints tip to use `dev:safe`) |

**Dev port conflicts:** `dev:safe` auto-picks the first free port in `3001–3010` when the preferred port is busy (writes `.delivera-dev-port`). Use `npm run dev:safe:force` to terminate the listener on your preferred port, or set `PORT=3010 npm run dev:safe` to pin a port.

**Self-heal:** If the API process dies on a recoverable request race (or `/healthz` misses 3 polls), `dev:safe`/`dev:hot` respawns nodemon with backoff so Answer/Today do not stay blank until you touch a file.

Playwright against an already-running server:

```bash
npm run dev:safe
# another terminal:
BASE_URL=http://localhost:3001 SKIP_WEBSERVER=true npm run test:stability:focused
```

**Health probe:** `GET /healthz` returns `{ ok: true, ready: true }` when the process is listening (Redis is advisory only). Used by Render, deploy smoke, and the stability gate.

## Auth modes

- **No auth (local default):** open Brief without login vars
- **Legacy:** `SESSION_SECRET`, `APP_LOGIN_USER`, `APP_LOGIN_PASSWORD`; sessions use the shared Redis SSOT when configured so Vercel instance changes and Render restarts do not sign everyone out
- **SuperTokens:** `SUPERTOKENS_ENABLED=true` (optional `SUPERTOKENS_HYBRID_MODE=true`)

Full matrix: [`docs/environment.md`](docs/environment.md)

## Common commands

| Command | Use |
|---------|-----|
| `npm run build:css` | Compile `public/css/*` → `public/styles.css` |
| `npm run check:css` | Fail if `styles.css` is out of sync |
| `npm run test:current-sprint:shell-release` | Focused Current Sprint fold, squad switch, and chrome readability contract |
| `npm run test:journey:governance-active-loop` | Fail-fast active PI contract loop: cache, evidence, actions, concurrency, logs, accessibility |
| `npm run test:governance:release` | Five risk-ranked meeting-safe release scenarios, fail-fast |
| `npm run test:settings:registry-release` | Focused Settings registry save, exclusivity, and continuity broadcast contract |
| `npm run test:friction:focused` | Small friction-finish release bundle: sprint shell → governance release → settings registry |
| `npm run test:stability:focused` | Server trust gate: healthz, governance mount, SD continuity smoke, refresh storm, settings bands |
| `npm run dev:safe` | Port guard + CSS watch + API reload + /healthz self-heal (recommended) |
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

- **Production UI/API:** `https://vodaagileboard.vercel.app` — root `index.js` + `vercel.json`; workers disabled.
- **PI intelligence worker:** `https://delivera-pi-intelligence.onrender.com` — [`render.yaml`](render.yaml), local CPU OCR, shared signed upload contract, and background processing.
- **Durability:** Upstash Redis `delivera-production` stores sessions, import jobs, reusable extraction, leases, quotas, and append-only revisions. Original decks are not stored in Redis.
- **Zero-cost operating truth:** Render Free can sleep after inactivity and wake on the next request; the UI keeps the durable receipt and reports the wake stage. Free infrastructure is best-effort, has no uptime SLA, and cannot honestly guarantee 90 simultaneous OCR jobs. Cache hits and native extraction remain the scale path; external AI calls stay sequential and quota-capped.
- **Release automation:** GitHub Actions validates the Blueprint against `RENDER_WORKSPACE_ID`, deploys `RENDER_SERVICE_ID`, then runs the three authenticated production smoke scenarios.

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
- Routes: [`routes/views.js`](routes/views.js), [`routes/api.js`](routes/api.js) (`GET /healthz`); PI slide validation/provider/enrichment ownership lives in [`routes/Delivera-Governance-PIBaseline-Slide-Upload-01Route.js`](routes/Delivera-Governance-PIBaseline-Slide-Upload-01Route.js)
- UI: `public/*.html`, `public/Delivera-*.js`, compiled `public/styles.css`
- Fetch retry on 502/503: [`public/Delivera-Shared-Runtime-Notification-Bridge.js`](public/Delivera-Shared-Runtime-Notification-Bridge.js)

## License

MIT
