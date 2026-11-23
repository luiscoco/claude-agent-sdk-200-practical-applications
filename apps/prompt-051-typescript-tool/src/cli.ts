import 'dotenv/config';
import { runCalculator } from './agent.js';
const report = await runCalculator({
  operation: process.argv[2] || 'add',
  left: Number(process.argv[3] ?? 24),
  right: Number(process.argv[4] ?? 18),
});
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
