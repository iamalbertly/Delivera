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
const FEEDBACK_SUBMISSIONS_FILE = join(__dirname, '..', 'data', 'Delivera-Feedback-UserInput-Submission-Log.jsonl');
import { readImprovementEvents } from './Delivera-Improvement-Events-01Store-IO.js';

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
  const improvementEvents = await readImprovementEvents({ project, limit: 50, hours: 168 });
  const userSubmissions = (await readJsonl(FEEDBACK_SUBMISSIONS_FILE)).slice(-20).reverse().slice(0, 8);

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
    const bucket = buckets[agent];
    if (bucket && bucket.items.length < 3) {
      bucket.count += 1;
      bucket.items.push({
        id: `dismiss-${d.id || d.ts || agent}`,
        summary: String(d.summary || d.dismissReason || d.type || 'Dismissed item').slice(0, 120),
        change: agent === 'data' ? 'Review board mapping or owner lane' : agent === 'proof' ? 'Strengthen evidence before send' : agent === 'pi' ? 'Confirm PI baseline classification' : 'Adjust rule or threshold',
        why: `Dismiss: ${d.dismissReason || d.source || 'user'}`,
      });
    }
  }
  if (dismissByType.rule >= 2 && !buckets.rule.items.some((i) => i.id === 'rule-threshold')) {
    buckets.rule.count = Math.max(buckets.rule.count, dismissByType.rule);
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

  for (const ev of improvementEvents.slice(-10)) {
    const agent = classifyFeedbackToAgent(ev);
    const bucket = buckets[agent];
    if (!bucket || bucket.items.length >= 3) continue;
    bucket.count += 1;
    bucket.items.push({
      id: `improve-${ev.id || ev.createdAt}`,
      summary: String(ev.payload?.phrase || ev.payload?.summary || ev.eventType || '').slice(0, 120),
      change: agent === 'phrase' ? 'Improve accepted phrasing' : bucket.label,
      why: `${ev.eventType} on ${ev.surface}`,
    });
  }

  const total = Object.values(buckets).reduce((a, b) => a + b.count, 0);
  const agents = Object.values(buckets).filter((b) => b.count > 0);

  const recentUserFeedback = userSubmissions.map((row, idx) => {
    const ctx = row.context && typeof row.context === 'object' ? row.context : {};
    return {
      id: `user-feedback-${row.ts || idx}`,
      message: String(row.message || '').slice(0, 160),
      category: row.category || '',
      page: ctx.page || '',
      squad: ctx.squad || '',
      issueKey: ctx.issueKey || '',
      ts: row.ts || null,
    };
  });

  return {
    total,
    agents,
    recentUserFeedback,
    lastImprovements: [
      scopedPatterns.length ? `${scopedPatterns.length} phrase patterns` : null,
      improvementEvents.length ? `${improvementEvents.length} improvement events` : null,
      dismissByType.rule ? `${dismissByType.rule} owner-lane dismissals` : null,
      dismissByType.data ? `${dismissByType.data} data-quality notes` : null,
    ].filter(Boolean),
  };
}
