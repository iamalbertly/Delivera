import { mkdir, appendFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const AUDIT_FILE = join(DATA_DIR, 'Delivera-Jira-Activity-Audit.jsonl');

export async function appendJiraActivityEntry(entry) {
  const row = {
    id: entry?.id || randomUUID(),
    ts: entry?.ts || new Date().toISOString(),
    user: String(entry?.user || 'unknown'),
    issueKey: String(entry?.issueKey || ''),
    commentId: entry?.commentId ? String(entry.commentId) : null,
    bodyPreview: String(entry?.bodyPreview || '').slice(0, 400),
    sprintId: entry?.sprintId ? String(entry.sprintId) : '',
    boardId: entry?.boardId ? String(entry.boardId) : '',
    status: String(entry?.status || 'sent'),
    undoReason: entry?.undoReason ? String(entry.undoReason) : '',
  };
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(AUDIT_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

export async function readJiraActivityEntries({ limit = 50 } = {}) {
  try {
    const raw = await readFile(AUDIT_FILE, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const parsed = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
    return parsed.slice(-limit).reverse();
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

export async function updateJiraActivityEntry(id, patch) {
  let raw = '';
  try {
    raw = await readFile(AUDIT_FILE, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
  const lines = raw.split('\n').filter(Boolean);
  let updated = null;
  const next = lines.map((line) => {
    try {
      const row = JSON.parse(line);
      if (row.id !== id) return line;
      updated = { ...row, ...patch, id };
      return JSON.stringify(updated);
    } catch (_) {
      return line;
    }
  });
  if (!updated) return null;
  const { writeFile } = await import('fs/promises');
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(AUDIT_FILE, next.join('\n') + (next.length ? '\n' : ''), 'utf8');
  return updated;
}

export async function findJiraActivityEntry(id) {
  const entries = await readJiraActivityEntries({ limit: 500 });
  return entries.find((e) => e.id === id) || null;
}
