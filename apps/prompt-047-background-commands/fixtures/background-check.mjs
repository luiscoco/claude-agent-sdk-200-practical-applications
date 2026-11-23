import fs from 'node:fs/promises';
const [selected, receiptFile, nonce] = process.argv.slice(2);
if (!['complete', 'cancel'].includes(selected) || !receiptFile || !nonce)
  throw new Error('Invalid background classroom arguments.');
const durationMs = selected === 'complete' ? 6000 : 20000;
await fs.writeFile(
  receiptFile + '.tmp',
  JSON.stringify({ pid: process.pid, nonce, durationMs, startedAt: new Date().toISOString() }),
);
await fs.rename(receiptFile + '.tmp', receiptFile);
console.log('BACKGROUND_STARTED · actual classroom process');
console.error('BACKGROUND_DIAGNOSTIC · actual stderr');
const started = Date.now();
let tick = 0;
while (Date.now() - started < durationMs) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(`BACKGROUND_TICK ${++tick}`);
}
console.log('BACKGROUND_COMPLETED · actual process reached its end');
