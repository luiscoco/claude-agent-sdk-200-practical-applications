import test from 'node:test';
import assert from 'node:assert/strict';
import { contextView } from '../src/context-view.js';
import { runContextUsage } from '../src/agent.js';
test('Largest used contributor excludes larger free capacity and reserved buffer', () => {
  const view = contextView({
    model: 'classroom-fixture',
    total_tokens: 50,
    raw_max_tokens: 1000,
    percentage: 5,
    categories: [
      { name: 'Messages', kind: 'used', tokens: 30 },
      { name: 'Tools', kind: 'used', tokens: 20 },
      { name: 'Reserve', kind: 'buffer', tokens: 100 },
      { name: 'Free', kind: 'free', tokens: 850 },
    ],
  });
  assert.equal(view.largestUsedContributor?.name, 'Messages');
  assert.equal(view.reservedTokens, 100);
  assert.equal(view.freeTokens, 850);
});
test('Actual local SDK context reports grow with owned transcript volume without model inference', async () => {
  const report = await runContextUsage({ mode: 'compare', topic: 'MCP' });
  assert.equal(
    report.verified,
    true,
    JSON.stringify(report.profiles.map((profile: any) => profile.checks)),
  );
  assert.equal(report.output.nativeAssistantModelTurns, 0);
  assert.equal(report.output.nativeModelCostUsd, 0);
  assert.ok(report.profiles[2].view.usedTokens > report.profiles[1].view.usedTokens);
});
