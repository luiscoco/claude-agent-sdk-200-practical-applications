import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFollowup } from '../src/interruption.js';

test('invalid follow-up inputs are rejected before the conversation is mutated', () => {
  assert.equal(validateFollowup('  Reply exactly READY  '), 'Reply exactly READY');
  for (const value of ['', '   ', null, ['text'], 'x'.repeat(301)])
    assert.throws(() => validateFollowup(value), /INVALID_FOLLOWUP/);
});
