import 'dotenv/config';
import { runRecovery } from './agent.js';
try {
  const report = await runRecovery({
    mode: process.argv[2] || 'disconnected',
    pageSize: Number(process.argv[3] || 5),
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : 'MCP recovery failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
}
