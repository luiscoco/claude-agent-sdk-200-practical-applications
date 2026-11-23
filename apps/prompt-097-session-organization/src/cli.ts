import { runOrganization } from './agent.js';
try {
  const report = await runOrganization({
    mode: process.argv[2] || 'organize',
    title: process.argv[3] || 'MCP classroom review',
    tag: process.argv[4] || 'ready',
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
