/**
 * SSOT: Feedback triage — route feedback to sub-agents (no LLM).
 */
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_FILE = join(__dirname, '..', 'data', 'Delivera-Governance-Narration-Knowledge.jsonl');
const METRICS_FILE = join(__dirname, '..', 'data', 'Delivera-Governance-Adoption-Metrics.jsonl');
const JOBS_FILE = join(__dirname, '..', 'data', 'Delivera-Governance-Jobs.jsonl');

export const FEEDBACK_AGENTS = Object.freeze({
  phrase: 'Phrase Agent',
  rule: 'Rule Agent',
  proof: 'Proof Agent',
  data: 'Data Agent',
  ux: 'UX Agent',
  pi: 'PI Agent',
});

export const DISMISS_REASONS = Object.freeze([
  'irrelevant',
  'handled',
  'wrong-owner',
  'bad-data',
]);

async function readJsonl(path) {
  try {
    const raw = await readFile(path, 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Classify a feedback/dismiss event to a sub-agent.
 */
export function classifyFeedbackToAgent(entry = {}) {
  const source = String(entry.source || entry.reason || '').toLowerCase();
  const note = String(entry.note || entry.phrase || '').toLowerCase();
  if (/word|phrase|copy|wording|narrat/.test(source + note)) return 'phrase';
  if (/dismiss|threshold|rule|repeat/.test(source + note)) return 'rule';
  if (/evidence|proof|claim|changelog/.test(source + note)) return 'proof';
  if (/board|mapping|jira|field|sprint|setup/.test(source + note)) return 'data';
  if (/scroll|layout|ui|space|click/.test(source + note)) return 'ux';
  if (/baseline|pi|epic|commit/.test(source + note)) return 'pi';
  if (entry.dismissReason === 'wrong-owner') return 'rule';
  if (entry.dismissReason === 'bad-data') return 'data';
  return 'phrase';
}

/**
 * Build improvement lab summary from stores.
 */
export async function buildFeedbackTriageSummary({ project = '' } = {}) {
  const patterns = await readJsonl(KNOWLEDGE_FILE);
  const metrics = await readJsonl(METRICS_FILE);
  const jobs = await readJsonl(JOBS_FILE);

  const pk = String(project || '').trim().toUpperCase();
  const scopedPatterns = patterns.filter((p) => !pk || p.project === '*' || p.project === pk);
  const recentDismiss = jobs.filter((j) => j.dismissReason).slice(-20);

  const buckets = {
    phrase: { agent: FEEDBACK_AGENTS.phrase, count: 0, items: [], label: 'accepted wording patterns' },
    rule: { agent: FEEDBACK_AGENTS.rule, count: 0, items: [], label: 'threshold proposals' },
    proof: { agent: FEEDBACK_AGENTS.proof, count: 0, items: [], label: 'claims need stronger evidence' },
    data: { agent: FEEDBACK_AGENTS.data, count: 0, items: [], label: 'board mapping issues' },
    ux: { agent: FEEDBACK_AGENTS.ux, count: 0, items: [], label: 'layout friction signals' },
    pi: { agent: FEEDBACK_AGENTS.pi, count: 0, items: [], label: 'baseline classification' },
  };

  for (const p of scopedPatterns.slice(-10)) {
    buckets.phrase.count += 1;
    buckets.phrase.items.push({
      id: `phrase-${p.ts}`,
      summary: String(p.phrase || '').slice(0, 120),
      change: 'Template prefers this phrasing',
      why: `Accepted from ${p.source || 'user'}`,
    });
  }

  const dismissByType = {};
  for (const d of recentDismiss) {
    const agent = classifyFeedbackToAgent(d);
    dismissByType[agent] = (dismissByType[agent] || 0) + 1;
  }
  if (dismissByType.rule >= 2) {
    buckets.rule.count = dismissByType.rule;
    buckets.rule.items.push({
      id: 'rule-threshold',
      summary: `${dismissByType.rule} repeated dismissals — review stale threshold`,
      change: 'Consider raising staleInProgressHours',
      why: 'Repeated dismissals on same risk type',
    });
  }

  const uxMetrics = metrics.filter((m) => m.metric === 'reportingMinutesSaved');
  if (uxMetrics.length) {
    buckets.ux.count = uxMetrics.length;
    buckets.ux.items.push({
      id: 'ux-minutes',
      summary: `${uxMetrics.length} reporting-time signals recorded`,
      change: 'Keep command surface above fold',
      why: 'User time-saved feedback',
    });
  }

  const total = Object.values(buckets).reduce((a, b) => a + b.count, 0);
  const agents = Object.values(buckets).filter((b) => b.count > 0);

  return {
    total,
    agents,
    lastImprovements: [
      scopedPatterns.length ? `${scopedPatterns.length} phrase patterns` : null,
      dismissByType.rule ? `${dismissByType.rule} owner-lane dismissals` : null,
      dismissByType.data ? `${dismissByType.data} data-quality notes` : null,
    ].filter(Boolean),
  };
}
