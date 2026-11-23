import 'dotenv/config';
import { runPermissions } from './agent.js';
try {
  const report = await runPermissions({
    mode: process.argv[2] || 'individual',
    slug: process.argv[3] || 'local-mcp',
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : 'Permission experiment failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
}
