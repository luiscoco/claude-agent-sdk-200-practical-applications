import test from 'node:test';
import assert from 'node:assert/strict';
import { runPersistence } from '../src/agent.js';
test('Actual TypeScript default and disabled persistence produce different native history while making zero assistant turns', async () => {
  const report = await runPersistence({ mode: 'typescript', topic: 'MCP' });
  assert.equal(
    report.verified,
    true,
    JSON.stringify(report.profiles.map((profile: any) => profile.checks)),
  );
  assert.equal(report.profiles[0].history.exactMarkerFoundByNativeReader, true);
  assert.equal(report.profiles[1].history.nativeMessages.length, 0);
  assert.equal(report.output.assistantTurns, 0);
  assert.equal(report.output.totalCostUsd, 0);
});
test(
  'Actual Python default and environment suppression produce the same persistence contrast without a first-class persist_session option',
  { skip: !process.env.PYTHON_PATH },
  async () => {
    const report = await runPersistence({ mode: 'python', topic: 'Hooks' });
    assert.equal(
      report.verified,
      true,
      JSON.stringify(report.profiles.map((profile: any) => profile.checks)),
    );
    assert.equal(
      report.profiles.every((profile: any) => !profile.firstClassPersistOption),
      true,
    );
    assert.equal(report.output.assistantTurns, 0);
    assert.equal(report.output.totalCostUsd, 0);
  },
);
