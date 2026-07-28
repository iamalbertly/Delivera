/**
 * One terminal: API restart (nodemon) + CSS rebuild on save + health self-heal.
 * No second port required. Prefer: npm run dev:safe
 */
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEALTH_INTERVAL_MS = 5000;
const HEALTH_MISS_LIMIT = 3;
const RESPAWN_BACKOFF_MS = [800, 1500, 3000, 5000];
const MAX_RESPAWNS = 12;

let shuttingDown = false;
let serverChild = null;
let cssWatch = null;
let healthMisses = 0;
let respawnCount = 0;
let respawnInFlight = false;
let lastRestartLogAt = 0;

function readDevPort() {
  const portFile = join(root, '.delivera-dev-port');
  if (!existsSync(portFile)) return process.env.PORT || '3000';
  try {
    const n = Number(readFileSync(portFile, 'utf8').trim());
    return Number.isFinite(n) && n > 0 ? String(n) : (process.env.PORT || '3000');
  } catch (_) {
    return process.env.PORT || '3000';
  }
}

function logRestart(message) {
  const now = Date.now();
  if (now - lastRestartLogAt < 2000) return;
  lastRestartLogAt = now;
  console.log(`[dev:hot] ${message}`);
}

function spawnEnv(extraEnv = {}) {
  return {
    ...process.env,
    PORT: readDevPort(),
    // Quiet Node experimental localStorage warning when NODE_OPTIONS injects --localstorage-file.
    NODE_OPTIONS: String(process.env.NODE_OPTIONS || '')
      .split(/\s+/)
      .filter((part) => part && !part.startsWith('--localstorage-file'))
      .join(' '),
    ...extraEnv,
  };
}

function run(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: spawnEnv(extraEnv),
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (label === 'server') {
      console.error(`[dev:hot] server exited code=${code ?? 'null'} signal=${signal || 'none'}`);
      void scheduleServerRespawn('server-exit');
      return;
    }
    if (code && code !== 0) console.error(`[dev:hot] ${label} exited`, code);
  });
  return child;
}

async function healthOk(port) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return Boolean(body?.ok && body?.ready);
  } catch (_) {
    return false;
  }
}

async function scheduleServerRespawn(reason) {
  if (shuttingDown || respawnInFlight) return;
  if (respawnCount >= MAX_RESPAWNS) {
    console.error(`[dev:hot] Gave up respawning server after ${MAX_RESPAWNS} attempts (${reason}).`);
    return;
  }
  respawnInFlight = true;
  const delay = RESPAWN_BACKOFF_MS[Math.min(respawnCount, RESPAWN_BACKOFF_MS.length - 1)];
  respawnCount += 1;
  logRestart(`Self-heal: respawning server (${reason}) in ${delay}ms [attempt ${respawnCount}/${MAX_RESPAWNS}]`);
  try {
    if (serverChild && !serverChild.killed) {
      try { serverChild.kill('SIGTERM'); } catch (_) {}
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (shuttingDown) return;
    serverChild = run('server', 'npx', ['nodemon', 'server.js']);
    healthMisses = 0;
  } finally {
    respawnInFlight = false;
  }
}

function startHealthWatchdog(port) {
  setInterval(async () => {
    if (shuttingDown || respawnInFlight) return;
    const ok = await healthOk(port);
    if (ok) {
      healthMisses = 0;
      if (respawnCount > 0) respawnCount = Math.max(0, respawnCount - 1);
      return;
    }
    healthMisses += 1;
    if (healthMisses >= HEALTH_MISS_LIMIT) {
      healthMisses = 0;
      void scheduleServerRespawn(`healthz-miss-x${HEALTH_MISS_LIMIT}`);
    }
  }, HEALTH_INTERVAL_MS);
}

const devPort = readDevPort();
console.log(`[dev:hot] Starting nodemon (server) + CSS watch on port ${devPort}.`);
console.log('[dev:hot] Prefer npm run dev:safe for port guard + self-heal. Plain npm run dev skips the port guard.');
cssWatch = run('css', process.execPath, ['scripts/Delivera-Dev-Css-Watch-01Runner.js']);
serverChild = run('server', 'npx', ['nodemon', 'server.js']);
startHealthWatchdog(devPort);

function shutdown() {
  shuttingDown = true;
  try { cssWatch?.kill('SIGTERM'); } catch (_) {}
  try { serverChild?.kill('SIGTERM'); } catch (_) {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
