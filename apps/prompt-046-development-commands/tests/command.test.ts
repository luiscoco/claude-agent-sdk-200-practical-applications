import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { allowedBash, bashQuote, capturedFiles } from '../src/command.js';

test('Bash quoting preserves an apostrophe and Windows path separators', () => {
  assert.equal(bashQuote("C:\\teacher's course\\check.mjs"), "'C:/teacher'\\''s course/check.mjs'");
});
test('approval matches command, timeout and foreground execution', () => {
  const input = { command: 'approved', timeout: 1000, run_in_background: false };
  assert.equal(allowedBash('Bash', input, 'approved', 1000), true);
  for (const changed of [
    { command: 'other' },
    { timeout: 2000 },
    { run_in_background: true },
    { dangerouslyDisableSandbox: true },
  ])
    assert.equal(allowedBash('Bash', { ...input, ...changed }, 'approved', 1000), false);
  assert.equal(allowedBash('Read', input, 'approved', 1000), false);
});
test('missing command exit status remains null until actual shell receipt exists', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'course-command-'));
  const before = await capturedFiles(directory, 'expected');
  assert.equal(before.exitCode, null);
  assert.equal(before.receiptMatches, false);
  await writeFile(path.join(directory, 'exit-status.txt'), '7\n');
  await writeFile(
    path.join(directory, 'receipt.json'),
    JSON.stringify({ pid: 123, nonce: 'expected' }),
  );
  const after = await capturedFiles(directory, 'expected');
  assert.equal(after.exitCode, 7);
  assert.equal(after.receiptMatches, true);
  assert.equal((await capturedFiles(directory, 'other')).receiptMatches, false);
});
