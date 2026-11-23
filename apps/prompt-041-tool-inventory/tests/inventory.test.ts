import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capabilityReport, configuredTools, requireTool } from '../src/inventory.js';
test('capability report derives only from the actual supplied inventory', () => {
  assert.deepEqual(capabilityReport([]), []);
  assert.equal(capabilityReport(['Read'])[0].name, 'Read');
  assert.deepEqual(configuredTools('none'), []);
  assert.deepEqual(configuredTools('scoped'), ['Read', 'Glob', 'Grep']);
  assert.throws(() => configuredTools(['scoped']), /INVALID_MODE/);
});
test('selection requires a present native tool', () => {
  assert.equal(requireTool(['Read'], 'Read'), 'Read');
  assert.throws(() => requireTool([], 'Read'), /TOOL_UNAVAILABLE/);
  assert.equal(
    capabilityReport(['FutureTool'])[0].capability,
    'Available tool reported by native initialization',
  );
});
