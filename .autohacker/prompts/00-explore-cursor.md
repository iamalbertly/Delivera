# Phase 0 — MCP browser exploration (MANDATORY)

Read FIRST: {{EVIDENCE_DIGEST}}, {{BRAIN_FILE}}, {{STATE_MATRIX_JSON}}, {{SCREENSHOT_FOLD_PATH}}.

**Hard requirement:** Use Playwright MCP on **desktop ({{DESKTOP_VIEWPORT}})** AND **mobile ({{MOBILE_VIEWPORT}})**.
If MCP tools are unavailable, write `MCP_BLOCKED` to {{EXPLORATION_MD}} and STOP — do not guess from JSON alone.

## Journey
1. {{TARGET_URL}}
2. {{JOURNEY_URL_2}}
3. Return to governance

## Evidence to confirm or refute (cite numbers)
- leftWhitespaceRatio={{LEFT_WHITESPACE_RATIO}} (max {{MAX_LEFT_WHITESPACE}})
- hiddenValueCount={{HIDDEN_VALUE_COUNT}} (max 8)
- duplicateCount={{DUPLICATE_COUNT}}
- brokenClicks={{BROKEN_CLICK_COUNT}}

## Mission
- Click every interactive control; read console each step.
- Take MCP screenshots at fold on desktop and mobile; compare to {{SCREENSHOT_FOLD_PATH}}.
- Challenge visual speed and dead vertical space (foldDeadBandPx, maxVoidPx).
- Identify **20+ real** click/scroll reductions (no filler).
- **Negative tests:** empty scope, double-click, escape dismiss, scroll-while-drawer-open, mobile overflow.

Append section `## MCP enrichment` to **{{EXPLORATION_MD}}** with repro steps, console errors, screenshot notes, and ranked reductions.

Align to: {{CORE_VALUES}}.

{{PATCH_TEXT}}
