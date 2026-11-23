import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSections } from '../src/schema.js';
import { calculateTotal, classroomExample } from '../fixtures/checkout.js';
test('source section ranges must include the actual function declaration', async () => {
  const lines = (await readFile(new URL('../fixtures/checkout.ts', import.meta.url), 'utf8')).split(
    /\r?\n/,
  );
  const line = lines.findIndex((text) => text.includes('export function calculateTotal(')) + 1;
  const section = {
    name: 'calculateTotal',
    startLine: line,
    endLine: line + 6,
    explanation: 'Actual source section',
  };
  assert.equal(validateSections([section], lines, 'calculateTotal'), true);
  assert.equal(validateSections([{ ...section, startLine: 0 }], lines, 'calculateTotal'), false);
  assert.equal(
    validateSections([{ ...section, startLine: line + 1 }], lines, 'calculateTotal'),
    false,
  );
  assert.equal(
    validateSections([{ ...section, endLine: lines.length + 1 }], lines, 'calculateTotal'),
    false,
  );
});
test('classroom source executes and rejects invalid discount inputs', () => {
  assert.deepEqual(classroomExample, { subtotalCents: 4000, discountCents: 0, totalCents: 4000 });
  assert.throws(
    () => calculateTotal([{ sku: 'SDK', quantity: 1, unitPriceCents: 1000 }], 501),
    /500 cents/,
  );
  assert.throws(() => calculateTotal([], 0), /At least one/);
});
