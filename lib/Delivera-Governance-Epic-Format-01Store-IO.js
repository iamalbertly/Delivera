/**
 * SSOT: Persist org epic format config (data/Delivera-Org-Epic-Format.json).
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_EPIC_FORMAT,
  normalizeEpicFormatConfig,
} from './Delivera-Governance-Epic-Format-01SSOT.js';
import { logger } from './Delivera-Server-Logging-Utility.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORMAT_FILE = join(__dirname, '..', 'data', 'Delivera-Org-Epic-Format.json');

let cached = null;

export async function loadEpicFormatConfig() {
  if (cached) return cached;
  try {
    const raw = await readFile(FORMAT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cached = normalizeEpicFormatConfig(parsed);
    return cached;
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      logger.warn('epic-format read failed, using default', { error: err?.message });
    }
    cached = normalizeEpicFormatConfig(DEFAULT_EPIC_FORMAT);
    return cached;
  }
}

export async function saveEpicFormatConfig(next = {}) {
  const merged = normalizeEpicFormatConfig({ ...(await loadEpicFormatConfig()), ...next });
  await mkdir(dirname(FORMAT_FILE), { recursive: true });
  await writeFile(FORMAT_FILE, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  cached = merged;
  return merged;
}

export function invalidateEpicFormatCache() {
  cached = null;
}
