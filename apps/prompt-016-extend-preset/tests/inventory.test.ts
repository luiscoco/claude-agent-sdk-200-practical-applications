import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expectedRecommendations, validateInventory, verifyRecommendations} from '../src/inventory.js';

const products = [{sku:'NOTEBOOK', stock:3, reorderPoint:5, target:100}];
test('the independent verifier distinguishes appended purchase policy', () => {
  assert.deepEqual(expectedRecommendations(products, false), [{sku:'NOTEBOOK', needed:97, proposed:97}]);
  assert.deepEqual(expectedRecommendations(products, true), [{sku:'NOTEBOOK', needed:97, proposed:20}]);
});
test('stock at the reorder point and a target below stock produce zero need', () => {
  assert.equal(expectedRecommendations([{sku:'A', stock:5, reorderPoint:5, target:100}], true)[0].needed, 0);
  assert.equal(expectedRecommendations([{sku:'A', stock:5, reorderPoint:10, target:3}], true)[0].needed, 0);
});
test('inventory validation catches duplicate SKUs and invalid counts', () => {
  assert.throws(() => validateInventory([...products, ...products]), /INVALID_INVENTORY/);
  assert.throws(() => validateInventory([{...products[0], stock:-1}]), /INVALID_INVENTORY/);
});
test('verification rejects missing and duplicate recommendations', () => {
  const expected = expectedRecommendations(products, true);
  assert.equal(verifyRecommendations([], expected), false);
  assert.equal(verifyRecommendations(expected, expected), true);
  assert.equal(verifyRecommendations([{sku:'NOTEBOOK', needed:97, proposed:97}], expected), false);
  assert.equal(verifyRecommendations([expected[0], expected[0]], [...expected, {sku:'PENCIL', needed:10, proposed:10}]), false);
});
