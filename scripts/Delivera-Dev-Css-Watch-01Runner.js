/**
 * Rebuild public/styles.css when partials change (pairs with nodemon for zero-touch dev).
 */
import { spawn } from 'child_process';
import { watch } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cssDir = join(root, 'public', 'css');
let timer = null;

function rebuild() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const child = spawn(process.execPath, ['scripts/build-css.js'], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });
    child.on('error', (err) => console.error('[dev:css:watch]', err.message));
  }, 200);
}

console.log('[dev:css:watch] Watching', cssDir);
watch(cssDir, { recursive: true }, () => rebuild());
rebuild();
