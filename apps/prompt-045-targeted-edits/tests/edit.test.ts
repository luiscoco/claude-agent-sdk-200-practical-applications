import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { actualDiff, inspectSource, probePolicy, originalLine, editedLine } from '../src/source.js';
test('the exact one-line source edit produces a real diff and changed imported behavior', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'course-edit-045-'));
  const target = path.join(directory, 'pricing.ts');
  const beforePath = path.join(directory, 'before.ts');
  try {
    const baseline = await readFile(new URL('../fixtures/pricing.ts', import.meta.url), 'utf8');
    await writeFile(target, baseline);
    await writeFile(beforePath, baseline);
    const before = await inspectSource(target);
    const original = await probePolicy(target, before.sha256, 550);
    assert.equal(original.loaded, true);
    assert.equal(original.accepted, false);
    assert.equal(original.error, 'DISCOUNT_LIMIT_500');
    await writeFile(target, baseline.replace(originalLine, editedLine));
    const after = await inspectSource(target);
    const updated = await probePolicy(target, after.sha256, 550);
    assert.equal(updated.loaded, true);
    assert.equal(updated.accepted, true);
    assert.equal(updated.limitCents, 600);
    assert.equal(after.text.replace(editedLine, originalLine), before.text);
    const diff = await actualDiff(directory);
    assert.equal(diff.exitCode, 1);
    assert.equal(diff.error, '');
    assert.match(diff.stdout, /-export const MAX_DISCOUNT_CENTS = 500;/);
    assert.match(diff.stdout, /\+export const MAX_DISCOUNT_CENTS = 600;/);
    await writeFile(target, baseline);
    assert.equal((await actualDiff(directory)).exitCode, 0);
  } finally {
    await unlink(target).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await unlink(beforePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await rmdir(directory);
  }
});
