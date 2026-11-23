import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createWorkspace, runTests, testCounts, validateStyle} from '../src/workspace.js';

test('a fresh fixture fails and the independent verifier accepts numeric addition', async () => {
  const {workspace} = await createWorkspace();
  const baseline = await runTests(workspace);
  assert.equal(baseline.exitCode, 1, baseline.stdout+baseline.stderr);
  assert.equal(baseline.counts.failed, 3);
  await writeFile(path.join(workspace, 'src/calculator.mjs'), 'export function add(left, right) { return left + right; }\n');
  const fixed = await runTests(workspace);
  assert.equal(fixed.exitCode, 0);
  assert.equal(fixed.counts.passed, 3);
});

test('style validation and TAP counts use the expected representations', () => {
  assert.equal(validateStyle('teaching-report'), 'teaching-report');
  assert.equal(validateStyle('default'), 'default');
  assert.throws(() => validateStyle('unknown'), /INVALID_STYLE/);
  assert.deepEqual(testCounts('# tests 3\n# pass 3\n# fail 0\n'), {total:3, passed:3, failed:0});
});
