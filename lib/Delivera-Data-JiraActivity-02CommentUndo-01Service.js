import { createVersion3Client } from './jiraClients.js';

function extractJiraErrorMessage(err) {
  const data = err?.response?.data || err?.cause?.response?.data;
  if (data?.errorMessages?.[0]) return String(data.errorMessages[0]);
  return err?.message || 'Failed to undo comment';
}

export async function undoJiraComment(version3Client, issueKey, commentId) {
  const key = String(issueKey || '').trim();
  const id = String(commentId || '').trim();
  if (!key || !id) {
    const error = new Error('Missing issue key or comment id');
    error.httpStatus = 400;
    error.code = 'MISSING_UNDO_KEYS';
    throw error;
  }
  const client = version3Client || createVersion3Client();
  try {
    if (client?.issueComments?.deleteComment) {
      await client.issueComments.deleteComment({ issueIdOrKey: key, id });
      return { ok: true };
    }
    if (typeof client?.request === 'function') {
      await client.request({
        method: 'DELETE',
        url: `/rest/api/3/issue/${encodeURIComponent(key)}/comment/${encodeURIComponent(id)}`,
      });
      return { ok: true };
    }
    const error = new Error('Jira client cannot delete comments');
    error.httpStatus = 500;
    error.code = 'JIRA_CLIENT_UNAVAILABLE';
    throw error;
  } catch (err) {
    const error = new Error(extractJiraErrorMessage(err));
    error.httpStatus = err?.response?.status || err?.status || 500;
    error.code = 'JIRA_UNDO_FAILED';
    throw error;
  }
}
