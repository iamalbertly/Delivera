/**
 * SSOT: Template Narrator (default, always-working).
 *
 * Turns the deterministic Brief Fact Contract into leadership language without
 * any LLM. This is the guaranteed path: if the optional advisor is blocked or
 * fails, this produces the identical brief. It reads accepted phrasing from the
 * narration knowledge store so the deterministic core improves over time.
 *
 * Pure aside from the optional pre-loaded knowledge map. No Jira/IO here.
 */
import { riskTypeLabel } from './Delivera-Governance-Grammar-01Rules-SSOT.js';

function confidenceWord(confidence) {
  switch (String(confidence || '').toLowerCase()) {
    case 'high': return 'high';
    case 'medium': return 'medium';
    default: return 'low';
  }
}

function phrase(knowledge, patternKey, fallback) {
  if (knowledge && typeof knowledge.get === 'function') {
    const v = knowledge.get(patternKey);
    if (v) return v;
  }
  return fallback;
}

function freshnessCaveat(contract) {
  const f = contract?.freshness?.confidenceLimit || 'live';
  if (f === 'live') return '';
  const age = Math.round(Number(contract?.freshness?.cacheAgeMinutes) || 0);
  if (f === 'stale') return ` Data is stale (cached ${age}m ago, Jira was unreachable) - treat confidence as provisional.`;
  if (f === 'partial') return ' Data is partial - some squads did not return; confidence is limited.';
  return ` Based on cached data from ${age}m ago.`;
}

/**
 * Build the leadership narrative deterministically.
 * @param {object} contract the enriched fact contract (risks have owners/actions)
 * @param {Map<string,string>} [knowledge] optional accepted-phrase map
 * @returns {{ confidence, headline, oneParagraph, decisionsNeeded, narratedBy }}
 */
export function narrateBriefTemplate(contract, knowledge = null) {
  const dt = contract?.deliveryTruth || {};
  const portfolio = contract?.portfolio || 'Portfolio';
  const conf = confidenceWord(contract?.leadershipNarrative?.confidence);
  const quarter = contract?.period?.vodacomQuarter ? `${contract.period.vodacomQuarter} ` : '';
  const committed = Number(dt.committed) || 0;
  const done = Number(dt.done) || 0;
  const stale = Number(dt.staleInProgress) || 0;
  const blocked = Number(dt.blocked) || 0;
  const lateAdded = Number(dt.lateAdded) || 0;

  const headline = phrase(
    knowledge,
    `headline.${conf}`,
    `${portfolio}: ${conf} delivery confidence this ${quarter}window - ${done}/${committed} delivered, ${stale} stale in progress, ${lateAdded} added mid-sprint.`,
  );

  const sentences = [];
  sentences.push(`${portfolio} is at ${conf} delivery confidence for the current ${quarter}sprint window.`);
  sentences.push(`${done} of ${committed} committed stories are delivered.`);
  if (stale > 0) sentences.push(`${stale} item${stale === 1 ? ' is' : 's are'} stale in progress with no recent movement.`);
  if (blocked > 0) sentences.push(`${blocked} blocker${blocked === 1 ? ' is' : 's are'} owned and ageing.`);
  if (lateAdded > 0) sentences.push(`${lateAdded} item${lateAdded === 1 ? ' was' : 's were'} added after sprint start and need a Product Owner decision.`);
  const caveat = freshnessCaveat(contract);
  const oneParagraph = sentences.join(' ') + caveat;

  const statusWord = conf === 'high' ? 'on track' : conf === 'medium' ? 'needs watching' : 'at risk';
  const meetingParts = [];
  meetingParts.push(`${portfolio} is ${statusWord} this sprint.`);
  meetingParts.push(`${done} of ${committed} committed stories are done.`);
  if (stale > 0) meetingParts.push(`${stale} stor${stale === 1 ? 'y is' : 'ies are'} stale in progress.`);
  if (done === 0 && committed > 0) {
    meetingParts.push('The team needs a Product Owner and Tech Lead decision today: unblock work or cut scope before the next check-in.');
  } else if (blocked > 0 || lateAdded > 0) {
    meetingParts.push('Escalate blockers and late-added scope before the next check-in.');
  }
  const meetingAnswer = meetingParts.join(' ');

  const quoteParts = [];
  if (done === 0 && committed > 0) {
    quoteParts.push(`${portfolio} has ${committed} committed item${committed === 1 ? '' : 's'} still in progress and none delivered.`);
    if (stale > 0) quoteParts.push(`All ${stale} open item${stale === 1 ? ' is' : 's are'} stale.`);
    quoteParts.push('We need a decision today on whether to unblock them or cut scope.');
  } else {
    quoteParts.push(`${portfolio} has ${done} of ${committed} stories delivered`);
    if (stale > 0) quoteParts.push(`with ${stale} stale in progress`);
    quoteParts.push('— confirm owners and next moves before the meeting.');
  }
  const whatToSay = quoteParts.join(' ');

  const whatChanged = 'First check-in for this scope — compare again after the next refresh.';

  const topRisks = Array.isArray(contract?.topRisks) ? contract.topRisks : [];
  const decisionsNeeded = topRisks.map((r) => ({
    issueKey: r.issueKey,
    decisionNeededFrom: r.decisionNeededFrom || 'Scrum Master',
    action: r.recommendedAction || `Review ${r.issueKey}.`,
    riskLabel: riskTypeLabel(r.riskType),
    evidence: r.evidence || '',
  }));

  const meetingScript = [oneParagraph, whatToSay].filter(Boolean).join('\n\n');

  return {
    confidence: conf,
    headline,
    oneParagraph,
    meetingAnswer,
    whatToSay,
    meetingScript,
    whatChanged,
    decisionsNeeded,
    narratedBy: 'template',
  };
}
