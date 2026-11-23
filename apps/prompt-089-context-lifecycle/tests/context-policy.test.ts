import test from 'node:test';
import assert from 'node:assert/strict';
import { modelMatches } from '../src/context-policy.js';
test('A dated native model identifier matches its requested model without accepting another family or arbitrary suffix', () => {
  assert.equal(modelMatches('claude-haiku-4-5-20251001', 'claude-haiku-4-5'), true);
  assert.equal(modelMatches('claude-haiku-4-5', 'claude-haiku-4-5'), true);
  assert.equal(modelMatches('claude-sonnet-4-6', 'claude-haiku-4-5'), false);
  assert.equal(modelMatches('claude-haiku-4-50', 'claude-haiku-4-5'), false);
  assert.equal(modelMatches('claude-haiku-4-5-unverified', 'claude-haiku-4-5'), false);
});
