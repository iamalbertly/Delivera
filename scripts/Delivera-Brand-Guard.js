import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const patterns = [
  { name: 'legacy product name', regex: /\bVodaAgileBoard\b/g },
  { name: 'legacy package slug', regex: /\bvoda-agile-board\b/g },
  { name: 'legacy suite title', regex: /\bJira Reporting App\b/g },
];

const allowlist = [
  /(^|\/)\.playwright_tmp\//,
  /(^|\/)node_modules\//,
  /(^|\/)public\/Delivera-Shared-Storage-Keys\.js$/,
  /(^|\/)routes\/api\.js$/,
];

const hits = [];

for (const file of tracked) {
  if (allowlist.some((entry) => entry.test(file))) continue;
  let content = '';
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      hits.push(`${file}: ${pattern.name}`);
    }
    pattern.regex.lastIndex = 0;
  }
}

if (hits.length > 0) {
  console.error('[Delivera-Brand-Guard] Found legacy branding references:');
  for (const hit of hits) console.error(`- ${hit}`);
  process.exit(1);
}

console.log('[Delivera-Brand-Guard] OK: no forbidden legacy branding references found.');
