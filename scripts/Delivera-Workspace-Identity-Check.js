import path from 'node:path';

const cwdBase = path.basename(process.cwd()).toLowerCase();
const expected = 'delivera';

if (cwdBase === expected) {
  console.log('[Delivera-Workspace-Identity-Check] OK: workspace folder name is Delivera.');
  process.exit(0);
}

console.warn('[Delivera-Workspace-Identity-Check] Workspace folder does not match product identity.');
console.warn(`[Delivera-Workspace-Identity-Check] Current folder: ${path.basename(process.cwd())}`);
console.warn('[Delivera-Workspace-Identity-Check] Recommended workspace path: C:\\Shared\\Projects\\Delivera');
console.warn('[Delivera-Workspace-Identity-Check] Note: run rename after closing terminal/editor sessions that are rooted in this folder.');
