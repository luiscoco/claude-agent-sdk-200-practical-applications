import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { prepareConfiguration, requestSchema } from '../src/configuration.js';

test('actual file loading resolves explicit paths and preserves the separate project configuration', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'course-config-'));
  try {
    const prepared = await prepareConfiguration(process.cwd(), workspace, 'strict');
    assert.deepEqual(Object.keys(prepared.loaded.mcpServers), ['catalog']);
    assert.equal(prepared.loaded.mcpServers.catalog.command, process.execPath);
    assert.equal(prepared.loaded.mcpServers.catalog.args[0], path.resolve('src/mcp-server.mjs'));
    assert.match(prepared.loaded.sha256, /^[a-f0-9]{64}$/);
    const project = JSON.parse(await readFile(path.join(workspace, '.mcp.json'), 'utf8'));
    assert.deepEqual(Object.keys(project.mcpServers), ['unintended']);
    await assert.rejects(prepareConfiguration(process.cwd(), workspace, 'malformed'), SyntaxError);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
test('host modes and extra input keys are validated', () => {
  assert.equal(requestSchema.safeParse({ mode: 'other', slug: 'local-mcp' }).success, false);
  assert.equal(
    requestSchema.safeParse({ mode: 'strict', slug: 'local-mcp', configFile: 'other' }).success,
    false,
  );
});
