import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration, fixture, requestSchema } from '../src/editing.js';

test('plan and editing configurations retain the native tools needed for plan files', () => {
  assert.equal(configuration('plan').permissionMode, 'plan');
  assert.equal(configuration('accept-edits').permissionMode, 'acceptEdits');
  assert.deepEqual(configuration('plan').tools, ['Read', 'Edit', 'Write']);
  assert.deepEqual(configuration('accept-edits').tools, ['Read', 'Edit', 'Write']);
  assert.deepEqual(configuration('edits-denied').settings.permissions.deny, [
    'Edit(./lesson-title.txt)',
  ]);
  assert.deepEqual(configuration('accept-edits').settings.permissions.deny, []);
});

test('classroom title edit preserves the topic and trailing newline', () => {
  assert.deepEqual(fixture('Hooks'), {
    original: 'Draft Hooks lesson.\n',
    proposed: 'Reviewed Hooks lesson.\n',
  });
  assert.equal(requestSchema.safeParse({ mode: 'plan', topic: 'MCP' }).success, true);
  assert.equal(
    requestSchema.safeParse({ mode: 'plan', topic: 'MCP', file: '../outside' }).success,
    false,
  );
  assert.equal(requestSchema.safeParse({ mode: 'bypass', topic: 'MCP' }).success, false);
});
