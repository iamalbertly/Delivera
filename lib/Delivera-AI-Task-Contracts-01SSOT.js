/**
 * SSOT: AI task type enum and contract definitions for the orchestrator.
 * Every AI feature must declare a contract here — no ad-hoc provider calls.
 */
import { narrateBriefTemplate } from './Delivera-Governance-Brief-02Narrator-Template.js';

export const AI_TASK_TYPES = Object.freeze({
  GOVERNANCE_NARRATION: 'governance-narration',
  PI_BASELINE_CLASSIFY: 'pi-baseline-classify',
  EPIC_HYGIENE_SUGGEST: 'epic-hygiene-suggest',
  FEEDBACK_TRIAGE: 'feedback-triage',
  SIMPLE_MODE_COPY: 'simple-mode-copy',
  ACTION_PLAN: 'action-plan',
  RISK_EXPLANATION: 'risk-explanation',
  TRANSLATION_HELPER: 'translation-helper',
  CONTRIBUTION_DRAFT: 'contribution-draft',
  REPORT_AUDIENCE_SUMMARY: 'report-audience-summary',
  CLAIM_GAP_DETECTION: 'claim-gap-detection',
  GOVERNANCE_CONFIRM_SCOPE: 'governance-confirm-scope',
  GOVERNANCE_CONFIRM_BLOCKER: 'governance-confirm-blocker',
  GOVERNANCE_RECOVERY_OPTIONS: 'governance-recovery-options',
  GOVERNANCE_INTERPRET_RESPONSE: 'governance-interpret-response',
  GOVERNANCE_PREPARE_ESCALATION: 'governance-prepare-escalation',
  GOVERNANCE_VERIFY_ACTION: 'governance-verify-action',
  GOVERNANCE_LEARN_OUTCOME: 'governance-learn-outcome',
  GOVERNANCE_CLOSE_CASE: 'governance-close-case',
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
  [AI_TASK_TYPES.CONTRIBUTION_DRAFT]: 'balanced reasoning, structured output',
  [AI_TASK_TYPES.REPORT_AUDIENCE_SUMMARY]: 'balanced reasoning, safe summary',
  [AI_TASK_TYPES.CLAIM_GAP_DETECTION]: 'balanced reasoning, structured output',
  [AI_TASK_TYPES.GOVERNANCE_CONFIRM_SCOPE]: 'low cost, human-approved draft',
  [AI_TASK_TYPES.GOVERNANCE_CONFIRM_BLOCKER]: 'low cost, human-approved draft',
  [AI_TASK_TYPES.GOVERNANCE_RECOVERY_OPTIONS]: 'balanced reasoning, structured output',
  [AI_TASK_TYPES.GOVERNANCE_INTERPRET_RESPONSE]: 'balanced reasoning, structured output',
  [AI_TASK_TYPES.GOVERNANCE_PREPARE_ESCALATION]: 'low cost, human-approved draft',
  [AI_TASK_TYPES.GOVERNANCE_VERIFY_ACTION]: 'balanced reasoning, fact-check',
  [AI_TASK_TYPES.GOVERNANCE_LEARN_OUTCOME]: 'stage5-deferred',
  [AI_TASK_TYPES.GOVERNANCE_CLOSE_CASE]: 'stage5-deferred',
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

function contributionDraftFallback(payload) {
  const source = Array.isArray(payload?.sourceRecords) ? payload.sourceRecords[0] || {} : {};
  const title = source.title || payload?.title || 'Draft contribution';
  return {
    situation: source.teamStatement || title,
    myAction: payload?.individualActionStatement || source.individualActionStatement || '',
    stakeholders: payload?.stakeholders || 'Product Owner, delivery team, dependency owner',
    result: payload?.impactStatement || source.impactStatement || 'Result needs human confirmation before validation.',
    strategicRelevance: 'Value protection, delivery risk reduction, or capability multiplication needs classification.',
    evidence: Array.isArray(payload?.sourceRecordIds) ? payload.sourceRecordIds.join(', ') : '',
    individualActionStatement: payload?.individualActionStatement || '',
    teamStatement: payload?.teamStatement || title,
    impactStatement: payload?.impactStatement || 'Impact needs human confirmation before validation.',
    sourceRecordIds: Array.isArray(payload?.sourceRecordIds) ? payload.sourceRecordIds : [],
    requiredHumanPromotion: true,
    confidence: 'review',
    _fallbackUsed: true,
  };
}

function reportAudienceSummaryFallback(payload) {
  return {
    summary: payload?.narrative || 'Report draft needs review.',
    gapCallouts: Array.isArray(payload?.gaps) ? payload.gaps : [],
    sourceRecordIds: Array.isArray(payload?.sourceRecordIds) ? payload.sourceRecordIds : [],
    confidence: 'review',
    _fallbackUsed: true,
  };
}

function claimGapDetectionFallback(payload) {
  const claims = Array.isArray(payload?.claims) ? payload.claims : [];
  return {
    gaps: claims.map((claim) => ({
      claim: String(claim?.claim || claim || '').slice(0, 220),
      gap: 'Needs Tier 1-3 evidence or stakeholder validation before verified reporting.',
      severity: 'review',
    })),
    sourceRecordIds: Array.isArray(payload?.sourceRecordIds) ? payload.sourceRecordIds : [],
    confidence: 'review',
    _fallbackUsed: true,
  };
}

function interventionDraftFallback(payload) {
  const issueKey = payload?.issueKey || payload?.issueKeys?.[0] || 'this work';
  const action = payload?.recommendedAction || payload?.action || 'confirm the decision and next action';
  return {
    issueKey,
    text: `${issueKey}: ${action}. Please confirm observed decision, owner, and target date.`,
    options: ['confirmed', 'partly-confirmed', 'needs-correction'],
    requiresHumanApproval: true,
    confidence: 'review',
    _fallbackUsed: true,
  };
}

function recoveryOptionsFallback(payload) {
  const issueKey = payload?.issueKey || payload?.issueKeys?.[0] || 'this work';
  return {
    options: [
      { label: 'Confirm owner today', consequence: 'Reduces decision delay without changing scope.' },
      { label: 'Split or defer scope', consequence: 'Protects release confidence if capacity is constrained.' },
      { label: 'Escalate decision', consequence: 'Makes leadership trade-off explicit before the risk ages further.' },
    ],
    preferred: `Confirm owner and target date for ${issueKey}`,
    confidence: 'review',
    _fallbackUsed: true,
  };
}

function interpretResponseFallback(payload) {
  const text = String(payload?.responseText || '').toLowerCase();
  const decision = text.includes('confirm') || text.includes('yes')
    ? 'confirmed'
    : text.includes('partial') ? 'partly-confirmed' : 'needs-review';
  return {
    decision,
    extractedOwner: payload?.owner || '',
    extractedTargetDate: payload?.targetDate || '',
    needsCorrection: decision === 'needs-review',
    confidence: 'review',
    _fallbackUsed: true,
  };
}

function verifyActionFallback(payload) {
  return {
    status: payload?.evidence?.length ? 'passed' : 'needs-evidence',
    evidence: Array.isArray(payload?.evidence) ? payload.evidence : [],
    missing: payload?.evidence?.length ? [] : ['fresh Jira fact or stakeholder confirmation'],
    confidence: payload?.evidence?.length ? 'bounded' : 'review',
    _fallbackUsed: true,
  };
}

function stage5DeferredFallback(payload) {
  return {
    status: 'stage5-deferred',
    reason: 'Autonomous learning/closure is contract-defined but remains human-gated in Stage 4.',
    caseId: payload?.caseId || '',
    _fallbackUsed: true,
  };
}

/** @type {Record<string, object>} */
export const AI_TASK_CONTRACTS = Object.freeze({
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
  [AI_TASK_TYPES.CONTRIBUTION_DRAFT]: {
    taskType: AI_TASK_TYPES.CONTRIBUTION_DRAFT,
    inputContract: 'source evidence records + optional user statement',
    allowedFields: ['sourceRecordIds', 'sourceRecords', 'title', 'teamStatement', 'individualActionStatement', 'impactStatement'],
    forbiddenFields: ['rating', 'performanceRating', 'disciplinaryAction', 'pip', 'termination', 'medicalInfo', ...FORBIDDEN_FACT_FIELDS],
    outputSchema: {
      situation: 'string',
      myAction: 'string',
      stakeholders: 'string',
      result: 'string',
      strategicRelevance: 'string',
      evidence: 'string',
      individualActionStatement: 'string',
      teamStatement: 'string',
      impactStatement: 'string',
      sourceRecordIds: 'array',
      requiredHumanPromotion: 'boolean',
      confidence: 'string',
    },
    maxTokens: 1024,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: contributionDraftFallback,
  },
  [AI_TASK_TYPES.REPORT_AUDIENCE_SUMMARY]: {
    taskType: AI_TASK_TYPES.REPORT_AUDIENCE_SUMMARY,
    inputContract: 'report snapshot + source ids + audience',
    allowedFields: ['audience', 'variant', 'narrative', 'sourceRecordIds', 'gaps'],
    forbiddenFields: ['rating', 'performanceRating', 'disciplinaryAction', 'pip', 'termination', ...FORBIDDEN_FACT_FIELDS],
    outputSchema: {
      summary: 'string',
      gapCallouts: 'array',
      sourceRecordIds: 'array',
      confidence: 'string',
    },
    maxTokens: 1024,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: reportAudienceSummaryFallback,
  },
  [AI_TASK_TYPES.CLAIM_GAP_DETECTION]: {
    taskType: AI_TASK_TYPES.CLAIM_GAP_DETECTION,
    inputContract: 'claims + source records',
    allowedFields: ['claims', 'sourceRecords', 'sourceRecordIds'],
    forbiddenFields: ['rating', 'performanceRating', 'disciplinaryAction', 'pip', 'termination', ...FORBIDDEN_FACT_FIELDS],
    outputSchema: {
      gaps: 'array',
      sourceRecordIds: 'array',
      confidence: 'string',
    },
    maxTokens: 1024,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: claimGapDetectionFallback,
  },
  [AI_TASK_TYPES.GOVERNANCE_CONFIRM_SCOPE]: {
    taskType: AI_TASK_TYPES.GOVERNANCE_CONFIRM_SCOPE,
    inputContract: 'case facts + resolved role + scope risk',
    allowedFields: ['caseId', 'issueKey', 'issueKeys', 'riskType', 'recommendedAction', 'recipient', 'facts', 'unknowns'],
    forbiddenFields: ['apiKey', 'password', 'token', ...FORBIDDEN_FACT_FIELDS],
    outputSchema: { issueKey: 'string', text: 'string', options: 'array', requiresHumanApproval: 'boolean', confidence: 'string' },
    maxTokens: 768,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: interventionDraftFallback,
  },
  [AI_TASK_TYPES.GOVERNANCE_CONFIRM_BLOCKER]: {
    taskType: AI_TASK_TYPES.GOVERNANCE_CONFIRM_BLOCKER,
    inputContract: 'case facts + blocker/dependency risk',
    allowedFields: ['caseId', 'issueKey', 'issueKeys', 'riskType', 'recommendedAction', 'recipient', 'facts', 'unknowns'],
    forbiddenFields: ['apiKey', 'password', 'token', ...FORBIDDEN_FACT_FIELDS],
    outputSchema: { issueKey: 'string', text: 'string', options: 'array', requiresHumanApproval: 'boolean', confidence: 'string' },
    maxTokens: 768,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: interventionDraftFallback,
  },
  [AI_TASK_TYPES.GOVERNANCE_RECOVERY_OPTIONS]: {
    taskType: AI_TASK_TYPES.GOVERNANCE_RECOVERY_OPTIONS,
    inputContract: 'case facts + current blockers',
    allowedFields: ['caseId', 'issueKey', 'issueKeys', 'riskType', 'recommendedAction', 'facts', 'unknowns'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: { options: 'array', preferred: 'string', confidence: 'string' },
    maxTokens: 1024,
    maxCostTier: 'medium',
    requiresHumanApproval: true,
    fallbackFn: recoveryOptionsFallback,
  },
  [AI_TASK_TYPES.GOVERNANCE_INTERPRET_RESPONSE]: {
    taskType: AI_TASK_TYPES.GOVERNANCE_INTERPRET_RESPONSE,
    inputContract: 'stakeholder response text + case context',
    allowedFields: ['caseId', 'responseText', 'owner', 'targetDate', 'allowedDecisions'],
    forbiddenFields: ['apiKey', 'password', 'token', ...FORBIDDEN_FACT_FIELDS],
    outputSchema: { decision: 'string', extractedOwner: 'string', extractedTargetDate: 'string', needsCorrection: 'boolean', confidence: 'string' },
    maxTokens: 768,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: interpretResponseFallback,
  },
  [AI_TASK_TYPES.GOVERNANCE_PREPARE_ESCALATION]: {
    taskType: AI_TASK_TYPES.GOVERNANCE_PREPARE_ESCALATION,
    inputContract: 'case facts + action age + escalation level',
    allowedFields: ['caseId', 'issueKeys', 'level', 'audience', 'action', 'facts', 'unknowns'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: { issueKey: 'string', text: 'string', options: 'array', requiresHumanApproval: 'boolean', confidence: 'string' },
    maxTokens: 768,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: interventionDraftFallback,
  },
  [AI_TASK_TYPES.GOVERNANCE_VERIFY_ACTION]: {
    taskType: AI_TASK_TYPES.GOVERNANCE_VERIFY_ACTION,
    inputContract: 'case facts + checkpoint/action evidence',
    allowedFields: ['caseId', 'issueKeys', 'evidence', 'facts', 'unknowns', 'checkpoint'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: { status: 'string', evidence: 'array', missing: 'array', confidence: 'string' },
    maxTokens: 768,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: verifyActionFallback,
  },
  [AI_TASK_TYPES.GOVERNANCE_LEARN_OUTCOME]: {
    taskType: AI_TASK_TYPES.GOVERNANCE_LEARN_OUTCOME,
    inputContract: 'closed case summary',
    allowedFields: ['caseId', 'outcome', 'facts', 'metrics'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: { status: 'string', reason: 'string', caseId: 'string' },
    maxTokens: 256,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: stage5DeferredFallback,
  },
  [AI_TASK_TYPES.GOVERNANCE_CLOSE_CASE]: {
    taskType: AI_TASK_TYPES.GOVERNANCE_CLOSE_CASE,
    inputContract: 'verified case + closure reason',
    allowedFields: ['caseId', 'reason', 'verification', 'facts'],
    forbiddenFields: FORBIDDEN_FACT_FIELDS,
    outputSchema: { status: 'string', reason: 'string', caseId: 'string' },
    maxTokens: 256,
    maxCostTier: 'low',
    requiresHumanApproval: true,
    fallbackFn: stage5DeferredFallback,
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
