/**
 * SSOT: AI output verification — extends claim verifier with schema + forbidden field checks.
 */
import {
  collectAllowedKeysFromContract,
  verifyAllowedIssueKeys,
  verifyCountClaim,
  scoreClaimConfidence,
} from './Delivera-Governance-Claim-Verify-01SSOT.js';
import { getTaskContract } from './Delivera-AI-Task-Contracts-01SSOT.js';

const ISSUE_KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const BANNED_PHRASES = [
  /confirmed baseline/i,
  /auto-?post/i,
  /jira write complete/i,
  /guaranteed delivery/i,
  /100%\s*confident/i,
  /\bperformance rating\b/i,
  /\bdisciplinary action\b/i,
  /\btermination\b/i,
  /\bformal pip\b/i,
  /\bpersonal improvement plan\b/i,
];

function collectAllowedKeysFromPayload(payload = {}) {
  const contract = payload.contract || payload.factContract;
  if (contract) return collectAllowedKeysFromContract(contract);
  const keys = new Set();
  const add = (k) => { const v = String(k || '').trim().toUpperCase(); if (v) keys.add(v); };
  for (const c of (payload.candidates || [])) add(c.issueKey);
  for (const r of (payload.topRisks || payload.risks || [])) add(r.issueKey);
  for (const e of (payload.weakEpics || [])) add(e.issueKey);
  for (const k of (payload.allowedIssueKeys || [])) add(k);
  return keys;
}

function validateSchemaShape(output, schema = {}) {
  const missing = [];
  for (const [key, typeHint] of Object.entries(schema)) {
    if (!(key in output)) {
      missing.push(key);
      continue;
    }
    const val = output[key];
    if (String(typeHint).includes('[]') && !Array.isArray(val)) missing.push(`${key}:not-array`);
    if (typeHint === 'string' && typeof val !== 'string') missing.push(`${key}:not-string`);
    if (typeHint === 'boolean' && typeof val !== 'boolean') missing.push(`${key}:not-boolean`);
  }
  return { pass: missing.length === 0, missing };
}

function scanBannedPhrases(text = '') {
  const hits = [];
  for (const re of BANNED_PHRASES) {
    if (re.test(text)) hits.push(re.source);
  }
  return { pass: hits.length === 0, hits };
}

function verifyPiConfidenceClaims(text, payload = {}) {
  const contract = payload.contract || payload.factContract;
  if (!contract?.leadershipNarrative?.confidence && /high confidence|low confidence/i.test(text)) {
    if (!contract) return { pass: false, reason: 'PI confidence mentioned without contract' };
  }
  return { pass: true };
}

/**
 * @param {object} output parsed AI output
 * @param {string} taskType
 * @param {object} payload original redacted payload
 * @returns {{ pass: boolean, confidence: 'safe'|'review'|'blocked', violations: string[] }}
 */
export function verifyAiOutput(output, taskType, payload = {}) {
  const violations = [];
  let contract;
  try { contract = getTaskContract(taskType); } catch (err) {
    return { pass: false, confidence: 'blocked', violations: [err.message] };
  }

  if (!output || typeof output !== 'object') {
    return { pass: false, confidence: 'blocked', violations: ['Output is not an object'] };
  }

  const schemaCheck = validateSchemaShape(output, contract.outputSchema || {});
  if (!schemaCheck.pass) violations.push(`Schema: ${schemaCheck.missing.join(', ')}`);

  const allowedKeys = collectAllowedKeysFromPayload(payload);
  const textBlob = JSON.stringify(output);
  if (allowedKeys.size > 0) {
    const keyCheck = verifyAllowedIssueKeys(textBlob, allowedKeys);
    if (!keyCheck.pass) violations.push(`Unknown keys: ${keyCheck.invalid.join(', ')}`);
  }

  const factContract = payload.contract || payload.factContract;
  if (factContract) {
    for (const field of [output.summary, output.simpleSummary, output.managerAnswer, output.riskExplanation, output.headline, output.oneParagraph].filter(Boolean)) {
      const countCheck = verifyCountClaim(field, factContract);
      if (!countCheck.pass) violations.push(`Count mismatch: ${JSON.stringify(countCheck.mismatches)}`);
    }
    const claimScore = scoreClaimConfidence(factContract, output);
    if (claimScore.keyViolations?.length) {
      violations.push(`Claim keys: ${claimScore.keyViolations.join(', ')}`);
    }
  }

  const phraseCheck = scanBannedPhrases(textBlob);
  if (!phraseCheck.pass) violations.push(`Banned phrases: ${phraseCheck.hits.join(', ')}`);

  const piCheck = verifyPiConfidenceClaims(textBlob, payload);
  if (!piCheck.pass) violations.push(piCheck.reason || 'PI confidence violation');

  for (const field of contract.forbiddenFields || []) {
    if (field in output) violations.push(`Forbidden field in output: ${field}`);
  }

  const mentioned = textBlob.match(ISSUE_KEY_RE) || [];
  if (Array.isArray(output.issueKeysUsed)) {
    for (const k of output.issueKeysUsed) {
      if (allowedKeys.size && !allowedKeys.has(String(k).toUpperCase())) {
        violations.push(`issueKeysUsed contains unknown key: ${k}`);
      }
    }
  } else if (mentioned.length && allowedKeys.size === 0 && taskType === 'governance-narration') {
    violations.push('Issue keys mentioned but no allowed key set');
  }

  const pass = violations.length === 0;
  let confidence = 'safe';
  if (!pass) confidence = violations.some((v) => /Unknown keys|Count mismatch|Forbidden/.test(v)) ? 'blocked' : 'review';
  if (output.confidence === 'blocked' || output.confidence === 'review') confidence = output.confidence;

  return { pass, confidence, violations };
}

export {
  collectAllowedKeysFromContract,
  verifyAllowedIssueKeys,
  verifyCountClaim,
  scoreClaimConfidence,
};
