import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAnswer, responseText } from '../src/clarification.js';
import { ClassroomQuestions } from '../src/questions.js';

const input = (multiSelect = false) => ({
  questions: [
    {
      question: 'Which area should the lesson emphasize?',
      header: 'Focus',
      multiSelect,
      options: [
        { label: 'Code', description: 'Examples' },
        { label: 'Diagrams', description: 'Architecture' },
      ],
    },
  ],
});
test('selected labels belong to the actual question and respect its selection mode', () => {
  assert.deepEqual(validateAnswer(input(), { action: 'select', labels: ['Code'] }), {
    action: 'select',
    labels: ['Code'],
  });
  assert.throws(() => validateAnswer(input(), { action: 'select', labels: ['Code', 'Diagrams'] }));
  assert.throws(() => validateAnswer(input(true), { action: 'select', labels: ['Code', 'Code'] }));
  assert.throws(() => validateAnswer(input(), { action: 'select', labels: ['invented'] }));
  assert.equal(
    responseText(validateAnswer(input(true), { action: 'select', labels: ['Code', 'Diagrams'] })),
    'Code, Diagrams',
  );
  const text = 'Focus on “tests”.\nThen show naïve examples.';
  assert.equal(responseText(validateAnswer(input(), { action: 'text', text })), text);
});
test('invalid or stale answers preserve the actual pending question', async () => {
  const questions = new ClassroomQuestions(),
    controller = new AbortController();
  const waiting = questions.ask('agent-clarification', { input: input() }, controller.signal);
  const id = questions.current()!.id;
  assert.throws(() => questions.answer(id, { action: 'text', text: '' }));
  assert.throws(() => questions.answer('old', { action: 'select', labels: ['Code'] }));
  assert.equal(questions.current()!.id, id);
  questions.answer(id, { action: 'text', text: 'Actual custom response.' });
  assert.deepEqual(await waiting, { action: 'text', text: 'Actual custom response.' });
});
test('cancellation clears the native question wait', async () => {
  const questions = new ClassroomQuestions(),
    controller = new AbortController();
  const waiting = questions.ask('agent-clarification', { input: input() }, controller.signal);
  controller.abort();
  await assert.rejects(waiting, /aborted/);
  assert.equal(questions.current(), null);
});
