import 'dotenv/config';
import { defaultQuestion, runImage } from './agent.js';
try {
  const report = await runImage(process.argv[2] || 'demo', null, defaultQuestion);
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
