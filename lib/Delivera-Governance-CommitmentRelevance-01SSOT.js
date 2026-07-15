/**
 * SSOT: Deterministic relevance tiers for PI commitment board-gaps.
 * Does not invent counts — classifies existing not-planned / unsupported rows only.
 */
import { scoreEpicName } from './Delivera-Governance-EpicHygiene-01Score-SSOT.js';

export const RELEVANCE_TIERS = Object.freeze({
  ACTIVE_GAP: 'active-gap',
  STALE_CANDIDATE: 'stale-candidate',
  HYGIENE_SUSPECT: 'hygiene-suspect',
});

export const RELEVANCE_LABELS = Object.freeze({
  [RELEVANCE_TIERS.ACTIVE_GAP]: 'Active PI gap',
  [RELEVANCE_TIERS.STALE_CANDIDATE]: 'Possibly stale — verify before planning',
  [RELEVANCE_TIERS.HYGIENE_SUSPECT]: 'Naming/hygiene check',
});

/** Idle days before a zero-story commitment is treated as stale-candidate. */
export const STALE_IDLE_DAYS = 45;

function daysSince(iso = '') {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

function isBoardGapRow(row = {}) {
  return row.lifecycleStage === 'not-planned'
    || row.verdict === 'not-planned'
    || row.governanceState === 'unsupported'
    || row.governanceState === 'done-unproven';
}

/**
 * Classify one commitment reality / compare row.
 * @returns {{ tier: string, label: string, idleDays: number|null, namingScore: number }}
 */
export function classifyCommitmentRelevance(row = {}, { idleDaysThreshold = STALE_IDLE_DAYS } = {}) {
  const title = row.title || row.baselinePromise || '';
  const namingScore = scoreEpicName(title);
  const updated = row.updated || row.epicActivity?.lastSprintStart || row.epicActivity?.firstActiveSprintStart || '';
  const created = row.created || '';
  const idleDays = daysSince(updated) ?? daysSince(created);
  const storyCount = Number(row.epicActivity?.storyCount ?? row.storyCount ?? 0) || 0;
  const lifecycle = String(row.epicActivity?.lifecycle || row.lifecycleStage || '').toLowerCase();

  if (namingScore < 40 && isBoardGapRow(row)) {
    return {
      tier: RELEVANCE_TIERS.HYGIENE_SUSPECT,
      label: RELEVANCE_LABELS[RELEVANCE_TIERS.HYGIENE_SUSPECT],
      idleDays,
      namingScore,
    };
  }

  const looksIdle = storyCount === 0
    && (lifecycle === 'not-started' || lifecycle === 'jira-only' || lifecycle === 'unknown' || !lifecycle
      || row.verdict === 'not-planned' || row.lifecycleStage === 'not-planned')
    && idleDays != null
    && idleDays >= idleDaysThreshold;

  if (looksIdle) {
    return {
      tier: RELEVANCE_TIERS.STALE_CANDIDATE,
      label: RELEVANCE_LABELS[RELEVANCE_TIERS.STALE_CANDIDATE],
      idleDays,
      namingScore,
    };
  }

  return {
    tier: RELEVANCE_TIERS.ACTIVE_GAP,
    label: RELEVANCE_LABELS[RELEVANCE_TIERS.ACTIVE_GAP],
    idleDays,
    namingScore,
  };
}

/**
 * Build full evidence rows for a claim count — every key listed with Jira URL when host known.
 */
export function buildAttentionEvidenceRows({
  commitmentRows = [],
  brief = {},
  resolveIssueUrl = null,
  focusProjectKey = '',
} = {}) {
  const pk = String(focusProjectKey || '').toUpperCase();
  const rows = (commitmentRows || []).filter((r) => {
    if (!isBoardGapRow(r)) return false;
    if (!pk) return true;
    const rowPk = String(r.projectKey || r.squad || '').toUpperCase()
      || String(r.issueKey || '').split('-')[0];
    return !rowPk || rowPk === pk || String(r.projectKey || '').toUpperCase() === pk;
  });

  const evidence = rows.map((row) => {
    const issueKey = String(row.issueKey || '').trim().toUpperCase();
    const relevance = classifyCommitmentRelevance(row);
    const issueUrl = (typeof resolveIssueUrl === 'function'
      ? resolveIssueUrl(issueKey)
      : row.issueUrl)
      || row.issueUrl
      || '';
    return {
      issueKey,
      title: row.title || row.baselinePromise || issueKey,
      verdict: row.verdict || '',
      lifecycleStage: row.lifecycleStage || '',
      activityLabel: row.epicActivity?.activityLabel || row.statusNow || '',
      storyCount: Number(row.epicActivity?.storyCount ?? 0) || 0,
      created: row.created || '',
      updated: row.updated || '',
      relevanceTier: relevance.tier,
      relevanceLabel: relevance.label,
      idleDays: relevance.idleDays,
      namingScore: relevance.namingScore,
      issueUrl,
      projectKey: row.projectKey || row.squad || '',
    };
  });

  const active = evidence.filter((e) => e.relevanceTier === RELEVANCE_TIERS.ACTIVE_GAP);
  const quarantine = evidence.filter((e) => e.relevanceTier !== RELEVANCE_TIERS.ACTIVE_GAP);

  return {
    rows: evidence,
    active,
    quarantine,
    total: evidence.length,
    activeCount: active.length,
    quarantineCount: quarantine.length,
  };
}

/** Clipboard / JQL pack for PO conversations. */
export function buildEvidenceCopyPack(evidence = {}) {
  const rows = evidence.rows || evidence.active || [];
  if (!rows.length) return { text: '', jql: '', keys: [] };
  const keys = rows.map((r) => r.issueKey).filter(Boolean);
  const lines = rows.map((r) => {
    const link = r.issueUrl || r.issueKey;
    const tier = r.relevanceLabel || r.relevanceTier || '';
    return `${r.issueKey}: ${r.title}${tier ? ` [${tier}]` : ''} — ${link}`;
  });
  const jql = keys.length ? `key in (${keys.join(', ')})` : '';
  return {
    text: lines.join('\n'),
    jql,
    keys,
  };
}
