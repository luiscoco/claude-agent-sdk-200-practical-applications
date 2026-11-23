import test from 'node:test';
import assert from 'node:assert/strict';
import { runOrganization } from '../src/agent.js';
test('Native title replacement and tag removal survive a new reader process without altering conversation messages', async () => {
  const replaced = await runOrganization({
    mode: 'replace',
    title: 'Hooks organization exercise',
    tag: 'review',
  });
  assert.equal(replaced.verified, true, JSON.stringify(replaced.checks));
  assert.equal(replaced.reloaded.after.customTitle, 'Hooks organization exercise');
  assert.equal(replaced.reloaded.after.tag, 'review');
  const cleared = await runOrganization({
    mode: 'clear',
    title: 'MCP organization exercise',
    tag: 'ready',
  });
  assert.equal(cleared.verified, true, JSON.stringify(cleared.checks));
  assert.equal(cleared.reloaded.after.tag ?? null, null);
  assert.equal(replaced.mutation.beforeMessageHash, cleared.mutation.beforeMessageHash);
  await assert.rejects(runOrganization({ mode: 'organize', title: '   ', tag: 'ready' }));
});
