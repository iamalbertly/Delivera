import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

const productionFiles = [
  'lib/Delivera-AI-PIArtifact-TaskContracts-01SSOT.js',
  'lib/Delivera-Governance-PIArtifact-AIQuota-05SSOT.js',
  'lib/Delivera-Governance-PIArtifact-Contracts-01SSOT.js',
  'lib/Delivera-Governance-PIArtifact-Identity-01SSOT.js',
  'lib/Delivera-Governance-PIArtifact-Import-06Service.js',
  'lib/Delivera-Governance-PIArtifact-Job-04Store-IO.js',
  'lib/Delivera-Governance-PIArtifact-LocalOCR-03Service.js',
  'lib/Delivera-Governance-PIArtifact-NativeExtract-02Service.js',
  'lib/Delivera-Governance-PIArtifact-UploadToken-07SSOT.js',
  'routes/Delivera-Governance-PIArtifact-Import-01Route.js',
];

const sourceByFile = new Map(productionFiles.map((file) => [file, readFileSync(file, 'utf8')]));
for (const [file, source] of sourceByFile) {
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${file} has ${lines} lines; split handwritten modules above 300`);
}

const routeSource = sourceByFile.get('routes/Delivera-Governance-PIArtifact-Import-01Route.js');
const routeSignatures = [...routeSource.matchAll(/router\.(get|post|put|patch|delete|options)\(\s*['"`]([^'"`]+)/g)]
  .map((match) => `${match[1].toUpperCase()} ${match[2]}`);
assert.equal(routeSignatures.length, new Set(routeSignatures).size, 'Duplicate PI artifact route handler');

const graph = new Map();
for (const [file, source] of sourceByFile) {
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((value) => value.startsWith('.'))
    .map((value) => {
      const target = resolve(dirname(file), value).replaceAll('\\', '/');
      return productionFiles.find((candidate) => resolve(candidate).replaceAll('\\', '/') === target) || '';
    })
    .filter(Boolean);
  graph.set(file, imports);
}

function visit(file, active = new Set(), complete = new Set()) {
  assert.ok(!active.has(file), `Circular PI artifact import at ${basename(file)}`);
  if (complete.has(file)) return;
  active.add(file);
  for (const dependency of graph.get(file) || []) visit(dependency, active, complete);
  active.delete(file);
  complete.add(file);
}
for (const file of productionFiles) visit(file);

for (const file of ['public/actions.html', 'public/settings.html']) {
  const html = readFileSync(file, 'utf8');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, `Duplicate DOM id in ${file}`);
}

const css = readFileSync('public/css/14-speed-simplicity-trust.css', 'utf8');
const referenced = [
  ['gov-baseline-job', 'public/Delivera-App-Governance-Brief-PIBaseline-01Wizard-UI.js'],
  ['gov-baseline-trust-strip', 'public/Delivera-App-Governance-PIBaseline-Wizard-02Render-UI.js'],
  ['registry-disclosure', 'public/Delivera-Settings-Governance-Registry-01UI.js'],
  ['settings-health-hero', 'public/settings.html'],
];
for (const [selector, file] of referenced) {
  assert.ok(css.includes(`.${selector}`), `Missing CSS selector ${selector}`);
  assert.ok(readFileSync(file, 'utf8').includes(selector), `Orphan CSS selector ${selector}`);
}

console.log(`[pi-source-audit] ✓ ${productionFiles.length} modules ≤300 lines; routes, imports, IDs, and selectors are clean.`);
