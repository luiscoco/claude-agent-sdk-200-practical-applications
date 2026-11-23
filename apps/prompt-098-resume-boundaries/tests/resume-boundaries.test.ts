import test from 'node:test';
import assert from 'node:assert/strict';
import { runBoundary } from '../src/agent.js';
test('Actual resume boundaries retain exact selected prefixes while a full fork keeps all original contexts', async () => {
  for (const [mode, expected] of [
    ['first', [true, false, false]],
    ['second', [true, true, false]],
    ['full', [true, true, true]],
  ] as const) {
    const report = await runBoundary({ mode, topic: 'MCP' });
    assert.equal(report.verified, true, JSON.stringify(report.checks));
    assert.deepEqual(report.output.actualMarkerPresence, expected);
    assert.equal(report.output.hostFileRemainsAtLatestState, true);
    assert.notEqual(report.sourceSessionId, report.fork.actualSessionId);
  }
});
