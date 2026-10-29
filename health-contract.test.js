const test = require('node:test');
const assert = require('node:assert/strict');
const { createHealthReport } = require('./health-contract');

test('uses the shared health fields and reports dependency failure', () => {
  const report = createHealthReport({ service: 'ios-device-monitor', version: '1.0.0', checks: { storage: { status: 'error', apiKey: 'hidden' } } });
  assert.deepEqual(Object.keys(report), ['status', 'service', 'version', 'timestamp', 'checks']);
  assert.equal(report.status, 'error');
  assert.doesNotMatch(JSON.stringify(report), /hidden/);
});
