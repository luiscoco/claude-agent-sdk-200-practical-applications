import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClassroomQuestions, answerSchema } from '../src/questions.js';

test('invalid revisions and stale identifiers preserve the live pending approval', async () => {
  const questions = new ClassroomQuestions(),
    controller = new AbortController();
  const pending = questions.ask('tool-permission', { toolName: 'Write' }, controller.signal);
  const id = questions.current()!.id;
  assert.throws(() => questions.answer(id, { action: 'revise', content: '' }));
  assert.throws(() => questions.answer('old-request', { action: 'allow' }));
  assert.equal(questions.current()!.id, id);
  questions.answer(id, { action: 'revise', content: 'Reviewed classroom note.\n' });
  assert.deepEqual(await pending, { action: 'revise', content: 'Reviewed classroom note.\n' });
  assert.equal(questions.current(), null);
  assert.throws(() => questions.answer(id, { action: 'deny' }));
});

test('aborting a pending native approval clears and rejects its wait', async () => {
  const questions = new ClassroomQuestions(),
    controller = new AbortController();
  const pending = questions.ask('tool-permission', { toolName: 'Write' }, controller.signal);
  controller.abort();
  await assert.rejects(pending, /aborted/);
  assert.equal(questions.current(), null);
  assert.equal(questions.history[0].status, 'cancelled');
});

test('one pending approval is retained and structured decisions stay bounded', async () => {
  const questions = new ClassroomQuestions(),
    controller = new AbortController();
  const pending = questions.ask('tool-permission', {}, controller.signal);
  await assert.rejects(questions.ask('tool-permission', {}, controller.signal), /awaiting/);
  assert.equal(answerSchema.safeParse({ action: 'allow', content: 'ignored' }).success, false);
  assert.equal(
    answerSchema.safeParse({ action: 'revise', content: 'x'.repeat(2001) }).success,
    false,
  );
  questions.cancel();
  await assert.rejects(pending, /cancelled/);
});
