import { inspectRuntime } from './inspector.mjs';
try {
  const report = await inspectRuntime(process.argv[2] || '');
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
