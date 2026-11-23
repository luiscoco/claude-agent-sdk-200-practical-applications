import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { MessageQueue } from '../src/queue.js';
import { approvedBackground, commandCapture } from '../src/command.js';
test('background permission requires the exact command, true background flag and bounded timeout', () => {
  const input = { command: 'approved', timeout: 60000, run_in_background: true };
  assert.equal(approvedBackground('Bash', input, 'approved'), true);
  for (const change of [
    { command: 'changed' },
    { timeout: 600000 },
    { run_in_background: false },
    { dangerouslyDisableSandbox: true },
  ])
    assert.equal(approvedBackground('Bash', { ...input, ...change }, 'approved'), false);
});
test('process observation requires a receipt matching the run nonce and preserves missing status', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'course-background-'));
  const before = await commandCapture(workspace, 'expected');
  assert.equal(before.processAlive, null);
  assert.equal(before.exitCode, null);
  await writeFile(
    path.join(workspace, 'receipt.json'),
    JSON.stringify({ pid: process.pid, nonce: 'expected' }),
  );
  assert.equal((await commandCapture(workspace, 'expected')).processAlive, true);
  assert.equal((await commandCapture(workspace, 'different')).processAlive, null);
});
test('ending an idle message queue unblocks its consumer', async () => {
  const queue = new MessageQueue();
  const stream = queue.messages();
  const pending = stream.next();
  queue.end();
  assert.deepEqual(await pending, { value: undefined, done: true });
  assert.throws(() => queue.push({} as never), /INPUT_CLOSED/);
});
