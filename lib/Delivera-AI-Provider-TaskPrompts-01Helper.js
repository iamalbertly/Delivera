/**
 * SSOT: System/user prompts and response parsing per AI task type.
 */
import { AI_TASK_TYPES } from './Delivera-AI-Task-Contracts-01SSOT.js';

export function buildSystemPromptForTask(taskContract = {}) {
  const taskType = taskContract.taskType;
  if (taskType === AI_TASK_TYPES.PI_SLIDE_VISION) {
    return SLIDE_VISION_SYSTEM_PROMPT;
  }
  const schema = JSON.stringify(taskContract.outputSchema || {}, null, 2);

  const base = `You are a Delivera governance advisor. You refine wording and classification only.
You must NOT invent counts, owners, dates, issue status, PI confidence, or Jira actions.
Merge repeated or overlapping recommendations before output. Prefer one important, evidence-backed action over several similar actions.
Output ONLY valid JSON matching this schema (no markdown fences):
${schema}`;

  switch (taskType) {
    case AI_TASK_TYPES.GOVERNANCE_NARRATION:
      return `${base}\nUse ONLY facts from the contract. Reference issue keys only if present in input.`;
    case AI_TASK_TYPES.PI_BASELINE_CLASSIFY:
      return `${base}\nClassify each epic as pi-commitment | ad-hoc | support | unclear. Do not confirm baseline.`;
    case AI_TASK_TYPES.PI_SLIDE_VISION:
      return base;
    case AI_TASK_TYPES.EPIC_HYGIENE_SUGGEST:
      return `${base}\nSuggest FY27 Q1 - Program - System - Product Goal style titles. Return at most one suggestion per issueKey. Do not auto-rename.`;
    case AI_TASK_TYPES.FEEDBACK_TRIAGE:
      return `${base}\nPropose improvements only. Do not change thresholds automatically.`;
    case AI_TASK_TYPES.SIMPLE_MODE_COPY:
      return `${base}\nProvide simple English and Swahili labels for non-native English speakers.`;
    case AI_TASK_TYPES.ACTION_PLAN:
      return `${base}\nGroup duplicate actions by owner and shared issue keys. Return the fewest actions that would materially improve the brief. All Jira writes require human approval.`;
    case AI_TASK_TYPES.RISK_EXPLANATION:
      return `${base}\nExplain one risk in plain language using evidence only.`;
    case AI_TASK_TYPES.TRANSLATION_HELPER:
      return `${base}\nTranslate short UI labels to simple English and Swahili.`;
    default:
      return base;
  }
}

export function buildUserPromptForTask(taskContract = {}, payload = {}) {
  if (payload.userText) return String(payload.userText);
  const { imageBase64, mimeType, systemPrompt, ...textSafe } = payload;
  return `Task: ${taskContract.taskType}\n\nInput:\n${JSON.stringify(textSafe, null, 2)}`;
}

export function parseTaskResponse(rawText, taskContract = {}) {
  let json;
  try {
    const cleaned = String(rawText || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    json = JSON.parse(cleaned);
  } catch (_) {
    throw new Error(`AI returned non-JSON for ${taskContract.taskType}`);
  }
  return json;
}

/** PI slide vision system prompt (shared with baseline agent). */
export const SLIDE_VISION_SYSTEM_PROMPT = `You extract PI planning commitments from a quarterly squad slide image.
Detect layout first:
1) "roadmap" — month columns (July/August/September…) × themes (Growth/Simplicity) with capability bullets.
2) "ambition-table" — table with Modules + Delivery Plan (e.g. "Q2 | TowerCo", Contract Management / ITP / Billing rows). ONE EPIC PER DELIVERY PLAN BULLET, not per module row.

Output ONLY valid JSON:
{
  "layout": "roadmap" | "ambition-table",
  "squad": "short squad code e.g. DMS or FIN",
  "squadNickname": "optional e.g. Tycoons",
  "program": "optional e.g. TowerCo (ambition-table header product/program)",
  "quarter": "e.g. FY27 Q2",
  "commitments": [
    {
      "month": "July",
      "theme": "Growth",
      "module": "",
      "deliveryItem": "",
      "deliveryPlan": [],
      "ragStatus": "",
      "bullet": "NBA integration with CVM for Channel",
      "suggestedEpicTitle": "FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns"
    }
  ]
}
For ambition-table: either emit one commitment per delivery-plan line (preferred), OR emit module rows with deliveryPlan:["item1","item2",…] and ragStatus per item when shown (Delivered/In progress/Off track). Map Timeline column to month (first month if range). Ambition/HOW/KPIs are NOT commitments.
Naming rule for suggestedEpicTitle: FY## Q# – Program – System – Capability Name (use en-dash – between segments).
Use Program=DMS and System=NBA for DMS squad slides unless the slide explicitly names another system.
For FIN/TowerCo ambition-table: system=FIN, subsystem=TOWERCO (or program name), module=Modules column, capability=Delivery Plan bullet — five segments.
Extract EVERY visible roadmap item across ALL month columns (July, August, September, etc.) — do not stop at the first column.
Map drill-down sub-bullets as child scope under the parent capability epic where appropriate (one epic per major capability).
Do not invent commitments not visible on the slide.`;
