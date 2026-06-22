import { createAgileClient, createVersion3Client } from './jiraClients.js';
import { assembleGovernanceBrief } from './Delivera-Governance-Brief-03Assemble-Service.js';
import { buildEvidencePack } from './Delivera-Governance-Evidence-01Pack-Builder.js';
import { getLatestPIBaseline } from './Delivera-Governance-PIBaseline-01Store-IO.js';
import { resolveDecisionLane, recommendedActionFor } from './Delivera-Governance-DecisionOwner-01Map-SSOT.js';
import { upsertInterventionCase, patchInterventionCase } from './Delivera-Governance-InterventionCase-02Store-IO.js';
import { upsertCaseAction, patchCaseAction } from './Delivera-Governance-ActionRegister-01Store-IO.js';
import { recordImprovementEvent } from './Delivera-Improvement-Events-01Store-IO.js';

let clients = null;

function getClients() {
  if (!clients) {
    clients = {
      agile: createAgileClient(),
      v3: createVersion3Client(),
    };
  }
  return clients;
}

export function createAgentToolsRegistry() {
  return {
    jira: {
      async getIssue(issueKey) {
        const { v3 } = getClients();
        const key = String(issueKey || '').trim().toUpperCase();
        if (!key) throw new Error('issueKey required');
        const result = await v3.issueSearch.searchForIssuesUsingJqlPost({
          jql: `issueKey = ${key}`,
          fields: ['summary', 'status', 'assignee', 'reporter', 'updated', 'created', 'parent', 'labels', 'components'],
          maxResults: 1,
        });
        return result?.issues?.[0] || null;
      },
      async getIssueChangelog(issueKey) {
        const issue = await this.getIssue(issueKey);
        return issue?.changelog || [];
      },
      async getIssueComments(issueKey) {
        const { v3 } = getClients();
        return v3.issueComments.getComments({ issueIdOrKey: issueKey });
      },
      async getEpicChildren(epicKey) {
        const { v3 } = getClients();
        return v3.issueSearch.searchForIssuesUsingJqlPost({
          jql: `"Epic Link" = ${String(epicKey || '').toUpperCase()} ORDER BY updated DESC`,
          fields: ['summary', 'status', 'assignee', 'updated'],
          maxResults: 50,
        });
      },
      async postComment(issueKey, body) {
        const { v3 } = getClients();
        return v3.issueComments.addComment({ issueIdOrKey: issueKey, body });
      },
    },
    governance: {
      getBrief: assembleGovernanceBrief,
      getEvidence: buildEvidencePack,
      getPIBaseline: getLatestPIBaseline,
      comparePIBaseline: async () => ({ status: 'not-wired-in-stage4' }),
      getPOReadiness: async () => ({ status: 'not-wired-in-stage4' }),
      resolveDecisionOwner: (risk) => ({ lane: resolveDecisionLane(risk), action: recommendedActionFor(risk) }),
      createInterventionCase: upsertInterventionCase,
      updateInterventionCase: patchInterventionCase,
      scheduleCheckpoint: upsertCaseAction,
      verifyCheckpoint: patchCaseAction,
      recordFeedback: recordImprovementEvent,
    },
  };
}

