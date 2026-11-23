import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
export const originalLine = 'export const MAX_DISCOUNT_CENTS = 500;';
export const editedLine = 'export const MAX_DISCOUNT_CENTS = 600;';
export const staleLine = 'export const MAX_DISCOUNT_CENTS = 450;';
export async function inspectSource(file: string) {
  const bytes = await readFile(file);
  return {
    text: bytes.toString('utf8'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
export async function probePolicy(file: string, version: string, discountCents: number) {
  let policy: {
    MAX_DISCOUNT_CENTS: number;
    validateDiscount: (discount: number, subtotal: number) => unknown;
  };
  try {
    policy = await import(pathToFileURL(file).href + '?source=' + version);
  } catch (error) {
    return {
      loaded: false,
      limitCents: null,
      discountCents,
      accepted: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  try {
    return {
      loaded: true,
      limitCents: policy.MAX_DISCOUNT_CENTS,
      discountCents,
      accepted: true,
      result: policy.validateDiscount(discountCents, 1000),
      error: '',
    };
  } catch (error) {
    return {
      loaded: true,
      limitCents: policy.MAX_DISCOUNT_CENTS,
      discountCents,
      accepted: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
export async function actualDiff(workspace: string) {
  const args = [
    '--no-pager',
    'diff',
    '--no-index',
    '--no-ext-diff',
    '--color=never',
    '--',
    'before.ts',
    'pricing.ts',
  ];
  try {
    const result = await execute('git', args, {
      cwd: workspace,
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
    });
    return {
      command: ['git', ...args],
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
      error: '',
    };
  } catch (error) {
    const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string };
    return {
      command: ['git', ...args],
      exitCode: typeof failure.code === 'number' ? failure.code : null,
      stdout: failure.stdout || '',
      stderr: failure.stderr || '',
      error: failure.code === 1 ? '' : failure.message,
    };
  }
}
