import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  createNoteServer,
  createNoteStore,
  inspectProtocolAnnotations,
  toolAnnotations,
} from '../src/notes.js';

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(path.join(tmpdir(), 'classroom-notes-'));
  const file = path.join(directory, 'note.json');
  await writeFile(file, JSON.stringify({ note: 'Original classroom note', revision: 0 }) + '\n');
  t.after(async () => {
    await rm(file, { force: true });
    await rmdir(directory);
  });
  return file;
}
test('MCP tools/list preserves all declared annotation fields', async (t) => {
  const file = await fixture(t);
  const listed = await inspectProtocolAnnotations(file);
  for (const [name, annotations] of Object.entries(toolAnnotations))
    assert.deepEqual(listed.find((item) => item.name === name)?.annotations, annotations);
});
test('read-only calls preserve file bytes and repeated writes are idempotent', async (t) => {
  const file = await fixture(t);
  const operate = createNoteStore(file);
  const read = await operate('read');
  assert.equal(read.beforeSha256, read.afterSha256);
  const first = await operate('write', 'Updated classroom note');
  const second = await operate('write', 'Updated classroom note');
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(first.afterSha256, second.afterSha256);
  assert.equal(second.after.revision, 1);
});
test('queued writes stay consistent and repeated deletion preserves the resulting state', async (t) => {
  const file = await fixture(t);
  const operate = createNoteStore(file);
  await Promise.all([operate('write', 'First'), operate('write', 'Second')]);
  const state = await operate('read');
  assert.deepEqual(state.after, { note: 'Second', revision: 2 });
  const first = await operate('delete');
  const second = await operate('delete');
  assert.equal(first.afterSha256, second.afterSha256);
  assert.equal(second.changed, false);
});
test('invalid direct writes fail before mutation and preserve a usable queue', async (t) => {
  const file = await fixture(t);
  const operate = createNoteStore(file);
  const before = await readFile(file, 'utf8');
  await assert.rejects(operate('write'));
  assert.equal(await readFile(file, 'utf8'), before);
  assert.equal((await operate('write', 'Valid retry')).after.note, 'Valid retry');
});
test('actual MCP deletion is rejected by the handler when host confirmation is absent', async (t) => {
  const file = await fixture(t);
  const before = await readFile(file, 'utf8');
  const executions: Parameters<typeof createNoteServer>[2] = [];
  const server = createNoteServer(file, false, executions);
  const client = new Client({ name: 'classroom-test', version: '1.0.0' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  try {
    await server.instance.connect(right);
    await client.connect(left);
    const result = await client.callTool({ name: 'delete_note', arguments: {} });
    assert.equal(result.isError, true);
    assert.equal(executions[0].outcome.errorCode, 'DELETE_CONFIRMATION_REQUIRED');
    assert.equal(await readFile(file, 'utf8'), before);
  } finally {
    await client.close();
    await server.instance.close();
  }
});
