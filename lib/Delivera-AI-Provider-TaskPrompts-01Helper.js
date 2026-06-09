/**
 * SSOT: System/user prompts and response parsing per AI task type.
 */
import { AI_TASK_TYPES } from './Delivera-AI-Task-Contracts-01SSOT.js';

export function buildSystemPromptForTask(taskContract = {}) {
  const taskType = taskContract.taskType;
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
  return `Task: ${taskContract.taskType}\n\nInput:\n${JSON.stringify(payload, null, 2)}`;
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
Output ONLY valid JSON:
{
  "squad": "short squad code",
  "quarter": "e.g. FY27 Q1",
  "commitments": [
    { "month": "April", "theme": "Growth", "bullet": "Territory daily report" }
  ]
}
Do not invent commitments not visible on the slide.`;
