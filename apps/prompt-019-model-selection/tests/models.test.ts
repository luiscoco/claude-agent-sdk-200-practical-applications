import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultModel, missingModel, validateModel} from '../src/models.js';

test('model selection preserves explicit identifiers and aliases for runtime resolution', () => {
  for (const model of [defaultModel, missingModel, 'sonnet', 'sonnet[1m]']) assert.equal(validateModel(model), model);
  for (const value of ['', undefined, ['sonnet'], 'sonnet --help', '../secret']) assert.throws(() => validateModel(value), /INVALID_MODEL/);
});
