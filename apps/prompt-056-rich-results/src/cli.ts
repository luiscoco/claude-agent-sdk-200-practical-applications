import 'dotenv/config';
import { runPack } from './agent.js';
try {
  const report = await runPack({ pack: process.argv[2] || 'available' });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Resource experiment failed.');
  process.exitCode = 1;
}
