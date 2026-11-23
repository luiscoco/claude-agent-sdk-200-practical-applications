export function countAvailable(units: number[]) {
  return units.reduce((sum, quantity) => sum + quantity, 0);
}
