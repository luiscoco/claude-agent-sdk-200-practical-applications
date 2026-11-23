import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customInstructions, profileOptions} from '../src/profiles.js';

test('minimal mode omits the systemPrompt option', () => {
  assert.equal(Object.hasOwn(profileOptions('minimal'), 'systemPrompt'), false);
});

test('preset and custom modes preserve the SDK representations', () => {
  assert.deepEqual(profileOptions('preset'), {
    systemPrompt: {type: 'preset', preset: 'claude_code'}
  });
  assert.equal(profileOptions('custom').systemPrompt, customInstructions);
});

test('unsupported profiles are rejected before query starts', () => {
  assert.throws(() => profileOptions('unknown'), /INVALID_PROFILE/);
});
