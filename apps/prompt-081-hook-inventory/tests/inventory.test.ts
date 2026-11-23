import test from 'node:test';
import assert from 'node:assert/strict';
import { HOOK_EVENTS } from '@anthropic-ai/claude-agent-sdk';
import { installedInventory } from '../src/inventory.js';

test('every installed hook has a distinct practical use case without unmapped events', async () => {
  const inventory = await installedInventory();
  assert.deepEqual(inventory.hooks.map(hook => hook.name), [...HOOK_EVENTS]);
  assert.deepEqual(inventory.unmappedEvents, []);
  assert.equal(new Set(inventory.hooks.map(hook => hook.useCase)).size, inventory.count);
  assert.ok(inventory.hooks.every(hook => hook.when && hook.useCase && hook.useCase.length > 20));
  assert.match(inventory.sdkVersion, /^\d+\.\d+\.\d+/);
});
