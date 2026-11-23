import test from 'node:test';
import assert from 'node:assert/strict';
import {
  principals,
  readAuthorizedNotes,
  toolInputSchema,
  type AccessEvent,
} from '../src/authorization.js';

test('owner access reaches the protected fixture read', () => {
  const accesses: AccessEvent[] = [];
  const outcome = readAuthorizedNotes(principals.alice, 'alice-lab', accesses);
  assert.equal(outcome.ok, true);
  assert.equal(accesses.length, 1);
  assert.ok(outcome.notes?.[0].startsWith('ALICE_CLASSROOM_NOTE'));
});
test('cross-owner access is rejected before protected data access', () => {
  const accesses: AccessEvent[] = [];
  const outcome = readAuthorizedNotes(principals.bob, 'alice-lab', accesses);
  assert.equal(outcome.errorCode, 'FORBIDDEN');
  assert.equal(outcome.notes, null);
  assert.equal(accesses.length, 0);
  assert.equal(JSON.stringify(outcome).includes('ALICE_CLASSROOM_NOTE'), false);
});
test('instructor access is explicit and an unassigned learner is denied', () => {
  assert.equal(readAuthorizedNotes(principals.instructor, 'bob-lab', []).ok, true);
  assert.equal(readAuthorizedNotes({ id: 'unassigned', role: 'learner' }, 'bob-lab', []).ok, false);
});
test('tool arguments accept project ID and reject identity or role overrides', () => {
  assert.ok(toolInputSchema.safeParse({ projectId: 'alice-lab' }).success);
  assert.equal(
    toolInputSchema.safeParse({ projectId: 'alice-lab', actor: 'instructor' }).success,
    false,
  );
  assert.equal(
    toolInputSchema.safeParse({ projectId: 'alice-lab', role: 'instructor' }).success,
    false,
  );
});
