import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { requestSchema, fixtureSchema } from '../src/resources.js';

test('bounds resource URI inputs to the synthetic classroom namespace', () => {
  assert.equal(requestSchema.safeParse({ uri: 'https://example.com/private' }).success, false);
  assert.equal(
    requestSchema.safeParse({ uri: 'course://lessons/agent-loop', token: 'extra' }).success,
    false,
  );
  assert.equal(requestSchema.safeParse({ uri: 'course://lessons/missing' }).success, true);
});
test('discovers and reads an actual resource separately from invoking its calculation tool', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  const fixtureFile = path.join(root, 'fixtures/resources.json');
  const fixture = fixtureSchema.parse(JSON.parse(await readFile(fixtureFile, 'utf8')))[0];
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/test-resource-'));
  const auditFile = path.join(workspace, 'audit.jsonl');
  const client = new Client({ name: 'classroom-resource-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'src/mcp-server.mjs'), fixtureFile, auditFile],
    stderr: 'pipe',
  });
  try {
    await client.connect(transport, { timeout: 60000 });
    const listed = await client.listResources();
    assert.equal(
      listed.resources.some((resource) => resource.uri === fixture.uri),
      true,
    );
    const read = await client.readResource({ uri: fixture.uri });
    assert.equal(read.contents[0].mimeType, 'application/json');
    assert.ok('text' in read.contents[0]);
    const body = JSON.parse(String(read.contents[0].text));
    assert.equal(body.title, fixture.title);
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name),
      ['total_minutes'],
    );
    const result = await client.callTool({
      name: 'total_minutes',
      arguments: { segments: body.segments },
    });
    assert.equal((result.structuredContent as { totalMinutes?: unknown })?.totalMinutes, 13);
    await assert.rejects(client.readResource({ uri: 'course://lessons/missing' }), /not found/i);
    const events = (await readFile(auditFile, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(events.filter((event) => event.method === 'tools/call').length, 1);
    assert.equal(
      events.find((event) => event.error === 'RESOURCE_NOT_FOUND').input.uri,
      'course://lessons/missing',
    );
  } finally {
    await client.close();
    await transport.close();
  }
});
