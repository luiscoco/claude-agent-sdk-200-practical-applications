import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { isWithinDirectory } from '../src/path-policy.js';

test('the path boundary admits children and rejects similarly named siblings and parent traversal', () => {
  const directory = path.resolve('fixtures/allowed');
  assert.equal(isWithinDirectory(directory, path.join(directory, 'note.txt')), true);
  assert.equal(isWithinDirectory(directory, path.join(directory, 'nested/note.txt')), true);
  assert.equal(
    isWithinDirectory(directory, path.resolve('fixtures/allowed-neighbor/note.txt')),
    false,
  );
  assert.equal(
    isWithinDirectory(directory, path.resolve(directory, '../restricted/note.txt')),
    false,
  );
});
