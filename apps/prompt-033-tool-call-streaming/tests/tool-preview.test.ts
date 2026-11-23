import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ToolPreview } from '../src/tool-preview.js';
import { validateMode } from '../src/agent.js';

test('argument fragments remain unparsed until the matching block completes', () => {
  const preview = new ToolPreview();
  preview.start('message', 1, 'tool', 'Write', {});
  preview.append('message', 1, '{"content":');
  assert.equal(preview.snapshot()[0].arguments, null);
  preview.append('message', 1, '"ready"}');
  assert.equal(preview.snapshot()[0].arguments, null);
  preview.complete('message', 1);
  assert.deepEqual(preview.snapshot()[0].arguments, { content: 'ready' });
  assert.equal(preview.snapshot()[0].state, 'complete');
});
test('cut streams stay incomplete and deliberate truncation reports an application parse error', () => {
  const cut = new ToolPreview();
  cut.start('message', 0, 'tool', 'Write', {});
  cut.append('message', 0, '{"content":');
  cut.markIncomplete('message');
  assert.equal(cut.snapshot()[0].state, 'incomplete');
  assert.equal(cut.snapshot()[0].arguments, null);
  const invalid = new ToolPreview(true);
  invalid.start('message', 0, 'tool', 'Write', {});
  invalid.append('message', 0, '{"content":"ready"}');
  invalid.complete('message', 0);
  assert.equal(invalid.snapshot()[0].state, 'invalid');
  assert.match(invalid.snapshot()[0].parseError, /JSON_PREVIEW_ERROR/);
  assert.throws(() => validateMode(['normal']), /INVALID_MODE/);
});
