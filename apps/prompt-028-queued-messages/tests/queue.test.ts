import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareItems,
  validateItems,
  verifyAnswers,
  verifyOrder,
  type QueueResult,
} from '../src/items.js';
import { runQueue } from '../src/agent.js';

test('new queue item IDs stay unique and native result groups preserve observed order', () => {
  const items = prepareItems();
  validateItems(items);
  const result: QueueResult = {
    sequence: 1,
    coveredIds: items.map((item) => item.id),
    answer: 'A=2\nB=4\nC=6',
    subtype: 'success',
    isError: false,
    sessionId: 'same-session',
  };
  assert.equal(
    verifyOrder(
      items,
      items.map((item) => item.id),
      [result],
    ),
    true,
  );
  assert.equal(verifyAnswers(items, [result]), true);
  assert.equal(verifyOrder(items, items.map((item) => item.id).reverse(), [result]), false);
  assert.equal(
    verifyOrder(
      items,
      items.map((item) => item.id),
      [{ ...result, coveredIds: result.coveredIds.slice(1) }],
    ),
    false,
  );
  assert.throws(() => validateItems(prepareItems(true)), /DUPLICATE_MESSAGE_ID/);
});
test('input mode validation rejects coerced array values before creating a query', async () => {
  await assert.rejects(() => runQueue(['rapid']), /INVALID_MODE/);
  await assert.rejects(() => runQueue(null), /INVALID_MODE/);
});
