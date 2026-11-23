import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSourceExcerpt, toolName } from '../src/remote.js';
const sourceUrl = 'https://code.claude.com/docs/en/agent-sdk/mcp#stdio-servers';
const sourceExcerpt = 'Local processes that communicate via stdin/stdout.';
const content = [
  {
    type: 'text',
    text: `Title: stdio servers\nLink: ${sourceUrl}\nPage: en/agent-sdk/mcp\nContent: ${sourceExcerpt}`,
  },
];
test('a verbatim excerpt matches its actual documentation result and URL', () => {
  assert.equal(matchesSourceExcerpt(content, { toolName, sourceExcerpt, sourceUrl }), true);
});
test('changed claims, unrelated URLs and metadata-only excerpts fail', () => {
  assert.equal(
    matchesSourceExcerpt(content, {
      toolName,
      sourceExcerpt: 'Remote processes communicate through local standard input.',
      sourceUrl,
    }),
    false,
  );
  assert.equal(
    matchesSourceExcerpt(content, {
      toolName,
      sourceExcerpt,
      sourceUrl: 'https://code.claude.com/docs/en/hooks',
    }),
    false,
  );
  assert.equal(
    matchesSourceExcerpt(content, {
      toolName,
      sourceExcerpt: 'Title: stdio servers Link: metadata text only',
      sourceUrl,
    }),
    false,
  );
  assert.equal(matchesSourceExcerpt(content, null), false);
});
