import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { nativeOutcome, requestSchema } from '../src/catalog.js';

test('actual stdio discovery, child-process tool result and missing lesson', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'classroom-mcp-'));
  const audit = path.join(folder, 'audit.jsonl');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('src/mcp-server.mjs'), path.resolve('fixtures/catalog.json'), audit],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'classroom-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const listing = await client.listTools();
    assert.equal(listing.tools[0].name, 'get_lesson');
    assert.equal(listing.tools[0].annotations?.readOnlyHint, true);
    const found = await client.callTool({ name: 'get_lesson', arguments: { slug: 'local-mcp' } });
    const outcome = nativeOutcome(found.content);
    assert.equal(outcome?.ok, true);
    assert.equal(outcome?.lesson?.minutes, 7);
    assert.notEqual(outcome?.processId, process.pid);
    const missing = await client.callTool({ name: 'get_lesson', arguments: { slug: 'missing' } });
    assert.equal(missing.isError, true);
    assert.equal(nativeOutcome(missing.content)?.errorCode, 'LESSON_NOT_FOUND');
    const events = (await readFile(audit, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(events.length, 2);
    assert.equal(events[0].processId, outcome?.processId);
  } finally {
    await client.close();
    await transport.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test('host input rejects empty or extra arguments', () => {
  assert.equal(requestSchema.safeParse({ slug: '' }).success, false);
  assert.equal(requestSchema.safeParse({ slug: 'local-mcp', command: 'other' }).success, false);
});
