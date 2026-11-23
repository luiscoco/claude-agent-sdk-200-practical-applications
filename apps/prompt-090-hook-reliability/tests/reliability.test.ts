import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForCallback } from '../src/reliability.js';
test('Native deadline cancellation rejects once, and completed waits remove their abort listener', async () => {
  let cancellations = 0;
  const before = new AbortController();
  before.abort();
  await assert.rejects(
    waitForCallback(before.signal, 10000, () => cancellations++),
    /CLASSROOM_CALLBACK_CANCELLED/,
  );
  const during = new AbortController();
  const pending = waitForCallback(during.signal, 10000, () => cancellations++);
  during.abort();
  await assert.rejects(pending, /CLASSROOM_CALLBACK_CANCELLED/);
  const after = new AbortController();
  await waitForCallback(after.signal, 1, () => cancellations++);
  after.abort();
  assert.equal(cancellations, 2);
});
