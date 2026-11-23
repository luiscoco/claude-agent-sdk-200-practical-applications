import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareTask, selectSchema } from '../src/schema.js';

test('classroom facts and JSON Schema preserve required field types', () => {
  const task = prepareTask('basics');
  assert.equal(task.expected.durationMinutes, 25);
  assert.deepEqual(task.expected.prerequisites, ['TypeScript', 'async/await']);
  assert.equal(task.expected.published, false);
  assert.equal(prepareTask('streaming').expected.published, true);
  assert.deepEqual(selectSchema('valid').required, [
    'title',
    'durationMinutes',
    'prerequisites',
    'published',
  ]);
  assert.equal(selectSchema('invalid-schema').required, 'title');
  assert.throws(() => selectSchema(['valid']), /INVALID_MODE/);
  assert.throws(() => prepareTask(null), /INVALID_TASK/);
});
