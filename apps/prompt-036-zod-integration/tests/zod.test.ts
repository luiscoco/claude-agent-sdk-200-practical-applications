import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkshopSchema, consumeWorkshop, corruptDuration, jsonSchema } from '../src/schema.js';
import { prepareTask } from '../src/task.js';

test('Zod generates draft-07 JSON Schema and returns typed data for the application', () => {
  assert.match(jsonSchema.$schema!, /draft-07/);
  const parsed = WorkshopSchema.safeParse(prepareTask('basics').expected);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(consumeWorkshop(parsed.data).totalMinutesWithBreak, 30);
});
test('the runtime boundary rejects a string duration without mutating native data', () => {
  const original = prepareTask('basics').expected;
  const candidate = corruptDuration(original);
  const parsed = WorkshopSchema.safeParse(candidate);
  assert.equal(original.durationMinutes, 25);
  assert.equal(parsed.success, false);
  if (!parsed.success) assert.equal(parsed.error.issues[0].path.join('.'), 'durationMinutes');
  assert.equal(WorkshopSchema.safeParse({ ...original, extra: 'unexpected' }).success, false);
});
