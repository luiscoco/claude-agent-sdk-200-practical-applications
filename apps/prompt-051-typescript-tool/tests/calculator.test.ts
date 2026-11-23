import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, calculatorInput, nativeOutcome, sameCalculation } from '../src/calculator.js';
test('all four typed operations return their actual arithmetic outcomes', () => {
  assert.equal(calculate({ operation: 'add', left: 24, right: 18 }).result, 42);
  assert.equal(calculate({ operation: 'subtract', left: 24, right: 18 }).result, 6);
  assert.equal(calculate({ operation: 'multiply', left: 6, right: 7 }).result, 42);
  assert.equal(calculate({ operation: 'divide', left: 42, right: 7 }).result, 6);
});
test('division by zero, overflow and JSON negative zero remain consistent', () => {
  assert.equal(
    calculate({ operation: 'divide', left: 24, right: 0 }).errorCode,
    'DIVISION_BY_ZERO',
  );
  assert.equal(
    calculate({ operation: 'divide', left: 1000000, right: Number.MIN_VALUE }).errorCode,
    'NON_FINITE_RESULT',
  );
  const zero = calculate({ operation: 'multiply', left: -1, right: 0 });
  assert.equal(Object.is(zero.result, -0), false);
  assert.deepEqual(nativeOutcome(JSON.stringify(zero)), zero);
});
test('typed input and native output boundaries reject unsupported values', () => {
  for (const input of [
    { operation: 'eval', left: 1, right: 2 },
    { operation: 'add', left: '1', right: 2 },
    { operation: 'add', left: 1000001, right: 2 },
    { operation: 'add', left: NaN, right: 2 },
  ])
    assert.equal(calculatorInput.safeParse(input).success, false);
  assert.equal(nativeOutcome('plain native error'), null);
  assert.deepEqual(
    nativeOutcome([{ type: 'text', text: '{"ok":true,"result":42,"errorCode":""}' }]),
    { ok: true, result: 42, errorCode: '' },
  );
});

test('signed zero input remains equivalent across JSON serialization', () => {
  assert.equal(
    sameCalculation(
      { operation: 'multiply', left: -0, right: 1 },
      { operation: 'multiply', left: 0, right: 1 },
    ),
    true,
  );
});
