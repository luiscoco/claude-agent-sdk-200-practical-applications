import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requestSchema,
  toolConfiguration,
  expectedWriteStatus,
  classroomText,
  type Request,
} from '../src/availability.js';

test('configurations distinguish selected tools, preapproval and explicit deny', () => {
  assert.deepEqual(toolConfiguration('selected'), {
    tools: ['Read'],
    allowedTools: [],
    disallowedTools: [],
  });
  assert.deepEqual(toolConfiguration('unapproved'), {
    tools: ['Read', 'Write'],
    allowedTools: [],
    disallowedTools: [],
  });
  assert.deepEqual(toolConfiguration('preapproved'), {
    tools: ['Read', 'Write'],
    allowedTools: ['Write'],
    disallowedTools: [],
  });
  assert.deepEqual(toolConfiguration('denied'), {
    tools: ['Read', 'Write'],
    allowedTools: [],
    disallowedTools: ['Write'],
  });
  const modes: Request['mode'][] = ['selected', 'unapproved', 'preapproved', 'denied'];
  assert.deepEqual(modes.map(expectedWriteStatus), [
    'unavailable',
    'permission-denied',
    'completed',
    'unavailable',
  ]);
});

test('request validation bounds classroom choices and preserves exact note content', () => {
  assert.equal(requestSchema.safeParse({ mode: 'preapproved', topic: 'Hooks' }).success, true);
  assert.equal(requestSchema.safeParse({ mode: 'bypass', topic: 'MCP' }).success, false);
  assert.equal(
    requestSchema.safeParse({ mode: 'selected', topic: 'MCP', file: '../outside' }).success,
    false,
  );
  assert.equal(classroomText('Hooks'), 'Synthetic classroom note about Hooks.\n');
});
