export function calculateLessonTotal(prices: number[]) {
  return prices.reduce((total, price) => total + price, 0);
}
const example = calculateLessonTotal([15, 15, 10]); // 40
// Verification marker: INVENTORY-041
