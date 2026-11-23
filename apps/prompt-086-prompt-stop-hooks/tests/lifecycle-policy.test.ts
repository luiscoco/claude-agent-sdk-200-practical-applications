import test from 'node:test';
import assert from 'node:assert/strict';
import { promptAdmission, stopPolicy } from '../src/lifecycle-policy.js';
test('An active stop hook cannot request another repair even when completion remains unsatisfied', () => {
  assert.equal(stopPolicy(false, false), 'request-repair');
  assert.equal(stopPolicy(true, false), 'guard-release');
  assert.equal(stopPolicy(true, true), 'guard-release');
  assert.equal(stopPolicy(false, true), 'complete');
  assert.equal(promptAdmission('Unrelated topic: MCP'), false);
  assert.equal(promptAdmission('Course topic: MCP. Explain the SDK.'), true);
});
