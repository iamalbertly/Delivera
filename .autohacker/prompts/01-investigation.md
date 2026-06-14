# Phase 1 - Investigation (full end-to-end improvement brief)

Read {{BRAIN_FILE}}, {{EVIDENCE_BUNDLE}}, {{EXPLORATION_JSON}}, {{HIDDEN_VALUE_JSON}}, {{VOID_JSON}}.

Use Playwright MCP on full **desktop ({{DESKTOP_VIEWPORT}})** and **mobile ({{MOBILE_VIEWPORT}})** to click through all interactive controls on {{TARGET_URL}}. If MCP is unavailable, use exploration and hidden-value JSON - proceed without reporting MCP status.

Mission (Loop {{LOOP_INDEX}}):
- Record every feature and mouse-click that fails silently or needs extra steps to unlock value (Open sprint, Open evidence, hidden tile details, setup gaps).
- Read console logs during the journey; list errors/warnings with repro steps.
- Run **positive AND negative tests** (empty scope, rapid double-click, escape dismiss, scroll-while-drawer-open, mobile overflow).
- Challenge presentation **speed** and **visual dead space** - cite foldDeadBandPx, maxVoidPx, hiddenValueCount; fix layout/CSS/structure not redundant JS listeners.
- Identify **20+ concrete ways** to reduce clicks, scroll depth, and journey steps without removing real user control.
- Map each finding to source files (HTML, render controllers, CSS) with evidence citations.
- Align every item to core values: {{CORE_VALUES}}.

Output: Write detailed end-to-end improvement brief to **{{INVEST_LOG}}** with:
Executive summary | Broken interactions | Console issues | Intra-card voids | Hidden-value clicks | Click/scroll waste | 20+ reductions | Negative test findings | File touch list.

Do NOT modify AutoHacker.ps1 or application code yet.

{{PATCH_TEXT}}
