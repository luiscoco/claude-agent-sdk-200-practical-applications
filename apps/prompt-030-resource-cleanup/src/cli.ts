import 'dotenv/config';
import { runCleanup } from './cleanup.js';

try {
  const selected = process.argv[2] || 'compare';
  const modes = selected === 'compare' ? ['success', 'cancel', 'exception'] : [selected];
  const reports = [];
  for (const mode of modes) reports.push(await runCleanup(mode));
  const report = { reports, verified: reports.every((item) => item.verified) };
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
