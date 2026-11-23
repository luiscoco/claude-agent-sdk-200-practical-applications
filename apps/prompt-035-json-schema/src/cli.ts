import 'dotenv/config';
import { runSchema } from './agent.js';
try {
  const report = await runSchema(process.argv[2] || 'valid', process.argv[3] || 'basics');
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
