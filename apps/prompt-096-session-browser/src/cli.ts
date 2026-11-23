import { browseSessions } from './session-browser.js';
try {
  const report = await browseSessions({
    selection: process.argv[2] || 'switch',
    includeSystem: process.argv.includes('--system'),
    offset: Number(process.argv[3] || 0),
    pageSize: 2,
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
