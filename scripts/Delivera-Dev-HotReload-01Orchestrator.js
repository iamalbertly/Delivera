/**
 * One terminal: API restart (nodemon) + CSS rebuild on save. No second port required.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[dev:hot] ${label} exited`, code);
  });
  return child;
}

console.log('[dev:hot] Starting nodemon (server) + CSS watch. Set PORT once in .env (e.g. 3001).');
const cssWatch = run('css', process.execPath, ['scripts/Delivera-Dev-Css-Watch-01Runner.js']);
const server = run('server', 'npx', ['nodemon', 'server.js']);

function shutdown() {
  try { cssWatch.kill('SIGTERM'); } catch (_) {}
  try { server.kill('SIGTERM'); } catch (_) {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
