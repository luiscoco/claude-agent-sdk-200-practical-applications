import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { saveConversation, loadConversation, isWithin } from '../src/restart-store.js';

test('Restart loader rejects traversal, mismatched identity and locations outside the owned run directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'course-restart-store-')),
    directory = path.join(root, 'conversations');
  const record = {
    conversationId: randomUUID(),
    sdkSessionId: 'opaque-native-identifier',
    workspace: path.join(root, 'session'),
    nativeConfigDirectory: path.join(root, 'session/config'),
    createdAt: new Date().toISOString(),
  };
  await saveConversation(directory, record);
  assert.deepEqual(await loadConversation(directory, record.conversationId), record);
  await assert.rejects(loadConversation(directory, '../foreign'), /Invalid application/);
  const file = path.join(directory, record.conversationId + '.json');
  const original = await readFile(file, 'utf8');
  await writeFile(file, JSON.stringify({ ...record, conversationId: randomUUID() }));
  await assert.rejects(loadConversation(directory, record.conversationId), /does not match/);
  await writeFile(
    file,
    JSON.stringify({
      ...record,
      workspace: path.join(root, '../foreign'),
      nativeConfigDirectory: path.join(root, '../foreign/config'),
    }),
  );
  await assert.rejects(loadConversation(directory, record.conversationId), /outside the owned/);
  await writeFile(file, original);
  await assert.rejects(saveConversation(directory, record), { code: 'EEXIST' });
  assert.equal(isWithin(root, root + '-sibling'), false);
  assert.equal(isWithin(root, path.join(root, 'session')), true);
});
