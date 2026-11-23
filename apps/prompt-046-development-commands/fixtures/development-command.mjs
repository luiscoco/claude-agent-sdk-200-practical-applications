import fs from 'node:fs/promises';

const [mode, receiptFile, nonce] = process.argv.slice(2);
if (!['success', 'failure', 'timeout'].includes(mode) || !receiptFile || !nonce)
  throw new Error('Invalid classroom command arguments.');
await fs.writeFile(
  receiptFile,
  JSON.stringify({ pid: process.pid, nonce, mode, startedAt: new Date().toISOString() }),
);
console.log('CHECK_STARTED · classroom development command');
console.error('CHECK_DIAGNOSTIC · stderr is captured separately');
if (mode === 'timeout') {
  console.log('SLOW_CHECK · bounded six-second task');
  await new Promise((resolve) => setTimeout(resolve, 6000));
}
if (mode === 'failure') {
  console.error('CHECK_FAILED · deliberate classroom exit 7');
  process.exitCode = 7;
} else {
  console.log('CHECK_PASSED · approved development check completed');
}
