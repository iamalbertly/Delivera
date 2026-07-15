/**
 * Fail fast when deploy-critical source files are not strict UTF-8.
 * Vercel's module graph loader rejects non-UTF-8 streams before runtime.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TextDecoder } from 'node:util';

const ROOTS = ['api', 'lib', 'public', 'routes', 'scripts'];
const ROOT_FILES = ['index.js', 'server.js', 'package.json', 'vercel.json', 'version.json'];
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', 'coverage', 'test-results']);
const decoder = new TextDecoder('utf-8', { fatal: true });

function extensionOf(path) {
  const index = path.lastIndexOf('.');
  return index >= 0 ? path.slice(index).toLowerCase() : '';
}

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(join(dir, entry.name), out);
      continue;
    }
    const file = join(dir, entry.name);
    if (EXTENSIONS.has(extensionOf(file))) out.push(file);
  }
  return out;
}

const files = [
  ...ROOT_FILES,
  ...ROOTS.flatMap((root) => {
    try {
      return statSync(root).isDirectory() ? collectFiles(root) : [];
    } catch (_) {
      return [];
    }
  }),
];

const failures = [];
for (const file of files) {
  try {
    decoder.decode(readFileSync(file));
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
  }
}

if (failures.length) {
  console.error('[validate:utf8] Non-UTF-8 source files block deployment:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`[validate:utf8] OK (${files.length} files)`);
