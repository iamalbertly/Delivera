/**
 * Shared dev-env helpers: NODE_OPTIONS cleanup + .delivera-dev-port SSOT.
 * Default port is 3001 everywhere (port guard, Playwright, SuperTokens example).
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const DEFAULT_DEV_PORT = 3001;

const rootFromHere = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Strip Cursor/Node-injected `--localstorage-file` (often without a path).
 * @param {string} [raw]
 * @returns {string}
 */
export function cleanNodeOptions(raw = process.env.NODE_OPTIONS || '') {
  return String(raw || '')
    .split(/\s+/)
    .filter((part) => part && !part.startsWith('--localstorage-file'))
    .join(' ');
}

/**
 * Read `.delivera-dev-port` written by the port guard.
 * @param {string} [root]
 * @param {number|string} [fallback]
 * @returns {number}
 */
export function readDevPortFromFile(root = rootFromHere, fallback = DEFAULT_DEV_PORT) {
  const portFile = join(root, '.delivera-dev-port');
  const envPort = Number(process.env.PORT);
  if (Number.isFinite(envPort) && envPort > 0) return envPort;
  if (!existsSync(portFile)) return Number(fallback) || DEFAULT_DEV_PORT;
  try {
    const n = Number(readFileSync(portFile, 'utf8').trim());
    return Number.isFinite(n) && n > 0 ? n : (Number(fallback) || DEFAULT_DEV_PORT);
  } catch (_) {
    return Number(fallback) || DEFAULT_DEV_PORT;
  }
}

export function resolveNodemonBin(root = rootFromHere) {
  const local = join(root, 'node_modules', 'nodemon', 'bin', 'nodemon.js');
  return existsSync(local) ? local : null;
}
