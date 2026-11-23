import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePrompt,examples} from '../src/prompt.js';
test('the first query accepts a question and rejects empty or oversized input', () => {
  assert.equal(validatePrompt('  '+examples.arithmetic.prompt+'  '),examples.arithmetic.prompt);
  for (const value of ['', '   ', undefined, 42]) assert.throws(() => validatePrompt(value),/EMPTY_PROMPT/);
  assert.throws(() => validatePrompt('a'.repeat(2001)),/PROMPT_TOO_LONG/);
});
