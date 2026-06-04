/**
 * SSOT: Narration Knowledge Store (the "senior advisor hand-back" loop).
 *
 * When the optional LLM advisor produces narration and a Scrum Master accepts or
 * edits it, the preferred phrasing is captured here as `patternKey -> phrase`.
 * The deterministic template narrator reads accepted phrases so the always-working
 * core improves over time. Patterns are project-scoped or general ("*"), giving a
 * shared, reviewable body of knowledge across projects - never model fine-tuning.
 *
 * Append-only JSONL (mirrors the audit/baseline stores). Latest append wins.
 */
import { mkdir, appendFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const KNOWLEDGE_FILE = join(DATA_DIR, 'Delivera-Governance-Narration-Knowledge.jsonl');

function normalizeScope(project) {
  const p = String(project || '').trim().toUpperCase();
  return p || '*';
}

/**
 * Record an accepted/edited phrasing pattern.
 * @param {object} entry { patternKey, phrase, project?, source?, briefId? }
 * @returns {Promise<object>} stored row
 */
export async function recordNarrationPattern(entry) {
  const row = {
    ts: new Date().toISOString(),
    patternKey: String(entry?.patternKey || '').trim(),
    phrase: String(entry?.phrase || '').slice(0, 600),
    project: normalizeScope(entry?.project),
    source: String(entry?.source || 'sm-accepted').trim(),
    briefId: entry?.briefId ? String(entry.briefId) : '',
  };
  if (!row.patternKey || !row.phrase) throw new Error('patternKey and phrase are required');
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(KNOWLEDGE_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

async function readAllPatterns() {
  try {
    const raw = await readFile(KNOWLEDGE_FILE, 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Resolve the active phrase map for a project: latest-append-wins, with
 * project-specific patterns overriding general ("*") patterns.
 * @param {string} project
 * @returns {Promise<Map<string,string>>} patternKey -> phrase
 */
export async function loadNarrationKnowledge(project) {
  const scope = normalizeScope(project);
  const all = await readAllPatterns();
  const general = new Map();
  const scoped = new Map();
  for (const row of all) {
    if (row.project === '*') general.set(row.patternKey, row.phrase);
    if (row.project === scope) scoped.set(row.patternKey, row.phrase);
  }
  // Scoped overrides general.
  const merged = new Map(general);
  for (const [k, v] of scoped) merged.set(k, v);
  return merged;
}
