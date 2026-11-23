import 'dotenv/config';
import { runToolStream } from './agent.js';
try {
  const report = await runToolStream(process.argv[2] || 'normal', () => {});
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified || !report.success) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
