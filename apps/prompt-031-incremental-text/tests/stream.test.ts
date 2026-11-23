import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from '../src/stream.js';

test('stream input validation preserves valid text and rejects unsupported inputs', () => {
  assert.deepEqual(validateInput('incremental', '  Explain streaming  '), {
    mode: 'incremental',
    prompt: 'Explain streaming',
  });
  for (const mode of [null, ['incremental'], 'unknown'])
    assert.throws(() => validateInput(mode, 'text'), /INVALID_MODE/);
  for (const prompt of ['', '  ', null, 'x'.repeat(2001)])
    assert.throws(() => validateInput('complete', prompt), /INVALID_PROMPT/);
});
