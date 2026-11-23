import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareTask,userMessages,type InputEvent} from '../src/input.js';

test('both modes use the same prepared task and documented user-message content', async () => {
  const task = prepareTask(12,30);
  const messages = [];
  const events: InputEvent[] = [];
  for await (const message of userMessages(task.prompt,false,events)) messages.push(message);
  assert.equal(task.expected,42);
  assert.equal(messages.length,1);
  assert.equal(messages[0].message.content,task.prompt);
  assert.throws(() => prepareTask('12',30),/INVALID_NUMBERS/);
  assert.throws(() => prepareTask(Number.MAX_SAFE_INTEGER,1),/INVALID_SUM/);
});
test('the deliberate input-generator failure preserves its original diagnostic', async () => {
  const observed: InputEvent[] = [];
  const generator = userMessages('test',true,observed);
  await assert.rejects(() => generator.next(),/CLASSROOM_GENERATOR_ERROR/);
  assert.equal(observed[0].kind,'error');
  assert.match(String(observed[0].message),/CLASSROOM_GENERATOR_ERROR/);
});
