import path from 'node:path';
import { readFile } from 'node:fs/promises';
export function bashQuote(value: string) {
  return "'" + value.replaceAll('\\', '/').replaceAll("'", "'\\''") + "'";
}
export function backgroundCommand(root: string, workspace: string, mode: string, nonce: string) {
  const invocation = [
    process.execPath,
    path.join(root, 'fixtures/background-check.mjs'),
    mode,
    path.join(workspace, 'receipt.json'),
    nonce,
  ]
    .map(bashQuote)
    .join(' ');
  return [
    'set +e',
    `${invocation} >${bashQuote(path.join(workspace, 'stdout.txt'))} 2>${bashQuote(path.join(workspace, 'stderr.txt'))}`,
    'course_exit=$?',
    `printf '%s\\n' "$course_exit" >${bashQuote(path.join(workspace, 'exit-status.txt'))}`,
    `cat ${bashQuote(path.join(workspace, 'stdout.txt'))}`,
    `cat ${bashQuote(path.join(workspace, 'stderr.txt'))} >&2`,
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
export async function commandCapture(workspace: string, nonce: string) {
  const [stdout, stderr, statusText, receiptText] = await Promise.all(
    ['stdout.txt', 'stderr.txt', 'exit-status.txt', 'receipt.json'].map((file) =>
      optionalText(path.join(workspace, file)),
    ),
  );
  const receipt = receiptText === null ? null : JSON.parse(receiptText);
  let processAlive: boolean | null = null;
  if (receipt?.nonce === nonce && Number.isSafeInteger(receipt.pid) && receipt.pid > 0) {
    try {
      process.kill(receipt.pid, 0);
      processAlive = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') processAlive = false;
      else throw error;
    }
  }
  const exitCode =
    statusText !== null && /^\d+\s*$/.test(statusText) ? Number(statusText.trim()) : null;
  return {
    stdout,
    stderr,
    receipt,
    receiptMatches: receipt?.nonce === nonce,
    processAlive,
    exitCode,
    statusText,
  };
}
export function approvedBackground(name: string, input: Record<string, unknown>, command: string) {
  return (
    name === 'Bash' &&
    input.command === command &&
    input.run_in_background === true &&
    input.timeout === 60000 &&
    input.dangerouslyDisableSandbox !== true
  );
}
