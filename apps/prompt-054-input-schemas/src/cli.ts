import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { runOrder } from './agent.js';
import { defaultInput } from './order.js';

try {
  const input = process.argv[2]
    ? JSON.parse(await readFile(process.argv[2], 'utf8'))
    : defaultInput;
  const report = await runOrder(input);
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Nested-input experiment failed.');
  process.exitCode = 1;
}
