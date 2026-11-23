import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ClassroomServiceError, outcomeSchema, safeFailure } from '../src/errors.js';

test('known errors expose useful whitelisted outcomes without their messages', () => {
  const privateMessage =
    'CLASSROOM_SECRET_unit-test http://classroom-internal.invalid/private ClassroomInternalStore.fetchRecord';
  for (const code of ['unavailable', 'missing'] as const) {
    const result = safeFailure(new ClassroomServiceError(code, privateMessage), randomUUID());
    assert.ok(outcomeSchema.safeParse(result).success);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes(privateMessage), false);
    assert.equal(JSON.stringify(result).includes('CLASSROOM_SECRET_'), false);
    assert.ok(result.recovery.length > 0);
    assert.equal(result.retryable, code === 'unavailable');
  }
});
test('unexpected exceptions and thrown values receive the fixed public fallback', () => {
  for (const error of [
    new Error('private cause'),
    'private thrown text',
    null,
    { message: 'private object' },
  ]) {
    const result = safeFailure(error, randomUUID());
    assert.equal(result.errorCode, 'REQUEST_FAILED');
    assert.equal(JSON.stringify(result).includes('private'), false);
    assert.equal(result.retryable, false);
  }
});
test('the public reference is preserved exactly', () => {
  const reference = randomUUID();
  assert.equal(safeFailure(new Error('private'), reference).reference, reference);
});
