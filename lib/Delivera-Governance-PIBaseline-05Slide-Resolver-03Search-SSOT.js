/**
 * SSOT: Jira epic search for slide-resolved commitments.
 */
import {
  EPIC_DELIM,
  EPIC_PLAYBOOKS,
  findPlaybookEntry,
  normalizeEpicTitle,
  playbookForProjects,
  quarterKey,
  squadKey,
} from './Delivera-Governance-PIBaseline-05Slide-Playbook-01SSOT.js';
import { fetchBoardEpicsForProjects } from './Delivera-Jira-Board-Epics-01SSOT.js';
import {
  getIssueByKey,
  searchIssuesJql,
  searchProjectBySummary,
} from './Delivera-Jira-Search-01SSOT.js';
import { PARTIAL_EPIC_RE } from './Delivera-Governance-EpicHygiene-01Score-SSOT.js';

const ISSUE_KEY_RE = /\b[A-Z]{2,10}-\d+\b/g;

function expandSearchAliases(term = '') {
  const t = String(term || '').toLowerCase().trim();
  if (!t) return [];
  const out = new Set([t]);
  if (t.includes('ehod') || t.includes('e-hod')) {
    out.add('ehod');
    out.add('e-hod');
    out.add('e hod');
  }
  if (t.includes('cvm')) {
    out.add('cvm');
    out.add('channel productivity');
  }
  if (t.includes('evod')) out.add('evod');
  if (t.includes('vop')) out.add('vop');
  if (t.includes('enhancement')) out.add('enhancement');
  return [...out];
}

function collectSearchTerms(resolved = [], playbook = []) {
  const terms = new Set();
  const issueKeys = new Set();

  for (const entry of playbook) {
    for (const t of (entry.duplicateSearchTerms || [])) {
      for (const alias of expandSearchAliases(t)) terms.add(alias);
    }
    for (const t of (entry.duplicatePrograms || [])) terms.add(String(t).toLowerCase());
    const noteKeys = String(entry.notes || '').match(ISSUE_KEY_RE);
    if (noteKeys) for (const k of noteKeys) issueKeys.add(k.toUpperCase());
    const termKeys = String((entry.duplicateSearchTerms || []).join(' ')).match(ISSUE_KEY_RE);
    if (termKeys) for (const k of termKeys) issueKeys.add(k.toUpperCase());
  }

  for (const row of resolved) {
    const entry = playbook.find((p) => normalizeEpicTitle(p.epicTitle) === normalizeEpicTitle(row.suggestedEpicTitle))
      || findPlaybookEntry(row, playbook);
    for (const t of (entry?.duplicateSearchTerms || [])) {
      for (const alias of expandSearchAliases(t)) terms.add(alias);
    }
    for (const t of (entry?.duplicatePrograms || [])) terms.add(String(t).toLowerCase());
    const cap = String(row.suggestedEpicTitle || '').split(EPIC_DELIM).pop() || '';
    if (cap) {
      for (const alias of expandSearchAliases(cap.slice(0, 40))) terms.add(alias);
    }
    const bullet = String(row.bullet || row.title || '').trim();
    if (bullet.length >= 4) {
      const words = bullet.split(/\s+/).filter((w) => w.length > 3).slice(0, 4).join(' ');
      if (words) for (const alias of expandSearchAliases(words)) terms.add(alias);
    }
  }

  return {
    terms: [...terms].filter((t) => t.length >= 3).slice(0, 20),
    issueKeys: [...issueKeys].slice(0, 8),
  };
}

function isLikelyEpicSummary(summary = '') {
  const t = String(summary || '').trim();
  return PARTIAL_EPIC_RE.test(t) || /^(dms|nba|evod|vop)\s*>/i.test(t);
}

export async function searchJiraEpicsForResolved(version3Client, resolved = [], projects = [], options = {}) {
  if (!version3Client || !resolved.length) return [];
  const pks = [...new Set(projects.map((p) => String(p || '').trim().toUpperCase()).filter(Boolean))];
  const quarter = options.quarter || quarterKey(resolved[0]?.suggestedEpicTitle || '') || 'FY27 Q2';
  const found = [];
  const seen = new Set();

  const pushIssue = (issue) => {
    const key = String(issue?.key || issue?.issueKey || '').toUpperCase();
    if (!key || seen.has(key)) return;
    const summary = issue?.fields?.summary || issue?.title || issue?.summary || '';
    if (summary && !isLikelyEpicSummary(summary) && !options.includeStories) return;
    seen.add(key);
    found.push({
      issueKey: key,
      title: summary || key,
      summary: summary || key,
      status: issue?.fields?.status?.name || issue?.status || '',
    });
  };

  const qKey = quarterKey(resolved[0]?.suggestedEpicTitle || quarter) || 'FY27 Q2';
  const squad = squadKey(projects);
  const playbook = options.playbook || EPIC_PLAYBOOKS[`${squad}:${qKey}`] || playbookForProjects(projects, qKey);
  const { terms: playbookTerms, issueKeys } = collectSearchTerms(resolved, playbook);

  for (const e of await fetchBoardEpicsForProjects(pks, { quarter, financialYearOnly: true })) {
    pushIssue({ issueKey: e.issueKey, title: e.title, summary: e.summary });
  }

  for (const key of issueKeys) {
    const issue = await getIssueByKey(version3Client, key, ['summary', 'status']);
    if (issue) pushIssue(issue);
  }

  for (const term of playbookTerms.slice(0, 10)) {
    for (const pk of pks.slice(0, 3)) {
      const issues = await searchProjectBySummary(version3Client, pk, term, { maxResults: 8 });
      for (const issue of issues) pushIssue(issue);
    }
    if (options.portfolioWide !== false) {
      const { issues } = await searchIssuesJql(version3Client, {
        jql: `summary ~ "${String(term).replace(/["\\]/g, '\\$&').slice(0, 40)}" ORDER BY updated DESC`,
        maxResults: 8,
        fields: ['summary', 'status'],
      });
      for (const issue of issues) {
        if (isLikelyEpicSummary(issue?.fields?.summary)) pushIssue(issue);
      }
    }
  }

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
      for (const pk of pks.slice(0, 3)) {
        const issues = await searchProjectBySummary(version3Client, pk, capWords, { maxResults: 8 });
        for (const issue of issues) pushIssue(issue);
      }
    }
  }

  return found;
}
