import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { decisionSchema } from '../src/agent.js';
import { runDirectory, withRunLock } from '../src/store.js';

test('saved run paths require a UUID and approval decisions are explicit', () => {
  assert.throws(() => runDirectory('../another-directory'));
  assert.throws(() => decisionSchema.parse('allow-everything'));
  assert.equal(decisionSchema.parse('approve'), 'approve');
  assert.equal(decisionSchema.parse('deny'), 'deny');
});
test('one worker owns a run lock and failure releases it for the next attempt', async () => {
  const id = randomUUID();
  let release!: () => void;
  let entered!: () => void;
  const enteredPromise = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = withRunLock(id, async () => {
    entered();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  await enteredPromise;
  await assert.rejects(
    withRunLock(id, async () => true),
    /active worker/,
  );
  release();
  await held;
  await assert.rejects(
    withRunLock(id, async () => {
      throw new Error('Classroom failure');
    }),
    /Classroom failure/,
  );
  assert.equal(await withRunLock(id, async () => 'released'), 'released');
});
