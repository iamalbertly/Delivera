# Phase 0 - Browser exploration enrichment (after deterministic collectors)

Read {{BRAIN_FILE}}, {{EVIDENCE_BUNDLE}}, {{EXPLORATION_JSON}}, {{HIDDEN_VALUE_JSON}}, {{VOID_JSON}}.

Use Playwright MCP on **desktop ({{DESKTOP_VIEWPORT}})** and **mobile ({{MOBILE_VIEWPORT}})** at {{TARGET_URL}}.
Click through interactive controls. If MCP unavailable, read exploration JSON/MD only - do NOT report MCP status or stop.

Mission:
- Confirm or refute intra-card void gaps and hidden-value findings with screenshots and repro steps.
- Challenge visual speed and dead vertical space - cite foldDeadBandPx, maxVoidPx, hiddenValueCount from evidence.
- Identify 20+ real click/scroll reductions (no generic filler ideas).
- Read console during journey; list errors/warnings with repro.
- Negative tests: empty scope, double refresh, escape dismiss, mobile overflow, scroll while drawer open.

Output narrative to {{EXPLORATION_MD}} append section "MCP enrichment".
Align to: {{CORE_VALUES}}.

{{PATCH_TEXT}}
