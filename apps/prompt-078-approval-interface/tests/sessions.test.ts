import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClassroomSessions, cookieToken, ownsJob } from '../src/auth.js';

test('authorization binds both the classroom user and application session', () => {
  const store = new ClassroomSessions();
  const first = store.create('learner-a'),
    second = store.create('learner-a'),
    other = store.create('learner-b');
  const owner = {
    userId: first.session.userId,
    sessionId: first.session.id,
    displayName: first.session.displayName,
  };
  assert.equal(ownsJob(owner, first.session), true);
  assert.equal(ownsJob(owner, second.session), false);
  assert.equal(ownsJob(owner, other.session), false);
  assert.equal(ownsJob({ ...owner, userId: 'learner-b' }, first.session), false);
});

test('public session identifiers provide separate metadata from opaque cookie credentials', () => {
  const store = new ClassroomSessions(),
    issued = store.create('learner-a');
  assert.notEqual(issued.token, issued.session.id);
  assert.equal(issued.token.length, 43);
  assert.equal(store.get(issued.session.id), null);
  assert.equal(store.get(issued.token)?.id, issued.session.id);
  assert.equal(cookieToken('other=value; classroom_session=' + issued.token), issued.token);
  assert.equal(cookieToken(undefined), undefined);
  store.revoke(issued.token);
  assert.equal(store.get(issued.token), null);
});

test('expired sessions cease authorizing access', () => {
  const store = new ClassroomSessions(),
    issued = store.create('learner-b');
  issued.session.expiresAt = Date.now() - 1;
  assert.equal(store.get(issued.token), null);
  assert.equal(store.revoke(issued.token), null);
});
