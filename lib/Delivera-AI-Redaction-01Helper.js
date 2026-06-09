/**
 * SSOT: Redact AI payloads to allowed fields only.
 * Never send full issue bodies unless the task contract explicitly requires it.
 */

const DEFAULT_ALLOWED = Object.freeze([
  'issueKey', 'title', 'summary', 'status', 'owner', 'ownerLane',
  'decisionNeededFrom', 'recommendedAction', 'riskType', 'evidence',
  'method', 'fixVersion', 'squad', 'confidence', 'score',
  'portfolio', 'period', 'deliveryTruth', 'freshness', 'topRisks',
  'leadershipNarrative', 'tier', 'statusTier', 'shortHelp', 'buttonLabel',
  'staleCount', 'blockedCount', 'quarter', 'candidates', 'weakEpics',
  'eventType', 'surface', 'scope', 'payload', 'note', 'phrase', 'text', 'context',
  'project', 'factContract', 'contract', 'knowledge', 'topRisks', 'risks',
]);

function pickAllowed(obj, allowedSet) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((row) => pickAllowed(row, allowedSet)).slice(0, 50);
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (allowedSet.has(k)) out[k] = pickAllowed(v, allowedSet);
  }
  return out;
}

function slimRisk(r = {}) {
  return {
    issueKey: r.issueKey,
    summary: r.summary || r.displayTitle,
    status: r.status,
    owner: r.owner,
    decisionNeededFrom: r.decisionNeededFrom,
    recommendedAction: r.recommendedAction,
    riskType: r.riskType,
    evidence: r.evidence,
    ageHours: r.ageHours,
  };
}

function slimContract(contract = {}) {
  return {
    portfolio: contract.portfolio,
    period: contract.period,
    freshness: contract.freshness,
    deliveryTruth: contract.deliveryTruth,
    leadershipNarrative: contract.leadershipNarrative
      ? { confidence: contract.leadershipNarrative.confidence }
      : undefined,
    topRisks: (contract.topRisks || []).map(slimRisk).slice(0, 15),
  };
}

/**
 * @param {object} payload raw input
 * @param {object} taskContract from AI_TASK_CONTRACTS
 * @returns {object} redacted payload safe for provider
 */
export function redactPayloadForTask(payload = {}, taskContract = {}) {
  const allowed = new Set([
    ...DEFAULT_ALLOWED,
    ...(Array.isArray(taskContract.allowedFields) ? taskContract.allowedFields : []),
  ]);
  const forbidden = new Set(Array.isArray(taskContract.forbiddenFields) ? taskContract.forbiddenFields : []);

  let base = pickAllowed(payload, allowed);
  if (payload.contract || payload.factContract) {
    base = {
      ...base,
      contract: slimContract(payload.contract || payload.factContract),
    };
    delete base.factContract;
  }
  if (Array.isArray(payload.candidates)) {
    base.candidates = payload.candidates.map((c) => pickAllowed(c, allowed)).slice(0, 42);
  }
  if (Array.isArray(payload.topRisks)) {
    base.topRisks = payload.topRisks.map(slimRisk).slice(0, 10);
  }

  for (const key of forbidden) {
    delete base[key];
  }
  return base;
}
