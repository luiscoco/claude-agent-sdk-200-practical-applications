import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestSchema, permissionRules, rule, expectedStatus } from '../src/precedence.js';

test('conflicting lists use the same exact scoped rule', () => {
  assert.deepEqual(permissionRules('deny-wins'), { allow: [rule], ask: [rule], deny: [rule] });
  assert.deepEqual(permissionRules('ask-denied'), { allow: [rule], ask: [rule], deny: [] });
  assert.deepEqual(permissionRules('ask-approved'), { allow: [rule], ask: [rule], deny: [] });
  assert.deepEqual(permissionRules('allow-only'), { allow: [rule], ask: [], deny: [] });
  assert.equal(expectedStatus('deny-wins'), 'permission-denied');
  assert.equal(expectedStatus('ask-denied'), 'permission-denied');
  assert.equal(expectedStatus('ask-approved'), 'completed');
  assert.equal(expectedStatus('allow-only'), 'completed');
});

test('input accepts bounded classroom choices and rejects unrelated settings', () => {
  assert.equal(requestSchema.safeParse({ mode: 'ask-approved', topic: 'Hooks' }).success, true);
  assert.equal(
    requestSchema.safeParse({ mode: 'allow-only', topic: 'MCP', settings: {} }).success,
    false,
  );
  assert.equal(requestSchema.safeParse({ mode: 'auto', topic: 'MCP' }).success, false);
});
