import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('doctor checks local configuration without printing the key or making an API request', () => {
  const env = { ...process.env, APEX_API_KEY: 'offline-fixture-secret', APEX_BASE_URL: 'http://127.0.0.1:3100/api' };
  const good = spawnSync(process.execPath, ['dist/index.js', 'doctor'], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(good.status, 0);
  assert.match(good.stdout, /present \/ présente \/ presente/);
  assert.doesNotMatch(good.stdout, /offline-fixture-secret/);
  const invalid = spawnSync(process.execPath, ['dist/index.js', 'doctor'], { env: { ...env, APEX_BASE_URL: 'not-a-url' }, encoding: 'utf8', timeout: 5000 });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stdout, /invalid \/ invalide \/ inválida/);
});
