import 'dotenv/config';
import { runComplex } from './agent.js';
try {
  const report = await runComplex(process.argv[2] || 'with-optionals');
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
