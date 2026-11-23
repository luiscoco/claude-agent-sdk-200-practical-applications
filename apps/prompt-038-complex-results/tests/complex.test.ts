import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundaryCandidate, consumePlan, CoursePlanSchema } from '../src/schema.js';
import { preparePlan } from '../src/task.js';

test('nested plans accept present and absent optional fields with explicit display defaults', () => {
  for (const mode of ['with-optionals', 'without-optionals']) {
    const parsed = CoursePlanSchema.parse(preparePlan(mode).expected);
    assert.equal(consumePlan(parsed).totalMinutes, 35);
    assert.equal(Object.hasOwn(parsed, 'notes'), mode === 'with-optionals');
  }
  assert.equal(
    consumePlan(CoursePlanSchema.parse(preparePlan('without-optionals').expected)).notesDisplay,
    'No notes supplied',
  );
});
test('missing required nested values, unsupported enumerations and null optionals are rejected', () => {
  const original = preparePlan('with-optionals').expected;
  for (const mode of ['missing-name', 'invalid-enum']) {
    const parsed = CoursePlanSchema.safeParse(boundaryCandidate(original, mode));
    assert.equal(parsed.success, false);
  }
  assert.equal(original.owner.name, 'Luis Coco Enríquez');
  assert.equal(CoursePlanSchema.safeParse({ ...original, notes: null }).success, false);
  assert.throws(() => preparePlan(['with-optionals']), /INVALID_MODE/);
});
