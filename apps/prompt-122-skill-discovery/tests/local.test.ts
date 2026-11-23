import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { launch } from '../src/launch.js';
test('Prompt 122: actual local native feature checks', { timeout: 240000 }, async () => {
 const observed = await launch('local'); await mkdir('recordings', { recursive: true }); await writeFile('recordings/verification-local.json', JSON.stringify(observed, null, 2)); assert.equal(observed.verified, true, JSON.stringify(observed.checks));
});
