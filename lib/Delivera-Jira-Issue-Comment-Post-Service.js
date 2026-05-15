/**
 * SSOT for posting plain-text comments to Jira issues (ADF conversion + client dispatch).
 */
import { buildAdfDocFromTextWithMentions } from './Delivera-Jira-Comment-Adf-01Mention-Build-SSOT.js';

export function toAdfBody(text) {
  const raw = String(text || '').trim();
  const paragraphs = raw.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);
  const content = paragraphs.map((para) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: para }],
  }));
  return {
    type: 'doc',
    version: 1,
    content: content.length ? content : [{ type: 'paragraph', content: [{ type: 'text', text: raw || ' ' }] }],
  };
}

function extractJiraErrorMessage(err) {
  const data = err?.response?.data || err?.cause?.response?.data;
  if (data?.errorMessages?.[0]) return String(data.errorMessages[0]);
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors).find(Boolean);
    if (first) return String(first);
  }
  return err?.message || 'Failed to post comment';
}

function extractJiraHttpStatus(err) {
  const status = err?.response?.status || err?.status || err?.cause?.response?.status;
  if (Number.isFinite(status) && status >= 400 && status < 600) return status;
  return 500;
}

/**
 * @param {import('jira.js').Version3Client} version3Client
 * @param {string} issueKey
 * @param {string} commentBody
 */
export async function postIssueComment(version3Client, issueKey, commentBody) {
  const key = String(issueKey || '').trim();
  const bodyText = String(commentBody || '').trim();
  if (!key) {
    const error = new Error('Missing issue key');
    error.httpStatus = 400;
    error.code = 'MISSING_ISSUE_KEY';
    throw error;
  }
  if (!bodyText) {
    const error = new Error('Missing comment body');
    error.httpStatus = 400;
    error.code = 'MISSING_COMMENT_BODY';
    throw error;
  }

  const adfBody = roster.length
    ? buildAdfDocFromTextWithMentions(bodyText, roster)
    : toAdfBody(bodyText);

  try {
    if (version3Client?.issueComments?.addComment) {
      return await version3Client.issueComments.addComment({
        issueIdOrKey: key,
        comment: adfBody,
      });
    }
    if (typeof version3Client?.request === 'function') {
      return await version3Client.request({
        method: 'POST',
        url: `/rest/api/3/issue/${encodeURIComponent(key)}/comment`,
        data: { body: adfBody },
      });
    }
    const error = new Error('No Jira client method available to create comment');
    error.httpStatus = 500;
    error.code = 'JIRA_CLIENT_UNAVAILABLE';
    throw error;
  } catch (err) {
    const error = new Error(extractJiraErrorMessage(err));
    error.httpStatus = extractJiraHttpStatus(err);
    error.code = 'JIRA_COMMENT_FAILED';
    throw error;
  }
}
