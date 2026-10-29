const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSecurityConfig } = require('./security-config');

test('requires an action password instead of using a source fallback', () => {
  assert.throws(() => loadSecurityConfig({}), /ACTION_PASSWORD/);
});

test('accepts an explicit action password', () => {
  assert.equal(loadSecurityConfig({ ACTION_PASSWORD: 'configured-secret' }).actionPassword, 'configured-secret');
});

