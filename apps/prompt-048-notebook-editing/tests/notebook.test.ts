import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyCells, correctedSource, cellSource, type Notebook } from '../src/notebook.js';
const before = JSON.parse(
  await readFile(new URL('../fixtures/checkout.ipynb', import.meta.url), 'utf8'),
) as Notebook;
test('verification accepts the native source array-to-string representation change', () => {
  const after = structuredClone(before);
  after.cells[1].source = correctedSource;
  assert.equal(verifyCells(before, after, 'edit').verified, true);
  assert.equal(cellSource(before.cells[1]), (before.cells[1].source as string[]).join(''));
  assert.equal(cellSource(after.cells[1]), correctedSource);
});
test('changed unrelated cells, cell metadata and order fail independent preservation', () => {
  const changed = structuredClone(before);
  changed.cells[1].source = correctedSource;
  changed.cells[2].source = 'Unexpected footer rewrite';
  assert.equal(verifyCells(before, changed, 'edit').otherCellsPreserved, false);
  changed.cells[2] = structuredClone(before.cells[2]);
  changed.cells[1].metadata = { changed: true };
  assert.equal(verifyCells(before, changed, 'edit').targetMetadataPreserved, false);
  changed.cells[1].metadata = structuredClone(before.cells[1].metadata);
  changed.cells.reverse();
  assert.equal(verifyCells(before, changed, 'edit').cellOrderPreserved, false);
});
test('missing-cell verification requires the original pricing source', () => {
  assert.equal(verifyCells(before, structuredClone(before), 'missing').verified, true);
  const changed = structuredClone(before);
  changed.cells[1].source = correctedSource;
  assert.equal(verifyCells(before, changed, 'missing').exactCellSource, false);
});
