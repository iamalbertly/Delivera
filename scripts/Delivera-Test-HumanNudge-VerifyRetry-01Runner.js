#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_ATTEMPTS = 3;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status === 0;
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  console.log(`\n=== Human nudge verify attempt ${attempt}/${MAX_ATTEMPTS} ===\n`);
  if (!run('npm', ['run', 'build:css'])) process.exit(1);
  if (!run('npm', ['run', 'check:css'])) process.exit(1);
  if (!run('npm', ['run', 'test:journey:human-nudge-trust'])) {
    if (attempt === MAX_ATTEMPTS) {
      console.error('\nHuman nudge trust journey failed after retries.\n');
      process.exit(1);
    }
    continue;
  }
  console.log('\nHuman nudge trust journey passed.\n');
  process.exit(0);
}
