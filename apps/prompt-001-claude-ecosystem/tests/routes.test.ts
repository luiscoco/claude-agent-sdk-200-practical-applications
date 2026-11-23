import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRoute, readAnswer } from '../src/routes.js';
test('four classroom goals select their documented interfaces', () => {
  for (const id of ['embedded', 'terminal', 'api', 'managed']) assert.equal(chooseRoute(id).id, id);
  assert.throws(() => chooseRoute(['embedded']), /INVALID_ROUTE/);
});
test('client and agent response contracts handle their actual shapes', () => {
  const agent = { type: 'result', subtype: 'success', is_error: false, result: 'COMPASS-001' };
  const client = { type: 'message', content: [{ type: 'text', text: 'COMPASS-001' }] };
  assert.equal(readAnswer(agent, 'agent-result'), 'COMPASS-001');
  assert.equal(readAnswer(client, 'client-message'), 'COMPASS-001');
  assert.throws(() => readAnswer(agent, 'client-message'), /RESPONSE_SHAPE_MISMATCH/);
  assert.throws(
    () => readAnswer({ ...agent, is_error: true }, 'agent-result'),
    /RESPONSE_SHAPE_MISMATCH/,
  );
});
