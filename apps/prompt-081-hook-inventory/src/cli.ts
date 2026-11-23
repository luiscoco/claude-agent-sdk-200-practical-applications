import 'dotenv/config';
import { installedInventory } from './inventory.js';
import { runInventoryProbe } from './agent.js';
try {
  const report =
    process.argv[2] === 'probe'
      ? await runInventoryProbe({ topic: process.argv[3] || 'MCP' })
      : await installedInventory();
  console.log(JSON.stringify(report, null, 2));
  if ('verified' in report && !report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : String(error);
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
}
