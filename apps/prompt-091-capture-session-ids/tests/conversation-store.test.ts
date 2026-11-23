import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { insertConversation, readConversation } from '../src/conversation-store.js';
test('Concurrent inserts cannot silently rebind one application conversation to another native session', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'course-session-store-'));
  const base = {
    conversationId: randomUUID(),
    label: 'Owned test',
    topic: 'MCP',
    workspace: 'owned',
    nativeConfigDirectory: 'owned/config',
    summary: 'Owned test summary.',
    createdAt: new Date().toISOString(),
  };
  const outcomes = await Promise.allSettled([
    insertConversation(directory, { ...base, sdkSessionId: 'native-A' }),
    insertConversation(directory, { ...base, sdkSessionId: 'native-B' }),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  const failed = outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult;
  assert.equal(failed.reason.code, 'EEXIST');
  const record = await readConversation(directory, base.conversationId);
  const succeeded = outcomes.find(
    (outcome) => outcome.status === 'fulfilled',
  ) as PromiseFulfilledResult<Awaited<ReturnType<typeof insertConversation>>>;
  assert.equal(record?.sdkSessionId, succeeded.value.sdkSessionId);
  assert.equal(await readConversation(directory, '../foreign'), null);
});
