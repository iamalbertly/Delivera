/**
 * One terminal: API restart (nodemon) + CSS rebuild on save. No second port required.
 */
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function run(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, PORT: readDevPort(), ...extraEnv },
  });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[dev:hot] ${label} exited`, code);
  });
  return child;
}

const devPort = readDevPort();
console.log(`[dev:hot] Starting nodemon (server) + CSS watch on port ${devPort}.`);
const cssWatch = run('css', process.execPath, ['scripts/Delivera-Dev-Css-Watch-01Runner.js']);
const server = run('server', 'npx', ['nodemon', 'server.js']);

function shutdown() {
  try { cssWatch.kill('SIGTERM'); } catch (_) {}
  try { server.kill('SIGTERM'); } catch (_) {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
