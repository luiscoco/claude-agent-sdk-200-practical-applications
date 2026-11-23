import 'dotenv/config';
import { runHandling } from './agent.js';
try {
  const report = await runHandling({
    mode: process.argv[2] || 'default-allow',
    topic: process.argv[3] || 'MCP',
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : 'Permission-mode experiment failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
}
