import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual, promisify } from 'node:util';
import { execFile } from 'node:child_process';
const execute = promisify(execFile);

export const pricingCellId = 'pricing-cell';
export const correctedSource = [
  'def calculate_total(prices_cents, discount_cents):',
  '    return sum(prices_cents) - discount_cents',
  '',
  'example_total_cents = calculate_total([1500, 2500, 500], 500)',
  '',
].join('\n');
type Cell = {
  id: string;
  cell_type: string;
  source: string | string[];
  metadata: unknown;
  [key: string]: unknown;
};
export type Notebook = {
  cells: Cell[];
  metadata: unknown;
  nbformat: number;
  nbformat_minor: number;
};
export const cellSource = (cell: Cell) =>
  Array.isArray(cell.source) ? cell.source.join('') : cell.source;
export async function inspectNotebook(file: string) {
  const bytes = await readFile(file);
  const notebook = JSON.parse(bytes.toString('utf8')) as Notebook;
  return {
    text: bytes.toString('utf8'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    notebook,
  };
}
export function verifyCells(before: Notebook, after: Notebook, mode: 'edit' | 'missing') {
  const targetBefore = before.cells.find((cell) => cell.id === pricingCellId);
  const targetAfter = after.cells.find((cell) => cell.id === pricingCellId);
  if (!targetBefore || !targetAfter)
    throw new Error('CLASSROOM_CELL_MISSING · Inspect the supplied notebook.');
  const otherCellsPreserved = isDeepStrictEqual(
    before.cells.filter((cell) => cell.id !== pricingCellId),
    after.cells.filter((cell) => cell.id !== pricingCellId),
  );
  const notebookMetadataPreserved =
    isDeepStrictEqual(before.metadata, after.metadata) &&
    before.nbformat === after.nbformat &&
    before.nbformat_minor === after.nbformat_minor;
  const { source: ignoredBefore, ...beforeFields } = targetBefore;
  const { source: ignoredAfter, ...afterFields } = targetAfter;
  const targetMetadataPreserved = isDeepStrictEqual(beforeFields, afterFields);
  const cellOrderPreserved = isDeepStrictEqual(
    before.cells.map((cell) => cell.id),
    after.cells.map((cell) => cell.id),
  );
  const expectedSource = mode === 'edit' ? correctedSource : cellSource(targetBefore);
  const exactCellSource = cellSource(targetAfter) === expectedSource;
  return {
    otherCellsPreserved,
    notebookMetadataPreserved,
    targetMetadataPreserved,
    cellOrderPreserved,
    exactCellSource,
    verified:
      otherCellsPreserved &&
      notebookMetadataPreserved &&
      targetMetadataPreserved &&
      cellOrderPreserved &&
      exactCellSource,
  };
}
export async function executePricingCell(root: string, file: string) {
  const python = process.env.PYTHON_PATH || 'python';
  try {
    const result = await execute(
      python,
      ['-I', path.join(root, 'fixtures/verify-notebook.py'), file],
      { windowsHide: true, timeout: 5000, encoding: 'utf8', maxBuffer: 1024 * 1024 },
    );
    return {
      executed: true,
      result: JSON.parse(result.stdout),
      stdout: result.stdout,
      stderr: result.stderr,
      error: '',
    };
  } catch (failure) {
    return {
      executed: false,
      result: null,
      stdout: '',
      stderr: '',
      error: failure instanceof Error ? failure.message : String(failure),
    };
  }
}
