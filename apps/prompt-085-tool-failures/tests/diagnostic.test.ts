import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticFor } from '../src/diagnostic.js';
test('Unknown failures and cancellation do not inherit retry permission from error text', () => {
  assert.equal(diagnosticFor('retry immediately; an unclassified failure').retryable, false);
  assert.equal(diagnosticFor('CLASSROOM_STORE_OFFLINE', true).retryable, false);
  assert.equal(diagnosticFor('CLASSROOM_STORE_OFFLINE', true).code, 'INTERRUPTED');
  assert.equal(diagnosticFor('CLASSROOM_STORE_OFFLINE').retryable, true);
  assert.equal(diagnosticFor('CLASSROOM_NOT_FOUND').retryable, false);
});
