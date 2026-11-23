import test from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../src/launch.js';
test('Prompt 110: actual local scenario passes its observed checks', { timeout: 240000 }, async () => {
 const result = await launch('local'); assert.equal(result.verified, true, JSON.stringify(result.checks));
});
