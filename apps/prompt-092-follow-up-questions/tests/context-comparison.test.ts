import test from 'node:test';
import assert from 'node:assert/strict';
import { sameRequirements } from '../src/context-comparison.js';
test('Context comparison allows order changes but rejects duplicate or missing retained requirements', () => {
  assert.equal(
    sameRequirements(
      ['RECORD_EVIDENCE', 'OWNED_WORKSPACE'],
      ['OWNED_WORKSPACE', 'RECORD_EVIDENCE'],
    ),
    true,
  );
  assert.equal(
    sameRequirements(
      ['OWNED_WORKSPACE', 'OWNED_WORKSPACE'],
      ['OWNED_WORKSPACE', 'RECORD_EVIDENCE'],
    ),
    false,
  );
  assert.equal(
    sameRequirements(['OWNED_WORKSPACE'], ['OWNED_WORKSPACE', 'RECORD_EVIDENCE']),
    false,
  );
  assert.equal(
    sameRequirements(['OWNED_WORKSPACE', 'LIMIT_TURNS'], ['OWNED_WORKSPACE', 'RECORD_EVIDENCE']),
    false,
  );
});
