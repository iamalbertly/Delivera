# Active PI Governance implementation record

This record connects the implemented behavior to the product values **Customer**, **Realism & Simplicity**, and **Speed & Trust**. It complements the researched architecture in `delivera-active-pi-governance-plan.md` and is the release checklist for the running product.

## Prioritized improvements delivered

1. **All Squads is the default** — Governance answers the portfolio question before asking for scope configuration; explicit deep links still win.
2. **Verified cache paints first** — a minimal versioned local projection paints without Jira, AI, proof tables, or portfolio recomputation.
3. **One contract-variance hero** — the first viewport gives one answer, source line, completed-work line, decision CTA, and compact squad strip.
4. **Immutable promise identity** — IDs derive from contract identity rather than a mutable Jira key or display text.
5. **Original contract facts are preserved** — original wording, source, quarter, approval, readiness gaps, and accepted planning risk survive Jira change.
6. **Plain deterministic match states** — Matched, Partly matched, No Jira proof, Done but not accepted, Cannot verify, and Aligned amended are computed facts; AI does not decide them.
7. **Append-only amendments** — approved descope, move, split, replacement, and support obligations are recorded above the original promise.
8. **Optimistic decision locking** — every action carries the version the PI user saw and stale actions fail with HTTP 412 instead of overwriting.
9. **Proof drawer is the action surface** — source, Jira evidence, freshness, Work Split, owner path, readiness, trade-off, and history live beside valid actions.
10. **Action eligibility is fail-closed** — actions appear only when baseline, version, evidence freshness, link state, and route safety permit them.
11. **Owner escalation keeps work moving** — active issue owner → Squad PO → stream lead → PI Team assignment queue, with the actual route stated before send.
12. **Correlated nudges are queued honestly** — every nudge gets a visible `DLV-...` reference; UI reports queued/awaiting/re-check states and never equates queueing with delivery.
13. **Replies become evidence** — Jira comments and Teams notifications containing a Delivera reference are correlated into the same case history.
14. **Relevant-state hashing** — summary, status, assignee, sprint, epic link, description, labels, components, worklog, resolution, deletion, and acceptance drive invalidation; ordering noise does not.
15. **Burst coalescing** — repeated webhook activity for the same issue is merged into one quiet-period recomputation.
16. **Refresh single flight** — concurrent users join one leased refresh job rather than multiplying Jira scans.
17. **Work Split chooses one honest unit** — reliable worklogs use effort; weak worklogs use ticket count; unclassifiable work is Unknown; percentages use largest-remainder rounding.
18. **Rule-based Proof Age** — 5/10/30-business-day boundaries, closed periods, deleted work, and missing acceptance are explicit and testable.
19. **Percentage-only trade-offs** — scope change is expressed as quarter impact and routes to move-out, support, amendment, or accepted risk.
20. **Ready to Promise is advisory** — missing planning facts are shown with fix-or-commit-with-risk choices, and accepted gaps remain in the baseline.
21. **Honest partial and outage states** — no baseline suppresses off-plan claims; partial verification limits the conclusion; stale Jira pauses freshness-dependent actions.
22. **Race-safe UI** — late responses from an old scope are ignored; open decisions are not silently reordered; a conflict preserves user context.
23. **Accessible persistent previews** — focus opens readable/selectable proof, Escape closes it, outside click dismisses it, and click opens the full drawer without navigation.
24. **Purposeful motion and dimensionality** — spatial layering identifies preview/drawer context while reduced-motion, visible focus, contrast, 44px targets, and responsive Bento layout preserve access.
25. **Journey-value automated validation** — the priority-zero suite asserts outcomes and state transitions while capturing console/page errors, avoiding brittle copy or layout snapshots.
26. **Compatibility isolation** — existing Brief tests mock the new projection explicitly, preventing live Jira state from creating false positives or false negatives.

## Decision rationale and realistic edge cases

| Solution | Why this is the best fit | Four or more near-path edge cases handled |
|---|---|---|
| Immutable contract + amendments | Event history protects trust without treating approved change as team failure. | Jira epic renamed; epic deleted; one epic split; quarter move; approved urgent replacement; support reclassification. |
| Cache-first all-squad answer | The PI meeting needs the last trustworthy answer now, not a spinner for a fresher but incomplete answer. | Empty first visit; corrupt cache; stale cache; slow refresh; partial portfolio; scope changes during refresh. |
| Deterministic Promise Match | Sponsor wording may vary, but governance state must be reproducible and auditable. | Missing link; weak semantic evidence; Jira Done without acceptance; deleted link; amended promise; unavailable Jira. |
| Proof drawer + contextual actions | Progressive disclosure keeps the hero calm and puts evidence exactly where a decision happens. | No owner; stale evidence; already-actioned item; no baseline; send in flight; action invalidated while drawer is open. |
| Owner cascade | Missing directory data should be visible but should not freeze a legitimate intervention. | Inactive assignee; explicit owner absent; PO absent; lead absent; duplicate directory entries; PI queue fallback. |
| Correlated feedback loop | A reference makes outbound asks and inbound reactions observable without inventing another chat system. | Duplicate webhook; reply without reference; late reply after amendment; Jira edit instead of reply; retry after send failure; Teams/Jira duplicate reaction. |
| State diff + coalescing | Governance compute should scale with meaningful change, not Jira event volume or active users. | Label ordering only; identical retry; rapid bulk edit; delete event; acceptance added; worklog-only change; worker restart. |
| Single-flight refresh | The backend owns synchronization; clients consume governed state. | Ten simultaneous requests; lease expiry; leader failure; subscriber disconnect; different squad keys; result already cached. |
| Optimistic versioning | A visible decision must apply to the facts the person actually reviewed. | Two approvers; reply arrives mid-decision; refresh completes mid-form; stale browser tab; duplicate submit; retry after network loss. |
| Proof Age | Business-day rules are explainable and avoid opaque AI freshness judgments. | Weekend boundary; exactly day 5/10/30; completed but unaccepted; closed quarter; deleted issue; missing movement timestamp. |
| Work Split | One defensible unit plus Unknown is more credible than mixed or invented precision. | Sparse worklogs; unpointed support; zero denominator; rounding to 99/101; largest unmapped cluster tie; unsafe classification. |
| Honest degradation | Trust compounds when the product says exactly what it could and could not verify. | No baseline; Day 1 recovery unavailable; Jira down; 3/4 squads verified; stale response; owner route unresolved; freshness-required action. |

## Minimalist UI trends used with purpose

- Accessibility-first architecture: semantic controls, focus persistence, Escape/outside dismissal, reduced motion, contrast, touch sizing.
- Graceful state degradation: cached, stale, partial, no-baseline, conflicted, queued, and unavailable states use explicit language and safe action rules.
- Bento Grids 2.0: compact squad cells scan as one portfolio instrument and collapse cleanly on narrow screens.
- Spatial UI and dimensionality: preview and drawer elevation communicate context without extra navigation.
- Purposeful motion: subtle state changes support orientation; motion is never required to understand status.
- Progressive disclosure: summary first, preview second, full evidence/action drawer third.
- Content-led minimalism: one answer and one decision dominate; safe squads remain visible but quiet.
- Adaptive action design: the interface shows the next safe action, not a fixed toolbar of unavailable controls.
- Calm gamification: loop completion is represented as governance coverage and resolved interventions, not vanity points, streak pressure, or public team shaming.

## Four bonus journey ideas retained for the next safe increment

1. **Decision rehearsal mode** — let a PI lead preview the exact amendment/risk effect before committing, using the same deterministic projection with no write.
2. **Governance hand-off receipt** — create a short copyable meeting receipt listing verified squads, open asks, joined refresh job, and decision references.
3. **Recovery coach** — when a baseline is absent, show whether a Day 1 reconstruction is possible and the evidence confidence before the user accepts it.
4. **Quiet resolution digest** — group replies and newly verifiable proof into one “ready to re-check” digest, avoiding notification fatigue while closing loops faster.
5. **Amendment pattern insight** — privately identify recurring amendment causes (support load, dependency, urgent work) without ranking or blaming squads.

## Validation contract

The automatic entry point is `npm run test:journey:governance-active-loop`. The journey is registered at priority zero in the existing journey bucket map. Its Playwright spec fails on browser exceptions, console errors, invalid deterministic states, unsafe actions, duplicated refresh behavior, inaccessible proof interaction, stale writes, mobile target regressions, and false delivery claims. Assertions focus on user value and state semantics rather than pixel snapshots or incidental copy.
