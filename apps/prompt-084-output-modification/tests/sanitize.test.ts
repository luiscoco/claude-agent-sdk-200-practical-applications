import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeText, replaceReadContent } from '../src/sanitize.js';
test('Synthetic marker sanitization preserves useful text and the original Read response', () => {
  const original = {
    type: 'text',
    file: {
      filePath: '/owned/classroom.txt',
      content: 'MCP student-ab12@example.invalid CLASSROOM_TOKEN_AB12\n',
      numLines: 2,
      totalLines: 2,
      startLine: 1,
    },
  };
  const sanitized = sanitizeText(original.file.content);
  assert.equal(sanitized, 'MCP [REDACTED_EMAIL] [REDACTED_TOKEN]\n');
  const replaced = replaceReadContent(original, 'Topic only.\n');
  assert.equal(replaced.file.filePath, original.file.filePath);
  assert.equal(replaced.file.content, 'Topic only.\n');
  assert.equal(replaced.file.numLines, 2);
  assert.equal(original.file.content, 'MCP student-ab12@example.invalid CLASSROOM_TOKEN_AB12\n');
  assert.throws(() => replaceReadContent('plain string', 'x'));
});
