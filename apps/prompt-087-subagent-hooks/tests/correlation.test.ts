import test from 'node:test';
import assert from 'node:assert/strict';
import { correlated } from '../src/correlation.js';
test('Correlation rejects a foreign parent or another subagent task despite matching tool names', () => {
  const task = { task_id: 'actual-child', tool_use_id: 'actual-parent' };
  assert.equal(
    correlated(task, 'actual-parent', { parentId: 'actual-parent', agentId: 'actual-child' }),
    true,
  );
  assert.equal(
    correlated(task, 'actual-parent', { parentId: 'other-parent', agentId: 'actual-child' }),
    false,
  );
  assert.equal(
    correlated(task, 'actual-parent', { parentId: 'actual-parent', agentId: 'other-child' }),
    false,
  );
  assert.equal(
    correlated(task, 'other-parent', { parentId: 'actual-parent', agentId: 'actual-child' }),
    false,
  );
});
