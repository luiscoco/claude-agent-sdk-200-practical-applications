import path from 'node:path';
import { readFile } from 'node:fs/promises';

export const commandModes = ['success', 'failure', 'timeout'] as const;
export type CommandMode = (typeof commandModes)[number];

export function bashQuote(value: string) {
  return "'" + value.replaceAll('\\', '/').replaceAll("'", "'\\''") + "'";
}

export function approvedCommand(root: string, workspace: string, mode: CommandMode, nonce: string) {
  const stdout = path.join(workspace, 'stdout.txt');
  const stderr = path.join(workspace, 'stderr.txt');
  const status = path.join(workspace, 'exit-status.txt');
  const receipt = path.join(workspace, 'receipt.json');
  const invocation = [
    process.execPath,
    path.join(root, 'fixtures/development-command.mjs'),
    mode,
    receipt,
    nonce,
  ]
    .map(bashQuote)
    .join(' ');
  return [
    'set +e',
    `${invocation} >${bashQuote(stdout)} 2>${bashQuote(stderr)}`,
    'course_exit=$?',
    `printf '%s\\n' "$course_exit" >${bashQuote(status)}`,
    `cat ${bashQuote(stdout)}`,
    `cat ${bashQuote(stderr)} >&2`,
    'exit "$course_exit"',
  ].join('\n');
}

async function optionalText(file: string) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function capturedFiles(workspace: string, nonce: string) {
  const [stdout, stderr, statusText, receiptText] = await Promise.all(
    ['stdout.txt', 'stderr.txt', 'exit-status.txt', 'receipt.json'].map((file) =>
      optionalText(path.join(workspace, file)),
    ),
  );
  const receipt = receiptText === null ? null : JSON.parse(receiptText);
  const exitCode =
    statusText !== null && /^\d+\s*$/.test(statusText) ? Number(statusText.trim()) : null;
  return {
    stdout,
    stderr,
    exitCode,
    statusText,
    receipt,
    receiptMatches: receipt?.nonce === nonce,
  };
}

export function allowedBash(
  name: string,
  input: Record<string, unknown>,
  command: string,
  timeout: number,
) {
  return (
    name === 'Bash' &&
    input.command === command &&
    input.timeout === timeout &&
    input.run_in_background !== true &&
    input.dangerouslyDisableSandbox !== true
  );
}
