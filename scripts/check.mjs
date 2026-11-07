import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { blockSlugsForSiteType, contractVersion } from '@eshobe/site-runtime';

const manifest = JSON.parse(await readFile('eshobe.theme.json', 'utf8'));
assert.equal(manifest.contractVersion, contractVersion);
assert.equal(manifest.proxiesApi, true);
assert.equal(manifest.build.healthCheckPath, '/api/health');
assert.equal(manifest.build.port, 3000);
assert.match(manifest.key, /^[a-z0-9-]+$/);
for (const color of ['primary', 'accent', 'background', 'foreground']) assert.match(manifest.design[color], /^#[0-9a-f]{6}$/i);
for (const entry of manifest.env) { assert.match(entry.key, /^[A-Z][A-Z0-9_]{0,63}$/); assert.ok(!entry.key.startsWith('ESHOBE_') || entry.secret); }
for (const [key, schema] of Object.entries(manifest.settings)) {
  assert.match(key, /^[a-z][A-Za-z0-9]{0,63}$/);
  assert.equal(typeof schema.default, schema.type === 'text' || schema.type === 'select' ? 'string' : schema.type);
  if (schema.type === 'number') assert.ok(schema.default >= schema.min && schema.default <= schema.max);
}
for (const file of ['server.js', 'app.js', ...((await readdir('src')).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`))]) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${file}: ${result.stderr}`);
}
const clientSource = await readFile('src/cms.js', 'utf8');
assert.ok(clientSource.includes('Authorization: `Bearer ${this.config.apiKey}`'));
assert.ok(!clientSource.includes('headers: { Host:'));
const proxySource = await readFile('src/proxy.js', 'utf8');
assert.ok(!proxySource.includes('config.apiKey'));
for (const type of ['store', 'business', 'portfolio']) assert.ok(blockSlugsForSiteType(type).length);
await access('public/fonts/LICENSE');
console.log('Manifest, contract, source syntax, credential boundaries and font licence checks passed.');
