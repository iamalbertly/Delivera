/**
 * SSOT: Jira epic search for slide-resolved commitments.
 */
import {
  EPIC_DELIM,
  EPIC_PLAYBOOKS,
  normalizeEpicTitle,
  quarterKey,
  squadKey,
} from './Delivera-Governance-PIBaseline-05Slide-Playbook-01SSOT.js';

function collectSearchTerms(resolved = [], playbook = []) {
  const terms = new Set();
  for (const row of resolved) {
    const entry = playbook.find((p) => normalizeEpicTitle(p.epicTitle) === normalizeEpicTitle(row.suggestedEpicTitle));
    for (const t of (entry?.duplicateSearchTerms || [])) terms.add(String(t).toLowerCase());
    for (const t of (entry?.duplicatePrograms || [])) terms.add(String(t).toLowerCase());
    const cap = String(row.suggestedEpicTitle || '').split(EPIC_DELIM).pop() || '';
    if (cap) terms.add(cap.toLowerCase().slice(0, 40));
  }
  return [...terms].filter(Boolean).slice(0, 16);
}

export async function searchJiraEpicsForResolved(version3Client, resolved = [], projects = [], options = {}) {
  if (!version3Client || !resolved.length) return [];
  const pks = [...new Set(projects.map((p) => String(p || '').trim().toUpperCase()).filter(Boolean))];
  const portfolioWide = options.portfolioWide !== false;
  const found = [];
  const seen = new Set();

  const pushIssue = (issue) => {
    const key = String(issue?.key || '').toUpperCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    found.push({
      issueKey: key,
      title: issue?.fields?.summary || key,
      summary: issue?.fields?.summary || key,
      status: issue?.fields?.status?.name || '',
    });
  };

  for (const row of resolved.slice(0, 12)) {
    const title = String(row.suggestedEpicTitle || '').trim();
    const bullet = String(row.bullet || row.title || '').trim();
    const searchPhrases = [title.split(EPIC_DELIM).pop() || title];
    if (bullet.length >= 6) {
      const words = bullet.split(/\s+/).filter((w) => w.length > 3).slice(0, 5).join(' ');
      if (words.length >= 6) searchPhrases.push(words);
    }
    for (const phrase of searchPhrases) {
      const capWords = String(phrase || '').trim();
      if (!capWords) continue;
      const escaped = capWords.replace(/["\\]/g, '\\$&').slice(0, 60);
      for (const pk of pks.slice(0, 3)) {
        try {
          const jql = `project = ${pk} AND issuetype = Epic AND summary ~ "${escaped}" ORDER BY updated DESC`;
          const res = await version3Client.issueSearch.searchForIssuesUsingJql({
            jql,
            maxResults: 8,
            fields: ['summary', 'status'],
          });
          for (const issue of res?.issues || []) pushIssue(issue);
        } catch (_) { /* per-project */ }
      }
    }
  }

  if (portfolioWide) {
    const qKey = quarterKey(resolved[0]?.suggestedEpicTitle || '') || 'FY27 Q2';
    const squad = squadKey(projects);
    const playbook = EPIC_PLAYBOOKS[`${squad}:${qKey}`] || [];
    const terms = collectSearchTerms(resolved, playbook);
    for (const term of terms.slice(0, 8)) {
      const escaped = String(term).replace(/["\\]/g, '\\$&').slice(0, 40);
      if (escaped.length < 3) continue;
      try {
        const jql = `issuetype = Epic AND summary ~ "${escaped}" ORDER BY updated DESC`;
        const res = await version3Client.issueSearch.searchForIssuesUsingJql({
          jql,
          maxResults: 8,
          fields: ['summary', 'status'],
        });
        for (const issue of res?.issues || []) pushIssue(issue);
      } catch (_) { /* portfolio-wide optional */ }
    }
  }

  return found;
}
