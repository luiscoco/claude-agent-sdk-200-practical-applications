import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultInput, evaluateOrder, requestSchema } from '../src/order.js';

test('handler applies omitted nested defaults and preserves the raw input', () => {
  const input = structuredClone(defaultInput);
  const outcome = evaluateOrder(input);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.totalCents, 2890);
  assert.deepEqual(outcome.normalized?.options, { shipping: 'standard', giftWrap: false });
  assert.equal(outcome.normalized?.address.country, 'ES');
  assert.deepEqual(input, defaultInput);
});
test('individual omitted options receive their handler defaults', () => {
  const outcome = evaluateOrder({ ...defaultInput, options: { shipping: 'express' } });
  assert.equal(outcome.totalCents, 3290);
  assert.deepEqual(outcome.normalized?.options, { shipping: 'express', giftWrap: false });
});
test('shape-valid invalid quantities reach and fail the handler validation', () => {
  for (const quantity of [0, -1, 1.5, 21]) {
    const input = { ...defaultInput, items: [{ sku: 'CAB-202', quantity }] };
    assert.ok(requestSchema.safeParse(input).success);
    const outcome = evaluateOrder(input);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.totalCents, null);
    assert.equal(outcome.errorCode, 'INVALID_ARGUMENTS');
    assert.ok(outcome.issues.some((issue) => issue.startsWith('items.0.quantity')));
  }
});
test('postal code checks occur inside the handler and explicit options affect the quote', () => {
  const input = { ...defaultInput, address: { city: 'Madrid', postalCode: 'ABC' } };
  assert.ok(requestSchema.safeParse(input).success);
  assert.ok(evaluateOrder(input).issues.some((issue) => issue.startsWith('address.postalCode')));
  assert.equal(
    evaluateOrder({ ...defaultInput, options: { shipping: 'express', giftWrap: true } }).totalCents,
    3490,
  );
});
