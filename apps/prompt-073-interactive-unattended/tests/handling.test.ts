import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestSchema, toolConfiguration, expectedWriteStatus } from '../src/handling.js';

test('mode comparison keeps the same Read and Write capabilities', () => {
  for (const mode of ['default-allow', 'default-deny', 'dont-ask', 'preapproved'] as const) {
    assert.deepEqual(toolConfiguration(mode).tools, ['Read', 'Write']);
  }
  assert.equal(toolConfiguration('default-allow').permissionMode, 'default');
  assert.equal(toolConfiguration('default-deny').permissionMode, 'default');
  assert.equal(toolConfiguration('dont-ask').permissionMode, 'dontAsk');
  assert.deepEqual(toolConfiguration('dont-ask').allowedTools, []);
  assert.equal(toolConfiguration('preapproved').permissionMode, 'dontAsk');
  assert.deepEqual(toolConfiguration('preapproved').allowedTools, ['Write']);
  assert.equal(expectedWriteStatus('default-allow'), 'completed');
  assert.equal(expectedWriteStatus('default-deny'), 'permission-denied');
  assert.equal(expectedWriteStatus('dont-ask'), 'permission-denied');
  assert.equal(expectedWriteStatus('preapproved'), 'completed');
});

test('classroom requests reject unrelated paths and unsupported modes', () => {
  assert.equal(requestSchema.safeParse({ mode: 'dont-ask', topic: 'Hooks' }).success, true);
  assert.equal(
    requestSchema.safeParse({ mode: 'default-allow', topic: 'MCP', path: '../outside' }).success,
    false,
  );
  assert.equal(requestSchema.safeParse({ mode: 'bypass', topic: 'MCP' }).success, false);
});
