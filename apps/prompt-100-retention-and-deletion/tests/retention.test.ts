import test from 'node:test';
import assert from 'node:assert/strict';
import { planRetention } from '../src/retention.js';
import { runRetention } from '../src/agent.js';
test('Retention honors cutoff boundary, protection, invalid times and owned catalog', () => {
  const plan = planRetention(
    [
      { sessionId: 'old', lastModified: 1000 },
      { sessionId: 'new', lastModified: 1001 },
      { sessionId: 'protected', lastModified: 1 },
      { sessionId: 'foreign', lastModified: 1 },
      { sessionId: 'invalid', lastModified: NaN },
    ],
    1000,
    new Set(['protected']),
    new Set(['old', 'new', 'protected', 'invalid']),
  );
  assert.deepEqual(
    plan.map((item) => item.reason),
    ['expired', 'recent', 'protected', 'outside-owned-catalog', 'invalid-timestamp'],
  );
  assert.deepEqual(
    plan.filter((item) => item.eligible).map((item) => item.sessionId),
    ['old'],
  );
});
test('Actual native deletion removes only expired copied transcript artifacts while independent application files remain', async () => {
  for (const mode of ['dry-run', 'delete-expired', 'protect']) {
    const report = await runRetention({ mode, retentionHours: 24 });
    assert.equal(report.verified, true, JSON.stringify(report.checks));
    assert.equal(report.output.deletedCount, mode === 'delete-expired' ? 1 : 0);
    assert.equal(report.reloaded.artifacts.applicationReference, true);
  }
  const longer = await runRetention({ mode: 'delete-expired', retentionHours: 72 });
  assert.equal(longer.verified, true, JSON.stringify(longer.checks));
  assert.equal(longer.output.deletedCount, 0);
});
