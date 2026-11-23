import 'dotenv/config';
import { runResources } from './agent.js';
try {
  const report = await runResources({ uri: process.argv[2] || 'course://lessons/agent-loop' });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : 'Resource experiment failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
}
