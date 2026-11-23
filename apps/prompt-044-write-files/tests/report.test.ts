import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { expectedContent, inspectReport, sha256 } from '../src/report.js';
test('report inspection distinguishes absent files and exact content with a hash', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'course-write-044-'));
  const target = path.join(directory, 'report.md');
  try {
    assert.equal((await inspectReport(target)).exists, false);
    await writeFile(target, expectedContent, 'utf8');
    const actual = await inspectReport(target);
    assert.equal(actual.content, expectedContent);
    assert.equal(actual.sha256, sha256(expectedContent));
    assert.equal(actual.bytes, Buffer.byteLength(expectedContent));
  } finally {
    await unlink(target).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await rmdir(directory);
  }
});
