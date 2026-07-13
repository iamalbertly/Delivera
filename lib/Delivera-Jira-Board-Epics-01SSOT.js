/**
 * SSOT: Agile board epic fetch for slide matching (works when JQL issuetype=Epic returns empty).
 */
import { createAgileClient } from './jiraClients.js';
import { PARTIAL_EPIC_RE } from './Delivera-Governance-EpicHygiene-01Score-SSOT.js';
import { quarterKey } from './Delivera-Governance-PIBaseline-05Slide-Playbook-01SSOT.js';

function normalizeProjects(projects = []) {
  return [...new Set(
    (Array.isArray(projects) ? projects : []).map((p) => String(p || '').trim().toUpperCase()).filter(Boolean),
  )];
}

export function epicMatchesFinancialQuarter(summary = '', quarter = '') {
  const t = String(summary || '').trim();
  if (!t || !quarter) return true;
  const qKey = quarterKey(quarter) || String(quarter).trim();
  if (!qKey) return true;
  const qShort = qKey.toUpperCase().slice(0, 7);
  if (PARTIAL_EPIC_RE.test(t)) {
    return t.toUpperCase().includes(qShort);
  }
  return t.toUpperCase().includes(qKey.toUpperCase());
}

/**
 * Fetch epics from Jira Agile boards for project keys (primary path for matcher pool).
 */
export async function fetchBoardEpicsForProjects(projects = [], options = {}) {
  const pks = normalizeProjects(projects);
  const quarter = String(options.quarter || '').trim();
  const financialYearOnly = options.financialYearOnly !== false;
  const maxPerBoard = Number(options.maxPerBoard) || 120;
  const byKey = new Map();

  let agile;
  try {
    agile = createAgileClient();
  } catch (_) {
    return [];
  }

  for (const pk of pks.slice(0, 5)) {
    try {
      const boards = await agile.board.getAllBoards({ projectKeyOrId: pk, maxResults: 3 });
      const boardIds = (boards?.values || []).map((b) => b.id).filter(Boolean);
      for (const boardId of boardIds.slice(0, 2)) {
        let startAt = 0;
        for (let page = 0; page < 4; page += 1) {
          const res = await agile.board.getEpics({
            boardId,
            startAt,
            maxResults: Math.min(50, maxPerBoard),
          });
          const batch = res?.values || [];
          for (const epic of batch) {
            const key = String(epic?.key || '').toUpperCase();
            const summary = String(epic?.summary || '').trim();
            if (!key || !summary) continue;
            if (financialYearOnly && quarter && !epicMatchesFinancialQuarter(summary, quarter)) continue;
            byKey.set(key, { issueKey: key, title: summary, summary });
          }
          if (!batch.length || batch.length < 50) break;
          startAt += batch.length;
        }
      }
    } catch (_) { /* per-project */ }
  }

  return [...byKey.values()];
}
