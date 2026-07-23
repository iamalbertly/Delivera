export function artifactOcrFallback(payload = {}) {
  return {
    textBlocks: Array.isArray(payload.localTextBlocks) ? payload.localTextBlocks : [],
    readingOrder: [],
    tableHints: [],
    needsHumanConfirmation: true,
    _fallbackUsed: true,
  };
}

export function artifactClassifyFallback(payload = {}) {
  return {
    slideType: payload.deterministicType || 'unknown',
    squadCandidate: payload.deterministicSquad || '',
    periodCandidate: payload.deterministicPeriod || '',
    monthColumns: [],
    commitmentSpans: [],
    needsHumanConfirmation: true,
    _fallbackUsed: true,
  };
}

export function artifactReconcileFallback(payload = {}) {
  return {
    preferredInterpretation: '',
    confidence: 'review',
    conflictExplanation: 'Automated reconciliation was unavailable.',
    needsHumanConfirmation: true,
    _fallbackUsed: true,
  };
}

const ARTIFACT_FORBIDDEN_FIELDS = Object.freeze([
  'approved', 'saved', 'deliveryStatus', 'inventedIssueKey', 'apiKey', 'password', 'token',
]);

export const PI_ARTIFACT_TASK_CONTRACTS = Object.freeze({
  'pi-artifact-ocr': {
    taskType: 'pi-artifact-ocr',
    inputContract: 'one unresolved artifact image with local text hints',
    allowedFields: ['imageBase64', 'mimeType', 'localTextBlocks', 'vocabulary', 'artifactHash'],
    forbiddenFields: ARTIFACT_FORBIDDEN_FIELDS,
    outputSchema: { textBlocks: 'array', readingOrder: 'array', tableHints: 'array', needsHumanConfirmation: 'boolean' },
    maxTokens: 4096,
    maxCostTier: 'free',
    requiresHumanApproval: true,
    fallbackFn: artifactOcrFallback,
  },
  'pi-artifact-structure-classify': {
    taskType: 'pi-artifact-structure-classify',
    inputContract: 'verified text blocks and slide metadata',
    allowedFields: ['imageBase64', 'mimeType', 'textBlocks', 'slideNumber', 'title', 'deterministicType', 'deterministicSquad', 'deterministicPeriod'],
    forbiddenFields: ARTIFACT_FORBIDDEN_FIELDS,
    outputSchema: {
      slideType: 'string',
      squadCandidate: 'string',
      periodCandidate: 'string',
      monthColumns: 'array',
      commitmentSpans: 'array',
      needsHumanConfirmation: 'boolean',
    },
    maxTokens: 3072,
    maxCostTier: 'free',
    requiresHumanApproval: true,
    fallbackFn: artifactClassifyFallback,
  },
  'pi-artifact-reconcile': {
    taskType: 'pi-artifact-reconcile',
    inputContract: 'conflicting evidence-backed interpretations',
    allowedFields: ['interpretations', 'sourceSpans', 'allowedIssueKeys', 'artifactHash'],
    forbiddenFields: ARTIFACT_FORBIDDEN_FIELDS,
    outputSchema: {
      preferredInterpretation: 'string',
      confidence: 'string',
      conflictExplanation: 'string',
      needsHumanConfirmation: 'boolean',
    },
    maxTokens: 2048,
    maxCostTier: 'free',
    requiresHumanApproval: true,
    fallbackFn: artifactReconcileFallback,
  },
});
