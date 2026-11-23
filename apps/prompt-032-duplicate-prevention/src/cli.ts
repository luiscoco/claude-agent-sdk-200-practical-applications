import 'dotenv/config';
import { runRenderer } from './agent.js';
try {
  const report = await runRenderer(process.argv[2] || 'reconciled', () => {});
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified || !report.success) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
