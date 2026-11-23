import assert from 'node:assert/strict';
/** Minimal assertion bridge for the unmodified official Bun conformance cases. */
export function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => assert.strictEqual(actual, expected),
    toEqual: (expected: unknown) => assert.deepStrictEqual(actual, expected),
    toBeNull: () => assert.strictEqual(actual, null),
    not: { toContain: (expected: unknown) => assert.ok(!Array.isArray(actual) || !actual.includes(expected)) },
  };
}
