import { riskTypeLabel } from './Delivera-Governance-Grammar-01Rules-SSOT.js';

export async function collectCaseEvidence({ caseRow = {}, risk = {}, toolRegistry = null } = {}) {
  const facts = [];
  const unknowns = [];
  const issueKeys = caseRow.issueKeys?.length ? caseRow.issueKeys : [risk.issueKey].filter(Boolean);

  if (!issueKeys.length) {
    unknowns.push({ key: 'issue-key', label: 'No Jira issue key available', severity: 'high' });
  }

  for (const issueKey of issueKeys.slice(0, 12)) {
    facts.push({ key: `issue:${issueKey}`, label: `Jira issue ${issueKey}`, value: issueKey, source: 'jira-key' });
    if (risk.status) facts.push({ key: `status:${issueKey}`, label: 'Current status', value: risk.status, source: 'brief-risk' });
    if (risk.ageHours != null) facts.push({ key: `age:${issueKey}`, label: 'Age in current risk state', value: `${Math.round(Number(risk.ageHours) || 0)}h`, source: 'brief-risk' });
    if (risk.riskType) facts.push({ key: `risk:${issueKey}`, label: 'Risk type', value: riskTypeLabel(risk.riskType), source: 'risk-grammar' });

    if (toolRegistry?.jira?.getIssue) {
      try {
        const issue = await toolRegistry.jira.getIssue(issueKey);
        if (issue?.fields?.summary) facts.push({ key: `summary:${issueKey}`, label: 'Issue summary', value: issue.fields.summary, source: 'jira-live' });
        if (issue?.fields?.updated) facts.push({ key: `updated:${issueKey}`, label: 'Last Jira update', value: issue.fields.updated, source: 'jira-live' });
      } catch (err) {
        unknowns.push({ key: `jira-fetch:${issueKey}`, label: `Could not read ${issueKey}`, severity: 'medium', reason: err.message, partial: true });
      }
    }
  }

  if (!risk.issueKey && !caseRow.issueKeys?.length) unknowns.push({ key: 'trigger', label: 'Trigger issue is missing', severity: 'high' });
  if (!risk.recommendedAction) unknowns.push({ key: 'recommended-action', label: 'Recommended action needs confirmation', severity: 'medium' });
  if (!risk.decisionNeededFrom) unknowns.push({ key: 'decision-owner', label: 'Decision owner is not resolved', severity: 'high' });
  if (!risk.targetDate && !risk.dueAt) unknowns.push({ key: 'target-date', label: 'No reliable target date', severity: 'medium' });

  return {
    facts,
    unknowns,
    partial: unknowns.some((item) => item.partial),
    collectedAt: new Date().toISOString(),
  };
}

