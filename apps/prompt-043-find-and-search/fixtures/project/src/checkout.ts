import { validateDiscount } from './pricing.js';
export function checkout(prices: number[], discountCents: number) {
  const subtotalCents = prices.reduce((sum, price) => sum + price, 0);
  validateDiscount(discountCents, subtotalCents);
  return subtotalCents - discountCents;
}
