import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// This theme ships plain JavaScript, so there is no TypeScript compiler to run.
// Instead we typecheck the Eshobe manifest: every setting default must conform to
// its declared type, and numeric defaults must honour min/max.
const manifest = JSON.parse(await readFile('eshobe.theme.json', 'utf8'));

for (const [key, schema] of Object.entries(manifest.settings ?? {})) {
  assert.match(key, /^[a-z][A-Za-z0-9]{0,63}$/, `setting key ${key}`);
  assert.match(String(schema.labelFa ?? ''), /\S/, `${key}: labelFa is required`);
  assert.match(String(schema.labelEn ?? ''), /\S/, `${key}: labelEn is required`);
  const { type, default: value, min, max } = schema;
  if (type === 'text' || type === 'select') {
    assert.strictEqual(typeof value, 'string', `${key}: default must be a string`);
  } else if (type === 'number') {
    assert.strictEqual(typeof value, 'number', `${key}: default must be a number`);
    if (min !== undefined) assert.ok(Number(value) >= min, `${key}: default below min`);
    if (max !== undefined) assert.ok(Number(value) <= max, `${key}: default above max`);
  } else if (type === 'boolean') {
    assert.strictEqual(typeof value, 'boolean', `${key}: default must be a boolean`);
  } else {
    assert.fail(`${key}: unknown setting type ${type}`);
  }
}

assert.equal(typeof manifest.build.port, 'number', 'build.port must be a number');
assert.equal(typeof manifest.build.healthCheckPath, 'string', 'build.healthCheckPath must be a string');

console.log('Typecheck OK: manifest settings conform to their declared types.');
