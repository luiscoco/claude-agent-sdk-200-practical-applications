export const MAX_DISCOUNT_CENTS = 500;

export function validateDiscount(discountCents: number, subtotalCents: number) {
  if (!Number.isSafeInteger(discountCents) || discountCents < 0)
    throw new Error('Discount must be a nonnegative integer.');
  if (discountCents > MAX_DISCOUNT_CENTS) throw new Error('Classroom discount exceeds policy.');
  if (discountCents > subtotalCents) throw new Error('Discount exceeds subtotal.');
}
