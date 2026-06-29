# README + Codebase Audit For Simpler Agentic Mockups

## Source Of Truth Used

- `README.md`: primary surfaces, global chrome, Brief above-fold order, Settings hub contract.
- `routes/views.js`: actual route map and aliases.
- `public/governance.html`: Brief mounts and right rail.
- `public/current-sprint.html` and `public/Delivera-CurrentSprint-Decision-Cockpit.js`: Today/Sprint answer, next action, attention queue, work and flow.
- `public/report.html`: Proof filters, preview, tabs, Refresh/Export.
- `public/evidence.html` and `public/Delivera-EvidenceOS-Timeline-01UI.js`: Impact cockpit, Add context, Run agents, manager brief, commitments, evidence trail.
- `public/settings.html` and Settings panel modules: My workspace, Organization, Integrations, Jira activity.

## Audit Of The Earlier Mockups

- Too many visible controls: they looked like an admin dashboard and increased visual fatigue.
- Too much AI/agent branding: the best agentic experience should surface value, not mechanics.
- Too much Jira-like density: tables, chips, filters, and issue lists competed with the answer.
- Incorrect emphasis: governance should begin with the delivery answer, not system health panels.
- Incorrect route model: the real primary surfaces are Brief, Sprint, Proof, Impact, Settings. Legacy pages redirect into these.
- Missing connection clarity: the earlier mockups did not show how Brief leads into Sprint, Proof, Impact, and Settings through actual route intent.

## Revised Design Rule

The visible product should answer the README sentence:

> what to say, who to chase, and what proof to show

Agentic behavior is represented as quiet preparation, review states, provenance, and next links. It should not look like a separate AI console.

## Surface Value Questions

- Brief `/governance`: What should I say, who should I chase, and what proof should I show?
- Sprint `/current-sprint`: What must move today?
- Proof `/report`: What proof supports the current Brief?
- Impact `/impact`: What needs my attention, and what context is missing?
- Settings `/settings`: What can Delivera read, prepare, and remember?

## Connection Model Shown In Mockups

- Brief to Sprint: `Open today` for the owner/blocker follow-up.
- Brief to Proof: `Show proof` for evidence supporting the answer.
- Brief to Impact: `Add context` for missing human context Jira cannot infer.
- Sprint to Brief: `Back to Brief` for the prepared message.
- Sprint to Proof: proof receipt for today’s movement.
- Proof to Brief: evidence supports the answer.
- Proof to Impact: unresolved evidence gaps become context requests.
- Impact to Settings: connection/trust state controls what agents may prepare.
- Settings to all surfaces: workspace scope, simple mode, organization catalog, integrations, and Jira activity.
