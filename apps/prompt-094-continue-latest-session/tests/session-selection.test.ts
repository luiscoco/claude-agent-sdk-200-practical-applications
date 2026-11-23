import test from 'node:test';
import assert from 'node:assert/strict';
import { runSelection } from '../src/agent.js';
test('Native continue follows the latest shared-directory session while explicit resume selects the intended classroom user', async () => {
  const shared = await runSelection({ mode: 'shared', topic: 'MCP' });
  assert.equal(shared.verified, true, JSON.stringify(shared.checks));
  assert.equal(shared.output.implicitRoutesToUserA, false);
  assert.equal(shared.output.explicitRoutesToUserA, true);
  const isolated = await runSelection({ mode: 'isolated', topic: 'Hooks' });
  assert.equal(isolated.verified, true, JSON.stringify(isolated.checks));
  assert.equal(isolated.output.implicitRoutesToUserA, true);
  assert.equal(isolated.output.explicitRoutesToUserA, true);
});
