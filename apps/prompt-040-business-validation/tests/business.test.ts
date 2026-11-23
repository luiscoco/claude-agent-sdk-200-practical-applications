import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InvoiceSchema } from '../src/schema.js';
import { prepareInvoice } from '../src/task.js';
import { consumeInvoice, validateBusiness } from '../src/business.js';
test('schema-valid incorrect invoices fail independent business checks', () => {
  for (const mode of ['wrong-price', 'wrong-total']) {
    const invoice = InvoiceSchema.parse(prepareInvoice(mode).supplied);
    const result = validateBusiness(invoice);
    assert.equal(result.passed, false);
    assert.equal(
      result.failures.some(
        (item) => item.path === (mode === 'wrong-price' ? 'items.0.unitPriceCents' : 'totalCents'),
      ),
      true,
    );
  }
});
test('correct invoice passes catalog, arithmetic and policy checks', () => {
  const invoice = InvoiceSchema.parse(prepareInvoice('correct').supplied);
  assert.equal(validateBusiness(invoice).passed, true);
  assert.equal(consumeInvoice(invoice).approvedTotalCents, 4000);
  const excessiveDiscount = { ...invoice, discountCents: 600, totalCents: 3400 };
  assert.equal(
    validateBusiness(excessiveDiscount).failures.some(
      (item) => item.path === 'discountWithinPolicy',
    ),
    true,
  );
  const inventedSku = {
    ...invoice,
    items: [{ ...invoice.items[0], sku: 'UNKNOWN' }, invoice.items[1]],
  };
  assert.equal(validateBusiness(inventedSku).passed, false);
});
