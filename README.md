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
| `/report` | **Proof** | Historical delivery proof, sprint audit, completed outcomes, exclusions, and exports |

**Proof (report) boundary:** Governance owns today’s decision; Report proves what happened across sprints and exports the audit trail. Header **Refresh** / **Export** replace duplicate sidebar Preview, the last valid context auto-loads, and repeated squad/period/freshness labels stay in the shared context strip.

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
- **Cross-surface continuity:** spotlight, squad, sprint, and return-route tokens stay meaningful across Governance, Current Sprint, Actions, Report, and Dashboard links via `Delivera-Shared-Continuity-Link-01Build.js` (including shared `renderSquadIdentityStrip`). `spotlight` and `squad` are intentional URL aliases with a conflict warn when both differ. `/current-sprint?squad=<KEY>` also sets `projects=<KEY>` so the sprint board cannot hydrate another squad first. `/report?squad=<KEY>` mirrors that contract (`projects=` + squad hydrate). Actions → Governance carries `returnTo=/actions`, and Governance shows **Back to Actions** when that token is present. Legacy `/brief` and `/home` continuity routes warn and redirect to `/governance` / `/dashboard`.
- **Squad tunnel:** with `spotlight` + squad lens, ActiveLoop hides the portfolio comparison matrix and shows a selected-squad tunnel bar; diagnosis lives once in the H1; Commitment Pack + next-move sit on the right rail. Continuity persists last focus squad so chrome Sprint/Evidence hrefs never drop to bare routes. Journey: `npm run test:journey:customer-growth-squadtunnel-continuity-masterplan`.
- **Stickiness echo-death:** tunnel hides “Why proof is missing” when H1 owns the sentence; Sprint strips Ends-in beside Needs Attention; Structure-now Create twin suppressed under chrome; Actions `returnTo` keeps Back to Actions. Journey: `npm run test:journey:customer-growth-directvalue-stickiness-masterplan`.
- **Local fail-fast gates:** prefer `npm run test:friction:focused` then `npm run test:stability:focused`. Fat `test:journey:*` suites stay secondary/protected-branch coverage, not the front-line local gate.

Notifications mount in `#app-notification-slot` under the top bar (`Delivera-Shared-Notifications-Dock-Manager.js`).

## Brief highlights

- Shared project catalog (`Delivera-Shared-Projects-Catalog-01SSOT.js`, `GET /api/projects-catalog.json`)
- **Loading shell:** `#gov-loading` reuses Sprint spinner markup (`Delivera-Governance-Brief-Page-02Loading-State.js`); cache hit paints instantly with a scope-bar “Refreshing…” chip (`preserveContent` pattern)
- **Cache-first paint:** `peekGovernanceBriefCache` renders the last release-compatible scoped answer before network; **Refresh** calls `invalidateBriefCacheEntry` + `?refresh=1` on client and server. Incompatible browser envelopes are discarded without deleting role or accessibility preferences.
- **Scope SSOT:** project changes call `notifyScopeChanged()` (`Delivera-Shared-Scope-Notify-01Bridge.js`) so sidebar, top chrome, and scope bar stay aligned; cross-tab `storage` events also notify; scope change invalidates brief cache and forces reload; quarter key is `GOVERNANCE_QUARTER_KEY` in `Delivera-Shared-Storage-Keys.js`
- Client-side brief cache (`Delivera-Shared-Brief-Client-Cache-01Bridge.js`) keys on `periodWindow` as well as projects/quarter — period chip invalidates cache before reload; deduped quarters fetch (`Delivera-Shared-Quarters-List-01Fetch-Memo.js`) cut repeat network round-trips
- Brief load runs inbox + brief in parallel; scorecard defers until evidence `<details>` opens
- **Above-fold order (single squad):** squad hero card (`#gov-verdict-mount[data-hero-squad]`) first — portfolio banner, compare tray, sprint pulse, cause/action, open sprint/evidence — then compact copy/overflow actions → owner clusters → setup debt → proof preview; **right rail** holds agent queue + PI strip only (desktop sticky column 2). Duplicate lead-blocker strip and command visual blocks hide when hero is active (`governance-shell--hero-squad`). Multi-squad: heat tiles in hero mount; supporting evidence `<details>` stays collapsed when owner clusters exist; feedback in collapsed `<details>`
- **AI trust SSOT:** `Delivera-AI-Trust-Display-01SSOT.js` — Settings + top pill read server OpenRouter; high template-fallback rate suppresses advisor badge
- **Journey tests:** `npm run test:journey:hero-squad-first` · `npm run test:journey:customer-growth-round3` · `npm run test:journey:customer-simplicity-trust`
- **Report feedback dedupe:** when top chrome is present, `#feedback-panel` stays empty — global Improve Delivera modal is SSOT (`Delivera-Report-Page-Feedback-Panel-Inject.js` defers until after chrome mount)
- Responsive layout: scope capsule, answer blocks, PI counters, and tables use auto-fit grids + `data-table-scroll-wrap` (no horizontal bleed on mobile)
- **Above-fold declutter:** duplicate status in command answer hides when scope chip is SSOT; send badge hides when owner clusters exist; agent queue mount and secondary chrome stay collapsed until they have content; governance brand context in top chrome hides (scope capsule is SSOT)
- **Continuity declutter (2026-08 follow-on):** one visible Open report; squad/mission/% done echo cut on Sprint header; Decision Rail + cockpit twin “Today/next move” merged; wallpaper “Unknown work is 100%” degraded in spotlight/drawer; chrome stops leaking “No report run yet” / AI busy pills onto Sprint/Actions/Settings; Create inherits URL `projects`/`squad`; Actions rows drop repeated squad label when scoped
- **First-fold seal (2026-08 continuity pass 2):** soft “Verified Nm ago” replaces Sync-paused wallpaper; cluster-first PI impact (`Classify KEY`); Mission-not-mapped hidden; Take action owns next-move (subtitle/verdict demoted); squad deep-dive keeps sticky Decision bento in the right rail; quiet detail-refresh chips; broken classifyCluster handler repaired; healthz exposes `releaseId` for cache guard
- **Dedup / SoC merge (2026-08):** Domain `classifyStoryFreshness` + `clusterUnknownWork` are the freshness/unknown-copy SSOT (UI maps `answer.freshness`, does not re-age); unknown display helpers live in `Delivera-Governance-PI-Commitment-Pack-01Build-SSOT.js`; client cache wipe is `clearGovernanceClientCaches()` in `Delivera-Shared-Release-Cache-Guard-01SSOT.js` (ActiveLoop / Settings / ScopeBar); Continuity URL rewrite is `rewriteContinuityUrl` in `Delivera-Shared-Continuity-Link-01Build.js`; `escapeAttr` lives in `Delivera-Shared-Dom-Escape-Helpers.js`. Unused Brief AttentionQueue wrapper marked `DeleteThisFile_*`. ActiveLoop + Header-Bar remain SIZE-EXEMPT orchestrators after helper absorption.
- Page-level **Export brief** hides when top chrome is present — **Export brief** moves to command overflow (`#gov-export-overflow`)
- PI baseline wizard with optional slide upload; rebaseline always preserves the selected squad/project key through the CTA, wizard, API, and matching agent. AI keys live in **Settings** (`/settings#gov-ai-helper`) or `.env` — providers: OpenAI, Claude, **OpenRouter** (`OPENROUTER_API_KEY`). Work-draft canvas links to Settings (no duplicate key UI).
- **Slide-reader failure contract:** provider quota/auth failures return typed `429`/`503` responses (`AI_PROVIDER_LIMIT_REACHED`, `AI_PROVIDER_AUTH_FAILED`) without leaking provider URLs or key material. The wizard restores the upload controls, keeps the squad/quarter context, focuses a persistent recovery message, and links provider failures to Settings. A successful provider response with no readable commitments returns `AI_SLIDE_CONTENT_NOT_FOUND` instead of silently claiming a successful empty baseline.
- Inbox drawer with icon tabs; guided nudge review (not silent approve)

Details: [`context.md`](context.md). Brief SSOT gate: `npm run test:journey:brief-ssot`. Layout gate: `npm run test:journey:layout-overlap`. Full governance bundle: `npm run test:journey:governance`.

## Active PI Governance (index)

Meeting-safe PI decision loop owned by Active Loop (presentation contract v5): delivery H1 + delivery bento (Evidenced / Diverting / At risk / Unverified) → one primary CTA → squad matrix (Evidenced / Diverted / Slip / Next) → epic commitment rail (start→end + child done/total from timelineChips + epic activity) → spotlight → resolution drawer. Legacy brief chrome is a degraded fallback only (lazy-loaded). Full invariants, diagnosis codes, registry participation, release schema (`20260730a`), continuity (`squad` write, `spotlight` read alias), and backlog live in [`context.md`](context.md) (Governance Layer + UX reliability).

**Above-fold SSOT:** delivery-first H1 (not “N of M verified”); one `[data-loop-primary]`; `{Squad} today` chip is Sprint continuity only; matrix preferred Next = `Open`; enriched bento shows stories done + epics closed; epic rail hydrates from brief chips with honest `No Jira target · N/M children` when end date missing; single `verdictLabel` drives drawer title/tone (no verified vs cannot-verify contradiction); format-alignment chip from ad-hoc epics; Proof tools rail appears only in squad tunnel (not portfolio first fold).

**Epic title period SSOT** (`lib/Delivera-Governance-EpicHygiene-01Score-SSOT.js`): aligned naming is `FY27 Q2 – Squad – Platform – Commitment title`. `parseEpicTitleParts` / `periodFromEpicSummary` beat Fix Version / label-only PI metadata. Domain stamps child counts + start/end on `expectedVsActual`. Non-aligned titles surface as ad-hoc / slip signals (`formatAligned: false`).

**Issue identity SSOT:** Jira keys, epic keys, and sprint ids always render with a human title (or sprint name) via `renderIssueIdentityHtml` / `renderSprintIdentityHtml`, linking to `/report?issueKey=` or Current Sprint continuity — never bare codes alone. Epic rail chips use the same identity helper.

**Focused gates (prefer locally — saves Vercel / API credits):**
- `npm run test:journey:governance-delivery-trust-masterplan` — verdict SSOT, enriched bento, identity, drawer/nudge, logcat (includes epic-title unit pre-step)
- `npm run test:journey:governance-firstviewport-value-dedupe` — delivery H1, CTA dedupe, epic rail, continuity
- `npm run test:journey:customer-growth-squadtunnel-continuity-masterplan` — squad tunnel + continuity
- `npm run test:current-sprint:shell-release` — Sprint shell continuity
- `npm run test:friction:focused` — Sprint shell + Governance release + Settings registry
- Do **not** run `npm run vercel:deploy` / `--prod` unless intentionally releasing; prefer `npm run dev:safe` + hard-refresh for UI proof. Skip full journey buckets unless a gate fails.
- Local Playwright: run `npm run dev:safe` first, then `SKIP_WEBSERVER=true` with `BASE_URL` matching `.delivera-dev-port` (usually `http://localhost:3001`), or let Playwright start a fresh server (`REUSE_DEV_SERVER` unset).

Skip `journey.data-integrity` until that bucket is repaired.

**Flow intelligence (summary):** Current Sprint shares one evidence-bound intervention contract with Governance, Actions, and nudge review. Quiet-dev Done-probe drafts live in `Delivera-CurrentSprint-JiraNudge-01HumanText-SSOT.js`. Squad title on Sprint links back via `governanceSpotlightHref`.

## Quickstart

**Prerequisites:** Node.js `>=20`, Jira credentials (`JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`). Use an Atlassian account API token for the same email (create/manage at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)). Validate with `npm run validate:jira-env`.

```bash
npm install
cp .env.example .env   # set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN
npm run build:css      # compiles public/css/* (incl. 14-governance-baseline.css) → public/styles.css
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

The master login belongs only in the untracked local `.env` and the deployment platform’s encrypted environment settings. README documents variable names, never usernames, passwords, API keys, or secret values.

Full matrix: [`docs/environment.md`](docs/environment.md)

## Common commands

| Command | Use |
|---------|-----|
| `npm run build:css` | Compile `public/css/*` (01–14 partials; `14-governance-baseline.css` owns baseline job/trust strip) → `public/styles.css` |
| `npm run check:css` | Fail if `styles.css` is out of sync |
| `npm run dev:safe` | Port guard + CSS watch + API reload + /healthz self-heal (recommended) |
| `npm run test:friction:focused` | Small friction-finish release bundle: sprint shell → governance release → settings registry |
| `npm run test:stability:focused` | Server trust gate: healthz, governance mount, SD continuity, dashboard identity, settings bands |
| `npm run test:current-sprint:shell-release` | Focused Current Sprint fold, squad switch, Report continuity, and chrome readability |
| `npm run test:governance:release` | Five risk-ranked meeting-safe release scenarios, fail-fast |
| `npm run test:masterplan:release` | Exactly ten serial, fail-fast scenarios: diagnosis → Governance truth → Finance causes → participation → proof/report → clipboard → responsive → degradation → all-project anchor → evidence policy |
| `npm run test:settings:registry-release` | Focused Settings registry save, exclusivity, and continuity broadcast contract |
| `npm run dev:hot` | Single-port dev with CSS + API reload |
| `npm run test:smoke` | Short UX smoke |
| `npm run test:focused` | Focused Playwright specs tagged `@focused` (fail-fast, port guard) |
| Official Vercel Git integration | Authenticated preview/production deployment SSOT |

### Broader / protected-branch journeys

Prefer the focused gates above for local verification. These remain available for protected-branch or full orchestration:

| Command | Use |
|---------|-----|
| `npm run test:all` | Full fail-fast orchestration |
| `npm run test:journey:governance-active-loop` | Active PI contract loop (cache, evidence, actions, concurrency) |
| `npm run test:journey:customer-growth-directvalue-masterplan` | Direct-to-value continuity Master Plan (ScopeTruth, Decision Rail, Commitment Pack, fail-fast logcat) |
| `npm run test:journey:direct-value-masterplan` | Broader direct-to-value master plan cross-surface validation |
| `npm run test:journey:value-retention` | Value retention master plan (desktop density, drawers, edge cases) |
| `npm run test:current-sprint:dedupe-fold` | Sprint header/viewport gate |
| `npm run test:journey:brief-ssot` | Brief loading shell, cache-first paint, scope sync |
| `npm run test:journey:layout-overlap` | Layout overlap + mobile clip gate |
| `npm run test:journey:governance` | Brief / governance Playwright bundle |
| `npm run test:journey:ux-core` | Cross-surface UX gate |

Orchestration, journeys, and `SKIP_WEBSERVER`: [`TESTING.md`](TESTING.md)

**Journey buckets (SSOT):** Spec-to-journey mapping lives in `scripts/Delivera-Tests-Journey-Buckets-Map-SSOT.js`. Run a bucket with `node scripts/Delivera-Tests-Journey-Runner-SSOT.js <journeyId>` (e.g. `journey.value-retention`, `journey.ux-core`, `journey.governance`) or the matching `npm run test:journey:*` alias. The journey runner builds CSS before Playwright. `npm run test:focused` runs only specs tagged `@focused` in the test title. **Phase 3 desktop density:** governance brief and current sprint use a 2-column grid from 1024px (shared `--brief-desktop-cols` / `--brief-desktop-gap` in `01-reset-vars.css`). `npm run test:all` follows `scripts/Delivera-Test-Orchestration-Steps.js`: build/check CSS → governance-active-loop → churn-retention → value-retention → direct-value → layout-overlap → current-sprint:dedupe-fold → brief-ssot → PI unit/probe → journey.governance → journey.data-integrity → outcome-intake → ux-core → current-sprint → human-nudge-trust → leadership → e2e (fail-fast). Direct Value spec owns evidence-tab restore; Value Retention spec owns squad portfolio, investment drawer, and period lens.

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
