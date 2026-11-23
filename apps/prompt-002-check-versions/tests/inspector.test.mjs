import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRuntime } from '../src/inspector.mjs';

test('invalid version input stops before executing a command', async () => {
  await assert.rejects(inspectRuntime('0.3; echo arbitrary'), /exact SDK version/);
});
test('real installed SDK and executable yield a traceable declaration checklist', async () => {
  const report = await inspectRuntime();
  assert.equal(report.status, 'passed');
  assert.equal(report.runtime.version, report.sdk.declaredRuntimeVersion);
  assert.match(report.environment.node, /^v\d/);
  assert.equal(report.capabilities.length, 6);
  assert.ok(report.capabilities.every(feature => feature.line > 0 && feature.declaration.includes(feature.field)));
  const mismatch = await inspectRuntime('0.0.0');
  assert.equal(mismatch.status, 'mismatch');
  assert.equal(mismatch.checks.at(-1).passed, false);
});
