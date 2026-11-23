import {readFile} from 'node:fs/promises';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '..');
export const inventoryFile = path.join(root, 'fixtures/inventory.json');
export const maximumProposal = 20;
export const domainPolicy = [
  'Classroom inventory recommendation policy.',
  `Limit the proposed quantity to at most ${maximumProposal} units per product.`,
  'Keep needed as the uncapped calculated requirement.',
  'Include every input SKU, including zero-quantity recommendations.'
].join(' ');

export type Product = {sku:string; stock:number; reorderPoint:number; target:number};
export type Recommendation = {sku:string; needed:number; proposed:number};

export function validateInventory(raw: unknown): Product[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) {
    throw new Error('INVALID_INVENTORY · Supply between 1 and 20 products.');
  }
  const names = new Set<string>();
  for (const product of raw) {
    if (!product || typeof product.sku !== 'string' || !/^[A-Z0-9_-]{1,30}$/.test(product.sku) || names.has(product.sku)) {
      throw new Error('INVALID_INVENTORY · Each product needs a unique uppercase SKU.');
    }
    names.add(product.sku);
    for (const key of ['stock', 'reorderPoint', 'target']) {
      if (!Number.isSafeInteger(product[key]) || product[key] < 0) {
        throw new Error('INVALID_INVENTORY · Stock, reorderPoint and target must be nonnegative safe integers.');
      }
    }
  }
  return raw;
}

export async function loadInventory() {
  return validateInventory(JSON.parse(await readFile(inventoryFile, 'utf8')));
}

export function expectedRecommendations(products: Product[], extend: boolean): Recommendation[] {
  return products.map(product => {
    const needed = product.stock < product.reorderPoint ? Math.max(0, product.target-product.stock) : 0;
    return {sku:product.sku, needed, proposed:extend ? Math.min(needed, maximumProposal) : needed};
  });
}

export function verifyRecommendations(actual: unknown, expected: Recommendation[]) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const rows = new Map(actual.map(row => [row?.sku, row]));
  return rows.size === expected.length && expected.every(value => {
    const row = rows.get(value.sku);
    return row?.needed === value.needed && row?.proposed === value.proposed;
  });
}
