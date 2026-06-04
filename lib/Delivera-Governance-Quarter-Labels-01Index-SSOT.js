/**
 * Persisted quarter labels from built governance briefs (survives cache eviction).
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const INDEX_FILE = join(DATA_DIR, 'Delivera-Governance-Quarter-Labels-Index.json');

export async function readQuarterLabelIndex() {
  try {
    const raw = await readFile(INDEX_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data?.labels) ? data.labels.map((e) => e.label).filter(Boolean) : [];
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    return [];
  }
}

export async function rememberQuarterLabel(label, projects = []) {
  const trimmed = String(label || '').trim();
  if (!trimmed) return;
  let labels = [];
  try {
    const raw = await readFile(INDEX_FILE, 'utf8');
    const data = JSON.parse(raw);
    labels = Array.isArray(data?.labels) ? data.labels : [];
  } catch (err) {
    if (err?.code !== 'ENOENT') return;
  }
  const entry = {
    label: trimmed,
    projects: [...new Set((projects || []).map((p) => String(p).trim().toUpperCase()).filter(Boolean))],
    at: new Date().toISOString(),
  };
  const next = [entry, ...labels.filter((e) => e.label !== trimmed)].slice(0, 40);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(INDEX_FILE, `${JSON.stringify({ labels: next })}\n`, 'utf8');
}
