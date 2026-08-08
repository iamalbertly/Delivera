/**
 * Run nodemon with NODE_OPTIONS stripped of invalid --localstorage-file.
 * Cursor/Node injects `--localstorage-file` without a path; that warning and
 * experimental localStorage init can stall restarts under load.
 */
import { spawn } from 'child_process';

const cleaned = String(process.env.NODE_OPTIONS || '')
  .split(/\s+/)
  .filter((part) => part && !part.startsWith('--localstorage-file'))
  .join(' ');

const child = spawn('npx', ['nodemon', 'server.js'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NODE_OPTIONS: cleaned,
  },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
