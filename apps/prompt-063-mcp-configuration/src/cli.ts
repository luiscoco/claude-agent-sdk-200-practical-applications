import 'dotenv/config';
import { runConfiguration } from './agent.js';
try {
  const report = await runConfiguration({
    mode: process.argv[2] || 'strict',
    slug: process.argv[3] || 'local-mcp',
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local MCP experiment failed.');
  process.exitCode = 1;
}
