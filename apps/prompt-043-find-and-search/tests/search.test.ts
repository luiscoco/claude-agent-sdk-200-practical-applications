import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareSearch, projectSnapshot, verifySearch, searchOutcome } from '../src/search.js';
test('independent fixture snapshot checks all actual files and matching lines', async () => {
  const directory = fileURLToPath(new URL('../fixtures/project', import.meta.url));
  const snapshot = await projectSnapshot(directory, prepareSearch('matches').pattern);
  const data = {
    files: snapshot.files.map((file) => file.name),
    matches: snapshot.matches,
    summary: 'Classroom match fixture',
    error: '',
  };
  assert.deepEqual(verifySearch(data, snapshot, directory), {
    filesMatched: true,
    matchesMatched: true,
  });
  assert.equal(verifySearch({ ...data, matches: [] }, snapshot, directory).matchesMatched, false);
  for (const represent of [
    (file: string) => 'fixtures/project/' + file,
    (file: string) => path.join(directory, file),
  ]) {
    const represented = {
      ...data,
      files: data.files.map(represent),
      matches: data.matches.map((match) => ({ ...match, file: represent(match.file) })),
    };
    assert.deepEqual(verifySearch(represented, snapshot, directory), {
      filesMatched: true,
      matchesMatched: true,
    });
  }

  assert.equal(
    verifySearch({ ...data, files: ['../outside.ts'] }, snapshot, directory).filesMatched,
    false,
  );
});
test('empty and malformed pattern scenarios remain distinct', async () => {
  const directory = fileURLToPath(new URL('../fixtures/project', import.meta.url));
  assert.equal(
    (await projectSnapshot(directory, prepareSearch('no-results').pattern)).matches.length,
    0,
  );
  assert.equal(prepareSearch('invalid-regex').pattern, '[');
  assert.throws(() => prepareSearch(['matches']), /INVALID_MODE/);
});

test('a recovered native argument error retains history and uses the final Grep result', () => {
  const calls = [
    { id: 'bad-argument', name: 'Grep' },
    { id: 'repaired-argument', name: 'Grep' },
  ];
  const results = [
    { toolUseId: 'bad-argument', isError: true },
    { toolUseId: 'repaired-argument', isError: false },
  ];
  assert.deepEqual(searchOutcome(calls, results), {
    searchCompleted: true,
    searchFailed: false,
    hadSearchError: true,
  });
  assert.equal(searchOutcome(calls.slice(0, 1), results).searchFailed, true);
  assert.equal(searchOutcome(calls, results.slice(0, 1)).searchCompleted, false);
});
