import 'dotenv/config';
import { runEditing } from './agent.js';
try {
  const report = await runEditing({
    mode: process.argv[2] || 'plan',
    topic: process.argv[3] || 'MCP',
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : 'Planning and editing experiment failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
}
