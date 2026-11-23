import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSchema, policyConfiguration } from '../src/policy.js';

test('MCP policies use bare tool names beside the SDK server configuration', () => {
  assert.deepEqual(policyConfiguration('ask-allow').tools, [
    { name: 'save_note', permission_policy: 'always_ask' },
  ]);
  assert.deepEqual(policyConfiguration('policy-deny').tools, [
    { name: 'save_note', permission_policy: 'always_deny' },
  ]);
  assert.deepEqual(policyConfiguration('preapproved').tools, []);
  for (const mode of requestSchema.shape.mode.options)
    assert.deepEqual(policyConfiguration(mode).allowedTools, ['mcp__classroom__*']);
});
test('session modes and explicit bypass opt-in remain associated with the selected experiment', () => {
  assert.equal(policyConfiguration('unattended').permissionMode, 'dontAsk');
  assert.equal(policyConfiguration('bypass-ask').permissionMode, 'bypassPermissions');
  assert.equal(policyConfiguration('bypass-ask').allowDangerouslySkipPermissions, true);
  assert.equal(policyConfiguration('ask-allow').allowDangerouslySkipPermissions, false);
  assert.throws(() => requestSchema.parse({ mode: 'unknown', topic: 'MCP' }));
});
