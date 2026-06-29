import { readEvidenceOsStore, mutateEvidenceOsStore, evidenceOsNow, newEvidenceOsId } from './Delivera-EvidenceOS-00Store-IO.js';
import { detectLinkedCommitments } from './Delivera-Goal-01Service.js';

function workTitle(workItemKey = '') {
  return workItemKey ? `${workItemKey} delivery item` : 'Manual delivery intervention';
}

function classifyValue(contribution = {}) {
  const text = `${contribution.teamStatement || ''} ${contribution.individualActionStatement || ''} ${contribution.impactStatement || ''}`.toLowerCase();
  if (/coach|onboard|standard|governance|maturity|capability|practice/.test(text)) return 'capability_multiplication';
  if (/risk|block|dependency|release|stabil|incident|defect|security|compliance|outage|protect/.test(text)) return 'value_protection';
  return 'value_generation';
}

function structuredContribution(contribution = {}) {
  return {
    situation: contribution.teamStatement || `${workTitle(contribution.workItemKey)} needed delivery support.`,
    myAction: contribution.individualActionStatement || 'Action needs confirmation.',
    stakeholders: contribution.stakeholders || 'Product Owner, delivery team, dependency owner',
    result: contribution.impactStatement || 'Result needs objective confirmation.',
    strategicRelevance: classifyValue(contribution).replace(/_/g, ' '),
    evidence: contribution.workItemKey || 'Manual source',
  };
}

function buildAttentionItems({ contributions, validations, reports, commitments }) {
  const items = [];
  const unvalidated = contributions.find((c) => c.validationStatus !== 'confirmed' && c.impactVerificationStatus !== 'verified');
  if (unvalidated) {
    items.push({
      type: 'confirm_contribution',
      title: 'Confirm contribution draft',
      detail: `${unvalidated.workItemKey || 'Manual work'} has captured action but still needs human context or validation.`,
      primaryAction: 'Confirm',
      secondaryAction: 'Correct',
      entityId: unvalidated.id,
      urgency: 'today',
    });
  }
  const missingCommitment = contributions.find((c) => !commitments.some((goal) => (goal.linkedDeliveryItems || []).includes(c.workItemKey)));
  if (missingCommitment) {
    items.push({
      type: 'link_commitment',
      title: 'Link existing commitment',
      detail: `I found possible PI or sprint goals for ${missingCommitment.workItemKey || 'this contribution'}.`,
      primaryAction: 'Choose commitment',
      secondaryAction: 'Ignore',
      entityId: missingCommitment.id,
      urgency: 'this_week',
    });
  }
  const needsBrief = !reports.length || reports.some((r) => r.status === 'draft');
  if (needsBrief) {
    items.push({
      type: 'manager_visibility',
      title: 'Prepare Nuru brief',
      detail: 'Summarize what changed, what is at risk, where intervention is needed, and what you enabled.',
      primaryAction: 'Preview brief',
      secondaryAction: 'Add context',
      urgency: 'this_week',
    });
  }
  if (!validations.length && contributions.length) {
    items.push({
      type: 'validation_gap',
      title: 'Validation only where material',
      detail: 'No stakeholder validation exists yet. Ask only when the outcome will appear in manager or calibration material.',
      primaryAction: 'Draft prompt',
      secondaryAction: 'Not needed',
      urgency: 'when_material',
    });
  }
  return items.slice(0, 4);
}

function portfolioMetrics(contributions) {
  const byProject = new Map();
  for (const c of contributions) {
    const key = String(c.workItemKey || 'PORTFOLIO').split('-')[0] || 'PORTFOLIO';
    const row = byProject.get(key) || {
      projectKey: key,
      sprintPredictability: 0,
      blockerAge: 0,
      dependencyAge: 0,
      decisionDelay: 0,
      backlogReadiness: 0,
      releaseConfidence: 0,
      governanceAdoption: 0,
      squadMaturity: 0,
      riskConcentration: 0,
      contributionCount: 0,
    };
    row.contributionCount += 1;
    const valueType = classifyValue(c);
    if (valueType === 'value_protection') row.riskConcentration += 1;
    row.sprintPredictability = Math.min(92, 62 + row.contributionCount * 6);
    row.backlogReadiness = Math.min(90, 55 + row.contributionCount * 7);
    row.releaseConfidence = Math.min(88, 58 + row.contributionCount * 5);
    row.governanceAdoption = Math.min(95, 50 + row.contributionCount * 8);
    row.squadMaturity = Math.min(90, 54 + row.contributionCount * 6);
    row.blockerAge = Math.max(1, 12 - row.riskConcentration * 2);
    row.dependencyAge = Math.max(1, 10 - row.contributionCount);
    row.decisionDelay = Math.max(0, 7 - row.contributionCount);
    byProject.set(key, row);
  }
  return Array.from(byProject.values()).slice(0, 6);
}

function valueStreams(contributions) {
  const streams = {
    value_generation: [],
    value_protection: [],
    capability_multiplication: [],
  };
  for (const c of contributions) {
    streams[classifyValue(c)].push({
      workItemKey: c.workItemKey || 'Manual',
      action: c.individualActionStatement || c.teamStatement || 'Contribution needs context',
      result: c.impactStatement || 'Result needs confirmation',
    });
  }
  return streams;
}

function managerBrief(contributions, attentionItems) {
  const top = contributions[0] ? structuredContribution(contributions[0]) : null;
  return {
    audience: 'Nuru',
    purpose: 'Give Nuru decision-ready evidence to understand, support, and defend delivery impact.',
    whatChanged: top ? top.result : 'No material delivery change captured yet.',
    whatIsAtRisk: attentionItems.find((i) => /risk|validation|commitment/.test(i.type))?.detail || 'No urgent evidence risk detected.',
    decisionRequired: attentionItems.find((i) => i.type === 'manager_visibility') ? 'Review brief and decide whether escalation is needed.' : 'No manager decision required now.',
    whatIEnabled: top ? top.myAction : 'No confirmed contribution yet.',
    missingEvidence: attentionItems.filter((i) => /validation|commitment|confirm/.test(i.type)).map((i) => i.title),
  };
}

function agentActivityRows({ contributions, commitments, reports }) {
  return [
    { agent: 'Delivery Observer', action: 'Scanned delivery records', detail: `${contributions.length} contribution candidates available`, status: 'complete' },
    { agent: 'Goal Linkage', action: 'Matched source commitments', detail: `${commitments.length} Jira or planning commitments suggested`, status: commitments.length ? 'needs_choice' : 'watching' },
    { agent: 'Portfolio Intelligence', action: 'Grouped portfolio signals', detail: 'Classified delivery work into value streams and risk signals', status: 'complete' },
    { agent: 'Manager Brief', action: 'Prepared next brief purpose', detail: reports.length ? 'Existing report status summarized' : 'Next Nuru brief is ready to preview', status: 'drafted' },
    { agent: 'Career Evidence', action: 'Preserved evidence quietly', detail: 'Evidence remains a background output, not a separate user workflow', status: 'complete' },
  ];
}

export async function buildEvidenceOsCockpit(identity) {
  const store = await readEvidenceOsStore();
  const contributions = store.contributions.filter((c) => c.organizationId === identity.orgId);
  const validationRequests = store.validationRequests.filter((v) => v.organizationId === identity.orgId);
  const reports = store.reportSnapshots.filter((r) => r.organizationId === identity.orgId);
  const detectedCommitments = await detectLinkedCommitments(identity);
  const linkedCommitments = store.linkedCommitments.filter((c) => c.organizationId === identity.orgId);
  const commitments = linkedCommitments.length ? linkedCommitments : detectedCommitments;
  const attentionItems = buildAttentionItems({ contributions, validations: validationRequests, reports, commitments });
  return {
    generatedAt: evidenceOsNow(),
    northStar: 'Save time, intervene earlier, and build verified impact evidence in the background.',
    attentionItems,
    commitments,
    portfolioMetrics: portfolioMetrics(contributions),
    valueStreams: valueStreams(contributions),
    managerBrief: managerBrief(contributions, attentionItems),
    structuredContributions: contributions.slice(0, 8).map((c) => ({ id: c.id, workItemKey: c.workItemKey, ...structuredContribution(c) })),
    validationPrompts: validationRequests.map((v) => ({
      id: v.id,
      channel: 'teams_or_email',
      title: `${v.entityType} confirmation`,
      humanPrompt: v.humanPrompt || v.prompt,
      whyNeeded: v.whyNeeded || 'Material outcome needs an observed confirmation before manager or calibration use.',
      status: v.status,
    })),
    reportStatus: reports.slice(-3).map((r) => ({
      id: r.id,
      audience: r.audience,
      purpose: r.purpose || 'Decision-ready impact brief',
      status: r.status,
      lastSentDate: r.lastSentDate || '',
      missingEvidence: r.explicitGaps || [],
    })),
    agentActivity: agentActivityRows({ contributions, commitments, reports }),
  };
}

export async function recordAgentActivity(identity, activity = {}) {
  return mutateEvidenceOsStore((store) => {
    const item = {
      id: newEvidenceOsId('agent'),
      organizationId: identity.orgId,
      agent: String(activity.agent || 'Evidence OS Agent'),
      action: String(activity.action || 'Detected delivery signal'),
      detail: String(activity.detail || ''),
      status: String(activity.status || 'logged'),
      createdAt: evidenceOsNow(),
    };
    store.agentActivity.push(item);
    return item;
  });
}
