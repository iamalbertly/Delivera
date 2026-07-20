/**
 * SSOT: Tanzanian public holidays for working-day calculations.
 * Fetches from Nager.at API once per year, caches to data/ JSON file.
 * Falls back to weekends-only if API is unavailable.
 *
 * @see https://date.nager.at/api/v3/PublicHolidays/{year}/TZ
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const CACHE_DIR = path.resolve(process.cwd(), 'data');
const CACHE_FILE = (year) => path.join(CACHE_DIR, `Delivera-Data-Tanzania-Holidays-${year}.json`);
const NAGER_API = (year) => `https://date.nager.at/api/v3/PublicHolidays/${year}/TZ`;

const memoryCache = new Map();

/**
 * Fetch Tanzanian public holidays for a given year.
 * Returns an array of ISO date strings (YYYY-MM-DD).
 * Falls back to an empty array (weekends-only) on any error.
 * @param {number} year - Full year (e.g. 2026)
 * @returns {Promise<string[]>}
 */
export async function getTanzaniaHolidays(year) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2020 || y > 2100) return [];

  if (memoryCache.has(y)) return memoryCache.get(y);

  // Try file cache first
  try {
    const cached = await fs.readFile(CACHE_FILE(y), 'utf8');
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed.dates)) {
      memoryCache.set(y, parsed.dates);
      return parsed.dates;
    }
  } catch (_) {
    // File doesn't exist or is invalid — fetch from API
  }

  // Fetch from Nager.at API
  try {
    const res = await fetch(NAGER_API(y), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const dates = Array.isArray(data)
      ? data.map((h) => String(h.date || '').slice(0, 10)).filter(Boolean)
      : [];
    // Persist to file cache (best-effort, non-blocking)
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(CACHE_FILE(y), JSON.stringify({ year: y, dates, fetchedAt: new Date().toISOString() }, null, 2), 'utf8');
    } catch (_) {
      // Non-fatal — in-memory cache still works for this process
    }
    memoryCache.set(y, dates);
    return dates;
  } catch (_) {
    // API down or unreachable — fall back to empty (weekends-only)
    memoryCache.set(y, []);
    return [];
  }
}

/**
 * Synchronous accessor for holidays already in memory cache.
 * Returns empty array if not yet fetched (use getTanzaniaHolidays first).
 * @param {number} year
 * @returns {string[]}
 */
export function getCachedTanzaniaHolidays(year) {
  const y = Number(year);
  return memoryCache.get(y) || [];
}

/**
 * Preload holidays for the current year into memory cache.
 * Call once at server startup for instant access.
 * @param {number} [year] - Defaults to current year
 */
export async function preloadTanzaniaHolidays(year) {
  const y = year || new Date().getFullYear();
  await getTanzaniaHolidays(y);
  // Also preload next year (for Dec/Jan boundary sprints)
  await getTanzaniaHolidays(y + 1);
}
