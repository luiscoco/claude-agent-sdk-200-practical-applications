import { runRetention } from './agent.js';
try {
  const report = await runRetention({
    mode: process.argv[2] || 'dry-run',
    retentionHours: Number(process.argv[3] || 24),
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
