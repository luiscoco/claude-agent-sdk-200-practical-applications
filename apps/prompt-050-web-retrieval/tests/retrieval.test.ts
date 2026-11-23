import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedFetch,
  excerptObserved,
  fetchPrompt,
  observedFetch,
  pageUrl,
  validRetrieval,
} from '../src/retrieval.js';
test('retrieval permission requires the exact public source URL and processing prompt', () => {
  const input = { url: pageUrl, prompt: fetchPrompt };
  assert.equal(allowedFetch('WebFetch', input, 'fetch'), true);
  assert.equal(allowedFetch('WebFetch', input, 'blocked'), false);
  for (const changed of [
    { url: 'https://example.com/' },
    { prompt: 'changed task' },
    { offset: 10 },
  ])
    assert.equal(allowedFetch('WebFetch', { ...input, ...changed }, 'fetch'), false);
});
test('excerpt observation accepts a short actual source excerpt and rejects unobserved text', () => {
  assert.equal(
    excerptObserved(
      '"Classroom instruction example"',
      'Page data includes classroom instruction example.',
    ),
    true,
  );
  assert.equal(
    excerptObserved('invented excerpt', 'Page data includes a different example.'),
    false,
  );
  assert.equal(
    excerptObserved('one two three four five six', 'one two three four five six'),
    false,
  );
  assert.equal(excerptObserved('', 'page data'), false);
});
test('structured output and native observation boundaries preserve missing or malformed fields', () => {
  const output = {
    retrieved: true,
    title: 'Unit-test title fixture',
    summary: 'Unit-test summary fixture.',
    sourceUrl: pageUrl,
    instructionExcerpt: 'Classroom example',
    contentRole: 'source-data',
    note: 'Unit-test fixture.',
  };
  assert.equal(validRetrieval(output), true);
  assert.equal(validRetrieval({ ...output, sourceUrl: 'https://example.com/' }), false);
  assert.equal(validRetrieval({ ...output, contentRole: 'instruction' }), false);
  assert.equal(validRetrieval(null), false);
  assert.equal(observedFetch(null).code, null);
  assert.equal(
    observedFetch({ code: 200, result: 'Actual fixture result.' }).processedResult,
    'Actual fixture result.',
  );
});
