import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ClassroomQuestions } from '../src/questions.js';

test('invalid and stale answers preserve the current request and one answer resolves it once', async () => {
  const questions = new ClassroomQuestions(),
    controller = new AbortController();
  const promise = questions.ask(
    'agent-clarification',
    { question: 'Choose a classroom topic' },
    controller.signal,
  );
  const id = questions.current()!.id;
  assert.throws(() => questions.answer(id, { choice: 'Private topic' }));
  assert.throws(() => questions.answer('stale-id', { choice: 'MCP' }), /no longer pending/);
  assert.equal(questions.current()?.id, id);
  questions.answer(id, { choice: 'Hooks' });
  assert.deepEqual(await promise, { choice: 'Hooks' });
  assert.throws(() => questions.answer(id, { choice: 'MCP' }), /no longer pending/);
  assert.equal(questions.history[0].status, 'answered');
});
test('native abort cancels the pending request and removes its answer target', async () => {
  const questions = new ClassroomQuestions(),
    controller = new AbortController();
  const pending = questions.ask('tool-permission', { toolName: 'classroom' }, controller.signal);
  const rejected = assert.rejects(pending, /aborted/);
  controller.abort();
  await rejected;
  assert.equal(questions.current(), null);
  assert.equal(questions.history[0].status, 'cancelled');
});
test('a second pending request is rejected and accepted elicitation requires its form field', async () => {
  const questions = new ClassroomQuestions(),
    controller = new AbortController();
  const pending = questions.ask('mcp-elicitation', { mode: 'form' }, controller.signal);
  await assert.rejects(
    questions.ask('tool-permission', {}, controller.signal),
    /Another classroom request/,
  );
  assert.throws(() => questions.answer(questions.current()!.id, { action: 'accept' }));
  questions.answer(questions.current()!.id, { action: 'decline' });
  assert.deepEqual(await pending, { action: 'decline' });
});
test('actual MCP form elicitation records accepted and declined responses in server events', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/test-elicitation-'));
  const auditFile = path.join(workspace, 'audit.jsonl');
  const client = new Client(
    { name: 'classroom-form-test', version: '1.0.0' },
    { capabilities: { elicitation: { form: {} } } },
  );
  let action: 'accept' | 'decline' = 'accept';
  client.setRequestHandler(ElicitRequestSchema, async (request) => {
    assert.equal(request.params.mode, 'form');
    return action === 'accept' ? { action, content: { format: 'detailed' } } : { action };
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'src/mcp-server.mjs'), auditFile],
    stderr: 'pipe',
  });
  try {
    await client.connect(transport, { timeout: 60000 });
    const accepted = await client.callTool({
      name: 'prepare_report',
      arguments: { topic: 'Hooks' },
    });
    assert.equal(accepted.isError, false);
    assert.equal((accepted.structuredContent as { format: string }).format, 'detailed');
    action = 'decline';
    const declined = await client.callTool({ name: 'prepare_report', arguments: { topic: 'MCP' } });
    assert.equal(declined.isError, true);
    assert.equal(
      (declined.structuredContent as { errorCode: string }).errorCode,
      'ELICITATION_DECLINED',
    );
    const events = (await readFile(auditFile, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      events
        .filter((event) => event.event === 'elicitation-response')
        .map((event) => event.value.action),
      ['accept', 'decline'],
    );
  } finally {
    await client.close();
    await transport.close();
  }
});
