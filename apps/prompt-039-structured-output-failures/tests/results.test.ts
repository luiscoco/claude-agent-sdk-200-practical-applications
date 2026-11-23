import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { consumeCount, inspectResult } from '../src/results.js';
// Minimal unit fixtures exercise result branches. Recorded lessons use actual SDK runs.
function fixture(value: unknown) {
  return value as SDKResultMessage;
}
test('error, missing and invalid structured data never reach the consumer', () => {
  assert.equal(inspectResult(null).kind, 'no_result');
  const cases = [
    { subtype: 'error_max_structured_output_retries', errors: ['five rejected attempts'] },
    { subtype: 'error_max_turns', errors: ['turn limit'] },
    { subtype: 'success', is_error: true, result: 'API error', structured_output: { count: 2 } },
    { subtype: 'success', is_error: false, result: 'COUNT 2' },
    { subtype: 'success', is_error: false, result: '', structured_output: null },
    { subtype: 'success', is_error: false, result: '', structured_output: { count: '2' } },
  ];
  for (const value of cases) assert.equal(inspectResult(fixture(value)).data, null);
});
test('validated success supplies typed arithmetic', () => {
  const outcome = inspectResult(
    fixture({ subtype: 'success', is_error: false, result: '', structured_output: { count: 2 } }),
  );
  assert.equal(outcome.kind, 'ready');
  if (outcome.kind === 'ready')
    assert.deepEqual(consumeCount(outcome.data), { count: 2, countPlusOne: 3 });
});
