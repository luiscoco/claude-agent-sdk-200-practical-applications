import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actualSearch, sourceUrl, verifyFindings, validatedQuestion } from '../src/research.js';
const url = 'https://code.claude.com/docs/en/agent-sdk/structured-outputs';
const hits = [{ title: 'Explicit unit-test source fixture', url }];
test('source membership accepts an observed HTTPS URL and rejects fabricated and unsafe URLs', () => {
  const valid = {
    findings: [{ summary: 'Unit-test finding fixture.', sourceUrls: [url] }],
    note: 'Unit-test fixture.',
  };
  assert.equal(verifyFindings(valid, hits).valid, true);
  for (const changed of [
    'https://code.claude.com/docs/en/fabricated',
    'https://example.com/',
    'javascript:alert(1)',
    'https://user:password@code.claude.com/',
  ]) {
    const candidate = structuredClone(valid);
    candidate.findings[0].sourceUrls = [changed];
    assert.equal(verifyFindings(candidate, hits).valid, false);
    assert.equal(verifyFindings(candidate, hits).findings.length, 0);
  }
  assert.equal(sourceUrl('invalid URL'), null);
});
test('search projection preserves actual hit metadata across text commentary and partial records', () => {
  const search = actualSearch({
    query: 'fixture',
    durationSeconds: 1,
    results: [
      'text commentary',
      null,
      {
        tool_use_id: 'fixture-id',
        content: [{ title: 'Fixture', url, snippet: 'Fixture page text.' }, null],
      },
    ],
  });
  assert.deepEqual(search.hits, [{ title: 'Fixture', url }]);
  assert.equal(actualSearch(null).hits.length, 0);
});
test('structured findings and question validation reject malformed boundary values', () => {
  for (const value of [
    null,
    {},
    { findings: [{}], note: '' },
    { findings: [{ summary: 'x', sourceUrls: [] }], note: '' },
  ])
    assert.equal(verifyFindings(value, hits).valid, false);
  for (const value of ['', ' ', 'x'.repeat(201), null])
    assert.throws(() => validatedQuestion(value), /INVALID_QUESTION/);
  assert.equal(validatedQuestion('  classroom query  '), 'classroom query');
});
