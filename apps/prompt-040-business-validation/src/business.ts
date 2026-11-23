import type { Invoice } from './schema.js';
import { reference } from './task.js';
export function validateBusiness(invoice: Invoice) {
  const checks: Array<{ path: string; passed: boolean; actual: unknown; expected: unknown }> = [];
  const check = (path: string, actual: unknown, expected: unknown) =>
    checks.push({ path, passed: actual === expected, actual, expected });
  check('invoiceId', invoice.invoiceId, reference.invoiceId);
  check('currency', invoice.currency, reference.currency);
  check('items.length', invoice.items.length, reference.order.length);
  invoice.items.forEach((item, index) => {
    const ordered = reference.order[index];
    check('items.' + index + '.sku', item.sku, ordered?.sku);
    check('items.' + index + '.quantity', item.quantity, ordered?.quantity);
    check('items.' + index + '.unitPriceCents', item.unitPriceCents, reference.catalog[item.sku]);
    check(
      'items.' + index + '.lineTotalCents',
      item.lineTotalCents,
      item.quantity * item.unitPriceCents,
    );
  });
  const calculatedSubtotal = invoice.items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  check('subtotalCents', invoice.subtotalCents, calculatedSubtotal);
  check('discountWithinPolicy', invoice.discountCents <= reference.maxDiscountCents, true);
  check('totalCents', invoice.totalCents, invoice.subtotalCents - invoice.discountCents);
  return {
    passed: checks.every((item) => item.passed),
    checks,
    failures: checks.filter((item) => !item.passed),
    calculatedSubtotal,
  };
}
export function consumeInvoice(invoice: Invoice) {
  return {
    invoiceId: invoice.invoiceId,
    currency: invoice.currency,
    approvedTotalCents: invoice.totalCents,
    amount: new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: invoice.currency,
    }).format(invoice.totalCents / 100),
    status: 'Approved for classroom checkout',
  };
}
