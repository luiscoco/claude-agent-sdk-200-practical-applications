import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import type {SDKResultMessage} from '@anthropic-ai/claude-agent-sdk';
import {completionOutcome,exceptionOutcome} from '../src/outcome.js';

async function recordedResult(name: string): Promise<SDKResultMessage> {
  return JSON.parse(await readFile(new URL('../fixtures/results/'+name+'.json',import.meta.url),'utf8'));
}
test('observed SDK success, is_error, and error-subtype results retain a consistent application shape', async () => {
  const success = completionOutcome(await recordedResult('success'));
  const apiError = completionOutcome(await recordedResult('result-error'));
  const turnError = completionOutcome(await recordedResult('turn-limit'));
  const exception = exceptionOutcome(new Error('startup failure'));
  assert.equal(success.ok,true);
  assert.equal(apiError.category,'sdk-result-error');
  assert.equal(apiError.resultSubtype,'success');
  assert.equal(apiError.resultIsError,true);
  assert.equal(apiError.answer,null);
  assert.equal(turnError.resultSubtype,'error_max_turns');
  for (const value of [apiError,turnError,exception]) assert.deepEqual(Object.keys(value).sort(),Object.keys(success).sort());
});
test('exception normalization preserves Error and non-Error thrown values', () => {
  assert.equal(exceptionOutcome(new TypeError('bad option')).exceptionName,'TypeError');
  assert.equal(exceptionOutcome('failed').message,'failed');
  assert.equal(exceptionOutcome('failed').exceptionName,'ThrownValue');
});
