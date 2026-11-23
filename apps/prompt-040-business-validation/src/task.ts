import type { Invoice } from './schema.js';

export const reference = {
  invoiceId: 'COURSE-040',
  currency: 'EUR',
  maxDiscountCents: 500,
  order: [
    { sku: 'SDK-LAB', quantity: 2 },
    { sku: 'VIDEO-LAB', quantity: 1 },
  ],
  catalog: { 'SDK-LAB': 1500, 'VIDEO-LAB': 1000 } as Record<string, number>,
};
export function prepareInvoice(mode: unknown) {
  if (typeof mode !== 'string' || !['correct', 'wrong-price', 'wrong-total'].includes(mode))
    throw new Error('INVALID_MODE · Select an invoice scenario.');
  const unitPrice = mode === 'wrong-price' ? 900 : 1500;
  const subtotal = 2 * unitPrice + 1000;
  const supplied: Invoice = {
    invoiceId: 'COURSE-040',
    currency: 'EUR',
    items: [
      { sku: 'SDK-LAB', quantity: 2, unitPriceCents: unitPrice, lineTotalCents: unitPrice * 2 },
      { sku: 'VIDEO-LAB', quantity: 1, unitPriceCents: 1000, lineTotalCents: 1000 },
    ],
    subtotalCents: subtotal,
    discountCents: 0,
    totalCents: mode === 'wrong-total' ? subtotal + 500 : subtotal,
  };
  const sourceText =
    'Extract this classroom invoice exactly as supplied, preserving every integer amount without correcting it. All amounts are integer cents.\n' +
    JSON.stringify(supplied, null, 2);
  return { mode, supplied, sourceText, reference };
}
