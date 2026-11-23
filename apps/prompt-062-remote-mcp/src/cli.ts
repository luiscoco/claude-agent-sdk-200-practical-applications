import 'dotenv/config';
import { runRemoteMcp } from './agent.js';
try {
  const report = await runRemoteMcp({
    mode: process.argv[2] || 'connected',
    query: process.argv.slice(3).join(' ') || 'Agent SDK MCP stdio configuration',
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Remote MCP failed.');
  process.exitCode = 1;
}
