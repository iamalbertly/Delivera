# Delivera Active PI Governance Loop

Status: recommended product and implementation plan
Date: 2026-07-17
Decision: evolve the existing Governance Brief, PI baseline, Actions/inbox, Jira activity, Settings roles, evidence drawer, cache, and worker. Do not add a second governance product or a Jira-shaped work-management layer.

## Executive decision

Delivera Governance should become a read-model plus decision loop centered on one question:

> Which squads are not honoring the approved PI contract, why, and what is the next safe intervention?

The best shape is:

1. **The PI contract is durable truth.** A baseline contains immutable promises with Delivera-owned promise IDs. Jira work is evidence linked to a promise; it is never the promise itself.
2. **Governance is the fast read model.** It paints the last verified all-squads answer immediately, refreshes quietly, and opens a single proof-and-action drawer.
3. **Actions owns the intervention case.** Nudges, replies, re-checks, amendments, risk acceptance, ownership assignment, and approvals are events on one case, not disconnected UI actions.
4. **Settings owns people and policy.** The organization registry, role fallbacks, business-day calendar, permissions, and audit browsing remain shared capabilities.
5. **The backend owns synchronization.** Jira and Teams updates enter a coalesced event pipeline. Browsers read local governance state and attach to refresh jobs; they do not initiate independent portfolio scans.
6. **Every decision is version-protected.** The visible state carries an ETag/version. Writes use `If-Match`; stale writes fail with `412 Precondition Failed` and never overwrite newer decisions.

This preserves Delivera's differentiator: Jira reports work activity; Delivera preserves the agreement and governs variance from it.

## What should be improved in the proposal

The requested direction is strong. These refinements make it implementable and trustworthy.

### 1. Separate promise identity from Jira identity

The current baseline store only retains committed items that have an `issueKey`, and the comparison looks up that same key. That makes Jira identity the contract identity. It cannot faithfully represent a promise with no Jira work, a renamed/replaced epic, or one promise split across several epics.

Give each promise an immutable `promiseId`, such as `prm_...`, and preserve:

- original promise text and business outcome;
- squad, quarter, source document/reference, and source excerpt/hash;
- baseline ID and baseline approval record;
- readiness gaps and any risk accepted at commitment time;
- zero or more time-bounded Jira evidence links.

Jira links then have their own lifecycle: `proposed`, `approved`, `superseded`, `deleted`, or `rejected`. A link change increments the promise version but never changes the original promise.

Rationale: this is the smallest change that makes “contract versus evidence” true instead of rhetorical.

### 2. Model amendments as events, not replacement baselines

The current `getLatestPIBaseline()` behavior effectively makes the newest snapshot win. That is useful for retrieval but unsafe as contract semantics: saving another snapshot can appear to replace history.

Create one approved baseline per quarter/version and append amendment records that target promises. The effective contract is a deterministic projection of:

`approved baseline + approved amendments up to evaluation time`

Allowed amendment types:

- `mutually_agreed_descope`
- `move_to_next_quarter`
- `split_into_new_promise`
- `replace_with_urgent_work`
- `mark_as_support_obligation`

An amendment must carry reason, requested by, approved by, approved at, source/proof, prior promise version, and replacement promise IDs where applicable. The UI label is **Aligned, amended**, but the original variance remains visible in history.

Rationale: this protects morale without laundering a breach or rewriting the past.

### 3. Use a transactional system of record for active decisions

Append-only JSONL remains useful for development exports and audit mirroring, but the current stores also rewrite entire JSONL files when resolving or updating records. They cannot safely enforce atomic version checks across multiple server instances or concurrent PI Team users.

Use a relational transactional store for baselines, promises, links, amendments, cases, actions, decisions, delivery state, and audit events. PostgreSQL is the recommended durable store. Keep Redis, which Delivera already depends on, for server cache, event streams, debounce windows, locks, and single-flight job coordination. JSONL can remain an append-only export/backup adapter during migration.

Rationale: optimistic concurrency is only trustworthy when the version check and mutation happen atomically.

### 4. Correlate nudges structurally and visibly

Every send creates a reference before dispatch, for example `DLV-FY27Q2-7K3M9`. Put it:

- visibly at the end of the Jira comment or Teams message;
- in Delivera's action event and outbox record;
- in a Jira comment property when permissions allow;
- in the Teams message record with the returned message/thread ID.

Do not depend only on text search. Jira comments are flat, so a “reply” is either a later comment containing the Delivera reference or a relevant issue-state change after the send. Teams channel messages have real threaded replies and can be watched by message/thread ID.

Rationale: the visible reference supports humans and degraded integrations; structural IDs make harvesting reliable.

### 5. Distinguish evidence freshness from transport freshness

The page needs three timestamps, not one ambiguous “fresh” label:

- **Contract approved:** when the agreement became authoritative.
- **Evidence observed:** when Jira/Teams state was last captured.
- **Answer verified:** when deterministic rules last evaluated that evidence.

Rationale: a recently served cache entry can contain old Jira evidence, and old evidence can still have a recently verified classification. Conflating these erodes trust.

## Target experience

### First viewport

Default scope is the user's authorized **All Squads** portfolio and the active PI quarter. Do not restore the last single-squad scope on Governance unless the user arrived through an explicit deep link.

The viewport contains only:

1. **Answer:** “2 squads are not aligned to Q2 PI promises. DMS has 2 promises with no Jira proof. RPA has 1 promise only partly matched.”
2. **Source:** “Compared with FY27 Q2 PI contract · 11 promises checked · last verified 10:32.”
3. **Delivera already did:** “Matched the contract to Jira, checked proof age and work split, and prepared 2 owner asks.”
4. **One CTA:** “Review and decide” for the highest-value open case; “Review attention items” when more than one is equivalent.
5. **Squad strip:** all squads, risky squads emphasized and aligned squads calm.

Do not render the old carousel, signal hero, commitment wall, prepared-actions rail, separate right decision rail, full proof table, or AI narration above the fold.

### Cache-first contract

Use a minimal `GovernanceAnswerSnapshot`, not the full proof pack, in browser storage. Key it by organization, user/permission fingerprint, portfolio, quarter, and schema version. Include `verifiedAt`, `evidenceObservedAt`, `contractId`, `contractVersion`, `answerVersion`, squad summaries, and no sensitive proof bodies.

Load sequence:

1. Read and validate the local snapshot synchronously/at boot.
2. Paint it if its scope and permission fingerprint match.
3. Fetch the server materialized snapshot immediately.
4. Render it only if the request sequence and current scope still match.
5. Ask the backend to refresh only when policy says the materialized state is stale; attach to an existing refresh if present.
6. Quietly replace the answer after a complete verified result arrives. If the user has a drawer open or is mid-decision, update a “new evidence available” indicator instead of reordering content.

Performance budgets:

- local verified answer paint: p95 under 500 ms on a warm visit;
- server snapshot visible: p95 under 2 seconds on a cold browser with a warm server cache;
- no live Jira, AI, proof-table construction, or full portfolio recomputation on the critical render path;
- a refresh response that belongs to an old scope is ignored.

### Proof-and-action drawer

Clicking a squad or promise remains on Governance and opens the shared right drawer. Sections appear in this order:

1. Verdict and why the deterministic rule fired.
2. Original PI promise and source.
3. Matched Jira evidence, link confidence, changes/deletions, and acceptance evidence.
4. Proof age and the exact last qualifying movement.
5. Work Split evidence, method, coverage, largest unmapped cluster, and Unknown explanation.
6. Owner route and fallback source.
7. Amendment history.
8. Nudge/reply/re-check history.
9. One recommended next safe action plus valid alternatives.

Action visibility is server-derived, not guessed by the browser:

| Action | Valid when | Block or downgrade when |
| --- | --- | --- |
| Send nudge | Open variance and a resolvable route or PI queue fallback | Jira/Teams evidence required for the message is unavailable |
| Pull fresh evidence | Promise has Jira links or a targeted lookup can run | Attach to an active refresh instead of creating another |
| Approve match | Proposed/partial match has reviewable evidence | Evidence is stale beyond policy or version changed |
| Amend contract | Baseline exists and user has amendment permission | No fresh approval proof, closed authorization, or stale version |
| Assign owner | Route is unresolved or explicitly being changed | Candidate is inactive or user lacks registry permission |
| Accept risk | Variance is understood and user has risk authority | No baseline, insufficient scope context, or stale version |

The backend returns `allowedActions[]` with reasons, required freshness, permissions, and current version. This prevents UI drift from policy.

### Accessible proof preview

Keep a short hover preview for pointer users. For keyboard focus or a request to copy/interact, use a non-modal popover/dialog rather than a tooltip. It remains open while focused, supports text selection, closes on Escape and outside click, and returns focus predictably. Clicking opens the full drawer. Jira keys, owners, references, and evidence must exist as real DOM text, not only a `title` attribute or disappearing CSS content.

Rationale: W3C guidance requires hover/focus content to be dismissible, hoverable, and persistent; interactive tooltip content should use a non-modal dialog pattern.

## Domain model

The minimum durable model is:

```text
pi_contract
  id, organization_id, quarter_id, status, approved_at, approved_by,
  source_type, source_ref, source_hash, version

pi_promise
  id, contract_id, original_text, business_outcome, squad_id,
  target_date, readiness_state, committed_with_risk, version

promise_evidence_link
  id, promise_id, jira_issue_id, jira_issue_key_at_link,
  link_state, match_rule, match_confidence, approved_by, valid_from, valid_to

contract_amendment
  id, contract_id, promise_id, type, reason, approval_proof_ref,
  requested_by, approved_by, approved_at, prior_version, status

governance_case
  id, promise_id, state, owner_route, verdict, answer_version, version

governance_action_event
  id, case_id, type, actor, channel, delivera_ref, payload,
  external_id, expected_version, created_at

jira_issue_state
  jira_issue_id, issue_key, normalized_relevant_state, relevant_hash,
  jira_updated_at, observed_at, deleted_at, version

governance_answer_snapshot
  portfolio_id, quarter_id, payload, verified_at, evidence_observed_at,
  complete_squad_count, expected_squad_count, version
```

All audit records use stable user IDs and also retain the display name at event time. Store Jira's immutable issue ID as the foreign identity; retain the key as a display/history attribute because keys can change.

## Deterministic governance rules

### Promise Match

AI never assigns the state. It may paraphrase the already-computed result after claim verification.

States:

- **Matched:** approved evidence links cover the promise outcome and active work has not invalidated the link.
- **Partly matched:** evidence covers only a defined subset, or a split/replacement is awaiting approval.
- **No Jira proof:** the contract promise exists but no valid Jira evidence link exists.
- **Done but not accepted:** linked Jira work is Done/resolved but required acceptance evidence is absent.
- **Cannot verify:** source/evidence access, classification, or portfolio completeness is insufficient.
- **Aligned, amended:** an approved amendment makes the effective contract align with current evidence.

Avoid a standalone **Breached** Promise Match state unless it has a precise rule and remedy. “Needs attention” is a portfolio presentation; the promise should retain the specific actionable reason. Otherwise “breach” becomes a moral label that duplicates No Jira proof, Partly matched, stale proof, and missed target.

### Proof Age

Use the organization business calendar from Settings. A qualifying movement is a governance-relevant change: status transition, acceptance indicator, resolution, material evidence-link change, or approved worklog increase if worklogs are the chosen method. Do not treat comments, watchers, cosmetic edits, or any update timestamp as delivery movement.

- Fresh: 0–5 business days since qualifying movement.
- Aging: 6–10 business days.
- Stale: more than 10 business days while incomplete.
- Expired: more than 30 business days, evidence from a closed period, or deleted Jira evidence.
- Done without acceptance: separate explicit condition, regardless of movement recency.

The display explains the fact and suggested question, for example: “This work has not moved in 12 business days. Ask the owner whether it is blocked or already done.”

### Work Split

Promise Match starts from the contract; Work Split starts from all observed squad activity in the quarter.

Classify each item into `PI promise`, `approved amendment`, `support obligation`, `unplanned`, or `unknown`. Roll child issues to a canonical epic/parent cluster where possible. The largest unmapped cluster is based on the same denominator used for the percentage.

Method selection is deterministic per squad and period:

1. Use logged effort only if the configured reliability threshold is met (recommended initial threshold: at least 80% of active items have credible worklogs and the squad's logging policy is enabled).
2. Otherwise use ticket count.
3. Do not use story points as the fallback and do not mix effort and count in one percentage.
4. Show `method`, `coverage`, and `unknown share` beside the result.

The 80% threshold is a starting policy, not a universal truth; make it configurable and test it with real squad data before locking it.

### Trade-off Guardrail

Express impact only as a percentage of the quarter using the same trusted denominator chosen for that squad. If there is no stable denominator, say Cannot verify instead of manufacturing a percentage.

New work creates a decision case with four paths: move something out, classify approved support work, amend the contract, or accept PI risk. Approval creates an amendment/risk event; it never silently edits historical scope.

### Ready to Promise

Readiness is advisory, not a planning gate. Required fields are owner, outcome, Jira evidence plan/link, acceptance evidence definition, quarter link, and dependencies. A user with authority may “Commit anyway with risk flag.” The original promise records every missing field and the approval of that exception. Follow-up cases chase the planning debt without later presenting it as a squad delivery failure.

## Owner resolution

Resolve at send time and retain the route used:

1. active explicit owner or Jira assignee;
2. squad Product Owner from the Settings organization registry/profile;
3. squad/stream lead;
4. PI Team assignment queue.

Never select an inactive Jira identity. The preview says, for example: “No epic owner found. Nudge will escalate to Squad PO: Amina N. Send anyway.” If the final fallback is the PI queue, sending creates an assignment case rather than pretending an external recipient exists.

The current squad-role resolver covers Jira and profile Product Owner/Scrum Master values. Extend it with active-status validation, stream lead, PI queue, and a returned `resolutionPath[]`; do not create a second owner table in Governance.

## Active nudge and reaction loop

### Send path

1. Client posts the case ID, chosen channel, content, and visible `expectedVersion`/`If-Match`.
2. In one transaction, the server validates permission, freshness, allowed action, and version; allocates a Delivera reference; appends a `nudge_queued` action event; and inserts an outbox row.
3. Return `202 Accepted` with the case/action ID and queued state. Do not show “sent” yet.
4. A dispatcher posts to Jira or Teams with an idempotency key and records the external comment/message ID.
5. On success append `nudge_sent`; on retryable failure retain `send_retrying`; on terminal failure append `send_failed` with a safe retry action.

The existing Jira comment audit/undo UI can project these action events into Settings activity. The current Jira comment service also needs a small correctness fix before reuse: it references `roster` without accepting it in its function signature, while the API caller passes `{ roster }` as a third argument.

### Reaction harvesting

- Jira webhook ingestion deduplicates on `X-Atlassian-Webhook-Identifier` and records retries.
- `comment_created`/`comment_updated` events search a bounded reference index and external comment relationship; issue updates route by Jira issue ID to open cases.
- Teams uses Graph change notifications for the exact channel/message scope where possible and renews subscriptions/lifecycle notifications before expiry.
- A later relevant Jira change after the send creates `evidence_changed_after_nudge`, even if no human comment exists.
- A human reply creates `owner_replied` with author, timestamp, safe excerpt, channel, and external link.
- Either event moves `Awaiting owner` to `Ready to re-check`; it does not automatically change the governance verdict.
- Re-check runs deterministic rules and creates `recheck_completed`, then closes or reopens the case based on the result.

This avoids claiming that any Jira change is an owner reply while still recognizing action taken without a comment.

## Incremental engine and queue control

### Canonical relevant-state hash

Normalize and hash only governance-relevant fields:

- status/status category;
- assignee/explicit owner account ID and active state;
- sprint IDs and active-sprint membership;
- parent/epic immutable ID;
- normalized summary and description;
- sorted labels and components;
- worklog total plus last qualifying worklog timestamp;
- resolution and acceptance indicator;
- deletion tombstone.

Include a `hashSchemaVersion`. Ignore field order, Jira rendering metadata, expanded names, and other cosmetic noise. Persist the incoming Jira `updated` timestamp and ignore an older out-of-order state unless it is a deletion/recovery event handled by explicit precedence.

If the relevant hash is unchanged, acknowledge the event and skip Promise Match, Proof Age, Work Split, Trade-off, rollover, and snapshot recomputation. If changed, use reverse indexes from Jira issue ID to promises, squad, quarter, and open cases to invalidate only affected projections.

### Coalescing and single flight

Use two related mechanisms:

- **Webhook burst coalescing:** ingest quickly, deduplicate webhook IDs, update a Redis dirty set keyed by organization/squad/issue, and extend a short quiet-window deadline (recommended start: 3–5 seconds, maximum latency cap 15 seconds). One job consumes the merged dirty set.
- **Refresh single flight:** acquire `refresh:{org}:{quarter}:{scope}` with a unique token and TTL. The first request creates a job; concurrent requests receive/subscribe to that same job ID. Release only with token comparison. Return the current materialized snapshot while the job runs.

Use Redis Streams/consumer groups for acknowledged worker delivery and pending-job recovery. A lock alone is not a queue and must not be the only record that work exists. Jobs and their final outcomes remain durable.

Recompute order for an affected scope:

1. normalize and persist Jira state;
2. recompute affected evidence links and Promise Match;
3. recompute Proof Age and Work Split only for affected promise/squad/quarter;
4. update cases and allowed actions;
5. atomically publish the new materialized answer version;
6. notify attached clients by SSE where available, with polling as the simple fallback.

## Optimistic concurrency

Every read model includes `version` and an HTTP `ETag`. All decision endpoints require `If-Match` (a body `expectedVersion` may be retained temporarily for older clients). The transaction performs an update equivalent to:

```sql
UPDATE governance_case
SET ..., version = version + 1
WHERE id = $case_id AND version = $expected_version;
```

Zero updated rows returns `412 Precondition Failed` with:

```json
{
  "code": "GOVERNANCE_VERSION_CONFLICT",
  "message": "This item was updated by another PI Team user 10 seconds ago. Reload latest state before deciding.",
  "latestVersion": 18,
  "changedAt": "2026-07-17T07:32:10Z",
  "changedBy": "user-id"
}
```

The UI preserves the user's draft, disables submission, and offers **Reload latest state** plus **Copy my draft**. Do not silently retry a human decision against a new version. This is standard HTTP conditional-request behavior for preventing lost updates.

## Honest degradation

| Condition | Required behavior |
| --- | --- |
| No approved baseline | Show baseline recovery; suppress off-plan, breach, Work Split-to-contract, and Trade-off conclusions |
| Temporary recovery | Reconstruct from a known Day 1 cutoff and label source/confidence; never use today's shifted board as if it were approved history |
| Jira unavailable | Serve last verified answer; mark evidence observation age; pause match approval, amendment evidence confirmation, and sends that depend on fresh facts |
| Some squads unavailable | “3 of 4 squads verified. Portfolio conclusion limited.” Do not display a definitive all-squads count |
| Refresh already running | Return/attach to the active job and existing snapshot |
| User mid-decision | Do not reorder or replace drawer state; announce that a newer version is available |
| Stale response after scope change | Drop it using request sequence + scope key + answer version |
| Teams unavailable | Offer Jira or PI queue route if policy permits; retain queued/failed state accurately |
| Owner unresolved | Route to PI Team assignment queue; do not block the rest of the portfolio loop |

## API shape

Prefer a small purpose-built surface over extending the heavyweight brief response:

```text
GET  /api/governance/answer?scope=all&quarter=FY27-Q2
GET  /api/governance/promises/:promiseId
POST /api/governance/refreshes                 -> 202 job or existing job
GET  /api/governance/refreshes/:jobId
POST /api/governance/cases/:caseId/nudges      If-Match required
POST /api/governance/cases/:caseId/recheck     If-Match required
POST /api/governance/cases/:caseId/decisions   If-Match required
POST /api/governance/contracts/:id/amendments  If-Match required
POST /api/governance/promises/:id/links/approve If-Match required
POST /api/integrations/jira/webhooks
POST /api/integrations/teams/notifications
```

The existing `/api/governance-brief.json` can adapt from the new materialized answer during migration. Do not make both endpoints independent truth builders.

## Delivery plan

### Phase 0 — lock semantics and telemetry

- Define the promise, contract, amendment, case, action, and relevant-hash schemas.
- Add current timing and duplicate-refresh telemetry before changing behavior.
- Fix the Jira comment service's `roster` signature mismatch.
- Freeze creation of new duplicate Governance surfaces.

Exit: agreed state machine, migrations rehearsed, existing baseline data exportable.

### Phase 1 — contract truth and all-squads fast path

- Introduce immutable promise IDs and source preservation.
- Migrate saved baselines; retain issue keys as initial evidence links.
- Build the all-squads materialized answer and minimal browser snapshot.
- Default Governance to All Squads and replace the above-fold composition.
- Add partial-scope and no-baseline degradation.

Exit: the acceptance sentence is visible within two seconds from verified cache and contains no unverified portfolio claim.

### Phase 2 — proof drawer and version-safe decisions

- Consolidate proof/action content into the existing drawer.
- Return server-derived allowed actions.
- Add ETags/`If-Match` to every decision.
- Implement amendments and **Aligned, amended** projection.
- Add the owner cascade using the Settings resolver/registry.

Exit: two users cannot silently overwrite one another; the original contract remains visible after amendment.

### Phase 3 — active feedback loop

- Create governance cases/action events and transactional outbox.
- Add Delivera references and Jira comment properties where permitted.
- Harvest Jira comments and relevant issue updates.
- Add Teams only after the Jira loop is operational; use message IDs and Graph change notifications rather than text-only correlation.
- Project the shared action history into Governance and Settings activity.

Exit: queued, sent, replied/changed, ready-to-recheck, rechecked, and failed states are observable and recover after restart.

### Phase 4 — incremental scale and hardening

- Add relevant-state hashes, reverse indexes, webhook dedupe, burst coalescing, and single-flight refresh.
- Move active JSONL state to the transactional store; keep JSONL export if useful.
- Load-test 90 concurrent readers, bulk Jira updates, webhook retries, and simultaneous refresh clicks.
- Add accessible persistent previews and complete keyboard tests.

Exit: unchanged Jira events cause zero governance recomputations; concurrent refreshes create one active scan per scope.

## Acceptance and release gates

### Product gates

- Governance always opens on authorized All Squads unless explicitly deep-linked.
- Warm local answer appears under 500 ms p95; server cached answer under 2 seconds p95.
- First viewport has exactly one answer, one source line, one “Delivera already did” line, one decision CTA, and one squad strip.
- Every verdict traces to contract version, deterministic rule, evidence observation time, and answer verification time.
- AI removal does not change any state, percentage, allowed action, or decision.

### Contract and amendment gates

- Jira rename, key change, deletion, move, and split never modify original promise text/source.
- A deleted link yields preserved promise plus changed/deleted Jira evidence.
- Amendment approval retains original promise, reason, approver, date, and replacement chain.
- Concurrent amendment/decision returns 412 and preserves both users' drafts/audit records.

### Loop gates

- A nudge has one Delivera reference and one idempotent action record.
- UI distinguishes queued, retrying, sent, replied, evidence-changed, failed, and ready-to-recheck.
- Jira webhook retries do not duplicate reactions or recomputation.
- A response/update cannot silently resolve a promise; it only triggers re-check.
- Owner fallback is visible and every path ends in a person or the PI assignment queue.

### Scale gates

- 10 simultaneous targeted refresh requests yield one Jira sync job and one shared result.
- 90 page loads cause zero live portfolio Jira scans when a valid materialized answer exists.
- A bulk edit burst is coalesced within the configured quiet/max window.
- An unchanged relevant hash skips all downstream governance calculators.
- Out-of-order Jira events do not roll state backward.
- Worker restart recovers pending sends and unacknowledged recompute jobs.

### Accessibility and stability gates

- Hover/focus preview is dismissible, hoverable, persistent, selectable, and Escape-closeable.
- Full drawer is keyboard operable and focus returns to its trigger.
- Mid-decision updates do not reorder the page or discard entered text.
- Scope changes invalidate late responses.
- Local snapshots are permission-scoped, minimal, schema-versioned, and cleared on logout/identity change.

## Success measures

Measure loop outcomes rather than dashboard engagement:

- time to first verified answer;
- time from variance detected to first safe action;
- percentage of nudges that receive a reply or qualifying Jira change;
- time from reaction to re-check;
- percentage of variances resolved by evidence, amendment, owner assignment, or explicit risk acceptance;
- duplicate refresh jobs prevented;
- governance recomputations skipped by unchanged hashes;
- stale-decision conflicts caught;
- Unknown/unverifiable rate by squad and reason;
- percentage of claims produced without AI dependency (target 100% for state and numbers).

Do not rank squads by these metrics. Use them to improve governance data and loop efficiency.

## Research basis

- Atlassian documents that Jira webhooks may be delivered more than once, expose a stable webhook identifier across retries, and include a changelog for issue-updated events. This supports ingestion dedupe plus state diffing rather than one recomputation per delivery: <https://developer.atlassian.com/cloud/jira/software/webhooks/>
- Jira comment properties can store bounded custom JSON on a comment, providing a structural place for a Delivera reference in addition to visible text: <https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comment-properties/>
- Microsoft Graph supports change notifications for Teams channel/chat messages and replies; long-lived subscriptions require lifecycle handling. This supports thread-ID correlation and explicit subscription renewal: <https://learn.microsoft.com/en-us/graph/teams-changenotifications-chatmessage>
- Microsoft documents Teams channel replies as real child messages of a parent message, which is preferable to text-only reply inference: <https://learn.microsoft.com/en-us/graph/api/chatmessage-post-replies?view=graph-rest-1.0>
- HTTP `If-Match` exists to prevent lost updates and a failed precondition returns 412: <https://www.rfc-editor.org/rfc/rfc9110>
- Redis Streams provide append-only events, consumer groups, acknowledgements, and pending-message recovery; Redis locks require unique tokens and expiry. Together they fit worker delivery plus single-flight coordination, but neither replaces durable domain state: <https://redis.io/docs/latest/develop/data-types/streams/> and <https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/>
- WCAG guidance requires hover/focus content to be dismissible, hoverable, and persistent; WAI-ARIA guidance says focusable content belongs in a non-modal dialog rather than a tooltip: <https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus> and <https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/>

## Final product test

Within five seconds, a PI Team user must be able to say:

> The PI Team checked all authorized squads. DMS and RPA need attention. This is compared with the saved FY27 Q2 PI contract. Delivera matched immutable promises to current Jira evidence, identified weak or old proof, exposed unplanned work only where the method was trustworthy, prepared the safest owner route, and has one version-protected decision ready.

Without leaving Governance, that user can open the promise, understand the source and deterministic rule, send or queue a correlated nudge, see a reply or qualifying Jira change, pull a single shared refresh, approve a match, amend the contract without rewriting it, assign ownership, or accept risk—with every transition recoverable and auditable.
