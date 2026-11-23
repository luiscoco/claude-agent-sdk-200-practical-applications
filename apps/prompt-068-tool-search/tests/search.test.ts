import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { requestSchema, searchSetting, toolContextMetrics } from '../src/search.js';

test('bounds classroom targets and preserves explicit native search settings', () => {
  assert.equal(requestSchema.safeParse({ mode: 'low-threshold', lessonId: 49 }).success, false);
  assert.equal(searchSetting('low-threshold'), 'auto:1');
  assert.equal(searchSetting('high-threshold'), 'auto:100');
  assert.equal(searchSetting('disabled'), 'false');
});
test('classifies actual context by category id and kind when raw loading flags stay false', () => {
  const mcpTools = [
    { name: 'mcp__core__health', serverName: 'core', tokens: 46, isLoaded: true },
    { name: 'mcp__catalog__lesson_17', serverName: 'catalog', tokens: 419, isLoaded: false },
  ];
  const upfront = toolContextMetrics({
    mcpTools,
    categories: [
      { id: 'mcp_tools', name: 'Localized label', tokens: 20142, color: 'blue', kind: 'used' },
    ],
  });
  assert.equal(upfront.usedMcpTokens, 20142);
  assert.equal(upfront.deferredMcpTokens, 0);
  assert.equal(upfront.rawCatalogLoadedFlags, 0);
  const deferred = toolContextMetrics({
    mcpTools,
    categories: [
      { id: 'mcp_tools', name: 'Loaded schemas', tokens: 46, color: 'blue', kind: 'used' },
      {
        id: 'mcp_tools_deferred',
        name: 'Other localized label',
        tokens: 20112,
        color: 'blue',
        kind: 'deferred',
      },
    ],
  });
  assert.equal(deferred.deferredMcpTokens, 20112);
  assert.equal(deferred.coreAlwaysLoadFlag, true);
});
test('actual catalog publishes 48 verbose definitions and returns the requested synthetic lesson', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/test-catalog-'));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'src/mcp-server.mjs'), 'catalog', path.join(workspace, 'audit.jsonl')],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'classroom-search-test', version: '1.0.0' });
  try {
    await client.connect(transport, { timeout: 60000 });
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 48);
    assert.equal(
      listed.tools.every((tool) => (tool.description?.length ?? 0) > 1500),
      true,
    );
    const outcome = await client.callTool({ name: 'lesson_17', arguments: { lessonId: 17 } });
    assert.equal((outcome.structuredContent as { minutes?: unknown }).minutes, 10);
  } finally {
    await client.close();
    await transport.close();
  }
});
