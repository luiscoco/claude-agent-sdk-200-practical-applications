import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { requestSchema, permissionRules, readTool } from '../src/permissions.js';
test('keeps the fully qualified individual, anchored wildcard and unanchored example distinct', () => {
  assert.deepEqual(permissionRules('individual'), [readTool]);
  assert.deepEqual(permissionRules('server-wide'), ['mcp__catalog__*']);
  assert.deepEqual(permissionRules('bad-prefix'), ['mcp__*']);
  assert.equal(requestSchema.safeParse({ mode: 'other', slug: 'local-mcp' }).success, false);
  assert.equal(requestSchema.safeParse({ mode: 'individual', slug: 'missing' }).success, false);
});
test('actual classroom server advertises and executes its two independent read-only handlers', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/test-tools-'));
  const auditFile = path.join(workspace, 'audit.jsonl');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      path.join(root, 'src/mcp-server.mjs'),
      path.join(root, 'fixtures/catalog.json'),
      auditFile,
    ],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'classroom-permission-test', version: '1.0.0' });
  try {
    await client.connect(transport, { timeout: 60000 });
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), ['list_lessons', 'read_lesson']);
    const read = await client.callTool({ name: 'read_lesson', arguments: { slug: 'local-mcp' } });
    assert.equal(
      (read.structuredContent as { lesson: { title: string } }).lesson.title,
      'Local MCP over stdio',
    );
    const all = await client.callTool({ name: 'list_lessons', arguments: {} });
    assert.deepEqual((all.structuredContent as { slugs: string[] }).slugs, [
      'agent-loop',
      'local-mcp',
    ]);
    const events = (await readFile(auditFile, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      events.map((event) => event.name),
      ['read_lesson', 'list_lessons'],
    );
  } finally {
    await client.close();
    await transport.close();
  }
});
