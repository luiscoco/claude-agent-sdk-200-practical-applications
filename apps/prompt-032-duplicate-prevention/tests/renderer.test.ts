import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TextRenderer, validateMode } from '../src/renderer.js';

test('completed blocks reconcile existing deltas across block indexes and API messages', () => {
  const renderer = new TextRenderer('reconciled');
  renderer.delta('first-message', 0, 'Hello ');
  renderer.delta('first-message', 0, 'class');
  renderer.complete('first-message', 'event-one', 'Hello class');
  renderer.complete('first-message', 'event-one', 'Hello class');
  renderer.delta('first-message', 2, '!');
  renderer.complete('first-message', 'event-two', '!');
  renderer.complete('next-message', 'event-three', ' Ready');
  renderer.complete('other-message', 'event-four', ' Ready');
  assert.equal(renderer.snapshot().visibleText, 'Hello class! Ready Ready');
  assert.equal(renderer.snapshot().blocks.length, 4);
});
test('completed text repairs a partial display and supports completed-only mode', () => {
  for (const mode of ['reconciled', 'completed-only'] as const) {
    const renderer = new TextRenderer(mode);
    renderer.delta('message', 0, 'Par');
    renderer.complete('message', 'completed-event', 'Partial text');
    assert.equal(renderer.snapshot().visibleText, 'Partial text');
  }
  const naive = new TextRenderer('naive');
  naive.delta('message', 0, 'Twice');
  naive.complete('message', 'completed', 'Twice');
  assert.equal(naive.snapshot().visibleText, 'TwiceTwice');
  assert.throws(() => validateMode(['reconciled']), /INVALID_MODE/);
});
