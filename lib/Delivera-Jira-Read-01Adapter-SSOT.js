import { createAgileClient, createVersion3Client } from './jiraClients.js';
import { getIssueByKey } from './Delivera-Jira-Search-01SSOT.js';

export class JiraServiceAccountIdentityProvider {
  resolve() {
    return { mode: 'service-account', writeEnabled: false };
  }
}

export class JiraReadAdapter {
  constructor(identityProvider = new JiraServiceAccountIdentityProvider()) {
    this.identityProvider = identityProvider;
    this.agile = createAgileClient();
    this.v3 = createVersion3Client();
  }

  getIdentity() {
    return this.identityProvider.resolve();
  }

  async getIssue(issueKey, fields = ['summary', 'status', 'assignee', 'updated']) {
    const key = String(issueKey || '').trim().toUpperCase();
    if (!key) throw new Error('issueKey is required');
    const issue = await getIssueByKey(this.v3, key, fields);
    if (!issue) return { issues: [] };
    return { issues: [issue] };
  }
}
