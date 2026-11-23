import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestSchema, toolConfiguration, expectedWriteStatus } from '../src/advanced.js';

test('advanced configurations preserve selected file tools and explicit workspace guards', () => {
  for (const mode of ['auto', 'bypass', 'auto-ask', 'bypass-ask'] as const) {
    const config = toolConfiguration(mode);
    assert.deepEqual(config.tools, ['Read', 'Write']);
    assert.deepEqual(config.allowedTools, []);
    assert.equal(config.settings.permissions.blockReadsOutsideWorkingDirectories, true);
    assert.equal(config.settings.permissions.blockWritesOutsideWorkingDirectories, true);
    assert.deepEqual(
      config.settings.permissions.ask,
      mode.endsWith('-ask') ? ['Edit(./classroom-report.txt)'] : [],
    );
    assert.equal(config.permissionMode, mode.startsWith('bypass') ? 'bypassPermissions' : 'auto');
    assert.equal(config.allowDangerouslySkipPermissions, mode.startsWith('bypass'));
    assert.equal(
      expectedWriteStatus(mode),
      mode.endsWith('-ask') ? 'permission-denied' : 'completed',
    );
  }
});

test('classroom requests reject arbitrary mode and path overrides', () => {
  assert.equal(requestSchema.safeParse({ mode: 'bypass', topic: 'Hooks' }).success, true);
  assert.equal(
    requestSchema.safeParse({ mode: 'auto', topic: 'MCP', path: '../outside' }).success,
    false,
  );
  assert.equal(requestSchema.safeParse({ mode: 'default', topic: 'MCP' }).success, false);
});
