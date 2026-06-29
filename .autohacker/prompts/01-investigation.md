# Phase 1 — Full end-to-end investigation (Loop {{LOOP_INDEX}})

Read FIRST: {{EVIDENCE_DIGEST}}, {{BRAIN_FILE}}, {{EVIDENCE_BUNDLE}}, {{EXPLORATION_JSON}}, {{HIDDEN_VALUE_JSON}}, {{VOID_JSON}}, {{STATE_MATRIX_JSON}}.

**Hard requirement:** Use Playwright MCP on **desktop ({{DESKTOP_VIEWPORT}})** and **mobile ({{MOBILE_VIEWPORT}})** at {{TARGET_URL}} and {{JOURNEY_URL_2}}.
If MCP unavailable, write `MCP_BLOCKED` to **{{INVEST_LOG}}** and STOP.

## Evidence metrics (must address)
- leftWhitespaceRatio={{LEFT_WHITESPACE_RATIO}} (target ≤ {{MAX_LEFT_WHITESPACE}})
- hiddenValueCount={{HIDDEN_VALUE_COUNT}}
- duplicateCount={{DUPLICATE_COUNT}}
- brokenClicks={{BROKEN_CLICK_COUNT}}
- Screenshot: {{SCREENSHOT_FOLD_PATH}}

## Mission
- Record every feature and click that fails silently or needs extra steps (Open sprint, Open evidence, collapsed details, setup gaps).
- Read console logs; list errors/warnings with repro.
- **Positive AND negative tests** (empty scope, rapid double-click, escape, scroll-while-drawer, mobile overflow).
- Challenge presentation **speed** and **visual dead space** — cite foldDeadBandPx, maxVoidPx, hiddenValueCount.
- Identify **20+ concrete** click/scroll/journey reductions without removing real user control.
- Map each finding to source files (HTML, render controllers, `09-governance.css`) with evidence citations.
- Align every item to: {{CORE_VALUES}}.

Output detailed brief to **{{INVEST_LOG}}**:
Executive summary | Broken interactions | Console issues | Intra-card voids | Hidden-value clicks | Whitespace/layering | Duplicate content | 20+ reductions | Negative tests | File touch list.

Do NOT modify application code or AutoHacker.ps1 yet.

{{PATCH_TEXT}}
