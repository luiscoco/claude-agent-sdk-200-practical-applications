import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMode } from '../src/cleanup.js';

test('cleanup mode validation rejects unsupported and coerced input values', () => {
  for (const value of ['success', 'cancel', 'exception']) assert.equal(validateMode(value), value);
  for (const value of [null, ['success'], '', 'unknown'])
    assert.throws(() => validateMode(value), /INVALID_MODE/);
});
