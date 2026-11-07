import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const SKIP = new Set(['node_modules', 'vendor', '.next', 'test-results', 'coverage', '.git']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

let files = 0;
let failed = 0;
for await (const file of walk('.')) {
  if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;
  files++;
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`${file}:\n${result.stderr}`);
    failed++;
  }
}

if (failed === 0) {
  console.log(`Lint OK: ${files} JavaScript files checked.`);
  process.exit(0);
}
console.error(`Lint failed: ${failed} of ${files} files have syntax errors.`);
process.exit(1);
