// Classroom policy fixture. All amounts are integer euro cents (EUR).
export const MAX_DISCOUNT_CENTS = 500;

export function validateDiscount(discountCents: number, subtotalCents: number) {
  if (!Number.isSafeInteger(discountCents) || discountCents < 0)
    throw new Error('DISCOUNT_INVALID');
  if (discountCents > MAX_DISCOUNT_CENTS) throw new Error('DISCOUNT_LIMIT_' + MAX_DISCOUNT_CENTS);
  if (discountCents > subtotalCents) throw new Error('DISCOUNT_EXCEEDS_SUBTOTAL');
  return { accepted: true, appliedDiscountCents: discountCents, limitCents: MAX_DISCOUNT_CENTS };
}

// Unrelated display behavior remains part of the precise-edit verification.
export function formatLessonTitle(title: string) {
  return title.trim().toUpperCase();
}
// Author: Luis Coco Enríquez
