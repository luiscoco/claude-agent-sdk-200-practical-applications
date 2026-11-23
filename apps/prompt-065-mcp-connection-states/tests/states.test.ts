import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { auditEvents, inspectConnectionTimeout } from '../src/states.js';
import { inputSchema } from '../src/agent.js';
import { startClassroomBroker } from '../src/broker.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

test('rejects empty, oversized and unknown message fields', () => {
  assert.equal(inputSchema.safeParse({ message: '  ' }).success, false);
  assert.equal(inputSchema.safeParse({ message: 'a'.repeat(161) }).success, false);
  assert.equal(inputSchema.safeParse({ message: 'hello', credential: 'ignored' }).success, false);
});
test('initialize deadline expires before any tool invocation', async () => {
  const report = await inspectConnectionTimeout();
  assert.equal(report.verified, true);
  assert.equal(report.connected, false);
  assert.equal(report.checks.noToolHandlerInvoked, true);
});
test('a connected MCP client can time out a call and later complete a healthy call', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/test-call-'));
  const audit = path.join(workspace, 'audit.jsonl');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'src/mcp-server.mjs'), audit, '0'],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'classroom-test', version: '1.0.0' });
  try {
    await client.connect(transport, { timeout: 60000 });
    await assert.rejects(
      client.callTool({ name: 'echo', arguments: { message: 'slow', workMs: 3000 } }, undefined, {
        timeout: 1000,
      }),
      /timed out/i,
    );
    const result = await client.callTool(
      { name: 'echo', arguments: { message: 'healthy', workMs: 0 } },
      undefined,
      { timeout: 5000 },
    );
    assert.equal((result.structuredContent as { message?: unknown })?.message, 'healthy');
    const events = await auditEvents(audit);
    assert.equal(events.filter((event) => event.event === 'tool-started').length, 2);
  } finally {
    await client.close();
    await transport.close();
  }
});
test('protected fixture challenges missing credentials and accepts its issued classroom credential', async () => {
  const broker = await startClassroomBroker();
  const initialize = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    },
  };
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  try {
    const missing = await fetch(broker.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(initialize),
    });
    assert.equal(missing.status, 401);
    assert.match(missing.headers.get('www-authenticate') || '', /resource_metadata/);
    const admitted = await fetch(broker.url, {
      method: 'POST',
      headers: { ...headers, Authorization: 'Bearer ' + broker.credential },
      body: JSON.stringify(initialize),
    });
    assert.equal(admitted.status, 200);
    assert.equal((await admitted.json()).result.serverInfo.name, 'classroom-credentialed-resource');
  } finally {
    await broker.close();
  }
});
