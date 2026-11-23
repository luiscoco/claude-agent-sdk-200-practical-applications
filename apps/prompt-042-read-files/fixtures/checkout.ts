export type LineItem = { sku: string; quantity: number; unitPriceCents: number };

// Classroom source fixture. All amounts are integer euro cents (EUR).
export function validateItem(item: LineItem) {
  if (!item.sku.trim()) throw new Error('A product code is required.');
  if (!Number.isSafeInteger(item.quantity) || item.quantity < 1)
    throw new Error('Quantity must be a positive integer.');
  if (!Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0)
    throw new Error('Unit price must be a nonnegative integer.');
}

export function validateDiscount(discountCents: number, subtotalCents: number) {
  if (!Number.isSafeInteger(discountCents) || discountCents < 0)
    throw new Error('Discount must be a nonnegative integer.');
  if (discountCents > 500) throw new Error('Classroom discount exceeds 500 cents.');
  if (discountCents > subtotalCents) throw new Error('Discount exceeds subtotal.');
}

export function calculateTotal(items: LineItem[], discountCents = 0) {
  if (!items.length) throw new Error('At least one item is required.');
  items.forEach(validateItem);
  const subtotalCents = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  if (!Number.isSafeInteger(subtotalCents))
    throw new Error('Subtotal exceeds the safe integer range.');
  validateDiscount(discountCents, subtotalCents);
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}

export const classroomExample = calculateTotal([
  { sku: 'SDK-LAB', quantity: 2, unitPriceCents: 1500 },
  { sku: 'VIDEO-LAB', quantity: 1, unitPriceCents: 1000 },
]);
// Verification marker: READ-042
