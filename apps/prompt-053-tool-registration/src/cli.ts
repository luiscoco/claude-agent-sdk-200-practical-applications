import 'dotenv/config';
import { runRegistration } from './agent.js';

const [sku = 'MIC-101', registration = 'complete'] = process.argv.slice(2);
try {
  const report = await runRegistration({ sku, registration });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Registration experiment failed.');
  process.exitCode = 1;
}
