/**
 * SSOT: AI task type enum and contract definitions for the orchestrator.
 * Every AI feature must declare a contract here — no ad-hoc provider calls.
 */
import { narrateBriefTemplate } from './Delivera-Governance-Brief-02Narrator-Template.js';
import { PI_ARTIFACT_TASK_CONTRACTS } from './Delivera-AI-PIArtifact-TaskContracts-01SSOT.js';

export const AI_TASK_TYPES = Object.freeze({
  GOVERNANCE_NARRATION: 'governance-narration',
  PI_BASELINE_CLASSIFY: 'pi-baseline-classify',
  EPIC_HYGIENE_SUGGEST: 'epic-hygiene-suggest',
  FEEDBACK_TRIAGE: 'feedback-triage',
  SIMPLE_MODE_COPY: 'simple-mode-copy',
  ACTION_PLAN: 'action-plan',
  RISK_EXPLANATION: 'risk-explanation',
  TRANSLATION_HELPER: 'translation-helper',
  PI_ARTIFACT_OCR: 'pi-artifact-ocr',
  PI_ARTIFACT_STRUCTURE_CLASSIFY: 'pi-artifact-structure-classify',
  PI_ARTIFACT_RECONCILE: 'pi-artifact-reconcile',
});

export const MODEL_POLICY = Object.freeze({
  [AI_TASK_TYPES.GOVERNANCE_NARRATION]: 'balanced reasoning, low temperature',
  [AI_TASK_TYPES.PI_BASELINE_CLASSIFY]: 'strong reasoning, structured output',
  [AI_TASK_TYPES.SIMPLE_MODE_COPY]: 'low cost, multilingual',
  [AI_TASK_TYPES.FEEDBACK_TRIAGE]: 'balanced reasoning',
  [AI_TASK_TYPES.EPIC_HYGIENE_SUGGEST]: 'balanced reasoning, structured output',
  [AI_TASK_TYPES.ACTION_PLAN]: 'balanced reasoning, structured output',
  [AI_TASK_TYPES.RISK_EXPLANATION]: 'balanced reasoning',
  [AI_TASK_TYPES.TRANSLATION_HELPER]: 'low cost, multilingual',
  [AI_TASK_TYPES.PI_ARTIFACT_OCR]: 'free OCR specialist, structured evidence',
  [AI_TASK_TYPES.PI_ARTIFACT_STRUCTURE_CLASSIFY]: 'free multimodal structure verifier',
  [AI_TASK_TYPES.PI_ARTIFACT_RECONCILE]: 'free evidence reconciliation',
});

const FORBIDDEN_FACT_FIELDS = Object.freeze([
  'description', 'comment', 'body', 'changelog', 'history', 'rawIssue',
]);

function governanceNarrationFallback(payload) {
  const contract = payload?.contract || payload?.factContract || {};
  const knowledge = payload?.knowledge || null;
  const template = narrateBriefTemplate(contract, knowledge);
  return {
    summary: template.headline || '',
    simpleSummary: template.meetingAnswer || template.oneParagraph || '',
    managerAnswer: template.meetingAnswer || '',
    piForumAnswer: template.whatToSay || '',
    protectMeAnswer: template.whatToSay || '',
    riskExplanation: template.oneParagraph || '',
    issueKeysUsed: (template.decisionsNeeded || []).map((d) => d.issueKey).filter(Boolean),
    confidence: 'review',
    _fallbackUsed: true,
  };
}

function piBaselineFallback(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  return {
    candidateItems: candidates.slice(0, 20).map((c) => ({
      issueKey: c.issueKey || '',
      title: c.title || c.summary || '',
      classification: 'unclear',
      reason: 'Deterministic classification — AI unavailable',
      suggestedStartDate: '',
      suggestedEndDate: '',
      confidence: Number(c.confidence) || 0.5,
    })),
    needsHumanConfirmation: true,
    _fallbackUsed: true,
  };
}

function epicHygieneFallback(payload) {
  const weak = Array.isArray(payload?.weakEpics) ? payload.weakEpics : [];
  return {
    weakEpics: weak.map((e) => ({
      issueKey: e.issueKey || '',
      currentTitle: e.currentTitle || e.summary || '',
      suggestedTitle: e.suggestedTitle || e.currentTitle || '',
      missingParts: e.missingParts || [],
      reason: 'Deterministic naming suggestion — AI unavailable',
    })),
    _fallbackUsed: true,
  };
}

function feedbackTriageFallback(payload) {
  return {
    proposals: [{
      agent: 'Phrase',
      proposal: 'Continue using accepted template phrasing',
      why: 'AI triage unavailable',
      affectedScope: payload?.project || '*',
      riskIfAccepted: 'low',
      requiresApproval: true,
    }],
    _fallbackUsed: true,
  };
}

function simpleModeFallback(payload) {
  const tier = String(payload?.tier || payload?.statusTier || 'watch').toLowerCase();
  const labels = {
    blocked: { statusLabel: 'Blocked', simpleLabel: 'Work stopped', swahiliLabel: 'Kazi imekwama' },
    watch: { statusLabel: 'Watch', simpleLabel: 'Needs attention', swahiliLabel: 'Inahitaji uangalizi' },
    'on-track': { statusLabel: 'On track', simpleLabel: 'Going well', swahiliLabel: 'Inaendelea vizuri' },
    setup: { statusLabel: 'Setup needed', simpleLabel: 'Finish setup first', swahiliLabel: 'Maliza usanidi kwanza' },
  };
  const row = labels[tier] || labels.watch;
  return {
    ...row,
    shortHelp: payload?.shortHelp || 'Review the brief for details.',
    buttonLabel: payload?.buttonLabel || 'Review action',
    _fallbackUsed: true,
  };
}

function actionPlanFallback(payload) {
  const risks = Array.isArray(payload?.topRisks) ? payload.topRisks : [];
  const grouped = risks.slice(0, 3).map((r) => ({
    owner: r.decisionNeededFrom || r.owner || 'Scrum Master',
    issueKeys: [r.issueKey].filter(Boolean),
    action: r.recommendedAction || `Review ${r.issueKey}`,
    nudgeDraft: r.recommendedAction || '',
    approvalRequired: true,
  }));
  return {
    doFirst: grouped[0]?.action || 'Review top risks in the brief',
    groupedActions: grouped,
    _fallbackUsed: true,
  };
}

function riskExplanationFallback(payload) {
  const risk = payload?.risk || {};
  return {
    summary: risk.evidence || risk.summary || 'Risk needs review',
    simpleSummary: risk.recommendedAction || 'Check owner and next step',
    confidence: 'review',
    _fallbackUsed: true,
  };
}

function translationFallback(payload) {
  return {
    original: payload?.text || '',
    simpleEnglish: payload?.text || '',
    swahiliLabel: '',
    _fallbackUsed: true,
  };
}

/** @type {Record<string, object>} */
export const AI_TASK_CONTRACTS = Object.freeze({
  ...PI_ARTIFACT_TASK_CONTRACTS,
  [AI_TASK_TYPES.GOVERNANCE_NARRATION]: {
    taskType: AI_TASK_TYPES.GOVERNANCE_NARRATION,
    inputContract: 'factContract + optional knowledge map',
    allowedFields: ['portfolio', 'period', 'deliveryTruth', 'topRisks', 'freshness', 'leadershipNarrative'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: {
      summary: 'string',
      simpleSummary: 'string',
      managerAnswer: 'string',
      piForumAnswer: 'string',
      protectMeAnswer: 'string',
      riskExplanation: 'string',
      issueKeysUsed: 'string[]',
      confidence: 'safe|review|blocked',
    },
    maxTokens: 2048,
    maxCostTier: 'medium',
    requiresHumanApproval: false,
    fallbackFn: governanceNarrationFallback,
  },
  [AI_TASK_TYPES.PI_BASELINE_CLASSIFY]: {
    taskType: AI_TASK_TYPES.PI_BASELINE_CLASSIFY,
    inputContract: 'candidate epics + quarter',
    allowedFields: ['issueKey', 'title', 'method', 'fixVersion', 'squad', 'imageBase64', 'mimeType'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: {
      candidateItems: 'array',
      needsHumanConfirmation: 'boolean',
    },
    maxTokens: 2048,
    maxCostTier: 'medium',
    requiresHumanApproval: true,
    fallbackFn: piBaselineFallback,
  },
  [AI_TASK_TYPES.EPIC_HYGIENE_SUGGEST]: {
    taskType: AI_TASK_TYPES.EPIC_HYGIENE_SUGGEST,
    inputContract: 'weak epics list + quarter',
    allowedFields: ['issueKey', 'title', 'summary', 'squad', 'score'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: { weakEpics: 'array' },
    maxTokens: 1536,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: epicHygieneFallback,
  },
  [AI_TASK_TYPES.FEEDBACK_TRIAGE]: {
    taskType: AI_TASK_TYPES.FEEDBACK_TRIAGE,
    inputContract: 'improvement events + adoption metrics',
    allowedFields: ['eventType', 'surface', 'scope', 'payload', 'note', 'phrase'],
    forbiddenFields: ['apiKey', 'password', 'token'],
    outputSchema: { proposals: 'array' },
    maxTokens: 2048,
    maxCostTier: 'medium',
    requiresHumanApproval: true,
    fallbackFn: feedbackTriageFallback,
  },
  [AI_TASK_TYPES.SIMPLE_MODE_COPY]: {
    taskType: AI_TASK_TYPES.SIMPLE_MODE_COPY,
    inputContract: 'status tier + risk context',
    allowedFields: ['tier', 'statusTier', 'shortHelp', 'buttonLabel', 'staleCount', 'blockedCount'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: {
      statusLabel: 'string',
      simpleLabel: 'string',
      swahiliLabel: 'string',
      shortHelp: 'string',
      buttonLabel: 'string',
    },
    maxTokens: 512,
    maxCostTier: 'low',
    requiresHumanApproval: false,
    fallbackFn: simpleModeFallback,
  },
  [AI_TASK_TYPES.ACTION_PLAN]: {
    taskType: AI_TASK_TYPES.ACTION_PLAN,
    inputContract: 'top risks + decision owner map',
    allowedFields: ['issueKey', 'owner', 'decisionNeededFrom', 'recommendedAction', 'riskType', 'summary'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: { doFirst: 'string', groupedActions: 'array' },
    maxTokens: 2048,
    maxCostTier: 'medium',
    requiresHumanApproval: true,
    fallbackFn: actionPlanFallback,
  },
  [AI_TASK_TYPES.RISK_EXPLANATION]: {
    taskType: AI_TASK_TYPES.RISK_EXPLANATION,
    inputContract: 'single risk + evidence',
    allowedFields: ['issueKey', 'riskType', 'evidence', 'owner', 'recommendedAction', 'summary'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: { summary: 'string', simpleSummary: 'string', confidence: 'string' },
    maxTokens: 1024,
    maxCostTier: 'low',
    requiresHumanApproval: false,
    fallbackFn: riskExplanationFallback,
  },
  [AI_TASK_TYPES.TRANSLATION_HELPER]: {
    taskType: AI_TASK_TYPES.TRANSLATION_HELPER,
    inputContract: 'short label or phrase',
    allowedFields: ['text', 'context', 'surface'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: { original: 'string', simpleEnglish: 'string', swahiliLabel: 'string' },
    maxTokens: 512,
    maxCostTier: 'low',
    requiresHumanApproval: false,
    fallbackFn: translationFallback,
  },
});

export function getTaskContract(taskType) {
  const key = String(taskType || '').trim();
  const contract = AI_TASK_CONTRACTS[key];
  if (!contract) throw new Error(`Unknown AI task type: ${key}`);
  return contract;
}

export function isAllowedTaskType(taskType) {
  return Boolean(AI_TASK_CONTRACTS[String(taskType || '').trim()]);
}
