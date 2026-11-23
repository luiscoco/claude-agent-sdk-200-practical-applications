import 'dotenv/config';
import { deferRun, resumeRun } from './agent.js';
try {
  const report =
    process.argv[2] === 'resume'
      ? await resumeRun(process.argv[3], process.argv[4] || 'approve')
      : await deferRun(process.argv[3] || 'MCP');
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : String(error);
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
}
