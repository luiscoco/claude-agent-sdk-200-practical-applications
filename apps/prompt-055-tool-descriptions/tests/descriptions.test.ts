import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecordServer,
  descriptions,
  requestSchema,
  testCases,
  toolNames,
} from '../src/descriptions.js';

test('comparison holds tool names constant and changes descriptions', () => {
  assert.equal(descriptions.vague.invoice, descriptions.vague.policy);
  assert.notEqual(descriptions.specific.invoice, descriptions.specific.policy);
  assert.notEqual(toolNames.invoice, toolNames.policy);
});
test('core cases balance two domains and holdout questions differ', () => {
  assert.equal(testCases.core.filter((item) => item.expected === 'invoice').length, 2);
  assert.equal(testCases.core.filter((item) => item.expected === 'policy').length, 2);
  const coreQuestions = new Set<string>(testCases.core.map((item) => item.question));
  assert.ok(testCases.holdout.every((item) => !coreQuestions.has(item.question)));
});
test('request schema rejects unknown modes and suites', () => {
  assert.ok(requestSchema.safeParse({ descriptionMode: 'specific', suite: 'core' }).success);
  assert.equal(requestSchema.safeParse({ descriptionMode: 'other', suite: 'core' }).success, false);
});
test('both modes create an actual SDK records server', async () => {
  for (const mode of ['vague', 'specific'] as const) {
    const server = createRecordServer(mode, []);
    assert.equal(server.type, 'sdk');
    assert.equal(server.name, 'records');
    await server.instance.close();
  }
});
