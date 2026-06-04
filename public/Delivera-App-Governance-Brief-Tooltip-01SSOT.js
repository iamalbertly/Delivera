/** Tooltip copy SSOT for governance PI surfaces. */
export const GOV_TOOLTIPS = Object.freeze({
  piConfidence: 'PI confidence compares baseline commitments to current Jira status.',
  piChipElapsed: 'Time elapsed between planned start and today.',
  piChipDelivery: 'Delivery progress from baseline verdict.',
  adHocEpic: 'Epic active in sprint but not in approved PI baseline.',
  scopeCard: 'Squad health from sprint, blockers, and PI epic linkage.',
  protectMe: 'De-personalized wording safe for escalation forums.',
  narrationAdvisor: 'Advisor narration — copy records acceptance for phrase learning.',
  narrationTemplate: 'Deterministic template — always available without API key.',
  safeToSend: 'Claim-verified against evidence pack and freshness gates.',
  sinceLastRun: 'Changes since the last worker brief run.',
  epicHygiene: 'Epic naming score based on FY/Q structured pattern.',
});

export function tooltipAttr(key) {
  const t = GOV_TOOLTIPS[key];
  return t ? ` title="${String(t).replace(/"/g, '&quot;')}"` : '';
}
