import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startClassroomApi } from '../src/classroom-api.js';
import { createOperationControl, requestCancellation } from '../src/handler.js';

function booking(url: string, key: string, label = 'Classroom booking', signal?: AbortSignal) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ label }),
    signal,
  });
}
test('same-key HTTP requests replay one committed booking and reject changed payloads', async () => {
  const api = await startClassroomApi({ processingMs: 10, replyDelayMs: 0 });
  const key = randomUUID();
  try {
    const first = await (await booking(api.url, key)).json();
    const second = await (await booking(api.url, key)).json();
    assert.equal(first.bookingId, second.bookingId);
    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.equal((await booking(api.url, key, 'Changed payload')).status, 409);
    assert.equal(api.snapshot().bookings.length, 1);
  } finally {
    await api.close();
  }
});
test('concurrent duplicates share the pending operation and one committed effect', async () => {
  const api = await startClassroomApi({ processingMs: 60, replyDelayMs: 0 });
  const key = randomUUID();
  try {
    const replies = await Promise.all([booking(api.url, key), booking(api.url, key)]);
    const values = await Promise.all(replies.map((reply) => reply.json()));
    assert.equal(values[0].bookingId, values[1].bookingId);
    assert.equal(api.snapshot().bookings.length, 1);
    assert.equal(values.filter((value) => value.replayed).length, 1);
  } finally {
    await api.close();
  }
});
test('a deadline after commit preserves the cached booking for a same-key retry', async () => {
  const api = await startClassroomApi({ processingMs: 20, replyDelayMs: 600 });
  const key = randomUUID();
  try {
    await assert.rejects(booking(api.url, key, 'Classroom booking', AbortSignal.timeout(150)));
    await api.waitForIdle();
    const observed = api.snapshot();
    assert.equal(observed.bookings.length, 1);
    assert.equal(observed.receipts[0].clientClosedBeforeReply, true);
    const retried = await (
      await booking(api.url, key, 'Classroom booking', AbortSignal.timeout(2000))
    ).json();
    assert.equal(retried.replayed, true);
    assert.equal(retried.bookingId, observed.bookings[0].bookingId);
    assert.equal(api.snapshot().bookings.length, 1);
  } finally {
    await api.close();
  }
});
test('cooperative pre-commit cancellation settles and permits a fresh same-key retry', async () => {
  const control = createOperationControl();
  control.mode = 'cancel';
  const api = await startClassroomApi({
    processingMs: 300,
    replyDelayMs: 0,
    onAccepted: () => {
      control.phase = 'waiting';
      requestCancellation(control);
    },
  });
  const key = randomUUID();
  try {
    await assert.rejects(booking(api.url, key, 'Classroom booking', control.abort.signal));
    await api.waitForIdle();
    assert.equal(control.cancelRequested, true);
    assert.equal(api.snapshot().bookings.length, 0);
    assert.equal(api.snapshot().operations[0].phase, 'abandoned');
    const retried = await (
      await booking(api.url, key, 'Classroom booking', AbortSignal.timeout(2000))
    ).json();
    assert.equal(retried.replayed, false);
    assert.equal(api.snapshot().bookings.length, 1);
  } finally {
    await api.close();
  }
});
test('host cancellation requires its active classroom cancellation phase', () => {
  const control = createOperationControl();
  assert.equal(requestCancellation(control), false);
  control.mode = 'cancel';
  control.phase = 'waiting';
  assert.equal(requestCancellation(control), true);
  assert.equal(requestCancellation(control), false);
});
