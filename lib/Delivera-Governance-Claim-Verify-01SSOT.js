/**
 * SSOT: Claim verification for governance narratives (pure, no IO).
 */
const ISSUE_KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;

export function collectAllowedKeysFromContract(contract) {
  const keys = new Set();
  const add = (k) => { const v = String(k || '').trim().toUpperCase(); if (v) keys.add(v); };
  for (const r of (Array.isArray(contract?.risks) ? contract.risks : [])) add(r.issueKey);
  for (const r of (Array.isArray(contract?.topRisks) ? contract.topRisks : [])) add(r.issueKey);
  for (const r of (Array.isArray(contract?.portfolioRisks) ? contract.portfolioRisks : [])) add(r.issueKey);
  const dk = contract?.deliveryTruthKeys || {};
  for (const arr of Object.values(dk)) {
    for (const k of (Array.isArray(arr) ? arr : [])) add(k);
  }
  return keys;
}

export function verifyAllowedIssueKeys(text, allowedSet) {
  const mentioned = String(text || '').match(ISSUE_KEY_RE) || [];
  const invalid = [];
  for (const k of mentioned) {
    if (!allowedSet.has(k.toUpperCase())) invalid.push(k);
  }
  return { pass: invalid.length === 0, invalid };
}

/**
 * Verify numeric claims in a sentence against deliveryTruth / risk counts.
 */
export function verifyCountClaim(sentence, contract) {
  const dt = contract?.deliveryTruth || {};
  const riskCount = (contract?.topRisks || []).length + (contract?.portfolioRisks || []).filter((r) => r.issueKey).length;
  const text = String(sentence || '');
  const mismatches = [];

  const staleMatch = text.match(/(\d+)\s+stale/i);
  if (staleMatch) {
    const claimed = Number(staleMatch[1]);
    const actual = Number(dt.staleInProgress) || 0;
    if (claimed !== actual) mismatches.push({ field: 'staleInProgress', claimed, actual });
  }

  const riskMatch = text.match(/(\d+)\s+risk/i);
  if (riskMatch) {
    const claimed = Number(riskMatch[1]);
    if (claimed !== riskCount && claimed !== (contract?.risks || []).length) {
      mismatches.push({ field: 'risks', claimed, actual: riskCount });
    }
  }

  const commitMatch = text.match(/(\d+)\s+commit/i);
  if (commitMatch) {
    const claimed = Number(commitMatch[1]);
    const actual = Number(dt.committed) || 0;
    if (claimed !== actual) mismatches.push({ field: 'committed', claimed, actual });
  }

  return { pass: mismatches.length === 0, mismatches };
}

/**
 * Score narrative confidence 0–1; safeToSend when >= 0.8.
 */
export function scoreClaimConfidence(contract, narrative = {}) {
  const allowed = collectAllowedKeysFromContract(contract);
  const parts = [
    narrative.headline,
    narrative.oneParagraph,
    narrative.meetingAnswer,
    narrative.whatToSay,
    JSON.stringify(narrative.decisionsNeeded || []),
  ].filter(Boolean).join(' ');

  let score = 1.0;
  const keyCheck = verifyAllowedIssueKeys(parts, allowed);
  if (!keyCheck.pass) score -= 0.4;

  for (const field of [narrative.headline, narrative.oneParagraph, narrative.meetingAnswer].filter(Boolean)) {
    const countCheck = verifyCountClaim(field, contract);
    if (!countCheck.pass) score -= 0.15;
  }

  if (contract?.freshness?.confidenceLimit === 'stale') score -= 0.25;
  if (contract?.freshness?.confidenceLimit === 'partial') score -= 0.15;
  if (!contract?.baselineComparison) score -= 0.35;

  score = Math.max(0, Math.min(1, score));
  const hasBaseline = Boolean(contract?.baselineComparison);
  return {
    score: Math.round(score * 100) / 100,
    safeToSend: hasBaseline && score >= 0.8,
    keyViolations: keyCheck.invalid || [],
  };
}

export function buildVerifiedMeetingAnswer(contract, narrative) {
  const n = narrative || {};
  const base = n.meetingAnswer || n.headline || n.oneParagraph || '';
  const check = scoreClaimConfidence(contract, n);
  if (check.safeToSend) return base;
  const fallback = contract?.executiveView?.verdictLine || n.headline || 'Delivery status needs review before sharing.';
  return `${fallback} (Some claims need confirmation — see Action Inbox.)`;
}
