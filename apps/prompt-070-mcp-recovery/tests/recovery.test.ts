import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { requestSchema, decodedBody, persistedOutputProof, auditEvents } from '../src/recovery.js';

test('bounds repaired response size and parses actual protocol text', () => {
  assert.equal(requestSchema.safeParse({ mode: 'oversized', pageSize: 400 }).success, false);
  assert.equal(decodedBody('Connection closed'), null);
  assert.deepEqual(
    decodedBody(JSON.stringify({ count: 1, rows: [{ id: 1, text: 'Synthetic row' }] })),
    { count: 1, rows: [{ id: 1, text: 'Synthetic row' }] },
  );
});
test('owned persisted result proof verifies the actual complete file and payload hash', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/test-persisted-'));
  const directory = path.join(workspace, 'native-config/projects/classroom/tool-results');
  await mkdir(directory, { recursive: true });
  const body = JSON.stringify({ count: 1, rows: [{ id: 1, text: 'Synthetic row' }] });
  const sha256 = createHash('sha256').update(body).digest('hex');
  await writeFile(path.join(directory, 'mcp-service-get_items-test.txt'), body);
  const proof = await persistedOutputProof(workspace, sha256);
  assert.equal(proof.handlerHashMatches, true);
  assert.equal(proof.count, 1);
  assert.equal(proof.actualRows, 1);
  assert.equal((await persistedOutputProof(workspace, 'different-hash')).handlerHashMatches, false);
});
test('actual MCP disconnect, unavailable advertisement and fresh healthy connection are observable', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/test-server-'));
  const stateFile = path.join(workspace, 'state.json'),
    auditFile = path.join(workspace, 'audit.jsonl');
  async function connect() {
    const client = new Client({ name: 'classroom-recovery-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(root, 'src/mcp-server.mjs'), stateFile, auditFile],
      stderr: 'pipe',
    });
    await client.connect(transport, { timeout: 60000 });
    return { client, transport };
  }
  await writeFile(stateFile, JSON.stringify({ available: true, disconnect: true }));
  let connection = await connect();
  try {
    await assert.rejects(
      connection.client.callTool({ name: 'get_items', arguments: { count: 5 } }),
      /closed/i,
    );
  } finally {
    await connection.client.close();
    await connection.transport.close();
  }
  await writeFile(stateFile, JSON.stringify({ available: false, disconnect: false }));
  connection = await connect();
  try {
    assert.equal(connection.client.getServerCapabilities()?.tools, undefined);
  } finally {
    await connection.client.close();
    await connection.transport.close();
  }
  await writeFile(stateFile, JSON.stringify({ available: true, disconnect: false }));
  connection = await connect();
  try {
    const outcome = await connection.client.callTool({
      name: 'get_items',
      arguments: { count: 5 },
    });
    const body = decodedBody(outcome.content);
    assert.equal(body?.rows.length, 5);
    const events = await auditEvents(auditFile);
    assert.equal(events.filter((event) => event.event === 'boot').length, 3);
    assert.equal(events.filter((event) => event.event === 'intentional-disconnect').length, 1);
    assert.equal(events.filter((event) => event.event === 'handler-result').length, 1);
  } finally {
    await connection.client.close();
    await connection.transport.close();
  }
});
