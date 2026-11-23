import 'dotenv/config';
import { runQueue } from './agent.js';
try {
  const report = await runQueue(process.argv[2] || 'rapid');
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified || report.error) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Queue experiment failed.');
  process.exitCode = 1;
}
