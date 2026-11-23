import test from 'node:test';
import assert from 'node:assert/strict';
import { browseSessions } from '../src/session-browser.js';

test('Native SDK utilities paginate actual recorded sessions without changing the source transcripts', async () => {
  const first = await browseSessions({
    selection: 'switch',
    includeSystem: false,
    offset: 0,
    pageSize: 2,
  });
  const next = await browseSessions({
    selection: 'switch',
    includeSystem: false,
    offset: 2,
    pageSize: 2,
  });
  const other = await browseSessions({
    selection: 'denied',
    includeSystem: true,
    offset: 0,
    pageSize: 4,
  });
  assert.equal(first.verified, true, JSON.stringify(first.checks));
  assert.equal(next.verified, true, JSON.stringify(next.checks));
  assert.equal(other.verified, true, JSON.stringify(other.checks));
  assert.equal(first.messages.length, 2);
  assert.equal(
    first.messages.some((message) => next.messages.some((other) => other.uuid === message.uuid)),
    false,
  );
  assert.notEqual(first.selectedMetadata?.sessionId, other.selectedMetadata?.sessionId);
  assert.equal(first.transcriptProof.sha256Before, next.transcriptProof.sha256Before);
  assert.equal(first.noModelQueriesMade, true);
  await assert.rejects(
    browseSessions({ selection: '../foreign', includeSystem: false, offset: 0, pageSize: 2 }),
  );
});
