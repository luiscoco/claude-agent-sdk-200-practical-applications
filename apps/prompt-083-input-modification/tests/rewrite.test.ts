import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { rewriteWrite } from '../src/rewrite.js';

test('Selected argument rewriting preserves unrelated fields and the original object', () => {
  const workspace = path.resolve('owned-classroom');
  const original = {
    file_path: path.join(workspace, 'requested-note.txt'),
    content: 'Draft MCP classroom note.\n',
    unrelated: 'preserved',
  };
  const content = rewriteWrite(original, 'rewrite-content', workspace, 'MCP');
  assert.equal(content.file_path, original.file_path);
  assert.equal(content.content, 'Reviewed MCP classroom note.\n');
  const redirected = rewriteWrite(original, 'rewrite-path', workspace, 'MCP');
  assert.equal(redirected.content, original.content);
  assert.equal(redirected.file_path, path.join(workspace, 'rewritten-note.txt'));
  assert.equal(redirected.unrelated, 'preserved');
  assert.equal(original.content, 'Draft MCP classroom note.\n');
  assert.equal(original.file_path, path.join(workspace, 'requested-note.txt'));
});
