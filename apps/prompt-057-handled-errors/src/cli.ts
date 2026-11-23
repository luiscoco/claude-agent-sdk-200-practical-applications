import 'dotenv/config';
import { runHandledError } from './agent.js';
try {
  const report = await runHandledError({ scenario: process.argv[2] || 'success' });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Handled-error experiment failed.');
  process.exitCode = 1;
}
