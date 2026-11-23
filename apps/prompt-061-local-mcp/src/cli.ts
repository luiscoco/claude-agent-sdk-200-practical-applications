import 'dotenv/config';
import { runLocalMcp } from './agent.js';
try {
  const report = await runLocalMcp({ slug: process.argv[2] || 'local-mcp' });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local MCP experiment failed.');
  process.exitCode = 1;
}
