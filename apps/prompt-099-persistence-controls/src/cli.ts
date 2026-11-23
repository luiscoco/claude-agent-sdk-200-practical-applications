import 'dotenv/config';
import { runPersistence } from './agent.js';
try {
  const report = await runPersistence({
    mode: process.argv[2] || 'typescript',
    topic: process.argv[3] || 'MCP',
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
